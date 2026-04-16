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

// GET /api/admin/report/finanzamt - Generate PDF report for Finanzamt
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

    // Filter by stripe_payment_date (actual payment received date)
    const bookings = await query(`
      SELECT booking_number, created_at, pickup_datetime, name, pickup_address, dropoff_address, price, steuersatz, stripe_payment_date
      FROM bookings
      WHERE payment_method = 'card' AND status != 'cancelled'
        AND stripe_payment_date IS NOT NULL
        AND DATE(stripe_payment_date) >= ? AND DATE(stripe_payment_date) < ?
      ORDER BY stripe_payment_date ASC
    `, [dateFrom, dateTo]);

    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const title = `Kreditkartenzahlungen — ${monthNames[month - 1]} ${year}`;

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

    // Page width in landscape = 841.89, margins 30 each side → usable = 781
    const pageW = 781;
    const startX = 30;

    // Column definitions: [x, width, label, align]
    // Buchungsnr(105) | Zahldatum(65) | Fahrtdatum(65) | Name(100) | Von(140) | Nach(140) | Preis(60) | MwSt(50)
    const cols = [
      { x: startX,       w: 105, label: 'Buchungsnr.',  align: 'left'  as const },
      { x: startX+105,   w: 65,  label: 'Zahldatum',    align: 'left'  as const },
      { x: startX+170,   w: 65,  label: 'Fahrtdatum',   align: 'left'  as const },
      { x: startX+235,   w: 105, label: 'Name',         align: 'left'  as const },
      { x: startX+340,   w: 155, label: 'Von',          align: 'left'  as const },
      { x: startX+495,   w: 155, label: 'Nach',         align: 'left'  as const },
      { x: startX+650,   w: 65,  label: 'Preis',        align: 'right' as const },
      { x: startX+715,   w: 50,  label: 'MwSt.',        align: 'center'as const },
    ];

    const drawHeader = () => {
      doc.fontSize(8).font('Helvetica-Bold');
      const hy = doc.y;
      cols.forEach(c => {
        doc.text(c.label, c.x, hy, { width: c.w, align: c.align, lineBreak: false });
      });
      doc.moveDown(0.15);
      const lineY = doc.y + 2;
      doc.moveTo(startX, lineY).lineTo(startX + pageW, lineY).lineWidth(0.5).stroke();
      doc.y = lineY + 4;
    };

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text(title, startX, 30, { width: pageW, align: 'center' });
    doc.fontSize(8).font('Helvetica').text(
      `Erstellt am: ${new Date().toLocaleDateString('de-DE')} | Zeitraum: ${monthNames[month - 1]} ${year} (nach Zahlungsdatum)`,
      startX, doc.y + 4, { width: pageW, align: 'center' }
    );
    doc.moveDown(0.8);

    if (bookings.length === 0) {
      doc.fontSize(11).text('Keine Kreditkartenzahlungen in diesem Zeitraum.', { align: 'center' });
      doc.end();
      return;
    }

    drawHeader();

    let total7 = 0, total19 = 0, totalUnset = 0;
    let count7 = 0, count19 = 0, countUnset = 0;
    const ROW_H = 14;

    // Helper function to apply same rounding as frontend's formatPrice
    const formatPriceForPDF = (price: number): number => {
      return Math.ceil(price * 2) / 2;
    };

    doc.font('Helvetica').fontSize(7.5);
    for (const b of bookings) {
      if (doc.y > 530) {
        doc.addPage();
        drawHeader();
        doc.font('Helvetica').fontSize(7.5);
      }

      const zahlDatumRaw = b.stripe_payment_date || b.created_at;
      const zahlDatum = zahlDatumRaw ? new Date(zahlDatumRaw).toLocaleDateString('de-DE') : '—';
      const fahrtDatum = b.pickup_datetime ? new Date(b.pickup_datetime).toLocaleDateString('de-DE') : '—';
      const name = (b.name || '').substring(0, 22);
      const pickup = (b.pickup_address || '').replace(/, Deutschland$/, '').substring(0, 35);
      const dropoff = (b.dropoff_address || '').replace(/, Deutschland$/, '').substring(0, 35);
      const roundedPrice = formatPriceForPDF(b.price || 0);
      const priceStr = `${roundedPrice.toFixed(2)} €`;
      const tax = b.steuersatz ? `${b.steuersatz}%` : '—';

      if (b.steuersatz === 7) { total7 += roundedPrice; count7++; }
      else if (b.steuersatz === 19) { total19 += roundedPrice; count19++; }
      else { totalUnset += roundedPrice; countUnset++; }

      // Draw alternating row background
      const rowY = doc.y;
      const values = [b.booking_number || '', zahlDatum, fahrtDatum, name, pickup, dropoff, priceStr, tax];
      const aligns: Array<'left'|'right'|'center'> = ['left','left','left','left','left','left','right','center'];
      cols.forEach((c, i) => {
        doc.text(values[i], c.x, rowY, { width: c.w, align: aligns[i], lineBreak: false });
      });
      doc.y = rowY + ROW_H;
    }

    // Summary
    doc.moveDown(0.8);
    const sumLineY = doc.y;
    doc.moveTo(startX, sumLineY).lineTo(startX + pageW, sumLineY).lineWidth(0.8).stroke();
    doc.y = sumLineY + 6;

    doc.fontSize(10).font('Helvetica-Bold').text('Zusammenfassung', startX, doc.y);
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica');

    // Two-column summary layout
    const colLeft = startX;
    const colRight = startX + 300;
    const sumY = doc.y;

    doc.text(`7% MwSt.:`, colLeft, sumY, { width: 100, lineBreak: false });
    doc.text(`${count7} Fahrten`, colLeft + 100, sumY, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').text(`${total7.toFixed(2)} €`, colLeft + 200, sumY, { width: 80, align: 'right', lineBreak: false });
    doc.font('Helvetica');

    doc.text(`19% MwSt.:`, colRight, sumY, { width: 100, lineBreak: false });
    doc.text(`${count19} Fahrten`, colRight + 100, sumY, { width: 100, lineBreak: false });
    doc.font('Helvetica-Bold').text(`${total19.toFixed(2)} €`, colRight + 200, sumY, { width: 80, align: 'right', lineBreak: false });
    doc.font('Helvetica');

    doc.y = sumY + 16;
    const totalY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Gesamt: ${bookings.length} Fahrten`, colLeft, totalY, { width: 200, lineBreak: false });
    doc.text(`${(total7 + total19 + totalUnset).toFixed(2)} €`, colLeft + 200, totalY, { width: 80, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(9);

    if (countUnset > 0) {
      doc.y = totalY + 20;
      doc.fillColor('#cc0000').text(
        `⚠  ${countUnset} Fahrten ohne Steuersatz (${totalUnset.toFixed(2)} €) — bitte vor Abgabe ergänzen!`,
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

// POST /api/admin/stripe/auto-sync - Fetch charges directly from Stripe and match bookings
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

    // Fetch all successful charges in the given month
    const charges: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const params: any = {
        created: { gte: Math.floor(dateFrom.getTime() / 1000), lt: Math.floor(dateTo.getTime() / 1000) },
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const page = await stripe.charges.list(params);
      charges.push(...page.data.filter(c => c.paid && !c.refunded));
      hasMore = page.has_more;
      if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id;
    }

    let matched = 0;
    let unmatched = 0;
    const details: any[] = [];

    for (const charge of charges) {
      const chargeDate = new Date(charge.created * 1000);
      const chargeMin = new Date(chargeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const chargeMax = new Date(chargeDate.getTime() + 7 * 24 * 60 * 60 * 1000);

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
      for (const b of candidates as any[]) {
        const roundedCents = Math.round(Math.ceil(b.price * 2) / 2 * 100);
        if (roundedCents === charge.amount) {
          await run(
            'UPDATE bookings SET stripe_charge_id = ?, stripe_payment_date = ? WHERE id = ?',
            [charge.id, chargeDate.toISOString(), b.id]
          );
          matched++;
          details.push({ charge_id: charge.id, booking_number: b.booking_number, amount: charge.amount / 100, status: 'matched' });
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        unmatched++;
        details.push({ charge_id: charge.id, amount: charge.amount / 100, date: chargeDate.toISOString(), status: 'unmatched' });
      }
    }

    res.json({ total: charges.length, matched, unmatched, details });
  } catch (error: any) {
    console.error('Stripe auto-sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync with Stripe' });
  }
});

export default router;
