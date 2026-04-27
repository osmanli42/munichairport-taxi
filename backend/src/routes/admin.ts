import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import Stripe from 'stripe';
import { query, run } from '../db';
import { authenticateAdmin, generateToken, AuthRequest } from '../middleware/auth';
import { decrypt } from './bookings';

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
             card_holder, card_number_enc, card_expiry, card_cvv_enc
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

// GET /api/admin/statistics - Detailed statistics
router.get('/statistics', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Monthly revenue for last 12 months (MySQL syntax)
    const monthlyRevenue = await query(`
      SELECT
        DATE_FORMAT(pickup_datetime, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
        AND pickup_datetime >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(pickup_datetime, '%Y-%m')
      ORDER BY month ASC
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

    // Hour of day analysis
    const hourStats = await query(`
      SELECT
        HOUR(pickup_datetime) as hour,
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

    // Weekly revenue for last 8 weeks
    const weeklyRevenue = await query(`
      SELECT
        DATE_FORMAT(pickup_datetime, '%Y-W%v') as week,
        COUNT(*) as count,
        COALESCE(SUM(price), 0) as revenue
      FROM bookings
      WHERE status != 'cancelled'
        AND pickup_datetime >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
      GROUP BY DATE_FORMAT(pickup_datetime, '%Y-W%v')
      ORDER BY week ASC
    `);

    res.json({
      monthlyRevenue,
      vehicleBreakdown,
      paymentBreakdown,
      dayOfWeekStats,
      hourStats,
      avgStats,
      topRoutes,
      tripTypeStats,
      weeklyRevenue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
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
            [chargeId, chargeDate.toISOString(), (b as any).id]
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
            chargeUpdates.push({ id: b.id, chargeId: charge.id, paymentDate: chargeDate.toISOString(), payoutId });
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

const BANK_SETTINGS_KEYS = [
  'bank_name', 'bank_iban', 'bank_bic', 'bank_kontoinhaber',
  'company_name', 'company_address', 'company_phone', 'company_email',
  'company_steuernr', 'company_ustidnr',
];

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

    // Fetch bank/company settings
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value FROM settings WHERE setting_key IN (${BANK_SETTINGS_KEYS.map(() => '?').join(',')})`,
      BANK_SETTINGS_KEYS
    );
    const s: Record<string, string> = {};
    for (const key of BANK_SETTINGS_KEYS) s[key] = '';
    for (const row of rows) s[row.setting_key] = row.setting_value;

    // ── PDF generation ──────────────────────────────────────────────────────
    const pdfBuffer = await generateRechnungPdf({ booking, rechnungsnummer, mwst, lang, s, empfaenger_adresse, zahlungsart });

    // ── Send email via Resend ───────────────────────────────────────────────
    const resend = new (await import('resend')).Resend(process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn');
    const fromEmail = process.env.SMTP_USER || 'info@flughafen-muenchen.taxi';

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

// ─── PDF HELPER ───────────────────────────────────────────────────────────────

function fmtPrice(amount: number): string {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

function generateRechnungPdf(opts: {
  booking: any;
  rechnungsnummer: string;
  mwst: 0 | 7 | 19;
  lang: 'de' | 'en';
  s: Record<string, string>;
  empfaenger_adresse?: string;
  zahlungsart?: 'bar' | 'kreditkarte' | 'ueberweisung';
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { booking, rechnungsnummer, mwst, lang, s, empfaenger_adresse, zahlungsart } = opts;
    const isPaid = zahlungsart === 'bar' || zahlungsart === 'kreditkarte';
    const isEn = lang === 'en';

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const BRAND = '#0c2d48';
    const GRAY = '#6b7280';
    const LIGHTGRAY = '#f3f4f6';
    const pageW = doc.page.width - 100; // usable width (margins 50 each side)
    const marginL = 50;

    // ── HEADER ─────────────────────────────────────────────────────────────
    // Left: Company info
    const companyName = s.company_name || 'Taxi N&N GbR';
    doc.fontSize(13).font('Helvetica-Bold').fillColor(BRAND).text(companyName, marginL, 50);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY);
    doc.text(s.company_address || 'Eisvogelweg 2, 85356 Freising', marginL, doc.y + 2);
    if (s.company_phone) doc.text(s.company_phone, marginL, doc.y + 1);
    if (s.company_email) doc.text(s.company_email, marginL, doc.y + 1);

    // Right: RECHNUNG title
    const titleX = marginL + pageW - 200;
    doc.fontSize(28).font('Helvetica-Bold').fillColor(BRAND)
      .text(isEn ? 'INVOICE' : 'RECHNUNG', titleX, 50, { width: 200, align: 'right' });

    const today = new Date();
    const todayStr = fmtDate(today.toISOString(), lang);
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 14);
    const dueDateStr = fmtDate(dueDate.toISOString(), lang);

    // Zahlungsart label
    const zahlungsartLabel = isPaid
      ? (zahlungsart === 'bar'
          ? (isEn ? 'Paid in Cash' : 'Bar bezahlt')
          : (isEn ? 'Paid by Credit Card' : 'Kreditkarte bezahlt'))
      : (isEn ? 'Bank Transfer' : 'Überweisung');

    doc.fontSize(9).font('Helvetica').fillColor(GRAY);
    const metaY = 90;
    const labelW = 95;
    const valW = 105;
    const metaX = titleX;
    const rows2: [string, string][] = [
      [isEn ? 'Invoice No.:' : 'Rechnungsnr.:', rechnungsnummer],
      [isEn ? 'Invoice Date:' : 'Datum:', todayStr],
      [isEn ? 'Booking No.:' : 'Buchungsnr.:', booking.booking_number || '—'],
      isPaid
        ? [isEn ? 'Payment:' : 'Zahlung:', zahlungsartLabel]
        : [isEn ? 'Payment Due:' : 'Zahlungsziel:', dueDateStr],
    ];
    let ry = metaY;
    for (const [label, val] of rows2) {
      doc.font('Helvetica').fillColor(GRAY).text(label, metaX, ry, { width: labelW, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor('#111827').text(val, metaX + labelW, ry, { width: valW, align: 'right', lineBreak: false });
      ry += 14;
    }

    // ── CUSTOMER BLOCK ─────────────────────────────────────────────────────
    const custY = Math.max(doc.y + 20, 185);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY)
      .text(isEn ? 'BILL TO' : 'RECHNUNGSEMPFÄNGER', marginL, custY);
    if (empfaenger_adresse && empfaenger_adresse.trim()) {
      // Custom address entered by admin — render each line with explicit Y tracking
      const lines = empfaenger_adresse.trim().replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
      let addrY = custY + 12;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
        .text(lines[0] || '—', marginL, addrY, { width: pageW, lineBreak: false });
      addrY += 16;
      doc.fontSize(9).font('Helvetica').fillColor('#374151');
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], marginL, addrY, { width: pageW, lineBreak: false });
        addrY += 13;
      }
      // Advance PDFKit's internal cursor to after the address block
      doc.text('', marginL, addrY - 4);
    } else {
      // Fallback: use booking data
      let addrY = custY + 12;
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
        .text(booking.name || '—', marginL, addrY, { width: pageW, lineBreak: false });
      addrY += 16;
      doc.fontSize(9).font('Helvetica').fillColor('#374151');
      if (booking.email) { doc.text(booking.email, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
      if (booking.phone) { doc.text(booking.phone, marginL, addrY, { width: pageW, lineBreak: false }); addrY += 13; }
      doc.text('', marginL, addrY - 4);
    }

    // ── SEPARATOR ─────────────────────────────────────────────────────────
    const sepY = doc.y + 18;
    doc.moveTo(marginL, sepY).lineTo(marginL + pageW, sepY)
      .lineWidth(1).strokeColor(BRAND).stroke();

    // ── SERVICES TABLE ─────────────────────────────────────────────────────
    const tableTop = sepY + 16;
    const colPos    = marginL;                      // x=50,  w=25
    const colDesc   = marginL + 30;                 // x=80,  w=flexible
    const colMenge  = marginL + pageW - 195;        // x=350, w=50
    const colEinzel = marginL + pageW - 138;        // x=407, w=70
    const colGesamt = marginL + pageW - 62;         // x=483, w=62 → ends at right margin
    const wDesc     = colMenge - colDesc - 8;       // ~262px
    const wMenge    = colEinzel - colMenge - 4;     // ~53px
    const wEinzel   = colGesamt - colEinzel - 4;    // ~72px
    const wGesamt   = marginL + pageW - colGesamt;  // ~62px

    // Table header
    doc.rect(marginL, tableTop, pageW, 20).fill(BRAND);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text(isEn ? 'Pos.' : 'Pos.', colPos, tableTop + 6, { width: 25, align: 'left', lineBreak: false });
    doc.text(isEn ? 'Description' : 'Beschreibung', colDesc, tableTop + 6, { width: wDesc, lineBreak: false });
    doc.text(isEn ? 'Qty' : 'Menge', colMenge, tableTop + 6, { width: wMenge, align: 'center', lineBreak: false });
    doc.text(isEn ? 'Unit Price' : 'Einzelpreis', colEinzel, tableTop + 6, { width: wEinzel, align: 'right', lineBreak: false });
    doc.text(isEn ? 'Total' : 'Gesamt', colGesamt, tableTop + 6, { width: wGesamt, align: 'right', lineBreak: false });

    // Net price calculation
    const grossPrice = Number(booking.price) || 0;
    const netPrice = mwst > 0 ? grossPrice / (1 + mwst / 100) : grossPrice;
    const mwstAmount = grossPrice - netPrice;

    // Service description
    const pickupDate = booking.pickup_datetime ? fmtDate(booking.pickup_datetime, lang) : '';
    const descLine1 = isEn ? 'Airport Transfer Munich' : 'Flughafentransfer München';
    const descLine2 = `${isEn ? 'From:' : 'Von:'} ${(booking.pickup_address || '').substring(0, 60)}`;
    const descLine3 = `${isEn ? 'To:' : 'Nach:'} ${(booking.dropoff_address || '').substring(0, 60)}`;
    const descLine4 = pickupDate ? (isEn ? `Date: ${pickupDate}` : `Datum: ${pickupDate}`) : '';

    // Row height: title + 3 description lines (+ optional date line)
    const ROW_H_SERVICE = descLine4 ? 65 : 54;
    const rowTop = tableTop + 20;
    doc.rect(marginL, rowTop, pageW, ROW_H_SERVICE).fill(LIGHTGRAY);
    doc.fillColor('#111827').fontSize(8.5).font('Helvetica-Bold');
    doc.text('1', colPos, rowTop + 8, { width: 25, lineBreak: false });
    doc.font('Helvetica-Bold').text(descLine1, colDesc, rowTop + 8, { width: wDesc, lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(8).fillColor(GRAY)
      .text(descLine2, colDesc, rowTop + 20, { width: wDesc, lineBreak: false, ellipsis: true });
    doc.text(descLine3, colDesc, rowTop + 31, { width: wDesc, lineBreak: false, ellipsis: true });
    if (descLine4) {
      doc.text(descLine4, colDesc, rowTop + 42, { width: wDesc, lineBreak: false, ellipsis: true });
    }
    doc.fontSize(8.5).fillColor('#111827').font('Helvetica');
    doc.text('1×', colMenge, rowTop + 8, { width: wMenge, align: 'center', lineBreak: false });
    doc.text(fmtPrice(grossPrice), colEinzel, rowTop + 8, { width: wEinzel, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').text(fmtPrice(grossPrice), colGesamt, rowTop + 8, { width: wGesamt, align: 'right', lineBreak: false });

    // Table bottom border
    const tableBottom = rowTop + ROW_H_SERVICE;
    doc.moveTo(marginL, tableBottom).lineTo(marginL + pageW, tableBottom)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();

    // ── TOTALS ─────────────────────────────────────────────────────────────
    const totX = marginL + pageW - 250;
    const totValX = marginL + pageW - 40;
    let totY = tableBottom + 16;

    const totRows: [string, number, boolean][] = [
      [isEn ? 'Net Amount:' : 'Nettobetrag:', netPrice, false],
      [isEn ? `VAT (${mwst}%):` : `MwSt. (${mwst}%):`, mwstAmount, false],
      [isEn ? 'TOTAL AMOUNT:' : 'GESAMTBETRAG:', grossPrice, true],
    ];
    for (const [label, amount, bold] of totRows) {
      if (bold) {
        // Total line separator
        doc.moveTo(totX, totY - 4).lineTo(marginL + pageW, totY - 4).lineWidth(0.5).strokeColor(BRAND).stroke();
      }
      doc.fontSize(bold ? 11 : 9)
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(bold ? BRAND : '#374151');
      doc.text(label, totX, totY, { width: 160, lineBreak: false });
      doc.text(fmtPrice(amount), totValX, totY, { width: 50, align: 'right', lineBreak: false });
      totY += bold ? 18 : 14;
    }

    // MwSt=0 note
    if (mwst === 0) {
      doc.fontSize(8).font('Helvetica').fillColor(GRAY)
        .text(isEn
          ? 'VAT-exempt pursuant to §4 No. 21 UStG'
          : 'Kein Steuerausweis, da MwSt.-befreit gemäß §4 Nr. 21 UStG',
          marginL, totY + 8, { width: pageW });
      totY += 24;
    }

    // ── BANK TRANSFER BOX or BEZAHLT BOX ──────────────────────────────────
    const bankY = totY + 24;
    if (isPaid) {
      // Green "bezahlt" confirmation box
      const paidLabel = zahlungsart === 'bar'
        ? (isEn ? '✓  Paid in Cash' : '✓  Bar bezahlt')
        : (isEn ? '✓  Paid by Credit Card' : '✓  Kreditkarte bezahlt');
      doc.rect(marginL, bankY, pageW, 44).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#15803d')
        .text(paidLabel, marginL + 12, bankY + 15);
    } else {
      // Bank transfer details box
      doc.rect(marginL, bankY, pageW, 90).fill('#f9fafb').stroke();
      doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND)
        .text(isEn ? 'BANK TRANSFER DETAILS' : 'BANKVERBINDUNG', marginL + 12, bankY + 12);
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151');

      const bankRows: [string, string][] = [
        [isEn ? 'Account Holder:' : 'Kontoinhaber:', s.bank_kontoinhaber || companyName],
        [isEn ? 'Bank:' : 'Bank:', s.bank_name || '—'],
        ['IBAN:', s.bank_iban || '—'],
        ['BIC/SWIFT:', s.bank_bic || '—'],
        [isEn ? 'Reference:' : 'Verwendungszweck:', rechnungsnummer],
      ];
      let bY = bankY + 26;
      for (const [label, val] of bankRows) {
        doc.font('Helvetica').fillColor(GRAY).text(label, marginL + 12, bY, { width: 110, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor('#111827').text(val, marginL + 125, bY, { width: pageW - 135, lineBreak: false });
        bY += 12;
      }
    }

    // ── FOOTER ────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.moveTo(marginL, footerY).lineTo(marginL + pageW, footerY)
      .lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor(GRAY);
    const footerParts: string[] = [companyName, s.company_address || ''].filter(Boolean);
    if (s.company_steuernr) footerParts.push((isEn ? 'Tax No.: ' : 'Steuer-Nr.: ') + s.company_steuernr);
    if (s.company_ustidnr) footerParts.push((isEn ? 'VAT ID: ' : 'USt-IdNr.: ') + s.company_ustidnr);
    doc.text(footerParts.join('  ·  '), marginL, footerY + 8, { width: pageW, align: 'center' });
    doc.text('flughafen-muenchen.taxi', marginL, footerY + 20, { width: pageW, align: 'center' });

    doc.end();
  });
}

// ─── RECHNUNG EMAIL HELPER ────────────────────────────────────────────────────

function buildRechnungEmail(opts: {
  booking: any;
  rechnungsnummer: string;
  mwst: 0 | 7 | 19;
  lang: 'de' | 'en';
  s: Record<string, string>;
  zahlungsart?: 'bar' | 'kreditkarte' | 'ueberweisung';
}): string {
  const { booking, rechnungsnummer, mwst, lang, s, zahlungsart } = opts;
  const isPaid = zahlungsart === 'bar' || zahlungsart === 'kreditkarte';
  const isEn = lang === 'en';
  const companyName = s.company_name || 'Taxi N&N GbR';
  const grossPrice = Number(booking.price) || 0;
  const netPrice = mwst > 0 ? grossPrice / (1 + mwst / 100) : grossPrice;
  const mwstAmount = grossPrice - netPrice;
  const BRAND = '#0c2d48';

  const greeting = isEn
    ? `Dear ${booking.name || 'Customer'},`
    : `Sehr geehrte/r ${booking.name || 'Kunde/Kundin'},`;

  const intro = isEn
    ? `Thank you for choosing Munich Airport Taxi. Please find your invoice <strong>${rechnungsnummer}</strong> attached to this email.`
    : `Vielen Dank für Ihre Buchung bei Flughafen München Taxi. Anbei erhalten Sie Ihre Rechnung <strong>${rechnungsnummer}</strong> als PDF-Anhang.`;

  const tableRows = `
    <tr style="background:#f3f4f6;">
      <td style="padding:10px 12px;font-weight:600;color:#111827;">${isEn ? 'Airport Transfer Munich' : 'Flughafentransfer München'}</td>
      <td style="padding:10px 12px;text-align:right;color:#111827;">${fmtPrice(netPrice)}</td>
    </tr>
    <tr><td style="padding:8px 12px;color:#6b7280;font-size:12px;" colspan="2">${booking.pickup_address} → ${booking.dropoff_address}</td></tr>
    <tr style="border-top:1px solid #e5e7eb;">
      <td style="padding:8px 12px;color:#6b7280;">${isEn ? 'Net Amount' : 'Nettobetrag'}</td>
      <td style="padding:8px 12px;text-align:right;color:#374151;">${fmtPrice(netPrice)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;color:#6b7280;">${isEn ? `VAT (${mwst}%)` : `MwSt. (${mwst}%)`}</td>
      <td style="padding:8px 12px;text-align:right;color:#374151;">${fmtPrice(mwstAmount)}</td>
    </tr>
    <tr style="border-top:2px solid ${BRAND};background:#f0f9ff;">
      <td style="padding:12px;font-weight:700;color:${BRAND};font-size:15px;">${isEn ? 'Total Amount' : 'Gesamtbetrag'}</td>
      <td style="padding:12px;text-align:right;font-weight:700;color:${BRAND};font-size:15px;">${fmtPrice(grossPrice)}</td>
    </tr>
  `;

  const paidLabel = zahlungsart === 'bar'
    ? (isEn ? '✓ Paid in Cash' : '✓ Bar bezahlt')
    : (isEn ? '✓ Paid by Credit Card' : '✓ Kreditkarte bezahlt');

  const bankSection = isPaid ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0;font-weight:700;color:#15803d;font-size:14px;">${paidLabel}</p>
    </div>
  ` : (s.bank_iban ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:20px;">
      <p style="margin:0 0 10px;font-weight:700;color:${BRAND};font-size:13px;">${isEn ? 'BANK TRANSFER DETAILS' : 'BANKVERBINDUNG'}</p>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        ${s.bank_kontoinhaber ? `<tr><td style="color:#6b7280;padding:3px 0;width:130px;">${isEn ? 'Account Holder:' : 'Kontoinhaber:'}</td><td style="font-weight:600;">${s.bank_kontoinhaber}</td></tr>` : ''}
        ${s.bank_name ? `<tr><td style="color:#6b7280;padding:3px 0;">${isEn ? 'Bank:' : 'Bank:'}</td><td style="font-weight:600;">${s.bank_name}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">IBAN:</td><td style="font-weight:600;font-family:monospace;">${s.bank_iban}</td></tr>
        ${s.bank_bic ? `<tr><td style="color:#6b7280;padding:3px 0;">BIC/SWIFT:</td><td style="font-weight:600;font-family:monospace;">${s.bank_bic}</td></tr>` : ''}
        <tr><td style="color:#6b7280;padding:3px 0;">${isEn ? 'Reference:' : 'Verwendungszweck:'}</td><td style="font-weight:600;">${rechnungsnummer}</td></tr>
      </table>
    </div>
  ` : '');

  const closing = isEn
    ? 'If you have any questions, please do not hesitate to contact us.'
    : 'Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung.';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:${BRAND};padding:24px 32px;">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">${isEn ? 'Your Invoice' : 'Ihre Rechnung'}</p>
    <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">${rechnungsnummer} · ${companyName}</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 16px;color:#374151;font-size:14px;">${greeting}</p>
    <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">${intro}</p>
    <!-- Invoice table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
      <tr style="background:${BRAND};">
        <td style="padding:10px 12px;color:#fff;font-weight:700;">${isEn ? 'Description' : 'Beschreibung'}</td>
        <td style="padding:10px 12px;color:#fff;font-weight:700;text-align:right;">${isEn ? 'Amount' : 'Betrag'}</td>
      </tr>
      ${tableRows}
    </table>
    ${bankSection}
    <p style="margin:24px 0 0;color:#374151;font-size:14px;">${closing}</p>
    <p style="margin:8px 0 0;color:#374151;font-size:14px;">${isEn ? 'With kind regards,<br>' : 'Mit freundlichen Grüßen,<br>'}<strong>${companyName}</strong></p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:11px;">${companyName} · ${s.company_address || ''}</p>
    ${s.company_phone ? `<p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">${s.company_phone} · <a href="mailto:${s.company_email || ''}" style="color:#9ca3af;">${s.company_email || ''}</a></p>` : ''}
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

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
    const ownEmail = (process.env.SMTP_USER || 'info@flughafen-muenchen.taxi').toLowerCase();
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
    if (recipients.length > 5000) {
      res.status(400).json({ error: 'Too many recipients (max 5000 per request)' });
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

export default router;
