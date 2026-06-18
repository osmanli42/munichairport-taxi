import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query, run } from '../db';
import { sendAllNotifications, BookingNotificationData } from '../services/notifications';
import { tripInZone, haversineKm, PgConfig, Coords } from '../utils/geo';
import { geocodeAddress } from './maps';
import { findFixedRoute, getFixedPrice } from './fixed-routes';
import { getVisitorCoords } from '../utils/ipGeo';

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
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MAT${year}${month}${day}-${random}`;
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
      pickup_sign,
      child_seat,
      luggage_count,
      notes,
      distance_km,
      duration_minutes,
      payment_method,
      language,
      card_holder,
      card_number,
      card_expiry,
      card_cvv,
      child_seat_details,
      trip_type,
      return_datetime,
      fahrrad_count,
      anfahrt_cost,
      toll_amount,
      zwischenstopp_address,
      promo_code,
      visitor_id,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
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

    if (!['cash', 'card'].includes(payment_method || 'cash')) {
      res.status(400).json({ error: 'Invalid payment method' });
      return;
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

    let price = Math.max(0, Math.round((baseTotal - promoDiscount) * 100) / 100);
    // Inside the Pflichtfahrgebiet, the final price may not fall below the mandatory fare
    if (pgFareFloor > 0) {
      price = Math.max(price, Math.round(pgFareFloor * 100) / 100);
    }

    const booking_number = generateBookingNumber();

    // Encrypt card data if provided
    const card_number_enc = card_number ? encrypt(card_number) : null;
    const card_cvv_enc = card_cvv ? encrypt(card_cvv) : null;

    const result = await run(`
      INSERT INTO bookings (
        booking_number, status, pickup_address, dropoff_address, pickup_datetime,
        vehicle_type, passengers, name, phone, email, flight_number, pickup_sign, child_seat,
        child_seat_details, luggage_count, notes, distance_km, duration_minutes, price, payment_method,
        card_holder, card_number_enc, card_expiry, card_cvv_enc, language,
        trip_type, return_datetime, fahrrad_count, anfahrt_cost, zwischenstopp_address,
        promo_code, discount_amount, visitor_id
      ) VALUES (
        ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      card_holder || null,
      card_number_enc,
      card_expiry || null,
      card_cvv_enc,
      language || 'de',
      trip_type || 'oneway',
      return_datetime || null,
      fahrradCount,
      parsedAnfahrtCost || null,
      zwischenstopp_address || null,
      validatedPromoCode || null,
      promoDiscount > 0 ? promoDiscount : null,
      visitor_id || null,
    ]);

    // Increment used_count for applied promo
    if (validatedPromoCode) {
      await run('UPDATE promotions SET used_count = used_count + 1 WHERE code = ?', [validatedPromoCode]);
    }

    const [newBooking] = await query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);

    // Determine whether this is a night-time booking that needs phone confirmation
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
      const pickupHour = parseInt(String(pickup_datetime).split('T')[1] ?? '', 10);
      if (nightEnabled && !isNaN(pickupHour)) {
        if (nightStart === nightEnd) nightConfirm = false;
        else if (nightStart < nightEnd) nightConfirm = pickupHour >= nightStart && pickupHour < nightEnd;
        else nightConfirm = pickupHour >= nightStart || pickupHour < nightEnd;
      }
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
      base_total: promoDiscount > 0 ? baseTotal : undefined,
      night_confirm: nightConfirm,
    };

    sendAllNotifications(notificationData).catch(err => console.error('Notification error:', err));

    res.status(201).json({
      success: true,
      booking_number,
      booking: newBooking,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// POST /api/bookings/calculate-price - Calculate price
router.post('/calculate-price', async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicle_type, distance_km, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address } = req.body;

    if (!vehicle_type || distance_km === undefined) {
      res.status(400).json({ error: 'vehicle_type and distance_km required' });
      return;
    }

    const [priceRow] = await query<PriceRow>(
      'SELECT base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, min_price, min_price_km FROM prices WHERE vehicle_type = ?',
      [vehicle_type]
    );
    if (!priceRow) {
      res.status(404).json({ error: 'Vehicle type not found' });
      return;
    }

    const km = parseFloat(distance_km);
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
    try {
      const [pgCfg] = await query<PgConfig>('SELECT * FROM pflichtgebiet_config WHERE id = 1');
      if (pgCfg && pgCfg.enabled && !fixedRouteMatch) {
        const pickupCoords: Coords | null =
          (pickup_lat && pickup_lng) ? { lat: parseFloat(pickup_lat), lng: parseFloat(pickup_lng) } : null;
        const dropoffCoords: Coords | null =
          (dropoff_lat && dropoff_lng) ? { lat: parseFloat(dropoff_lat), lng: parseFloat(dropoff_lng) } : null;

        let ipBypass2 = false;
        if (pgCfg.ip_bypass_enabled) {
          const vc = await getVisitorCoords(req);
          if (vc.lat != null && vc.lng != null) {
            ipBypass2 = haversineKm(vc.lat, vc.lng, pgCfg.betriebssitz_lat, pgCfg.betriebssitz_lng) > (pgCfg.ip_bypass_distance_km || 100);
          }
        }

        if (!ipBypass2 && km <= (pgCfg.radius_km || 50) && tripInZone(pickupCoords, dropoffCoords, pgCfg)) {
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
    } catch (e) {
      console.error('Pflichtgebiet calc-price skipped:', e);
    }

    res.json({
      vehicle_type,
      distance_km: km,
      base_price: priceRow.base_price,
      price_per_km: priceRow.price_per_km,
      total_price: parseFloat(price.toFixed(2)),
      pflichtgebiet,
      fixed_route: fixedRouteMatch,
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
