import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query, run } from '../db';
import { sendAllNotifications, BookingNotificationData } from '../services/notifications';

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
      zwischenstopp_address,
      promo_code,
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

    // Validate promo code first — if valid, skip roundtrip_discount (not combinable)
    let promoDiscount = 0;
    let validatedPromoCode: string | null = null;
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
      }
    }

    const discount = validatedPromoCode ? 0 : (priceRow.roundtrip_discount || 0);
    const tripPrice = isRoundtrip
      ? oneWayPrice * 2 * (1 - discount / 100)
      : oneWayPrice;
    const parsedAnfahrtCost = anfahrt_cost ? parseFloat(anfahrt_cost) : 0;
    const baseTotal = tripPrice + fahrradCost + parsedAnfahrtCost;

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

    const price = Math.max(0, Math.round((baseTotal - promoDiscount) * 100) / 100);

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
        promo_code, discount_amount
      ) VALUES (
        ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    ]);

    // Increment used_count for applied promo
    if (validatedPromoCode) {
      await run('UPDATE promotions SET used_count = used_count + 1 WHERE code = ?', [validatedPromoCode]);
    }

    const [newBooking] = await query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);

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
      price: parseFloat(price.toFixed(2)),
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
      oneway_price: isRoundtrip ? oneWayPrice : undefined,
      roundtrip_discount: isRoundtrip ? discount : undefined,
      fahrrad_count: fahrradCount || 0,
      fahrrad_price: fahrradCount > 0 ? priceRow.fahrrad_price : undefined,
      fahrrad_total: fahrradCount > 0 ? fahrradCost : undefined,
      anfahrt_cost: parsedAnfahrtCost || undefined,
      zwischenstopp_address: zwischenstopp_address || undefined,
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
    const { vehicle_type, distance_km } = req.body;

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
    const price = (priceRow.min_price > 0 && km <= (priceRow.min_price_km || 15))
      ? Math.max(calculatedPrice, priceRow.min_price)
      : calculatedPrice;

    res.json({
      vehicle_type,
      distance_km: km,
      base_price: priceRow.base_price,
      price_per_km: priceRow.price_per_km,
      total_price: parseFloat(price.toFixed(2)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate price' });
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
