import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, run } from '../db';
import { authenticateAdmin, generateToken, AuthRequest } from '../middleware/auth';
import { decrypt } from './bookings';

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

    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (vehicle_type) {
      sql += ' AND vehicle_type = ?';
      params.push(vehicle_type);
    }
    if (date_from) {
      sql += ' AND DATE(pickup_datetime) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND DATE(pickup_datetime) <= ?';
      params.push(date_to);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR booking_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const [countResult] = await query<{ count: number }>(countSql, params);

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const fullParams = [...params, limitNum, offset];

    const rawBookings = await query(sql, fullParams);
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
  res.json(booking);
});

// PATCH /api/admin/bookings/:id/steuersatz - Update tax rate
router.patch('/bookings/:id/steuersatz', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { steuersatz } = req.body;

  if (steuersatz !== null && steuersatz !== 7 && steuersatz !== 19) {
    res.status(400).json({ error: 'Steuersatz must be 7, 19, or null' });
    return;
  }

  const result = await run('UPDATE bookings SET steuersatz = ? WHERE id = ? AND payment_method = ?', [steuersatz, req.params.id, 'card']);
  if (result.affectedRows === 0) {
    res.status(404).json({ error: 'Booking not found or not a card payment' });
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
      FROM bookings ORDER BY created_at DESC LIMIT 5
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

export default router;
