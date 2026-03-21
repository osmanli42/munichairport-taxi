import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
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
router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as AdminUser | undefined;
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
router.get('/bookings', authenticateAdmin, (req: AuthRequest, res: Response): void => {
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

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (vehicle_type) {
      query += ' AND vehicle_type = ?';
      params.push(vehicle_type);
    }
    if (date_from) {
      query += ' AND DATE(pickup_datetime) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND DATE(pickup_datetime) <= ?';
      params.push(date_to);
    }
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR booking_number LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params) as { count: number };

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const rawBookings = db.prepare(query).all(...params);
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
router.get('/bookings/:id', authenticateAdmin, (req: AuthRequest, res: Response): void => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json(decryptBooking(booking));
});

// PATCH /api/admin/bookings/:id/status - Update booking status
router.patch('/bookings/:id/status', authenticateAdmin, (req: AuthRequest, res: Response): void => {
  const { status } = req.body;
  const validStatuses = ['new', 'confirmed', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  res.json(booking);
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', authenticateAdmin, (req: AuthRequest, res: Response): void => {
  const result = db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json({ success: true });
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', authenticateAdmin, (req: AuthRequest, res: Response): void => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const todayStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) = ? AND status != 'cancelled'
    `).get(today) as { count: number; revenue: number };

    const weekStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) >= ? AND status != 'cancelled'
    `).get(weekStart) as { count: number; revenue: number };

    const monthStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE DATE(created_at) >= ? AND status != 'cancelled'
    `).get(monthStart) as { count: number; revenue: number };

    const totalStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE status != 'cancelled'
    `).get() as { count: number; revenue: number };

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM bookings GROUP BY status
    `).all() as { status: string; count: number }[];

    const vehicleStats = db.prepare(`
      SELECT vehicle_type, COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
      FROM bookings WHERE status != 'cancelled'
      GROUP BY vehicle_type
    `).all();

    const recentBookings = db.prepare(`
      SELECT id, booking_number, name, pickup_address, dropoff_address, pickup_datetime, vehicle_type, price, status, created_at
      FROM bookings ORDER BY created_at DESC LIMIT 5
    `).all();

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
router.post('/change-password', authenticateAdmin, (req: AuthRequest, res: Response): void => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Both passwords required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.adminId) as AdminUser;
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
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(newHash, req.adminId);

  res.json({ success: true, message: 'Password changed successfully' });
});

export default router;
