import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import Stripe from 'stripe';
import { query, run } from '../db';
import { authenticateAdmin, generateToken, AuthRequest } from '../middleware/auth';
import { decrypt } from './bookings';
import { signToken } from '../utils/trackingToken';
import { BANK_SETTINGS_KEYS, fetchBankSettings, generateRechnungPdf, buildRechnungEmail, fmtPrice, roundGrossPrice, fmtDate } from '../services/rechnung';
import { chargeSavedCard, getCompanyForCharge } from '../services/stripeCards';

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://flughafen-muenchen.taxi').replace(/\/$/, '');

function buildTrackingLinks(bookingNumber: string) {
  return {
    customer_link: `${PUBLIC_SITE_URL}/track/${bookingNumber}?t=${signToken(bookingNumber, 'cust')}`,
    driver_link: `${PUBLIC_SITE_URL}/fahrer/${bookingNumber}?t=${signToken(bookingNumber, 'drv')}`,
  };
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' as any })
  : null;

function decryptBooking(booking: any) {
  if (!booking) return booking;
  return {
    ...booking,
    card_number: booking.card_number_enc ? decrypt(booking.card_number_enc) : null,
    card_cvv: booking.card_cvv_enc ? decrypt(booking.card_cvv_enc) : null,
    card_number_enc: undefined,
    card_cvv_enc: undefined,
  };
}

const router = Router();

interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
}

interface BookingRow {
  id: number;
  booking_number: string;
  status: string;
  price: number;
  created_at: string;
}

// POST /api/admin/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const [admin] = await query<AdminUser>('SELECT * FROM admin_users WHERE username = ?', [username]);
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, admin.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = generateToken(admin.id, admin.username);
  res.json({ token, username: admin.username });
});

// GET /api/admin/bookings - List all bookings with filters
router.get('/bookings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      vehicle_type,
      date_from,
      date_to,
      search,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    let sql = 'SELECT bookings.*, companies.company_name AS company_name FROM bookings LEFT JOIN companies ON bookings.company_id = companies.id WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      sql += ' AND bookings.status = ?';
      params.push(status);
    }
    if (vehicle_type) {
      sql += ' AND bookings.vehicle_type = ?';
      params.push(vehicle_type);
    }
    if (date_from && date_to) {
      sql += ' AND (DATE(bookings.pickup_datetime) BETWEEN ? AND ? OR (bookings.return_datetime IS NOT NULL AND DATE(bookings.return_datetime) BETWEEN ? AND ?))';
      params.push(date_from, date_to, date_from, date_to);
    } else if (date_from) {
      sql += ' AND (DATE(bookings.pickup_datetime) >= ? OR (bookings.return_datetime IS NOT NULL AND DATE(bookings.return_datetime) >= ?))';
      params.push(date_from, date_from);
    } else if (date_to) {
      sql += ' AND (DATE(bookings.pickup_datetime) <= ? OR (bookings.return_datetime IS NOT NULL AND DATE(bookings.return_datetime) <= ?))';
      params.push(date_to, date_to);
    }
    if (search) {
      sql += ' AND (bookings.name LIKE ? OR bookings.phone LIKE ? OR bookings.email LIKE ? OR bookings.booking_number LIKE ? OR bookings.pickup_address LIKE ? OR bookings.dropoff_address LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const countSql = sql.replace('SELECT bookings.*, companies.company_name AS company_name', 'SELECT COUNT(*) as count');
    const [countResult] = await query<{ count: number }>(countSql, params);

    sql += ` ORDER BY bookings.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    const rawBookings = await query(sql, params);
    const bookings = rawBookings.map(decryptBooking);

    res.json({
      bookings,
      pagination: {
        total: countResult.count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(countResult.count / limitNum),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/admin/bookings/today - All bookings with pickup today
router.get('/bookings/today', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const bookings = await query(`
      SELECT id, booking_number, name, phone, pickup_address, dropoff_address,
             pickup_datetime, vehicle_type, passengers, price, status, payment_method,
             flight_number, notes, card_holder, card_number_enc, card_expiry, card_cvv_enc
      FROM bookings
      WHERE status != 'cancelled'
        AND DATE(pickup_datetime) = ?
      ORDER BY pickup_datetime ASC
    `, [today]);
    res.json(bookings.map(decryptBooking));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch today bookings' });
  }
});

// GET /api/admin/bookings/tomorrow-cards - Card bookings for tomorrow (to charge today)
router.get('/bookings/tomorrow-cards', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const bookings = await query(`
      SELECT id, booking_number, name, phone, pickup_address, dropoff_address,
             pickup_datetime, vehicle_type, passengers, price, status,
             card_holder, card_number_enc, card_expiry, card_cvv_enc,
             company_id, charge_status, charge_error
      FROM bookings
      WHERE payment_method = 'card'
        AND status IN ('new', 'confirmed')
        AND DATE(pickup_datetime) = ?
      ORDER BY pickup_datetime ASC
    `, [tomorrowStr]);

    res.json(bookings.map(decryptBooking));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tomorrow cards' });
  }
});

// GET /api/admin/bookings/:id
router.get('/bookings/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json(decryptBooking(booking));
});

// PATCH /api/admin/bookings/:id/status - Update booking status
router.patch('/bookings/:id/status', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const validStatuses = ['new', 'confirmed', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = await run('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);

  // Company card-on-file: charge automatically if this company charges on trip completion
  if (status === 'completed' && booking?.company_id && booking.payment_method === 'card' && booking.charge_status !== 'succeeded') {
    const company = await getCompanyForCharge(booking.company_id);
    if (company?.charge_mode === 'on_completion' && company.stripe_payment_method_id) {
      chargeSavedCard(booking.id, company, Number(booking.price)).catch(err => console.error('On-completion charge error:', err));
    }
  }

  // Send cancellation email when booking is cancelled
  if (status === 'cancelled' && booking?.email) {
    const { sendCancellationEmail } = await import('../services/notifications');
    sendCancellationEmail({
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
    }).catch(err => console.error('Cancellation email error:', err));
  }

  res.json(booking);
});

// PATCH /api/admin/bookings/:id/steuersatz - Update tax rate
router.patch('/bookings/:id/steuersatz', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { steuersatz } = req.body;

  if (steuersatz !== null && steuersatz !== 7 && steuersatz !== 19) {
    res.status(400).json({ error: 'Steuersatz must be 7, 19, or null' });
    return;
  }

  const result = await run('UPDATE bookings SET steuersatz = ? WHERE id = ?', [steuersatz, req.params.id]);
  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  res.json(decryptBooking(booking));
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await run('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json({ success: true });
});

// PUT /api/admin/bookings/:id — update editable booking fields
router.put('/bookings/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const EDITABLE_FIELDS = [
    'name', 'email', 'phone',
    'pickup_address', 'dropoff_address', 'pickup_datetime', 'return_datetime',
    'vehicle_type', 'passengers', 'flight_number', 'pickup_sign',
    'child_seat', 'child_seat_details', 'luggage_count', 'notes', 'price',
    'payment_method', 'language', 'trip_type', 'fahrrad_count',
    'anfahrt_cost', 'zwischenstopp_address', 'promo_code', 'discount_amount',
  ];

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates.push(`${field} = ?`);
      const val = req.body[field];
      values.push(val === '' ? null : val);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No editable fields provided' });
    return;
  }

  values.push(req.params.id);
  const result = await run(
    `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  res.json(decryptBooking(booking));
});

// POST /api/admin/bookings — create booking without auto-sending notifications
router.post('/bookings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    pickup_address, dropoff_address, pickup_datetime, return_datetime,
    vehicle_type, passengers, name, phone, email,
    flight_number, pickup_sign, child_seat, child_seat_details,
    luggage_count, notes, distance_km, duration_minutes, price,
    payment_method, language, trip_type, fahrrad_count,
    anfahrt_cost, zwischenstopp_address, promo_code, discount_amount,
  } = req.body;

  if (!pickup_address || !dropoff_address || !pickup_datetime || !name || !phone || !email || !price) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  const booking_number = `MAT${year}${month}${day}-${random}`;

  const result = await run(`
    INSERT INTO bookings (
      booking_number, status, pickup_address, dropoff_address, pickup_datetime,
      vehicle_type, passengers, name, phone, email, flight_number, pickup_sign, child_seat,
      child_seat_details, luggage_count, notes, distance_km, duration_minutes, price, payment_method,
      language, trip_type, return_datetime, fahrrad_count, anfahrt_cost, zwischenstopp_address,
      promo_code, discount_amount
    ) VALUES (
      ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `, [
    booking_number,
    pickup_address,
    dropoff_address,
    pickup_datetime,
    vehicle_type || 'kombi',
    parseInt(passengers) || 1,
    name,
    phone,
    email,
    flight_number || null,
    pickup_sign || null,
    child_seat ? 1 : 0,
    child_seat_details || null,
    parseInt(luggage_count) || 0,
    notes || null,
    distance_km || null,
    parseInt(duration_minutes) || null,
    parseFloat(price),
    payment_method || 'cash',
    language || 'de',
    trip_type || 'oneway',
    return_datetime || null,
    parseInt(fahrrad_count) || 0,
    anfahrt_cost || null,
    zwischenstopp_address || null,
    promo_code || null,
    discount_amount || null,
  ]);

  const [newBooking] = await query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);
  res.status(201).json(decryptBooking(newBooking));
});

// POST /api/admin/bookings/:id/resend-confirmation — resend customer confirmation email
router.post('/bookings/:id/resend-confirmation', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const { sendCustomerConfirmation } = await import('../services/notifications');

  const [priceRow] = await query<{ fahrrad_price: number; child_seat_price: number }>(
    'SELECT fahrrad_price, child_seat_price FROM prices WHERE vehicle_type = ?',
    [booking.vehicle_type]
  );
  const fahrradCount = booking.fahrrad_count || 0;
  const fahrradUnitPrice = priceRow?.fahrrad_price ?? 0;

  await sendCustomerConfirmation({
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
    child_seat_details: booking.child_seat_details || undefined,
    luggage_count: booking.luggage_count || 0,
    flight_number: booking.flight_number || undefined,
    pickup_sign: booking.pickup_sign || undefined,
    notes: booking.notes || undefined,
    distance_km: booking.distance_km || undefined,
    duration_minutes: booking.duration_minutes || undefined,
    trip_type: booking.trip_type || undefined,
    return_datetime: booking.return_datetime || undefined,
    fahrrad_count: fahrradCount,
    fahrrad_price: fahrradCount > 0 ? fahrradUnitPrice : undefined,
    fahrrad_total: fahrradCount > 0 ? fahrradCount * fahrradUnitPrice : undefined,
    anfahrt_cost: booking.anfahrt_cost || undefined,
    zwischenstopp_address: booking.zwischenstopp_address || undefined,
    promo_code: booking.promo_code || undefined,
    discount_amount: booking.discount_amount || undefined,
    night_confirm: false,
  });

  res.json({ success: true });
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [todayStats] = await query<{ count: number; revenue: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) = ? AND status != 'cancelled'
    `, [today]);

    const [weekStats] = await query<{ count: number; revenue: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) >= ? AND status != 'cancelled'
    `, [weekStart]);

    const [monthStats] = await query<{ count: number; revenue: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) >= ? AND status != 'cancelled'
    `, [monthStart]);

    const [totalStats] = await query<{ count: number; revenue: number }>(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE status != 'cancelled'
    `);

    const statusCounts = await query<{ status: string; count: number }>(`
      SELECT status, COUNT(*) as count FROM bookings GROUP BY status
    `);

    const vehicleStats = await query(`
      SELECT vehicle_type, COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE status != 'cancelled'
      GROUP BY vehicle_type
    `);

    const recentBookings = await query(`
      SELECT id, booking_number, name, pickup_address, dropoff_address, pickup_datetime, vehicle_type, price, status, created_at
      FROM bookings ORDER BY created_at DESC LIMIT 15
    `);

    res.json({
      today: todayStats,
      week: weekStats,
      month: monthStats,
      total: totalStats,
      statusCounts,
      vehicleStats,
      recentBookings,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/statistics - Detailed statistics
router.get('/statistics', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Monthly revenue for last 12 months with payment breakdown
    const monthlyRevenue = await query(`
      SELECT
        DATE_FORMAT(pickup_datetime, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN price ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN price ELSE 0 END), 0) as card_revenue,
        SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END) as cash_count,
        SUM(CASE WHEN payment_method = 'card' THEN 1 ELSE 0 END) as card_count
      FROM bookings
      WHERE status != 'cancelled'
        AND pickup_datetime >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(pickup_datetime, '%Y-%m')
      ORDER BY month ASC
    `);

    // Month-to-date vs same period last month (day 1 → today's day)
    const mtdComparison = await query(`
      SELECT
        CASE
          WHEN DATE_FORMAT(pickup_datetime, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') THEN 'current'
          ELSE 'previous'
        END as period,
        COALESCE(SUM(price), 0) as revenue,
        COUNT(*) as count
      FROM bookings
      WHERE status != 'cancelled'
        AND (
          (DATE_FORMAT(pickup_datetime, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
           AND DAY(pickup_datetime) <= DAY(NOW()))
          OR
          (DATE_FORMAT(pickup_datetime, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')
           AND DAY(pickup_datetime) <= DAY(NOW()))
        )
      GROUP BY period
    `);

    // Vehicle type breakdown
    const vehicleBreakdown = await query(`
      SELECT
        vehicle_type,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue,
        ROUND(AVG(price), 2) as avg_price
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY vehicle_type
      ORDER BY revenue DESC
    `);

    // Payment method breakdown
    const paymentBreakdown = await query(`
      SELECT
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY payment_method
    `);

    // Day of week analysis (0=Sunday ... 6=Saturday)
    const dayOfWeekStats = await query(`
      SELECT
        (DAYOFWEEK(pickup_datetime) - 1) as dow,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY dow
      ORDER BY dow ASC
    `);

    // Hour of day analysis (using created_at — pickup_datetime often stored without time)
    const hourStats = await query(`
      SELECT
        HOUR(created_at) as hour,
        COUNT(*) as count
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    // Average price and distance stats
    const [avgStats] = await query(`
      SELECT
        ROUND(AVG(price), 2) as avg_price,
        ROUND(AVG(distance_km), 2) as avg_distance,
        ROUND(AVG(passengers), 1) as avg_passengers,
        MAX(price) as max_price,
        MIN(price) as min_price
      FROM bookings
      WHERE status != 'cancelled'
    `);

    // Top routes
    const topRoutes = await query(`
      SELECT
        pickup_address,
        dropoff_address,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY pickup_address, dropoff_address
      ORDER BY count DESC
      LIMIT 10
    `);

    // Roundtrip vs one-way
    const tripTypeStats = await query(`
      SELECT
        trip_type,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY trip_type
    `);

    // Weekly revenue for last 8 weeks with payment breakdown
    const weeklyRevenue = await query(`
      SELECT
        DATE_FORMAT(pickup_datetime, '%Y-W%v') as week,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN price ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN price ELSE 0 END), 0) as card_revenue,
        SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END) as cash_count,
        SUM(CASE WHEN payment_method = 'card' THEN 1 ELSE 0 END) as card_count
      FROM bookings
      WHERE status != 'cancelled'
        AND pickup_datetime >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
      GROUP BY DATE_FORMAT(pickup_datetime, '%Y-W%v')
      ORDER BY week ASC
    `);

    // Price distribution buckets
    const priceDistribution = await query(`
      SELECT
        CASE
          WHEN price < 50 THEN '< 50 €'
          WHEN price < 100 THEN '50–100 €'
          WHEN price < 150 THEN '100–150 €'
          WHEN price < 200 THEN '150–200 €'
          WHEN price < 300 THEN '200–300 €'
          ELSE '300 € +'
        END as bucket,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY bucket
      ORDER BY MIN(price) ASC
    `);

    // Lead time distribution (days between booking and pickup)
    const leadTimeBuckets = await query(`
      SELECT
        CASE
          WHEN DATEDIFF(pickup_datetime, created_at) = 0 THEN 'Gleicher Tag'
          WHEN DATEDIFF(pickup_datetime, created_at) <= 3 THEN '1–3 Tage'
          WHEN DATEDIFF(pickup_datetime, created_at) <= 7 THEN '4–7 Tage'
          WHEN DATEDIFF(pickup_datetime, created_at) <= 14 THEN '1–2 Wochen'
          WHEN DATEDIFF(pickup_datetime, created_at) <= 30 THEN '2–4 Wochen'
          ELSE '1+ Monat'
        END as bucket,
        COUNT(*) as count
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY bucket
      ORDER BY MIN(DATEDIFF(pickup_datetime, created_at)) ASC
    `);

    // Language distribution
    const languageStats = await query(`
      SELECT
        COALESCE(language, 'de') as language,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY COALESCE(language, 'de')
      ORDER BY count DESC
    `);

    // Top 5 best earning days — by order date (created_at)
    const topDays = await query(`
      SELECT
        DATE(created_at) as day,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY revenue DESC
      LIMIT 5
    `);

    // Top 5 best earning days — by trip date (pickup_datetime)
    const topDaysByTrip = await query(`
      SELECT
        DATE(pickup_datetime) as day,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
      GROUP BY DATE(pickup_datetime)
      ORDER BY revenue DESC
      LIMIT 5
    `);

    // Extras statistics
    const [extrasStats] = await query(`
      SELECT
        SUM(CASE WHEN fahrrad_count > 0 THEN 1 ELSE 0 END) as fahrrad_bookings,
        COALESCE(SUM(fahrrad_count), 0) as total_fahrrad,
        SUM(CASE WHEN child_seat = 1 THEN 1 ELSE 0 END) as child_seat_bookings,
        ROUND(AVG(luggage_count), 1) as avg_luggage,
        SUM(CASE WHEN luggage_count > 3 THEN 1 ELSE 0 END) as heavy_luggage_bookings,
        COUNT(*) as total
      FROM bookings
      WHERE status != 'cancelled'
    `);

    // Cancellation rate by month (last 6 months)
    const cancellationStats = await query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM bookings
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    res.json({
      monthlyRevenue,
      mtdComparison,
      vehicleBreakdown,
      paymentBreakdown,
      dayOfWeekStats,
      hourStats,
      avgStats,
      topRoutes,
      tripTypeStats,
      weeklyRevenue,
      priceDistribution,
      leadTimeBuckets,
      languageStats,
      topDays,
      topDaysByTrip,
      extrasStats,
      cancellationStats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/admin/visitor-geo-stats?range=30d|6m|all
router.get('/visitor-geo-stats', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const range = (req.query.range as string) || '30d';
    let dateSql = 'AND first_seen >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    if (range === 'today') dateSql = 'AND DATE(first_seen) = CURDATE()';
    else if (range === '7d') dateSql = 'AND first_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (range === '6m') dateSql = 'AND first_seen >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
    else if (range === 'all') dateSql = '';

    const visitorCountries = await query(`
      SELECT country, COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors
      FROM visitor_sessions
      WHERE is_bot = 0 AND country IS NOT NULL AND country != ''
        ${dateSql}
      GROUP BY country
      ORDER BY sessions DESC
      LIMIT 20
    `);
    const visitorCities = await query(`
      SELECT city, country, COUNT(*) AS sessions
      FROM visitor_sessions
      WHERE is_bot = 0 AND city IS NOT NULL AND city != ''
        ${dateSql}
      GROUP BY city, country
      ORDER BY sessions DESC
      LIMIT 15
    `);
    res.json({ range, visitorCountries, visitorCities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch visitor geo stats' });
  }
});

// POST /api/admin/change-password
router.post('/change-password', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Both passwords required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const [admin] = await query<AdminUser>('SELECT * FROM admin_users WHERE id = ?', [req.adminId]);
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const valid = bcrypt.compareSync(currentPassword, admin.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE admin_users SET password_hash = ? WHERE id = ?', [newHash, req.adminId]);

  res.json({ success: true, message: 'Password changed successfully' });
});

// POST /api/admin/import-db — one-time data import (admin protected)
router.post('/import-db', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { bookings, prices } = req.body;
  let importedBookings = 0;
  let importedPrices = 0;

  if (Array.isArray(prices)) {
    for (const p of prices) {
      try {
        await run(`
          REPLACE INTO prices (vehicle_type, base_price, price_per_km, roundtrip_discount, fahrrad_price, fahrrad_enabled, max_passengers, max_luggage, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [p.vehicle_type, p.base_price, p.price_per_km, p.roundtrip_discount ?? 5, p.fahrrad_price ?? 10, p.fahrrad_enabled ?? 0, p.max_passengers ?? 8, p.max_luggage ?? 10, p.updated_at ?? new Date().toISOString()]);
        importedPrices++;
      } catch { /* skip duplicate */ }
    }
  }

  if (Array.isArray(bookings)) {
    for (const b of bookings) {
      try {
        await run(`
          INSERT IGNORE INTO bookings (
            booking_number, status, pickup_address, dropoff_address, pickup_datetime,
            vehicle_type, passengers, name, phone, email, flight_number, pickup_sign,
            child_seat, child_seat_details, luggage_count, notes, distance_km,
            duration_minutes, price, payment_method, language, trip_type,
            return_datetime, fahrrad_count, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          b.booking_number, b.status, b.pickup_address, b.dropoff_address, b.pickup_datetime,
          b.vehicle_type, b.passengers, b.name, b.phone, b.email, b.flight_number ?? null, b.pickup_sign ?? null,
          b.child_seat, b.child_seat_details ?? null, b.luggage_count, b.notes ?? null, b.distance_km ?? null,
          b.duration_minutes ?? null, b.price, b.payment_method, b.language ?? 'de', b.trip_type ?? 'oneway',
          b.return_datetime ?? null, b.fahrrad_count ?? 0, b.created_at ?? new Date().toISOString()
        ]);
        importedBookings++;
      } catch { /* skip duplicate */ }
    }
  }

  res.json({ success: true, importedBookings, importedPrices });
});

// GET /api/admin/report/finanzamt - Generate PDF report for Finanzamt grouped by Stripe payout
router.get('/report/finanzamt', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);

    if (!month || !year || month < 1 || month > 12) {
      res.status(400).json({ error: 'Valid month and year required' });
      return;
    }

    const monthStr = month.toString().padStart(2, '0');
    const dateFrom = `${year}-${monthStr}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const dateTo = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    // For Finanzamt: group by payout ARRIVAL date (when money reaches bank account),
    // not by charge date. Fetch all payouts that arrived in this month, then fetch
    // the bookings that belong to those payouts.
    const relevantPayoutIds: string[] = [];
    const payoutMeta: Record<string, { arrivalDate: Date; grossCents: number; feeCents: number; netCents: number }> = {};

    if (stripe) {
      const arrFrom = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
      const arrTo = Math.floor(new Date(nextYear, nextMonth - 1, 1).getTime() / 1000);

      let poHasMore = true;
      let poStartingAfter: string | undefined = undefined;
      while (poHasMore) {
        const poParams: any = { arrival_date: { gte: arrFrom, lt: arrTo }, limit: 100 };
        if (poStartingAfter) poParams.starting_after = poStartingAfter;
        const poPage = await (stripe.payouts.list as any)(poParams);
        for (const po of poPage.data) {
          relevantPayoutIds.push(po.id);
          payoutMeta[po.id] = {
            arrivalDate: new Date(po.arrival_date * 1000),
            grossCents: po.amount,
            feeCents: 0,
            netCents: po.amount,
          };
        }
        poHasMore = poPage.has_more;
        if (poPage.data.length > 0) poStartingAfter = poPage.data[poPage.data.length - 1].id;
        else break;
      }

      // Compute gross/fee from balance transactions for each payout
      for (const pid of relevantPayoutIds) {
        try {
          const bts: any[] = [];
          let btHasMore = true;
          let btCursor: string | undefined = undefined;
          while (btHasMore) {
            const btParams: any = { payout: pid, limit: 100 };
            if (btCursor) btParams.starting_after = btCursor;
            const btPage = await (stripe.balanceTransactions.list as any)(btParams);
            bts.push(...btPage.data);
            btHasMore = btPage.has_more;
            if (btPage.data.length > 0) btCursor = btPage.data[btPage.data.length - 1].id;
          }
          let grossSum = 0;
          let feeSum = 0;
          for (const bt of bts) {
            if (bt.type === 'charge') { grossSum += bt.amount; feeSum += bt.fee; }
            else if (bt.type === 'refund') { grossSum += bt.amount; feeSum += bt.fee; }
          }
          payoutMeta[pid].grossCents = grossSum;
          payoutMeta[pid].feeCents = feeSum;
          payoutMeta[pid].netCents = grossSum - feeSum;
        } catch (e) { /* leave Stripe defaults */ }
      }
    }

    // Fetch bookings: those linked to payouts that arrived this month,
    // plus unassigned bookings charged this month (shown as "Nicht zugeordnet")
    let bookings: any[];
    if (relevantPayoutIds.length > 0) {
      bookings = await query(`
        SELECT booking_number, created_at, pickup_datetime, name, pickup_address, dropoff_address,
               price, steuersatz, stripe_payment_date, stripe_charge_id, stripe_payout_id
        FROM bookings
        WHERE payment_method = 'card' AND status != 'cancelled'
          AND stripe_payment_date IS NOT NULL
          AND (
            stripe_payout_id IN (${relevantPayoutIds.map(() => '?').join(',')})
            OR (stripe_payout_id IS NULL AND DATE(stripe_payment_date) >= ? AND DATE(stripe_payment_date) < ?)
          )
        ORDER BY stripe_payout_id ASC, stripe_payment_date ASC
      `, [...relevantPayoutIds, dateFrom, dateTo]);
    } else {
      bookings = await query(`
        SELECT booking_number, created_at, pickup_datetime, name, pickup_address, dropoff_address,
               price, steuersatz, stripe_payment_date, stripe_charge_id, stripe_payout_id
        FROM bookings
        WHERE payment_method = 'card' AND status != 'cancelled'
          AND stripe_payment_date IS NOT NULL
          AND stripe_payout_id IS NULL
          AND DATE(stripe_payment_date) >= ? AND DATE(stripe_payment_date) < ?
        ORDER BY stripe_payment_date ASC
      `, [dateFrom, dateTo]);
    }

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const title = `Kreditkartenzahlungen — ${monthNames[month - 1]} ${year}`;

    // Helper: round price same as frontend
    const formatPriceForPDF = (price: number): number => Math.ceil(price * 2) / 2;

    const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
    const fmtDate = (d: Date) => d.toLocaleDateString('de-DE');

    // Group bookings by payout id (null → "Nicht zugeordnet")
    interface GroupedPayout {
      payoutId: string | null;
      bookings: any[];
    }
    const groups: GroupedPayout[] = [];
    const groupMap: Record<string, GroupedPayout> = {};

    for (const b of bookings as any[]) {
      const pid: string | null = b.stripe_payout_id || null;
      const key = pid || '__none__';
      if (!groupMap[key]) {
        const group: GroupedPayout = { payoutId: pid, bookings: [] };
        groupMap[key] = group;
        groups.push(group);
      }
      groupMap[key].bookings.push(b);
    }

    // Use A4 landscape for more space
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Finanzamt_${monthNames[month - 1]}_${year}.pdf"`);
      res.send(pdfBuffer);
    });

    const pageW = 781;
    const startX = 30;

    const cols = [
      { x: startX,       w: 105, label: 'Buchungsnr.',  align: 'left'  as const },
      { x: startX+105,   w: 65,  label: 'Zahldatum',    align: 'left'  as const },
      { x: startX+170,   w: 65,  label: 'Fahrtdatum',   align: 'left'  as const },
      { x: startX+235,   w: 105, label: 'Name',         align: 'left'  as const },
      { x: startX+340,   w: 155, label: 'Von',          align: 'left'  as const },
      { x: startX+495,   w: 155, label: 'Nach',         align: 'left'  as const },
      { x: startX+650,   w: 65,  label: 'Brutto',       align: 'right' as const },
      { x: startX+715,   w: 50,  label: 'MwSt.',        align: 'center'as const },
    ];

    const drawColHeader = () => {
      doc.fontSize(7.5).font('Helvetica-Bold');
      const hy = doc.y;
      cols.forEach(c => {
        doc.text(c.label, c.x, hy, { width: c.w, align: c.align, lineBreak: false });
      });
      doc.moveDown(0.15);
      const lineY = doc.y + 2;
      doc.moveTo(startX, lineY).lineTo(startX + pageW, lineY).lineWidth(0.4).stroke();
      doc.y = lineY + 4;
    };

    // Grand-total accumulators
    let grandTotal7 = 0, grandTotal19 = 0, grandTotalUnset = 0;
    let grandCount7 = 0, grandCount19 = 0, grandCountUnset = 0;
    const ROW_H = 14;

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text(title, startX, 30, { width: pageW, align: 'center' });
    doc.fontSize(8).font('Helvetica').text(
      `Erstellt am: ${new Date().toLocaleDateString('de-DE')} | Zeitraum: ${monthNames[month - 1]} ${year} | Gruppiert nach Stripe-Auszahlung`,
      startX, doc.y + 4, { width: pageW, align: 'center' }
    );
    doc.moveDown(0.8);

    if (bookings.length === 0) {
      doc.fontSize(11).text('Keine Kreditkartenzahlungen in diesem Zeitraum.', { align: 'center' });
      doc.end();
      return;
    }

    for (const group of groups) {
      // --- Payout header bar ---
      const meta = group.payoutId ? payoutMeta[group.payoutId] : undefined;

      // Compute booking-level sums for this group
      let gBrutto = 0;
      for (const b of group.bookings) gBrutto += formatPriceForPDF(b.price || 0);

      let headerLabel: string;
      if (!group.payoutId) {
        headerLabel = 'Nicht zugeordnet (kein Stripe-Payout)';
      } else if (meta) {
        const arrStr = fmtDate(meta.arrivalDate);
        const gross = meta.grossCents / 100;
        const fee = meta.feeCents / 100;
        const net = meta.netCents / 100;
        headerLabel = `Auszahlung ${arrStr}   Brutto: ${fmt(gross)}   Gebühren: -${fmt(Math.abs(fee))}   Netto: ${fmt(net)}`;
      } else {
        headerLabel = `Auszahlung ${group.payoutId}`;
      }

      // Ensure enough space for header; add page if needed
      if (doc.y > 490) doc.addPage();

      // Draw thick separator line
      const sepY = doc.y;
      doc.moveTo(startX, sepY).lineTo(startX + pageW, sepY).lineWidth(1.5).stroke();
      doc.y = sepY + 5;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a6e')
        .text(headerLabel, startX, doc.y, { width: pageW, lineBreak: false });
      doc.fillColor('black');

      const sepY2 = doc.y + 12;
      doc.moveTo(startX, sepY2).lineTo(startX + pageW, sepY2).lineWidth(1.5).stroke();
      doc.y = sepY2 + 5;

      drawColHeader();

      // Per-group accumulators
      let g7 = 0, g19 = 0, gUnset = 0;
      let gc7 = 0, gc19 = 0, gcUnset = 0;

      doc.font('Helvetica').fontSize(7.5);
      for (const b of group.bookings) {
        if (doc.y > 530) {
          doc.addPage();
          drawColHeader();
          doc.font('Helvetica').fontSize(7.5);
        }

        const zahlDatumRaw = b.stripe_payment_date || b.created_at;
        const zahlDatum = zahlDatumRaw ? fmtDate(new Date(zahlDatumRaw)) : '—';
        const fahrtDatum = b.pickup_datetime ? fmtDate(new Date(b.pickup_datetime)) : '—';
        const name = (b.name || '').substring(0, 22);
        const pickup = (b.pickup_address || '').replace(/, Deutschland$/, '').substring(0, 35);
        const dropoff = (b.dropoff_address || '').replace(/, Deutschland$/, '').substring(0, 35);
        const roundedPrice = formatPriceForPDF(b.price || 0);
        const priceStr = fmt(roundedPrice);
        const tax = b.steuersatz ? `${b.steuersatz}%` : '—';

        if (b.steuersatz === 7)       { g7 += roundedPrice; gc7++; }
        else if (b.steuersatz === 19) { g19 += roundedPrice; gc19++; }
        else                          { gUnset += roundedPrice; gcUnset++; }

        const rowY = doc.y;
        const values = [b.booking_number || '', zahlDatum, fahrtDatum, name, pickup, dropoff, priceStr, tax];
        const aligns: Array<'left'|'right'|'center'> = ['left','left','left','left','left','left','right','center'];
        cols.forEach((c, i) => {
          doc.text(values[i], c.x, rowY, { width: c.w, align: aligns[i], lineBreak: false });
        });
        doc.y = rowY + ROW_H;
      }

      // Accumulate into grand totals
      grandTotal7 += g7; grandCount7 += gc7;
      grandTotal19 += g19; grandCount19 += gc19;
      grandTotalUnset += gUnset; grandCountUnset += gcUnset;

      // Per-group summary — ensure enough space (need ~80px for summary block)
      if (doc.y > 470) {
        doc.addPage();
        drawColHeader();
        doc.font('Helvetica').fontSize(7.5);
      }
      doc.moveDown(0.4);
      const gsumY = doc.y;
      doc.moveTo(startX + 400, gsumY).lineTo(startX + pageW, gsumY).lineWidth(0.4).stroke();
      doc.y = gsumY + 4;

      doc.fontSize(8).font('Helvetica');
      const sumRowY = doc.y;
      if (gc7 > 0) {
        doc.text(`7% MwSt.: ${gc7} Fahrten`, startX + 400, sumRowY, { width: 160, lineBreak: false });
        doc.font('Helvetica-Bold').text(fmt(g7), startX + 560, sumRowY, { width: 80, align: 'right', lineBreak: false });
        doc.font('Helvetica');
        doc.y = sumRowY + 13;
      }
      const sumRowY2 = doc.y;
      if (gc19 > 0) {
        doc.text(`19% MwSt.: ${gc19} Fahrten`, startX + 400, sumRowY2, { width: 160, lineBreak: false });
        doc.font('Helvetica-Bold').text(fmt(g19), startX + 560, sumRowY2, { width: 80, align: 'right', lineBreak: false });
        doc.font('Helvetica');
        doc.y = sumRowY2 + 13;
      }
      const sumRowY3 = doc.y;
      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text(`Summe: ${group.bookings.length} Fahrten`, startX + 400, sumRowY3, { width: 160, lineBreak: false });
      doc.text(fmt(g7 + g19 + gUnset), startX + 560, sumRowY3, { width: 80, align: 'right', lineBreak: false });
      doc.font('Helvetica');

      if (gcUnset > 0) {
        doc.y = sumRowY3 + 14;
        doc.fontSize(7.5).fillColor('#cc0000').text(
          `! ${gcUnset} Fahrten ohne Steuersatz (${fmt(gUnset)})`,
          startX + 400, doc.y, { width: 340 }
        );
        doc.fillColor('black');
      }

      doc.moveDown(1.2);
    }

    // === Grand Total Summary ===
    if (doc.y > 490) doc.addPage();

    const gtLineY = doc.y;
    doc.moveTo(startX, gtLineY).lineTo(startX + pageW, gtLineY).lineWidth(1.5).stroke();
    doc.y = gtLineY + 8;

    doc.fontSize(11).font('Helvetica-Bold').text('Gesamtzusammenfassung', startX, doc.y);
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');

    const colLeft = startX;
    const colRight = startX + 320;
    const gtY = doc.y;

    doc.text(`7% MwSt.:`, colLeft, gtY, { width: 110, lineBreak: false });
    doc.text(`${grandCount7} Fahrten`, colLeft + 110, gtY, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').text(fmt(grandTotal7), colLeft + 210, gtY, { width: 90, align: 'right', lineBreak: false });
    doc.font('Helvetica');

    doc.text(`19% MwSt.:`, colRight, gtY, { width: 110, lineBreak: false });
    doc.text(`${grandCount19} Fahrten`, colRight + 110, gtY, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').text(fmt(grandTotal19), colRight + 210, gtY, { width: 90, align: 'right', lineBreak: false });
    doc.font('Helvetica');

    doc.y = gtY + 18;
    const totalY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10.5);
    doc.text(`Gesamt: ${bookings.length} Fahrten`, colLeft, totalY, { width: 210, lineBreak: false });
    doc.text(fmt(grandTotal7 + grandTotal19 + grandTotalUnset), colLeft + 210, totalY, { width: 90, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(9);

    if (grandCountUnset > 0) {
      doc.y = totalY + 22;
      doc.fillColor('#cc0000').text(
        `! ${grandCountUnset} Fahrten ohne Steuersatz (${fmt(grandTotalUnset)}) — bitte vor Abgabe ergänzen!`,
        colLeft, doc.y
      );
      doc.fillColor('black');
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// PATCH /api/admin/bookings/:id/stripe-date - Set stripe payment date manually
router.patch('/bookings/:id/stripe-date', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { stripe_payment_date } = req.body;

  if (!stripe_payment_date && stripe_payment_date !== null) {
    res.status(400).json({ error: 'stripe_payment_date required (or null to clear)' });
    return;
  }

  const result = await run(
    'UPDATE bookings SET stripe_payment_date = ? WHERE id = ? AND payment_method = ?',
    [stripe_payment_date || null, req.params.id, 'card']
  );
  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found or not a card payment' });
    return;
  }

  const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
  res.json(decryptBooking(booking));
});

// POST /api/admin/stripe/sync - Sync Stripe charges with bookings
router.post('/stripe/sync', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year, charges } = req.body;

    if (!month || !year || !Array.isArray(charges)) {
      res.status(400).json({ error: 'month, year, and charges array required' });
      return;
    }

    let matched = 0;
    let unmatched = 0;
    const details: any[] = [];

    for (const charge of charges) {
      const { id: chargeId, amount, created } = charge;
      const chargeDate = new Date(created * 1000);
      const chargeMin = new Date(chargeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const chargeMax = new Date(chargeDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Find matching booking
      const candidates = await query(`
        SELECT id, booking_number, price, pickup_datetime
        FROM bookings
        WHERE payment_method = 'card'
          AND status != 'cancelled'
          AND stripe_charge_id IS NULL
          AND pickup_datetime >= ?
          AND pickup_datetime <= ?
      `, [chargeMin.toISOString(), chargeMax.toISOString()]);

      let foundMatch = false;
      for (const b of candidates) {
        const roundedCents = Math.ceil((b as any).price * 2) / 2 * 100;
        if (Math.round(roundedCents) === Math.round(amount)) {
          await run(
            'UPDATE bookings SET stripe_charge_id = ?, stripe_payment_date = ? WHERE id = ?',
            [chargeId, chargeDate.toISOString().replace('T', ' ').replace('Z', '').split('.')[0], (b as any).id]
          );
          matched++;
          details.push({ charge_id: chargeId, booking_number: (b as any).booking_number, status: 'matched' });
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        unmatched++;
        details.push({ charge_id: chargeId, amount, created, status: 'unmatched' });
      }
    }

    res.json({ matched, unmatched, details });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to sync Stripe charges' });
  }
});

// GET /api/admin/stripe/unmatched - Card bookings without stripe_payment_date
router.get('/stripe/unmatched', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await query(`
      SELECT id, booking_number, name, pickup_datetime, price, status, created_at
      FROM bookings
      WHERE payment_method = 'card'
        AND status != 'cancelled'
        AND stripe_payment_date IS NULL
      ORDER BY created_at DESC
    `);
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch unmatched bookings' });
  }
});

// POST /api/admin/stripe/auto-sync - Fetch charges directly from Stripe and match bookings + payouts
router.post('/stripe/auto-sync', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!stripe) {
      res.status(500).json({ error: 'Stripe not configured (STRIPE_SECRET_KEY missing)' });
      return;
    }

    const { month, year } = req.body;
    if (!month || !year) {
      res.status(400).json({ error: 'month and year required' });
      return;
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const dateFrom = new Date(yearNum, monthNum - 1, 1);
    const dateTo = new Date(yearNum, monthNum, 1);

    // Fetch all successful charges in the given month (with balance_transaction expanded for payout info)
    const charges: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: any = {
        created: { gte: Math.floor(dateFrom.getTime() / 1000), lt: Math.floor(dateTo.getTime() / 1000) },
        limit: 100,
        expand: ['data.balance_transaction'],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const page = await (stripe as any).charges.list(params);
      charges.push(...page.data.filter((c: any) => c.paid && !c.refunded));
      hasMore = page.has_more;
      if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id;
      else break;
    }

    // Load all unmatched card bookings in ONE query
    const allDateFrom = new Date(yearNum, monthNum - 1, 1);
    allDateFrom.setMonth(allDateFrom.getMonth() - 1); // 1 month buffer
    const allDateTo = new Date(yearNum, monthNum, 31);
    const unmatchedBookings: any[] = await query(`
      SELECT id, booking_number, price, pickup_datetime
      FROM bookings
      WHERE payment_method = 'card' AND status != 'cancelled' AND stripe_charge_id IS NULL
        AND pickup_datetime >= ? AND pickup_datetime <= ?
    `, [allDateFrom.toISOString(), allDateTo.toISOString()]);

    let matched = 0;
    let unmatched = 0;
    const details: any[] = [];
    const chargeUpdates: Array<{ id: number; chargeId: string; paymentDate: string; payoutId: string | null }> = [];

    for (const charge of charges) {
      const chargeDate = new Date(charge.created * 1000);
      const chargeMin = chargeDate.getTime() - 7 * 24 * 60 * 60 * 1000;
      const chargeMax = chargeDate.getTime() + 7 * 24 * 60 * 60 * 1000;
      const bt = charge.balance_transaction;
      const payoutId = bt && typeof bt === 'object'
        ? (typeof bt.payout === 'string' ? bt.payout : bt.payout?.id) || null
        : null;

      let foundMatch = false;
      for (const b of unmatchedBookings) {
        const pt = new Date(b.pickup_datetime).getTime();
        if (pt >= chargeMin && pt <= chargeMax) {
          const roundedCents = Math.round(Math.ceil(b.price * 2) / 2 * 100);
          if (roundedCents === charge.amount) {
            chargeUpdates.push({ id: b.id, chargeId: charge.id, paymentDate: chargeDate.toISOString().replace('T', ' ').replace('Z', '').split('.')[0], payoutId });
            b.stripe_charge_id = charge.id; // mark as matched in memory
            matched++;
            details.push({ charge_id: charge.id, booking_number: b.booking_number, amount: charge.amount / 100, status: 'matched' });
            foundMatch = true;
            break;
          }
        }
      }
      if (!foundMatch) {
        unmatched++;
        details.push({ charge_id: charge.id, amount: charge.amount / 100, status: 'unmatched' });
      }
    }

    // Batch update: charge matches
    if (chargeUpdates.length > 0) {
      const placeholders = chargeUpdates.map(() => 'WHEN id = ? THEN ?').join(' ');
      const datePlaceholders = chargeUpdates.map(() => 'WHEN id = ? THEN ?').join(' ');
      const ids = chargeUpdates.map(u => u.id);
      await run(
        `UPDATE bookings SET
          stripe_charge_id = CASE ${placeholders} END,
          stripe_payment_date = CASE ${datePlaceholders} END
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        [
          ...chargeUpdates.flatMap(u => [u.id, u.chargeId]),
          ...chargeUpdates.flatMap(u => [u.id, u.paymentDate]),
          ...ids,
        ]
      );
    }

    // --- Payout linking ---
    // Stripe's balance_transaction.payout field is unreliable (often undefined even when
    // the charge IS in a payout). The correct approach: iterate payouts → their balance
    // transactions → map chargeId → payoutId.
    let payoutLinked = 0;
    let payoutError: string | null = null;

    try {
      const payoutMap: Record<string, string> = {};

      // Search payouts created from 14 days before month start to 14 days after month end
      // to capture all payouts that could contain charges from this month.
      const poDateFrom = Math.floor(new Date(yearNum, monthNum - 1, -13).getTime() / 1000);
      const poDateTo = Math.floor(new Date(yearNum, monthNum, 15).getTime() / 1000);

      let poHasMore = true;
      let poStartingAfter: string | undefined = undefined;

      while (poHasMore) {
        const poParams: any = { created: { gte: poDateFrom, lt: poDateTo }, limit: 100 };
        if (poStartingAfter) poParams.starting_after = poStartingAfter;
        const poPage = await (stripe as any).payouts.list(poParams);

        for (const payout of poPage.data) {
          // For each payout, fetch its balance transactions to find which charges are in it
          let btHasMore = true;
          let btStartingAfter: string | undefined = undefined;
          while (btHasMore) {
            const btParams: any = { payout: payout.id, type: 'charge', limit: 100 };
            if (btStartingAfter) btParams.starting_after = btStartingAfter;
            const btPage = await (stripe as any).balanceTransactions.list(btParams);
            for (const bt of btPage.data) {
              const chargeId = typeof bt.source === 'string' ? bt.source : bt.source?.id;
              if (chargeId) payoutMap[chargeId] = payout.id;
            }
            btHasMore = btPage.has_more;
            if (btPage.data.length > 0) btStartingAfter = btPage.data[btPage.data.length - 1].id;
            else break;
          }
        }

        poHasMore = poPage.has_more;
        if (poPage.data.length > 0) poStartingAfter = poPage.data[poPage.data.length - 1].id;
        else break;
      }

      const chargeIds = Object.keys(payoutMap);
      if (chargeIds.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < chargeIds.length; i += BATCH) {
          const slice = chargeIds.slice(i, i + BATCH);
          const cases = slice.map(() => 'WHEN stripe_charge_id = ? THEN ?').join(' ');
          const result = await run(
            `UPDATE bookings SET stripe_payout_id = CASE ${cases} END
             WHERE stripe_charge_id IN (${slice.map(() => '?').join(',')}) AND stripe_payout_id IS NULL`,
            [...slice.flatMap(cid => [cid, payoutMap[cid]]), ...slice]
          );
          payoutLinked += result.affectedRows || 0;
        }
      }
    } catch (pe: any) {
      console.error('Payout linking error (non-fatal):', pe);
      payoutError = pe.message || 'Payout linking failed';
    }

    res.json({ total: charges.length, matched, unmatched, payoutLinked, payoutError, details });
  } catch (error: any) {
    console.error('Stripe auto-sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync with Stripe' });
  }
});

// ─── BANK & COMPANY SETTINGS ─────────────────────────────────────────────────

// GET /api/admin/bank-settings
router.get('/bank-settings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${BANK_SETTINGS_KEYS.map(() => '?').join(',')})`,
      BANK_SETTINGS_KEYS
    );
    const result: Record<string, string> = {};
    for (const key of BANK_SETTINGS_KEYS) result[key] = '';
    for (const row of rows) result[row.setting_key] = row.setting_value;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch bank settings' });
  }
});

// PUT /api/admin/bank-settings
router.put('/bank-settings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, string>;
    for (const key of Object.keys(body)) {
      if (!BANK_SETTINGS_KEYS.includes(key)) continue;
      await run(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, body[key] ?? '', body[key] ?? '']
      );
    }
    // Return updated settings
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${BANK_SETTINGS_KEYS.map(() => '?').join(',')})`,
      BANK_SETTINGS_KEYS
    );
    const result: Record<string, string> = {};
    for (const key of BANK_SETTINGS_KEYS) result[key] = '';
    for (const row of rows) result[row.setting_key] = row.setting_value;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save bank settings' });
  }
});

// ─── RECHNUNG (INVOICE) ───────────────────────────────────────────────────────

// POST /api/admin/bookings/:id/rechnung
router.post('/bookings/:id/rechnung', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rechnungsnummer, mwst_satz, sprache, empfaenger_adresse, zahlungsart } = req.body as {
      rechnungsnummer: string;
      mwst_satz: 0 | 7 | 19;
      sprache: 'de' | 'en';
      empfaenger_adresse?: string;
      zahlungsart?: 'bar' | 'kreditkarte' | 'ueberweisung';
    };

    if (!rechnungsnummer) {
      res.status(400).json({ error: 'Rechnungsnummer ist erforderlich' });
      return;
    }
    if (![0, 7, 19].includes(Number(mwst_satz))) {
      res.status(400).json({ error: 'Ungültiger MwSt.-Satz' });
      return;
    }

    const lang = sprache === 'en' ? 'en' : 'de';
    const mwst = Number(mwst_satz) as 0 | 7 | 19;

    const [booking] = await query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    const s = await fetchBankSettings();

    const pdfBuffer = await generateRechnungPdf({ booking, rechnungsnummer, mwst, lang, s, empfaenger_adresse, zahlungsart });

    // ── Send email via Resend ───────────────────────────────────────────────
    const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY);
    const fromEmail = 'info@flughafen-muenchen.taxi';

    const subject = lang === 'en'
      ? `Your Invoice ${rechnungsnummer} – Munich Airport Taxi`
      : `Ihre Rechnung ${rechnungsnummer} – Flughafen München Taxi`;

    const htmlBody = buildRechnungEmail({ booking, rechnungsnummer, mwst, lang, s, zahlungsart });

    await resend.emails.send({
      from: `Flughafen München Taxi <${fromEmail}>`,
      to: booking.email,
      subject,
      html: htmlBody,
      attachments: [{
        filename: `Rechnung_${rechnungsnummer}.pdf`,
        content: pdfBuffer.toString('base64'),
      }],
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Rechnung error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice' });
  }
});

// ─── MARKETING ────────────────────────────────────────────────────────────────

// GET /api/admin/marketing/customers - Unique customer emails from bookings
router.get('/marketing/customers', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customers = await query(`
      SELECT
        LOWER(TRIM(email)) AS email,
        MAX(name) AS name,
        MAX(pickup_datetime) AS lastBooking,
        COUNT(*) AS bookingCount
      FROM bookings
      WHERE email IS NOT NULL AND email != '' AND email LIKE '%@%'
        AND status != 'cancelled'
      GROUP BY LOWER(TRIM(email))
      ORDER BY MAX(pickup_datetime) DESC
    `);
    res.json(customers);
  } catch (error: any) {
    console.error('Marketing customers error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customers' });
  }
});

// POST /api/admin/marketing/parse-ics - Parse .ics calendar file for emails
router.post('/marketing/parse-ics', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { icsContent } = req.body as { icsContent?: string };
    if (!icsContent || typeof icsContent !== 'string') {
      res.status(400).json({ error: 'icsContent string required' });
      return;
    }

    // Unfold lines (RFC 5545: lines starting with space/tab continue previous line)
    const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);

    // Parse VEVENT blocks
    interface ParsedContact { email: string; name?: string }
    const contactMap = new Map<string, ParsedContact>();

    let inEvent = false;
    let currentSummary = '';
    let currentDescription = '';
    let currentAttendees: ParsedContact[] = [];
    let currentOrganizer: ParsedContact | null = null;

    const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

    const addContact = (email: string, name?: string) => {
      const key = email.trim().toLowerCase();
      if (!key || !key.includes('@')) return;
      const existing = contactMap.get(key);
      if (!existing || (!existing.name && name)) {
        contactMap.set(key, { email: key, name: name?.trim() || existing?.name });
      }
    };

    for (const line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        currentSummary = '';
        currentDescription = '';
        currentAttendees = [];
        currentOrganizer = null;
      } else if (line.startsWith('END:VEVENT')) {
        // Filter: only events with "Fahrt" / "Taxi" / "Transfer" in summary (case-insensitive)
        // If no filter keyword, include anyway (user may want all calendar contacts)
        const summaryLower = currentSummary.toLowerCase();
        const isRelevant =
          /fahrt|taxi|transfer|abholung|rückfahrt|ruckfahrt|hinfahrt|flughafen/i.test(summaryLower) ||
          summaryLower === ''; // include if no summary

        if (isRelevant || currentAttendees.length > 0 || currentOrganizer) {
          for (const a of currentAttendees) addContact(a.email, a.name);
          if (currentOrganizer) addContact(currentOrganizer.email, currentOrganizer.name);

          // Also extract emails from DESCRIPTION
          const descMatches = currentDescription.match(emailRegex);
          if (descMatches) for (const e of descMatches) addContact(e);
        }
        inEvent = false;
      } else if (inEvent) {
        if (line.startsWith('SUMMARY')) {
          const idx = line.indexOf(':');
          if (idx > -1) currentSummary = line.slice(idx + 1).trim();
        } else if (line.startsWith('DESCRIPTION')) {
          const idx = line.indexOf(':');
          if (idx > -1) {
            currentDescription = line
              .slice(idx + 1)
              .replace(/\\n/g, '\n')
              .replace(/\\,/g, ',')
              .replace(/\\;/g, ';');
          }
        } else if (line.startsWith('ATTENDEE')) {
          const mailto = line.match(/mailto:([^\r\n;>]+)/i);
          const cn = line.match(/CN=([^;:]+)/i);
          if (mailto) currentAttendees.push({ email: mailto[1], name: cn ? cn[1] : undefined });
        } else if (line.startsWith('ORGANIZER')) {
          const mailto = line.match(/mailto:([^\r\n;>]+)/i);
          const cn = line.match(/CN=([^;:]+)/i);
          if (mailto) currentOrganizer = { email: mailto[1], name: cn ? cn[1] : undefined };
        }
      }
    }

    // Filter out the company's own email and common system addresses
    const ownEmail = ('info@flughafen-muenchen.taxi').toLowerCase();
    const blocklist = new Set([ownEmail, 'noreply@', 'no-reply@']);
    const result = Array.from(contactMap.values()).filter(
      (c) => !c.email.startsWith('noreply') && !c.email.startsWith('no-reply') && c.email !== ownEmail
    );

    res.json(result);
  } catch (error: any) {
    console.error('Marketing parse-ics error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse .ics file' });
  }
});

// POST /api/admin/marketing/preview - Generate HTML preview from content
router.post('/marketing/preview', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subject, content, buttonText, buttonUrl, isHtml } = req.body as {
      subject?: string;
      content?: string;
      buttonText?: string;
      buttonUrl?: string;
      isHtml?: boolean;
    };
    if (!content) {
      res.status(400).json({ error: 'content required' });
      return;
    }
    let html: string;
    if (isHtml) {
      // Raw HTML mode — return as-is, replacing {isim} placeholder, encode non-ASCII
      const { encodeNonAscii } = await import('../services/notifications');
      html = encodeNonAscii(
        content.replace(/\{isim\}/gi, 'Vorschau').replace(/\{name\}/gi, 'Vorschau')
      );
    } else {
      const { generateMarketingEmailHtml } = await import('../services/notifications');
      html = generateMarketingEmailHtml({
        subject: subject || 'Vorschau',
        content,
        buttonText,
        buttonUrl,
        recipientName: 'Vorschau',
      });
    }
    res.json({ html });
  } catch (error: any) {
    console.error('Marketing preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate preview' });
  }
});

// POST /api/admin/marketing/send - Bulk send marketing email via Resend Batch API
router.post('/marketing/send', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { recipients, subject, content, buttonText, buttonUrl, isHtml } = req.body as {
      recipients?: Array<{ email: string; name?: string }>;
      subject?: string;
      content?: string;
      buttonText?: string;
      buttonUrl?: string;
      isHtml?: boolean;
    };

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: 'recipients array required (min 1)' });
      return;
    }
    if (!subject || !content) {
      res.status(400).json({ error: 'subject and content required' });
      return;
    }
    if (recipients.length > 50000) {
      res.status(400).json({ error: 'Too many recipients (max 50000 per request)' });
      return;
    }

    const { sendMarketingEmail } = await import('../services/notifications');
    const result = await sendMarketingEmail(recipients, { subject, content, buttonText, buttonUrl, isHtml });
    res.json(result);
  } catch (error: any) {
    console.error('Marketing send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send marketing email' });
  }
});

// GET /api/admin/settings/reminder
router.get('/settings/reminder', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('reminder_enabled', 'reminder_time')"
    );
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
    res.json({
      enabled: map['reminder_enabled'] === 'true',
      time: map['reminder_time'] || '18:00',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/settings/reminder
router.post('/settings/reminder', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enabled, time } = req.body as { enabled?: boolean; time?: string };
    if (enabled !== undefined) {
      await run(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('reminder_enabled', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [String(enabled), String(enabled)]
      );
    }
    if (time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(time)) {
        res.status(400).json({ error: 'time must be HH:MM format' });
        return;
      }
      await run(
        "INSERT INTO settings (setting_key, setting_value) VALUES ('reminder_time', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [time, time]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/test-reminder — JWT korumalı, yarınki gerçek fahrtlara test gönderimi
router.get('/test-reminder', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sendReminderEmail } = await import('../services/notifications');
    const bookings = await query<any>(
      `SELECT * FROM bookings
       WHERE DATE(pickup_datetime) = DATE(DATE_ADD(NOW(), INTERVAL 1 DAY))
       AND status NOT IN ('cancelled', 'storniert')
       ORDER BY pickup_datetime ASC`
    );
    const results: any[] = [];
    for (const b of bookings) {
      try {
        await sendReminderEmail(b);
        results.push({ booking_number: b.booking_number, email: b.email, status: 'sent' });
      } catch (e: any) {
        results.push({ booking_number: b.booking_number, email: b.email, status: 'error', error: e.message });
      }
    }
    res.json({ count: bookings.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEO Dashboard ──────────────────────────────────────────────────────────
import * as fsSync from 'fs';
import * as pathMod from 'path';

const SEO_DATA_DIR = pathMod.join(__dirname, '../../../frontend/scripts/seo-tracker/data');

router.get('/seo/data', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const read = (file: string, fallback: any) => {
      const p = pathMod.join(SEO_DATA_DIR, file);
      if (!fsSync.existsSync(p)) return fallback;
      const raw = fsSync.readFileSync(p, 'utf8');
      try { return JSON.parse(raw); } catch { return raw; }
    };

    const history = read('history.json', { entries: [] });
    const entries = (history.entries || []).slice(-30);
    const latest = entries[entries.length - 1] || null;

    // Read autopilot proposals (latest file)
    const dataFiles = fsSync.existsSync(SEO_DATA_DIR) ? fsSync.readdirSync(SEO_DATA_DIR) : [];
    const autopilotFiles = dataFiles.filter((f: string) => f.startsWith('autopilot-')).sort().reverse();
    const autopilotRaw = autopilotFiles[0] ? fsSync.readFileSync(pathMod.join(SEO_DATA_DIR, autopilotFiles[0]), 'utf8') : '';

    const rankOneSummaryFiles = dataFiles.filter((f: string) => f.startsWith('rank-one-summary-')).sort().reverse();
    const rankOneSummary = rankOneSummaryFiles[0] ? fsSync.readFileSync(pathMod.join(SEO_DATA_DIR, rankOneSummaryFiles[0]), 'utf8') : '';

    const alertsLog = fsSync.existsSync(pathMod.join(SEO_DATA_DIR, 'alerts.log'))
      ? fsSync.readFileSync(pathMod.join(SEO_DATA_DIR, 'alerts.log'), 'utf8').trim().split('\n').slice(-20).reverse()
      : [];

    // Trend series
    const scoreSeries = entries.map((e: any) => ({ ts: e.ts, score: e.siteScore || 0 }));
    const rankSeries: Record<string, Array<{ ts: string; position: number | null }>> = {};
    for (const e of entries) {
      for (const [kw, v] of Object.entries(e.ranks || {})) {
        if (!rankSeries[kw]) rankSeries[kw] = [];
        rankSeries[kw].push({ ts: e.ts, position: (v as any).position || null });
      }
    }

    res.json({
      latest,
      scoreSeries,
      rankSeries,
      pageScores: latest?.pages || [],
      ranks: latest?.ranks || {},
      autopilot: autopilotRaw,
      rankOneSummary,
      alertsLog,
      dataDir: SEO_DATA_DIR,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Drivers (Fahrer) =====

// GET /api/admin/drivers
router.get('/drivers', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const drivers = await query('SELECT * FROM drivers ORDER BY active DESC, name ASC');
    res.json(drivers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/drivers
router.post('/drivers', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, vehicle_plate, vehicle_model } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'name required' });
      return;
    }
    const result = await run(
      'INSERT INTO drivers (name, phone, vehicle_plate, vehicle_model) VALUES (?, ?, ?, ?)',
      [String(name).trim(), phone || '', vehicle_plate || '', vehicle_model || '']
    );
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [result.insertId]);
    res.status(201).json(driver);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/drivers/:id
router.put('/drivers/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, phone, vehicle_plate, vehicle_model, active } = req.body;
    await run(
      'UPDATE drivers SET name = ?, phone = ?, vehicle_plate = ?, vehicle_model = ?, active = ? WHERE id = ?',
      [name, phone || '', vehicle_plate || '', vehicle_model || '', active ? 1 : 0, req.params.id]
    );
    const [driver] = await query('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/drivers/:id
router.delete('/drivers/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/bookings/:id/assign-driver — assign a driver and return tracking links
router.post('/bookings/:id/assign-driver', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { driver_id } = req.body;
    const [booking] = await query<any>('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    if (driver_id) {
      const [driver] = await query<any>('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (!driver) {
        res.status(404).json({ error: 'Driver not found' });
        return;
      }
      await run(
        `UPDATE bookings SET assigned_driver_id = ?, driver_status = 'assigned',
         driver_lat = NULL, driver_lng = NULL, driver_location_updated_at = NULL WHERE id = ?`,
        [driver_id, booking.id]
      );
    } else {
      // Unassign
      await run(
        `UPDATE bookings SET assigned_driver_id = NULL, driver_status = NULL,
         driver_lat = NULL, driver_lng = NULL, driver_location_updated_at = NULL WHERE id = ?`,
        [booking.id]
      );
      res.json({ ok: true, assigned: false });
      return;
    }

    res.json({ ok: true, assigned: true, ...buildTrackingLinks(booking.booking_number) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/bookings/:id/tracking-links — fetch links for an already-assigned booking
router.get('/bookings/:id/tracking-links', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [booking] = await query<any>('SELECT booking_number FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json(buildTrackingLinks(booking.booking_number));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
