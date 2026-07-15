import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, run } from '../db';
import {
  CompanyAuthRequest,
  authenticateCompany,
  generateCompanyToken,
  checkLoginRateLimit,
  resetLoginAttempts,
} from '../middleware/companyAuth';
import { generateRechnungPdf, generateSammelrechnungPdf, fetchBankSettings, fmtPrice, roundGrossPrice, fmtDate, wrapBrandedEmail } from '../services/rechnung';
import { createSetupIntent, attachPaymentMethod, detachPaymentMethod, getCompanyForCharge } from '../services/stripeCards';

const router = Router();

function monthRange(yearMonth: string): [string, string] {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

// ─── PUBLIC: APPLY ──────────────────────────────────────────────────────────

router.post('/apply', async (req, res): Promise<void> => {
  try {
    const [setting] = await query<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE setting_key = 'b2b_applications_enabled'"
    );
    if (setting && setting.setting_value === '0') {
      res.status(403).json({ error: 'New company applications are currently disabled' });
      return;
    }

    const { company_name, contact_name, email, phone, address, ust_idnr, message } = req.body;
    if (!company_name || !contact_name || !email || !phone) {
      res.status(400).json({ error: 'company_name, contact_name, email, phone required' });
      return;
    }

    const [existing] = await query('SELECT id FROM companies WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'A company with this email already exists' });
      return;
    }

    await run(
      `INSERT INTO companies (company_name, contact_name, email, phone, address, ust_idnr, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [company_name, contact_name, email, phone, address || '', ust_idnr || '', message || '']
    );

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminEmail = 'info@flughafen-muenchen.taxi';
      const applyBody = `
          <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
            <p style="margin:0;color:#1e40af;font-weight:600;font-size:15px;">📥 Neue Firmenkundenanfrage</p>
          </div>
          <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:120px;">Firma:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${company_name}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Kontakt:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${contact_name}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">E-Mail:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${email}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Telefon:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${phone}</td></tr>
              ${address ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Adresse:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${address}</td></tr>` : ''}
              ${ust_idnr ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">USt-IdNr.:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${ust_idnr}</td></tr>` : ''}
            </table>
            ${message ? `<p style="margin:12px 0 0;color:#374151;font-size:14px;"><strong>Nachricht:</strong> ${message}</p>` : ''}
          </div>
          <div style="text-align:center;margin:28px 0 4px;">
            <a href="${process.env.SITE_URL || 'https://flughafen-muenchen.taxi'}/admin" style="display:inline-block;background:#0c2d48;color:#fbbf24;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;text-decoration:none;">Im Admin-Panel prüfen →</a>
          </div>`;
      await resend.emails.send({
        from: `Flughafen München Taxi <${adminEmail}>`,
        to: adminEmail,
        subject: `Neue Firmenkundenanfrage: ${company_name}`,
        html: wrapBrandedEmail({ title: 'Neue Firmenkundenanfrage', bodyHtml: applyBody }),
      });
    } catch (emailErr) {
      console.error('Company application notification email failed:', emailErr);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Company apply error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit application' });
  }
});

// ─── PUBLIC: LOGIN ──────────────────────────────────────────────────────────

router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password required' });
      return;
    }

    if (!checkLoginRateLimit(email.toLowerCase())) {
      res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
      return;
    }

    const [user] = await query(
      `SELECT cu.*, c.status AS company_status, c.company_name
       FROM company_users cu JOIN companies c ON cu.company_id = c.id
       WHERE cu.email = ?`,
      [email.toLowerCase()]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.company_status !== 'active') {
      res.status(403).json({ error: 'Company account is not active' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    resetLoginAttempts(email.toLowerCase());

    await run('UPDATE company_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = generateCompanyToken(user.id, user.company_id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        must_change_password: !!user.must_change_password,
        company_name: user.company_name,
        company_id: user.company_id,
      },
    });
  } catch (error: any) {
    console.error('Company login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── AUTHENTICATED ROUTES ───────────────────────────────────────────────────

router.get('/me', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const [user] = await query(
      `SELECT cu.id, cu.name, cu.email, cu.role, cu.must_change_password,
              c.company_name, c.contact_name, c.phone AS company_phone, c.address, c.ust_idnr,
              c.discount_percent, c.discount_kombinierbar, c.pg_discount_override, c.allowed_payment_methods, c.id AS company_id,
              c.card_brand, c.card_last4, c.card_exp_month, c.card_exp_year, c.charge_mode
       FROM company_users cu JOIN companies c ON cu.company_id = c.id
       WHERE cu.id = ?`,
      [req.companyUserId]
    );
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const [trackingSetting] = await query(
      "SELECT setting_value FROM settings WHERE setting_key = 'portal_tracking_enabled'", []
    );
    const portalTrackingEnabled = trackingSetting?.setting_value === '1';

    res.json({
      ...user,
      must_change_password: !!user.must_change_password,
      portal_tracking_enabled: portalTrackingEnabled,
      has_saved_card: !!user.card_last4,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }

    const { company_name, contact_name, phone, address, ust_idnr } = req.body;
    if (!company_name || !contact_name || !phone || !address) {
      res.status(400).json({ error: 'company_name, contact_name, phone and address are required' });
      return;
    }

    await run(
      'UPDATE companies SET company_name = ?, contact_name = ?, phone = ?, address = ?, ust_idnr = ? WHERE id = ?',
      [company_name, contact_name, phone, address, ust_idnr || null, req.companyId]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── PAYMENT METHOD (Stripe card on file) ──────────────────────────────────

router.post('/payment-method/setup-intent', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
    const company = await getCompanyForCharge(req.companyId!);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    const { client_secret } = await createSetupIntent(company);
    res.json({ client_secret });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start card setup' });
  }
});

router.post('/payment-method/confirm', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
    const { payment_method_id } = req.body;
    if (!payment_method_id) { res.status(400).json({ error: 'payment_method_id required' }); return; }
    const company = await getCompanyForCharge(req.companyId!);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    const card = await attachPaymentMethod(company, payment_method_id);
    res.json({ success: true, card });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save card' });
  }
});

router.delete('/payment-method', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
    const company = await getCompanyForCharge(req.companyId!);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    await detachPaymentMethod(company);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove card' });
  }
});

router.post('/change-password', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password) {
      res.status(400).json({ error: 'Current password is required' });
      return;
    }
    if (!new_password || new_password.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    const [user] = await query('SELECT password_hash FROM company_users WHERE id = ?', [req.companyUserId]);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

    const hash = await bcrypt.hash(new_password, 10);
    await run('UPDATE company_users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [hash, req.companyUserId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── BOOKINGS ───────────────────────────────────────────────────────────────

router.get('/bookings', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const scope = req.query.scope as string || 'all';
    let whereExtra = '';
    if (scope === 'upcoming') whereExtra = ' AND b.pickup_datetime >= NOW()';
    else if (scope === 'past') whereExtra = ' AND b.pickup_datetime < NOW()';

    const bookings = await query(
      `SELECT b.*, cu.name AS booked_by_name
       FROM bookings b LEFT JOIN company_users cu ON b.company_user_id = cu.id
       WHERE b.company_id = ?${whereExtra}
       ORDER BY b.pickup_datetime DESC`,
      [req.companyId]
    );
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/bookings.csv', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    let dateFilter = '';
    const params: any[] = [req.companyId];
    if (from) { dateFilter += ' AND b.pickup_datetime >= ?'; params.push(from); }
    if (to) { dateFilter += ' AND b.pickup_datetime <= ?'; params.push(to + ' 23:59:59'); }

    const bookings = await query(
      `SELECT b.*, cu.name AS booked_by_name
       FROM bookings b LEFT JOIN company_users cu ON b.company_user_id = cu.id
       WHERE b.company_id = ?${dateFilter}
       ORDER BY b.pickup_datetime DESC`,
      params
    );

    const header = 'Datum;Buchungsnr;Gast;Von;Nach;Kostenstelle;Preis;Status;Gebucht von\n';
    const rows = bookings.map((b: any) => {
      const date = b.pickup_datetime ? fmtDate(b.pickup_datetime, 'de') : '';
      const price = roundGrossPrice(Number(b.price) || 0).toFixed(2).replace('.', ',');
      return [date, b.booking_number, b.name, b.pickup_address, b.dropoff_address, b.cost_center || '', price, b.status, b.booked_by_name || ''].join(';');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=fahrten_${req.companyId}_${new Date().toISOString().slice(0,10)}.csv`);
    res.send('﻿' + header + rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

router.get('/stats', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    const [thisStart, thisEnd] = monthRange(thisMonth);
    const [lastStart, lastEnd] = monthRange(lastMonth);

    const [thisMonthStats] = await query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS total
       FROM bookings WHERE company_id = ? AND pickup_datetime >= ? AND pickup_datetime < ? AND status != 'cancelled'`,
      [req.companyId, thisStart, thisEnd]
    );
    const [lastMonthStats] = await query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS total
       FROM bookings WHERE company_id = ? AND pickup_datetime >= ? AND pickup_datetime < ? AND status != 'cancelled'`,
      [req.companyId, lastStart, lastEnd]
    );

    const [company] = await query('SELECT discount_percent FROM companies WHERE id = ?', [req.companyId]);
    const discount = Number(company?.discount_percent) || 0;
    const thisTotal = Number(thisMonthStats?.total) || 0;
    const savedThisMonth = discount > 0 ? (thisTotal / (1 - discount / 100)) * (discount / 100) : 0;

    res.json({
      this_month: { count: Number(thisMonthStats?.count) || 0, total: thisTotal },
      last_month: { count: Number(lastMonthStats?.count) || 0, total: Number(lastMonthStats?.total) || 0 },
      discount_percent: discount,
      saved_this_month: Math.round(savedThisMonth * 100) / 100,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/bookings/:id/cancel', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const [booking] = await query(
      'SELECT * FROM bookings WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status === 'cancelled') { res.status(400).json({ error: 'Already cancelled' }); return; }

    const pickupTime = new Date(booking.pickup_datetime);
    if (pickupTime <= new Date()) {
      res.status(400).json({ error: 'Cannot cancel past bookings' });
      return;
    }

    await run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [req.params.id]);

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminEmail = 'info@flughafen-muenchen.taxi';
      const cancelBody = `
          <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
            <p style="margin:0;color:#991b1b;font-weight:600;font-size:15px;">⚠ Buchung storniert</p>
          </div>
          <div style="background:#f8f9fa;border-radius:8px;padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:120px;">Buchung:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${booking.booking_number}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Firmenkunde:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${req.companyName}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Gast:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${booking.name}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Route:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${booking.pickup_address} → ${booking.dropoff_address}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Datum:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${booking.pickup_datetime}</td></tr>
            </table>
          </div>`;
      await resend.emails.send({
        from: `Flughafen München Taxi <${adminEmail}>`,
        to: adminEmail,
        subject: `Stornierung: ${booking.booking_number} (Firmenkunde: ${req.companyName})`,
        html: wrapBrandedEmail({ title: 'Buchung storniert', bodyHtml: cancelBody }),
      });
    } catch (emailErr) {
      console.error('Cancel notification email failed:', emailErr);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// ─── SINGLE BOOKING RECHNUNG PDF ────────────────────────────────────────────

router.get('/bookings/:id/rechnung.pdf', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const [booking] = await query(
      'SELECT * FROM bookings WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

    if (!booking.rechnung_number) {
      const rechnungNr = `FKP-${new Date().getFullYear()}-${booking.id}`;
      await run('UPDATE bookings SET rechnung_number = ? WHERE id = ?', [rechnungNr, booking.id]);
      booking.rechnung_number = rechnungNr;
    }

    const [company] = await query('SELECT * FROM companies WHERE id = ?', [req.companyId]);
    const empfaengerLines = [
      company.company_name,
      `z.Hd. ${company.contact_name}`,
      company.address,
      company.ust_idnr ? `USt-IdNr.: ${company.ust_idnr}` : '',
    ].filter(Boolean);

    const s = await fetchBankSettings();
    const pdfBuffer = await generateRechnungPdf({
      booking,
      rechnungsnummer: booking.rechnung_number,
      mwst: 19,
      lang: 'de',
      s,
      empfaenger_adresse: empfaengerLines.join('\n'),
      zahlungsart: 'ueberweisung',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Rechnung_${booking.rechnung_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// ─── SAMMELRECHNUNGEN (COLLECTIVE INVOICES) ─────────────────────────────────

router.get('/invoices', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const invoices = await query(
      `SELECT * FROM company_invoices WHERE company_id = ? ORDER BY created_at DESC`,
      [req.companyId]
    );
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id/rechnung.pdf', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const [invoice] = await query(
      'SELECT * FROM company_invoices WHERE id = ? AND company_id = ?',
      [req.params.id, req.companyId]
    );
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const bookingIds = JSON.parse(invoice.booking_ids || '[]');
    const bookings = bookingIds.length > 0
      ? await query(`SELECT * FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`, bookingIds)
      : [];

    const [company] = await query('SELECT * FROM companies WHERE id = ?', [req.companyId]);
    const s = await fetchBankSettings();

    const pdfBuffer = await generateSammelrechnungPdf({
      company: { company_name: company.company_name, contact_name: company.contact_name, address: company.address, ust_idnr: company.ust_idnr },
      invoiceNumber: invoice.invoice_number,
      periodMonth: invoice.period_month,
      mwst: Number(invoice.mwst_satz) as 0 | 7 | 19,
      bookings,
      total: Number(invoice.total),
      dueDate: invoice.due_date,
      mahngebuehr: Number(invoice.mahngebuehr) || 0,
      reminderLevel: Number(invoice.reminder_level) || 0,
      s,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Sammelrechnung_${invoice.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
});

// ─── FAVORITES ──────────────────────────────────────────────────────────────

router.get('/favorites', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const favorites = await query(
      'SELECT * FROM company_favorites WHERE company_id = ? ORDER BY label',
      [req.companyId]
    );
    res.json(favorites);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/favorites', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    const { label, pickup_address, dropoff_address, vehicle_type } = req.body;
    if (!label || !pickup_address || !dropoff_address) {
      res.status(400).json({ error: 'label, pickup_address, dropoff_address required' });
      return;
    }
    await run(
      'INSERT INTO company_favorites (company_id, label, pickup_address, dropoff_address, vehicle_type) VALUES (?, ?, ?, ?, ?)',
      [req.companyId, label, pickup_address, dropoff_address, vehicle_type || 'sedan']
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save favorite' });
  }
});

router.delete('/favorites/:id', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM company_favorites WHERE id = ? AND company_id = ?', [req.params.id, req.companyId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete favorite' });
  }
});

// ─── USER MANAGEMENT (company admin only) ───────────────────────────────────

router.get('/users', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
    const users = await query(
      'SELECT id, name, email, role, last_login_at, created_at FROM company_users WHERE company_id = ?',
      [req.companyId]
    );
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }

    const { name, email, role } = req.body;
    if (!name || !email) { res.status(400).json({ error: 'name and email required' }); return; }

    const [existing] = await query('SELECT id FROM company_users WHERE email = ?', [email.toLowerCase()]);
    if (existing) { res.status(409).json({ error: 'A user with this email already exists' }); return; }

    const tempPassword = Math.random().toString(36).slice(-12);
    const hash = await bcrypt.hash(tempPassword, 10);

    await run(
      'INSERT INTO company_users (company_id, email, password_hash, name, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)',
      [req.companyId, email.toLowerCase(), hash, name, role === 'admin' ? 'admin' : 'member']
    );

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = 'info@flughafen-muenchen.taxi';
      const inviteBody = `
          <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
            <p style="margin:0;color:#065f46;font-weight:600;font-size:15px;">✓ Ihr Zugang wurde eingerichtet</p>
          </div>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
            Sie wurden als Benutzer für <strong>${req.companyName}</strong> im Firmenkundenportal angelegt.
          </p>
          <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;">
            <p style="margin:0 0 12px;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Ihre Zugangsdaten</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:110px;">E-Mail:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${email.toLowerCase()}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Passwort:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${tempPassword}</td></tr>
            </table>
            <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">Bitte ändern Sie Ihr Passwort beim ersten Login.</p>
          </div>
          <div style="text-align:center;margin:28px 0 4px;">
            <a href="${process.env.SITE_URL || 'https://flughafen-muenchen.taxi'}/portal" style="display:inline-block;background:#0c2d48;color:#fbbf24;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;text-decoration:none;">Zum Portal →</a>
          </div>`;
      await resend.emails.send({
        from: `Flughafen München Taxi <${fromEmail}>`,
        to: email.toLowerCase(),
        subject: `Ihr Zugang zum Firmenkundenportal – Flughafen München Taxi`,
        html: wrapBrandedEmail({ title: 'Ihr Zugang zum Firmenkundenportal', bodyHtml: inviteBody }),
      });
    } catch (emailErr) {
      console.error('User invite email failed:', emailErr);
    }

    res.json({ success: true, temp_password: tempPassword });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.delete('/users/:id', authenticateCompany, async (req: CompanyAuthRequest, res: Response): Promise<void> => {
  try {
    if (req.companyRole !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }

    const userId = Number(req.params.id);
    if (userId === req.companyUserId) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }

    const admins = await query(
      "SELECT id FROM company_users WHERE company_id = ? AND role = 'admin'",
      [req.companyId]
    );
    const [targetUser] = await query('SELECT role FROM company_users WHERE id = ? AND company_id = ?', [userId, req.companyId]);
    if (!targetUser) { res.status(404).json({ error: 'User not found' }); return; }
    if (targetUser.role === 'admin' && admins.length <= 1) {
      res.status(400).json({ error: 'Cannot delete the last admin' });
      return;
    }

    await run('DELETE FROM company_users WHERE id = ? AND company_id = ?', [userId, req.companyId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
