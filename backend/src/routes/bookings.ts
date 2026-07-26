import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query, run } from '../db';
import { sendAllNotifications, BookingNotificationData } from '../services/notifications';
import { tripInZone, haversineKm, PgConfig, Coords } from '../utils/geo';
import { geocodeAddress } from './maps';
import { findFixedRoute, getFixedPrice } from './fixed-routes';
import { getVisitorCoords, getClientIp } from '../utils/ipGeo';
import { isRateLimited, registerFailure, clearRateLimit } from '../utils/rateLimit';
import { parsePhone } from '../utils/phone';
import { enrichBookingLineType } from '../services/phoneLookup';
import { getCompanyAuth } from '../middleware/companyAuth';
import { variantString } from '../utils/experiments';
import { resolveAutoDiscount, countCustomerBookings } from '../services/autoDiscount';
import { roundPriceUp } from '../utils/price';
import { chargeSavedCard, createAnonymousSetupIntent, getPaymentMethodCardInfo, createBookingPaymentIntent, updateBookingPaymentIntentAmount, verifyBookingPaymentIntent } from '../services/stripeCards';

const ENCRYPT_KEY = (process.env.CARD_ENCRYPT_KEY || 'muc-taxi-card-secret-key-32chars!').slice(0, 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch { return '***'; }
}

export { decrypt };

const router = Router();

// Add visitor_id column to bookings if not exists
(async () => {
  try { await run(`ALTER TABLE bookings ADD COLUMN visitor_id VARCHAR(64) DEFAULT NULL`); } catch {}
})();

function generateBookingNumber(): string {
  // Server runs in UTC; use Berlin-local date parts so the number matches the
  // calendar day customers/admin see (raw local getters would misdate bookings
  // made 00:00–02:00 Berlin time, since UTC hasn't rolled over yet).
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MAT${map.year}${map.month}${map.day}-${random}`;
}

interface PriceRow {
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
  fahrrad_price: number;
  fahrrad_enabled: number;
  min_price: number;
  min_price_km: number;
}

// POST /api/bookings/card-setup-intent - creates an anonymous Stripe customer +
// SetupIntent for a regular (non-company) customer to tokenize their card client-side
// before the booking itself exists.
router.post('/card-setup-intent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email } = req.body;
    const result = await createAnonymousSetupIntent({ name, email });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create setup intent' });
  }
});

// POST /api/bookings/card-setup-confirm - read-only lookup of a just-confirmed payment
// method's non-sensitive display info (brand/last4), for the booking review screen.
// No persistence — the booking-creation endpoint independently re-verifies this via
// getPaymentMethodCardInfo before ever writing anything to the database.
router.post('/card-setup-confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { payment_method_id } = req.body;
    if (!payment_method_id) { res.status(400).json({ error: 'payment_method_id required' }); return; }
    const result = await getPaymentMethodCardInfo(payment_method_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid payment method' });
  }
});

// POST /api/bookings/payment-intent — create a PaymentIntent for online payment
// (Apple Pay, Link, Klarna etc. via PaymentElement).
router.post('/payment-intent', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount_eur, name, email } = req.body;
    if (!amount_eur || amount_eur <= 0) { res.status(400).json({ error: 'amount_eur required' }); return; }
    const result = await createBookingPaymentIntent({ amountEur: amount_eur, name, email });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
});

// PUT /api/bookings/payment-intent/:id — update amount when extras change
router.put('/payment-intent/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount_eur } = req.body;
    if (!amount_eur || amount_eur <= 0) { res.status(400).json({ error: 'amount_eur required' }); return; }
    await updateBookingPaymentIntentAmount(req.params.id, amount_eur);
    res.json({ updated: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update payment intent' });
  }
});

// POST /api/bookings - Create new booking
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      pickup_address,
      dropoff_address,
      pickup_datetime,
      vehicle_type,
      passengers,
      name,
      phone,
      email,
      flight_number,
      flight_validated,
      flight_info,
      pickup_sign,
      child_seat,
      luggage_count,
      notes,
      distance_km,
      duration_minutes,
      payment_method,
      language,
      stripe_customer_id,
      stripe_payment_method_id,
      child_seat_details,
      trip_type,
      return_datetime,
      fahrrad_count,
      anfahrt_cost,
      toll_amount,
      zwischenstopp_address,
      promo_code,
      visitor_id,
      session_id,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      cost_center,
      rechnung_required,
      rechnung_adresse,
      payment_intent_id,
    } = req.body;

    // Validation
    if (!pickup_address || !dropoff_address || !pickup_datetime || !vehicle_type || !passengers || !name || !phone || !email) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['kombi', 'van', 'grossraumtaxi'].includes(vehicle_type)) {
      res.status(400).json({ error: 'Invalid vehicle type' });
      return;
    }

    const companyAuth = getCompanyAuth(req);
    let companyData: any = null;
    if (companyAuth) {
      const [company] = await query('SELECT * FROM companies WHERE id = ? AND status = ?', [companyAuth.companyId, 'active']);
      if (!company) { res.status(403).json({ error: 'Company account is not active' }); return; }
      companyData = company;
      const allowed = (company.allowed_payment_methods || 'cash,card').split(',').map((m: string) => m.trim());
      const pm = payment_method || 'cash';
      if (!allowed.includes(pm)) {
        res.status(403).json({ error: 'Payment method not allowed for this account' });
        return;
      }
      if (pm === 'card' && !company.stripe_payment_method_id) {
        res.status(403).json({ error: 'Bitte zuerst eine Kreditkarte in den Einstellungen hinterlegen' });
        return;
      }
    } else {
      if (!['cash', 'card'].includes(payment_method || 'cash')) {
        res.status(400).json({ error: 'Invalid payment method' });
        return;
      }
      if (payment_method === 'rechnung') {
        res.status(400).json({ error: 'Invoice payment requires a company account' });
        return;
      }
    }

    // Get price from database
    const [priceRow] = await query<PriceRow>(
      'SELECT base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, min_price, min_price_km FROM prices WHERE vehicle_type = ?',
      [vehicle_type]
    );
    if (!priceRow) {
      res.status(400).json({ error: 'Vehicle type not found in prices' });
      return;
    }

    const km = parseFloat(distance_km) || 0;
    // §12 Abs. 2 Nr. 10 UStG: Personenbeförderung per Taxi ist bis 50 km ermäßigt (7%),
    // darüber regulär (19%). Bezugsgröße ist die einfache Beförderungsstrecke, nicht Hin+Rück.
    const steuersatz = km > 0 ? (km <= 50 ? 7 : 19) : null;
    const fahrradCount = priceRow.fahrrad_enabled ? (parseInt(fahrrad_count) || 0) : 0;
    const fahrradCost = fahrradCount * (priceRow.fahrrad_price || 0);
    const calculatedPrice = priceRow.base_price + (km * priceRow.price_per_km);
    const oneWayPrice = (priceRow.min_price > 0 && km <= (priceRow.min_price_km || 15))
      ? Math.max(calculatedPrice, priceRow.min_price)
      : calculatedPrice;
    const isRoundtrip = trip_type === 'roundtrip';

    // Validate promo code
    let promoDiscount = 0;
    let validatedPromoCode: string | null = null;
    let promoKombinierbar = false;
    if (promo_code) {
      const today = new Date().toISOString().split('T')[0];
      const [promo] = await query<any>(
        `SELECT * FROM promotions WHERE UPPER(code) = ? AND active = 1
         AND start_date <= ? AND end_date >= ?
         AND (max_uses IS NULL OR used_count < max_uses)`,
        [String(promo_code).toUpperCase(), today, today]
      );
      if (promo) {
        validatedPromoCode = promo.code;
        promoKombinierbar = !!promo.kombinierbar;
      }
    }

    // If promo is not combinable, skip roundtrip_discount
    const discount = (validatedPromoCode && !promoKombinierbar) ? 0 : (priceRow.roundtrip_discount || 0);
    let tripPrice = isRoundtrip
      ? oneWayPrice * 2 * (1 - discount / 100)
      : oneWayPrice;

    // Effective values shown in confirmation emails (overridden inside the zone)
    let effectiveOneWay = oneWayPrice;
    let effectiveRoundtripDiscount = priceRow.roundtrip_discount || 0;

    // --- Fixed-price routes (Festpreisrouten) — legally mandated, overrides all other pricing ---
    let fixedRouteApplied = false;
    try {
      const allRoutes = await query<any>('SELECT * FROM fixed_routes WHERE enabled = 1');
      const match = findFixedRoute(pickup_address, dropoff_address, allRoutes);
      if (match) {
        const fp = getFixedPrice(match, vehicle_type);
        if (fp > 0) {
          effectiveOneWay = fp;
          tripPrice = isRoundtrip ? fp * 2 * (1 - discount / 100) : fp;
          effectiveRoundtripDiscount = discount;
          fixedRouteApplied = true;
        }
      }
    } catch (e) {
      console.error('Fixed-route pricing skipped:', e);
    }

    // --- Pflichtfahrgebiet (mandatory tariff zone) — skipped if a fixed route already applied ---
    let pgFareFloor = 0;
    try {
      const [pgCfg] = await query<PgConfig>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
      if (pgCfg && pgCfg.enabled && !fixedRouteApplied) {
        let pickupCoords: Coords | null =
          (pickup_lat && pickup_lng) ? { lat: parseFloat(pickup_lat), lng: parseFloat(pickup_lng) } : null;
        let dropoffCoords: Coords | null =
          (dropoff_lat && dropoff_lng) ? { lat: parseFloat(dropoff_lat), lng: parseFloat(dropoff_lng) } : null;
        if (!pickupCoords) pickupCoords = await geocodeAddress(pickup_address);
        if (!dropoffCoords) dropoffCoords = await geocodeAddress(dropoff_address);

        let ipBypass = false;
        if (pgCfg.ip_bypass_enabled) {
          const vc = await getVisitorCoords(req);
          if (vc.lat != null && vc.lng != null) {
            ipBypass = haversineKm(vc.lat, vc.lng, pgCfg.betriebssitz_lat, pgCfg.betriebssitz_lng) > (pgCfg.ip_bypass_distance_km || 100);
          }
        }

        if (!ipBypass && km <= (pgCfg.radius_km || 50) && tripInZone(pickupCoords, dropoffCoords, pgCfg)) {
          const excludedRows = await query<{ plz: string }>('SELECT plz FROM pflichtgebiet_exclusions WHERE enabled = 1');
          const excludedSet = new Set(excludedRows.map(r => r.plz));
          const pPlz = pickup_address?.match(/\b(\d{5})\b/)?.[1];
          const dPlz = dropoff_address?.match(/\b(\d{5})\b/)?.[1];
          const isExcluded = (pPlz && excludedSet.has(pPlz)) || (dPlz && excludedSet.has(dPlz));

          if (!isExcluded) {
          const [tar] = await query<{ grundgebuehr: number; min_per_km: number }>(
            'SELECT grundgebuehr, min_per_km FROM pflichtgebiet_tarife WHERE vehicle_type = ?',
            [vehicle_type]
          );
          if (tar) {
            let mandatoryOneWay = tar.grundgebuehr + km * tar.min_per_km;
            // Mindestgebühr still applies inside the zone
            if (priceRow.min_price > 0 && km <= (priceRow.min_price_km || 15)) {
              mandatoryOneWay = Math.max(mandatoryOneWay, priceRow.min_price);
            }
            const effOneWay = pgCfg.mode === 'replace'
              ? mandatoryOneWay
              : Math.max(oneWayPrice, mandatoryOneWay); // floor
            // Roundtrip discount is optional inside the zone
            const pgDiscount = pgCfg.roundtrip_discount_enabled ? discount : 0;
            tripPrice = isRoundtrip ? effOneWay * 2 * (1 - pgDiscount / 100) : effOneWay;
            pgFareFloor = tripPrice; // promos may not undercut the mandatory fare
            effectiveOneWay = effOneWay;
            effectiveRoundtripDiscount = pgDiscount;
          }
          }
        }
      }
    } catch (e) {
      console.error('Pflichtgebiet pricing skipped:', e);
    }

    const parsedAnfahrtCost = anfahrt_cost ? parseFloat(anfahrt_cost) : 0;
    const parsedTollAmount = toll_amount ? parseFloat(toll_amount) : 0;

    let plzSurcharge = 0;
    const [plzSetting] = await query<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE setting_key = 'plz_surcharge_enabled'"
    );
    if (plzSetting?.setting_value === '1') {
      const plzMatch = pickup_address?.match(/\b(\d{5})\b/);
      if (plzMatch) {
        const [surchargeRow] = await query<{ surcharge: number }>(
          'SELECT surcharge FROM plz_surcharges WHERE plz = ?',
          [plzMatch[1]]
        );
        if (surchargeRow) plzSurcharge = surchargeRow.surcharge;
      }
    }

    const baseTotal = tripPrice + fahrradCost + parsedAnfahrtCost + parsedTollAmount + plzSurcharge;

    if (validatedPromoCode) {
      const [promo] = await query<any>('SELECT * FROM promotions WHERE code = ?', [validatedPromoCode]);
      if (promo) {
        if (promo.type === 'fixed') {
          promoDiscount = Math.min(parseFloat(promo.value), baseTotal);
        } else {
          promoDiscount = baseTotal * (parseFloat(promo.value) / 100);
        }
        promoDiscount = Math.round(promoDiscount * 100) / 100;
      }
    }

    let companyDiscount = 0;
    if (companyData && Number(companyData.discount_percent) > 0) {
      const corpPct = Number(companyData.discount_percent);
      if (isRoundtrip && !companyData.discount_kombinierbar) {
        tripPrice = isRoundtrip ? effectiveOneWay * 2 : effectiveOneWay;
        effectiveRoundtripDiscount = 0;
      }
      const preTotalForDiscount = tripPrice + fahrradCost + parsedAnfahrtCost + parsedTollAmount + plzSurcharge - promoDiscount;
      companyDiscount = Math.round(preTotalForDiscount * (corpPct / 100) * 100) / 100;
    }

    // --- Automatische Rabatte (Rabatte-Tab): kural bazlı, kod gerektirmez ---
    let autoDiscountAmount = 0;
    let autoDiscountId: number | null = null;
    let autoDiscountName: string | null = null;
    try {
      // Bölge tespiti: PG bloğundan bağımsız (enabled=0 olsa da) geometri hesaplanır.
      let adZone: 'inside' | 'outside' = 'outside';
      const [pgCfgAd] = await query<PgConfig>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
      if (pgCfgAd) {
        let pCoords: Coords | null =
          (pickup_lat && pickup_lng) ? { lat: parseFloat(pickup_lat), lng: parseFloat(pickup_lng) } : null;
        let dCoords: Coords | null =
          (dropoff_lat && dropoff_lng) ? { lat: parseFloat(dropoff_lat), lng: parseFloat(dropoff_lng) } : null;
        if (!pCoords) pCoords = await geocodeAddress(pickup_address);
        if (!dCoords) dCoords = await geocodeAddress(dropoff_address);
        if (km <= (pgCfgAd.radius_km || 50) && tripInZone(pCoords, dCoords, pgCfgAd)) {
          adZone = 'inside';
        }
      }

      const customerBookingCount = await countCustomerBookings({
        visitorId: visitor_id || null,
        email: email || null,
      });

      const adResult = await resolveAutoDiscount({
        km,
        zone: adZone,
        vehicleType: vehicle_type,
        isRoundtrip,
        pickupDateTime: pickup_datetime ? new Date(pickup_datetime) : null,
        customerBookingCount,
        baseTotal,
      });

      if (adResult) {
        // Promo koduyla birleşmiyorsa büyük olan kazanır
        if (validatedPromoCode && promoDiscount > 0 && !adResult.rule.stackable_with_promo) {
          if (adResult.amount > promoDiscount) {
            promoDiscount = 0;
            validatedPromoCode = null;
            autoDiscountAmount = adResult.amount;
            autoDiscountId = adResult.rule.id;
            autoDiscountName = adResult.rule.name;
          }
          // aksi halde promo kalır, otomatik indirim uygulanmaz
        } else {
          autoDiscountAmount = adResult.amount;
          autoDiscountId = adResult.rule.id;
          autoDiscountName = adResult.rule.name;
        }
      }
    } catch (e) {
      console.error('Auto discount skipped:', e);
    }

    let price = Math.max(0, Math.round((baseTotal - autoDiscountAmount - promoDiscount - companyDiscount) * 100) / 100);

    if (companyData && pgFareFloor > 0 && !companyData.pg_discount_override) {
      price = Math.max(price, Math.round(pgFareFloor * 100) / 100);
    } else if (pgFareFloor > 0 && !companyData) {
      price = Math.max(price, Math.round(pgFareFloor * 100) / 100);
    }

    // Letzter Schritt: auf 0,50 € aufrunden — identisch mit formatPrice() im Frontend,
    // damit der angezeigte und der abgerechnete/in Rechnung gestellte Betrag immer übereinstimmen.
    price = roundPriceUp(price);

    const booking_number = generateBookingNumber();

    // Regular (non-company) card bookings: the client already tokenized the card via
    // Stripe SetupIntent — verify the payment method server-side and store only the
    // Stripe references + non-sensitive card display info. No raw card data ever
    // reaches this endpoint.
    let cardInfo: { brand: string; last4: string; exp_month: number; exp_year: number } | null = null;
    if (!companyData && (payment_method || 'cash') === 'card' && stripe_payment_method_id) {
      try {
        cardInfo = await getPaymentMethodCardInfo(stripe_payment_method_id);
      } catch {
        res.status(400).json({ error: 'Invalid or expired payment method' });
        return;
      }
    }

    // Online payment (Apple Pay / Link / Klarna etc.) via PaymentElement — verify
    // the PaymentIntent succeeded before accepting the booking.
    let onlinePaymentVerified = false;
    if (!companyData && payment_intent_id) {
      try {
        const pi = await verifyBookingPaymentIntent(payment_intent_id);
        if (!pi.succeeded) {
          res.status(400).json({ error: 'Payment has not been completed' });
          return;
        }
        onlinePaymentVerified = true;
      } catch {
        res.status(400).json({ error: 'Invalid payment intent' });
        return;
      }
    }

    // Billing address is free-form multi-line text typed by the customer. Normalise
    // here too (not just client-side): drop blank lines and stray indentation so the
    // RECHNUNGSEMPFÄNGER block on the PDF stays tight. /api/bookings is public.
    const rechnungAdresseClean = typeof rechnung_adresse === 'string' && rechnung_adresse.trim()
      ? rechnung_adresse.replace(/\r/g, '').split('\n').map((l: string) => l.trim()).filter(Boolean).join('\n').slice(0, 500)
      : null;
    const rechnungRequired = rechnung_required && rechnungAdresseClean ? 1 : 0;

    // Derive the canonical form of the phone number. Advisory only: an unparseable
    // number leaves phone_e164 NULL and the booking is still accepted, because losing
    // a real customer to a false negative costs more than a bad number in the admin.
    const phoneParsed = parsePhone(phone);
    const phoneE164 = phoneParsed.ok ? phoneParsed.e164 : null;

    // Funnel attribution: a company-authenticated request is the B2B portal, never a
    // public web visitor. Never trust a client-supplied `source` — this is why it isn't
    // destructured out of req.body above. See db.ts idx_source_created for how the
    // admin funnel (tracking.ts) uses this to exclude non-web bookings from conversion.
    const bookingSource = companyAuth ? 'portal' : 'web';

    // A/B attribution: recomputed server-side from visitor_id, never trusted from the
    // client — a tampered variant would let a visitor cherry-pick the checkout they see
    // while still being counted under a rollout percentage they don't belong to.
    const expRows = await query<{ setting_key: string; setting_value: string }>(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'experiment_%'"
    );
    const expSettings: Record<string, string> = {};
    for (const row of expRows) expSettings[row.setting_key] = row.setting_value;
    const experimentVariant = variantString(visitor_id, expSettings) || null;

    const result = await run(`
      INSERT INTO bookings (
        booking_number, status, pickup_address, dropoff_address, pickup_datetime,
        vehicle_type, passengers, name, phone, email, flight_number, pickup_sign, child_seat,
        child_seat_details, luggage_count, notes, distance_km, duration_minutes, price, payment_method,
        stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, language,
        trip_type, return_datetime, fahrrad_count, anfahrt_cost, zwischenstopp_address,
        promo_code, discount_amount, visitor_id, session_id, source, experiment_variant, flight_validated, flight_info,
        company_id, company_user_id, cost_center, steuersatz,
        rechnung_required, rechnung_adresse, phone_e164, auto_discount_id, auto_discount_amount
      ) VALUES (
        ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      booking_number,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      vehicle_type,
      parseInt(passengers),
      name,
      phone,
      email,
      flight_number || null,
      pickup_sign || null,
      child_seat ? 1 : 0,
      child_seat_details || null,
      parseInt(luggage_count) || 0,
      notes || null,
      km || null,
      parseInt(duration_minutes) || null,
      price,
      payment_method || 'cash',
      cardInfo ? stripe_customer_id : null,
      cardInfo ? stripe_payment_method_id : null,
      cardInfo?.brand || null,
      cardInfo?.last4 || null,
      cardInfo?.exp_month || null,
      cardInfo?.exp_year || null,
      language || 'de',
      trip_type || 'oneway',
      return_datetime || null,
      fahrradCount,
      parsedAnfahrtCost || null,
      zwischenstopp_address || null,
      validatedPromoCode || null,
      promoDiscount > 0 ? promoDiscount : null,
      visitor_id || null,
      session_id || null,
      bookingSource,
      experimentVariant,
      flight_validated || null,
      flight_info || null,
      companyAuth?.companyId || null,
      companyAuth?.companyUserId || null,
      cost_center || null,
      steuersatz,
      rechnungRequired,
      rechnungAdresseClean,
      phoneE164,
      autoDiscountId,
      autoDiscountAmount > 0 ? autoDiscountAmount : null,
    ]);

    // Record the confirmed PaymentIntent for online payments
    if (onlinePaymentVerified && payment_intent_id) {
      await run(
        'UPDATE bookings SET stripe_charge_id = ?, charge_status = ?, stripe_payment_date = NOW() WHERE id = ?',
        [payment_intent_id, 'succeeded', result.insertId]
      );
    }

    // Increment used_count for applied promo
    if (validatedPromoCode) {
      await run('UPDATE promotions SET used_count = used_count + 1 WHERE code = ?', [validatedPromoCode]);
    }
    // Increment used_count for applied auto discount rule (koşullu — max_uses aşımını önler)
    if (autoDiscountId) {
      await run(
        'UPDATE auto_discounts SET used_count = used_count + 1 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)',
        [autoDiscountId]
      );
    }

    const [newBooking] = await query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);

    // Company card-on-file: charge immediately if this company is configured to
    // charge on booking confirmation rather than manually or on trip completion.
    let chargeResult: { success: boolean; error?: string } | undefined;
    if (companyData && (payment_method || 'cash') === 'card' && companyData.charge_mode === 'on_confirm') {
      chargeResult = await chargeSavedCard(result.insertId, companyData, price);
    }

    // Determine whether this booking warrants an extra phone confirmation as a
    // safety measure (we are open 24/7, but want late-hour trips guaranteed). The
    // notice appears only when BOTH the booking arrives during the night window
    // (owner likely asleep) AND the trip departs during the night window (owner
    // can't dispatch in time after waking). Booking time uses the CURRENT Munich
    // time; pickup time is read from pickup_datetime — both in Europe/Berlin.
    let nightConfirm = false;
    try {
      const nightRows = await query<{ setting_key: string; setting_value: string }>(
        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('night_confirm_enabled', 'night_confirm_start', 'night_confirm_end')"
      );
      const nightCfg: Record<string, string> = {};
      for (const r of nightRows) nightCfg[r.setting_key] = r.setting_value;
      const nightEnabled = (nightCfg['night_confirm_enabled'] ?? '1') === '1';
      const nightStart = parseInt(nightCfg['night_confirm_start'] ?? '22', 10);
      const nightEnd = parseInt(nightCfg['night_confirm_end'] ?? '7', 10);
      const inWindow = (h: number): boolean => {
        if (isNaN(h) || nightStart === nightEnd) return false;
        return nightStart < nightEnd ? (h >= nightStart && h < nightEnd) : (h >= nightStart || h < nightEnd);
      };
      const now = new Date();
      const bookingHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(now), 10);
      const pickupHour = parseInt(String(pickup_datetime).split('T')[1] ?? '', 10);
      const pickupDate = new Date(pickup_datetime);
      const hoursUntilPickup = (pickupDate.getTime() - now.getTime()) / 3600000;
      nightConfirm = nightEnabled && inWindow(bookingHour) && inWindow(pickupHour) && hoursUntilPickup <= 24;
    } catch (e) {
      console.error('Night-confirm check failed:', e);
    }

    // Send notifications asynchronously
    const notificationData: BookingNotificationData = {
      booking_number,
      name,
      email,
      phone,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      vehicle_type,
      passengers: parseInt(passengers),
      price,
      payment_method: payment_method || 'cash',
      flight_number,
      flight_validated: flight_validated || undefined,
      flight_info: flight_info || undefined,
      pickup_sign: pickup_sign || undefined,
      child_seat: !!child_seat,
      child_seat_details: child_seat_details || undefined,
      luggage_count: parseInt(luggage_count) || 0,
      notes,
      distance_km: km || undefined,
      duration_minutes: parseInt(duration_minutes) || undefined,
      language: language || 'de',
      trip_type: trip_type || 'oneway',
      return_datetime: return_datetime || undefined,
      oneway_price: isRoundtrip && !validatedPromoCode ? effectiveOneWay : undefined,
      roundtrip_discount: isRoundtrip && !validatedPromoCode ? effectiveRoundtripDiscount : undefined,
      fahrrad_count: fahrradCount || 0,
      fahrrad_price: fahrradCount > 0 ? priceRow.fahrrad_price : undefined,
      fahrrad_total: fahrradCount > 0 ? fahrradCost : undefined,
      anfahrt_cost: parsedAnfahrtCost || undefined,
      zwischenstopp_address: zwischenstopp_address || undefined,
      promo_code: validatedPromoCode || undefined,
      discount_amount: promoDiscount > 0 ? promoDiscount : undefined,
      base_total: (promoDiscount > 0 || autoDiscountAmount > 0) ? baseTotal : undefined,
      night_confirm: nightConfirm,
      company_name: companyData?.company_name || undefined,
      company_discount: companyDiscount > 0 ? companyDiscount : undefined,
      auto_discount_name: autoDiscountName || undefined,
      auto_discount_amount: autoDiscountAmount > 0 ? autoDiscountAmount : undefined,
    };

    sendAllNotifications(notificationData).catch(err => console.error('Notification error:', err));

    // No-op unless TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN are set. Deliberately not
    // awaited: the customer's confirmation must not wait on an external lookup.
    enrichBookingLineType(result.insertId, phoneE164).catch(err => console.error('Phone lookup error:', err));

    res.status(201).json({
      success: true,
      booking_number,
      booking: newBooking,
      charge: chargeResult,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

export interface RoutePriceEstimate {
  base_price: number;
  price_per_km: number;
  total_price: number;
  pflichtgebiet: boolean;
  fixed_route: boolean;
  auto_discount?: { name: string; type: 'percent' | 'fixed'; value: number; amount: number } | null;
}

export interface RoutePriceOptions {
  visitorId?: string | null;
  email?: string | null;
  phone?: string | null;
  pickupDatetime?: string | null;
  tripType?: string | null;
}

// Shared one-way price estimate logic — used by the /calculate-price endpoint
// (live booking flow) and by the public popular-routes teaser prices, so both
// surfaces always agree with the actual tariff engine (fixed routes +
// Pflichtfahrgebiet mandatory zone + min-price floor).
export async function computeRoutePrice(
  req: Request,
  vehicle_type: string,
  distance_km: number,
  pickup_address?: string,
  dropoff_address?: string,
  pickup_lat?: number | string,
  pickup_lng?: number | string,
  dropoff_lat?: number | string,
  dropoff_lng?: number | string,
  options?: RoutePriceOptions
): Promise<RoutePriceEstimate | null> {
  const [priceRow] = await query<PriceRow>(
    'SELECT base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, min_price, min_price_km FROM prices WHERE vehicle_type = ?',
    [vehicle_type]
  );
  if (!priceRow) return null;

  const km = distance_km;
  const calculatedPrice = priceRow.base_price + (km * priceRow.price_per_km);
  let price = (priceRow.min_price > 0 && km <= (priceRow.min_price_km || 15))
    ? Math.max(calculatedPrice, priceRow.min_price)
    : calculatedPrice;

  // Fixed-price route override (highest priority)
  let fixedRouteMatch = false;
  if (pickup_address && dropoff_address) {
    try {
      const allRoutes = await query<any>('SELECT * FROM fixed_routes WHERE enabled = 1');
      const match = findFixedRoute(pickup_address, dropoff_address, allRoutes);
      if (match) {
        const fp = getFixedPrice(match, vehicle_type);
        if (fp > 0) { price = fp; fixedRouteMatch = true; }
      }
    } catch (e) { console.error('Fixed-route calc-price skipped:', e); }
  }

  // Pflichtfahrgebiet mandatory tariff floor/replace (one-way preview)
  let pflichtgebiet = false;
  let zoneInside = false; // geometrie — auto-discount motoru için, `pgCfg.enabled`'dan bağımsız
  let pgFloorValue: number | null = null; // mandatory tarife tabanı — auto-discount bunun altına inemez
  try {
    const [pgCfg] = await query<PgConfig>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
    if (pgCfg && !fixedRouteMatch) {
      let pickupCoords: Coords | null =
        (pickup_lat && pickup_lng) ? { lat: parseFloat(String(pickup_lat)), lng: parseFloat(String(pickup_lng)) } : null;
      let dropoffCoords: Coords | null =
        (dropoff_lat && dropoff_lng) ? { lat: parseFloat(String(dropoff_lat)), lng: parseFloat(String(dropoff_lng)) } : null;
      if (!pickupCoords && pickup_address) pickupCoords = await geocodeAddress(pickup_address);
      if (!dropoffCoords && dropoff_address) dropoffCoords = await geocodeAddress(dropoff_address);

      if (km <= (pgCfg.radius_km || 50) && tripInZone(pickupCoords, dropoffCoords, pgCfg)) {
        zoneInside = true;
      }

      if (pgCfg.enabled) {
        let ipBypass2 = false;
        if (pgCfg.ip_bypass_enabled) {
          const vc = await getVisitorCoords(req);
          if (vc.lat != null && vc.lng != null) {
            ipBypass2 = haversineKm(vc.lat, vc.lng, pgCfg.betriebssitz_lat, pgCfg.betriebssitz_lng) > (pgCfg.ip_bypass_distance_km || 100);
          }
        }

        if (!ipBypass2 && zoneInside) {
          const excludedRows = await query<{ plz: string }>('SELECT plz FROM pflichtgebiet_exclusions WHERE enabled = 1');
          const excludedSet = new Set(excludedRows.map(r => r.plz));
          const pPlz = pickup_address?.match(/\b(\d{5})\b/)?.[1];
          const dPlz = dropoff_address?.match(/\b(\d{5})\b/)?.[1];
          const isExcluded = (pPlz && excludedSet.has(pPlz)) || (dPlz && excludedSet.has(dPlz));

          if (!isExcluded) {
            const [tar] = await query<{ grundgebuehr: number; min_per_km: number }>(
              'SELECT grundgebuehr, min_per_km FROM pflichtgebiet_tarife WHERE vehicle_type = ?',
              [vehicle_type]
            );
            if (tar) {
              let mandatory = tar.grundgebuehr + km * tar.min_per_km;
              if (priceRow.min_price > 0 && km <= (priceRow.min_price_km || 15)) {
                mandatory = Math.max(mandatory, priceRow.min_price);
              }
              price = pgCfg.mode === 'replace' ? mandatory : Math.max(price, mandatory);
              pflichtgebiet = true;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Pflichtgebiet calc-price skipped:', e);
  }

  // Automatische Rabatte — Vorschau (calculate-price). Identisch mit POST /
  // Nur Anwendungsfall unterscheidet: Kundenzahl fehlt evtl. (visitorId/email optional übergeben).
  let autoDiscount: { name: string; type: 'percent' | 'fixed'; value: number; amount: number } | null = null;
  try {
    const customerCount = (options?.visitorId || options?.email)
      ? await countCustomerBookings({ visitorId: options?.visitorId, email: options?.email })
      : null;
    const result = await resolveAutoDiscount({
      km,
      zone: zoneInside ? 'inside' : 'outside',
      vehicleType: vehicle_type,
      isRoundtrip: options?.tripType === 'roundtrip',
      pickupDateTime: options?.pickupDatetime ? new Date(options.pickupDatetime) : null,
      customerBookingCount: customerCount,
      baseTotal: price,
    });
    if (result) {
      autoDiscount = { name: result.rule.name, type: result.rule.discount_type, value: Number(result.rule.discount_value), amount: result.amount };
    }
  } catch (e) {
    console.error('Auto discount preview skipped:', e);
  }

  return {
    base_price: priceRow.base_price,
    price_per_km: priceRow.price_per_km,
    total_price: roundPriceUp(price),
    pflichtgebiet,
    fixed_route: fixedRouteMatch,
    auto_discount: autoDiscount,
  };
}

// POST /api/bookings/calculate-price - Calculate price
router.post('/calculate-price', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      vehicle_type, distance_km, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
      pickup_address, dropoff_address, visitor_id, email, pickup_datetime, trip_type,
    } = req.body;

    if (!vehicle_type || distance_km === undefined) {
      res.status(400).json({ error: 'vehicle_type and distance_km required' });
      return;
    }

    const km = parseFloat(distance_km);
    const estimate = await computeRoutePrice(req, vehicle_type, km, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, {
      visitorId: visitor_id || null,
      email: email || null,
      pickupDatetime: pickup_datetime || null,
      tripType: trip_type || null,
    });
    if (!estimate) {
      res.status(404).json({ error: 'Vehicle type not found' });
      return;
    }

    res.json({
      vehicle_type,
      distance_km: km,
      base_price: estimate.base_price,
      price_per_km: estimate.price_per_km,
      total_price: estimate.total_price,
      pflichtgebiet: estimate.pflichtgebiet,
      fixed_route: estimate.fixed_route,
      auto_discount: estimate.auto_discount || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// GET /api/bookings/recent-social — anonymised recent bookings for social proof
router.get('/recent-social', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<{ name: string; dropoff_address: string; created_at: string }>(
      `SELECT name, dropoff_address, created_at FROM bookings
       WHERE created_at >= NOW() - INTERVAL 48 HOUR AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 20`
    );
    const items = rows.map(r => {
      const parts = (r.name || '').trim().split(/\s+/);
      const first = parts[0] || '?';
      const lastInit = parts.length > 1 ? parts[parts.length - 1][0] + '.' : '';
      return {
        name: `${first} ${lastInit}`.trim(),
        dest: (r.dropoff_address || '').split(',')[0].trim().slice(0, 35),
        minsAgo: Math.max(1, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)),
      };
    });
    res.json(items);
  } catch {
    res.json([]);
  }
});

// ─── Self-service booking management ("Buchung verwalten") ───
// Requires booking_number + email match to prevent unauthorized access to
// someone else's booking. Free cancellation up to 3 hours before pickup,
// matching the policy already published in the FAQ / AGB.

const CANCEL_FREE_HOURS = 3;

// Brute-force protection for the self-service endpoints. booking_number is
// MAT{YYMMDD}-{4 digits}, i.e. only 9000 values per booking day, so someone who knows
// a customer's email could otherwise walk the keyspace and read their booking, cancel
// their ride, or pull their invoice.
//
// Two independent budgets, whichever runs out first:
//   • per IP    — stops a plain single-host sweep
//   • per email — stops the same victim being targeted from rotating IPs, which is the
//                 shape this attack actually takes
// Only misses count, and any successful match clears both, so genuine customers (incl.
// several sharing a hotel/office IP) are unaffected. 20 is far below the ~9000 needed
// to brute-force, yet way above normal human retyping.
const MANAGE_MAX_FAILURES = 20;
const MANAGE_WINDOW_MS = 15 * 60 * 1000;

function manageRateKeys(req: Request, email: unknown): string[] {
  return [
    `manage:ip:${getClientIp(req) || 'unknown'}`,
    `manage:mail:${String(email ?? '').trim().toLowerCase()}`,
  ];
}

function sanitizeBookingForCustomer(booking: any) {
  if (!booking) return booking;
  const {
    card_number_enc, card_cvv_enc, card_holder, card_expiry,
    visitor_id, company_id, company_user_id, cost_center,
    // Internal invoice bookkeeping — a Resend/API failure message is nothing the
    // customer should see. rechnung_number/_sent_at stay: the download button needs them.
    rechnung_error, rechnung_attempts,
    ...safe
  } = booking;
  const hoursUntilPickup = (new Date(booking.pickup_datetime).getTime() - Date.now()) / 3600000;
  return {
    ...safe,
    can_cancel_free: booking.status !== 'cancelled' && booking.status !== 'completed' && hoursUntilPickup >= CANCEL_FREE_HOURS,
  };
}

// POST /api/bookings/manage/lookup - Look up a booking by number + email (public; email must match)
router.post('/manage/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_number, email } = req.body;
    if (!booking_number || !email) {
      res.status(400).json({ error: 'booking_number and email required' });
      return;
    }
    const rateKeys = manageRateKeys(req, email);
    if (rateKeys.some(k => isRateLimited(k, MANAGE_MAX_FAILURES))) {
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }

    const [booking] = await query<any>(
      'SELECT * FROM bookings WHERE booking_number = ? AND LOWER(email) = LOWER(?)',
      [String(booking_number).trim(), String(email).trim()]
    );
    if (!booking) {
      rateKeys.forEach(k => registerFailure(k, MANAGE_WINDOW_MS));
      res.status(404).json({ error: 'not_found' });
      return;
    }
    rateKeys.forEach(clearRateLimit);
    res.json(sanitizeBookingForCustomer(booking));
  } catch (error) {
    console.error('Booking manage lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings/manage/cancel - Self-service cancellation (email must match; free up to 3h before pickup)
router.post('/manage/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_number, email } = req.body;
    if (!booking_number || !email) {
      res.status(400).json({ error: 'booking_number and email required' });
      return;
    }
    const rateKeys = manageRateKeys(req, email);
    if (rateKeys.some(k => isRateLimited(k, MANAGE_MAX_FAILURES))) {
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }

    const [booking] = await query<any>(
      'SELECT * FROM bookings WHERE booking_number = ? AND LOWER(email) = LOWER(?)',
      [String(booking_number).trim(), String(email).trim()]
    );
    if (!booking) {
      rateKeys.forEach(k => registerFailure(k, MANAGE_WINDOW_MS));
      res.status(404).json({ error: 'not_found' });
      return;
    }
    rateKeys.forEach(clearRateLimit);
    if (booking.status === 'cancelled') {
      res.status(400).json({ error: 'already_cancelled' });
      return;
    }
    if (booking.status === 'completed') {
      res.status(400).json({ error: 'already_completed' });
      return;
    }
    const hoursUntilPickup = (new Date(booking.pickup_datetime).getTime() - Date.now()) / 3600000;
    if (hoursUntilPickup < CANCEL_FREE_HOURS) {
      res.status(400).json({ error: 'cancellation_window_closed' });
      return;
    }

    await run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [booking.id]);

    const { sendCancellationEmail, sendAdminCancellationEmail } = await import('../services/notifications');
    const notificationData = {
      booking_number: booking.booking_number,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      pickup_datetime: booking.pickup_datetime,
      vehicle_type: booking.vehicle_type,
      passengers: booking.passengers,
      price: booking.price,
      payment_method: booking.payment_method,
      language: booking.language || 'de',
      child_seat: !!booking.child_seat,
      luggage_count: booking.luggage_count || 0,
    };
    if (booking.email) {
      sendCancellationEmail(notificationData).catch(err => console.error('Self-service cancellation email error:', err));
    }
    sendAdminCancellationEmail(notificationData).catch(err => console.error('Admin cancellation email error:', err));

    res.json({ success: true });
  } catch (error) {
    console.error('Booking manage cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// POST /api/bookings/manage/rechnung - Download the invoice that was already sent.
// Public, so it re-checks booking_number + email exactly like /manage/lookup. POST
// rather than a GET link on purpose: the email would otherwise sit in the URL and
// leak into access logs, browser history and Referer headers.
// Rebuilt from the stored render params (rechnung_sent_at keeps Datum identical), so
// the customer gets the same document that was mailed to them.
router.post('/manage/rechnung', async (req: Request, res: Response): Promise<void> => {
  try {
    const { booking_number, email } = req.body;
    if (!booking_number || !email) {
      res.status(400).json({ error: 'booking_number and email required' });
      return;
    }
    const rateKeys = manageRateKeys(req, email);
    if (rateKeys.some(k => isRateLimited(k, MANAGE_MAX_FAILURES))) {
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }

    const [booking] = await query<any>(
      'SELECT * FROM bookings WHERE booking_number = ? AND LOWER(email) = LOWER(?)',
      [String(booking_number).trim(), String(email).trim()]
    );
    if (!booking) {
      rateKeys.forEach(k => registerFailure(k, MANAGE_WINDOW_MS));
      res.status(404).json({ error: 'not_found' });
      return;
    }
    rateKeys.forEach(clearRateLimit);
    if (!booking.rechnung_number) {
      res.status(404).json({ error: 'no_invoice' });
      return;
    }
    // A cancelled ride's invoice must not stay downloadable: the customer was never
    // driven, so handing them a numbered invoice invites expense-report fraud. The
    // record itself is kept (rechnung_number/_sent_at stay set) — it remains visible
    // in admin and the number is not reused, which is what GoBD requires. Correcting
    // an already-issued invoice is an admin job (Storno-/Gutschrift), not a delete.
    if (booking.status === 'cancelled') {
      res.status(403).json({ error: 'cancelled' });
      return;
    }

    const { fetchBankSettings, generateRechnungPdf } = await import('../services/rechnung');
    const s = await fetchBankSettings();
    const steuersatz = Number(booking.rechnung_mwst);
    const pdfBuffer = await generateRechnungPdf({
      booking,
      rechnungsnummer: booking.rechnung_number,
      mwst: [0, 7, 19].includes(steuersatz) ? (steuersatz as 0 | 7 | 19) : 19,
      lang: booking.rechnung_sprache === 'en' ? 'en' : 'de',
      s,
      empfaenger_adresse: booking.rechnung_adresse || undefined,
      zahlungsart: booking.rechnung_zahlungsart || (booking.payment_method === 'card' ? 'kreditkarte' : 'bar'),
      invoice_date: booking.rechnung_sent_at || undefined,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Rechnung_${booking.rechnung_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Booking manage rechnung error:', error);
    res.status(500).json({ error: 'Failed to render invoice' });
  }
});

// GET /api/bookings/:booking_number - Get booking by number (public)
router.get('/:booking_number', async (req: Request, res: Response): Promise<void> => {
  try {
    const [booking] = await query('SELECT * FROM bookings WHERE booking_number = ?', [req.params.booking_number]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

export default router;
