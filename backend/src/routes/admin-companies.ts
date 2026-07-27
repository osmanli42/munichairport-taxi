import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { generateSammelrechnungPdf, buildReminderEmail, fetchBankSettings, roundGrossPrice, wrapBrandedEmail } from '../services/rechnung';

const router = Router();

function monthRange(yearMonth: string): [string, string] {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

// ─── LIST COMPANIES ─────────────────────────────────────────────────────────

router.get('/', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    let where = '';
    const params: any[] = [];
    if (status) { where = ' WHERE c.status = ?'; params.push(status); }

    const companies = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM company_users cu WHERE cu.company_id = c.id) AS user_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.company_id = c.id) AS booking_count
       FROM companies c${where}
       ORDER BY c.created_at DESC`,
      params
    );
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

router.get('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [company] = await query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }

    const users = await query(
      'SELECT id, name, email, role, last_login_at, created_at FROM company_users WHERE company_id = ?',
      [req.params.id]
    );
    company.users = users;
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// ─── DIREKT FIRMA ANLEGEN (für Kalender-Import, kein Portal-Login) ──────────

router.post('/direct', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { company_name, contact_name, email, phone, address } = req.body as {
      company_name?: string; contact_name?: string; email?: string;
      phone?: string; address?: string;
    };
    if (!company_name?.trim()) { res.status(400).json({ error: 'company_name erforderlich' }); return; }
    const result = await run(
      `INSERT INTO companies (company_name, contact_name, email, phone, address, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
      [
        company_name.trim(),
        contact_name?.trim() || company_name.trim(),
        email?.trim() || '',
        phone?.trim() || '',
        address?.trim() || '',
      ]
    );
    res.json({ id: (result as any).insertId, company_name: company_name.trim() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create company' });
  }
});

// ─── APPROVE ────────────────────────────────────────────────────────────────

router.post('/:id/approve', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [company] = await query('SELECT * FROM companies WHERE id = ? AND status = ?', [req.params.id, 'pending']);
    if (!company) { res.status(404).json({ error: 'Pending company not found' }); return; }

    const [existingUser] = await query('SELECT id FROM company_users WHERE email = ?', [company.email.toLowerCase()]);
    if (existingUser) {
      res.status(409).json({ error: `Diese E-Mail-Adresse (${company.email}) wird bereits von einem anderen Firmenkonto verwendet.` });
      return;
    }

    const { allowed_payment_methods, discount_percent } = req.body;
    const payMethods = allowed_payment_methods || 'cash,card';
    const discount = Number(discount_percent) || 0;

    const tempPassword = Math.random().toString(36).slice(-12);
    const hash = await bcrypt.hash(tempPassword, 10);

    await run(
      "INSERT INTO company_users (company_id, email, password_hash, name, role, must_change_password) VALUES (?, ?, ?, ?, 'admin', 1)",
      [req.params.id, company.email.toLowerCase(), hash, company.contact_name]
    );

    await run(
      "UPDATE companies SET status = 'active', allowed_payment_methods = ?, discount_percent = ? WHERE id = ?",
      [payMethods, discount, req.params.id]
    );

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = 'info@flughafen-muenchen.taxi';
      const portalUrl = `${process.env.SITE_URL || 'https://flughafen-muenchen.taxi'}/portal`;
      const bodyHtml = `
          <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;">
            <p style="margin:0;color:#065f46;font-weight:600;font-size:15px;">✓ Ihr Firmenkonto wurde freigeschaltet</p>
          </div>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
            Willkommen im Firmenkundenportal! Ihr Firmenkonto <strong>${company.company_name}</strong> ist ab sofort aktiv und einsatzbereit.
          </p>
          <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;">
            <p style="margin:0 0 12px;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Ihre Zugangsdaten</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:110px;">E-Mail:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${company.email}</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Passwort:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${tempPassword}</td></tr>
            </table>
            <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">Bitte ändern Sie Ihr Passwort beim ersten Login.</p>
          </div>
          ${discount > 0 ? `<div style="background:#fff8e1;border:2px solid #fbbf24;border-radius:8px;padding:14px 18px;text-align:center;margin:0 0 20px;">
            <p style="margin:0;color:#92400e;font-size:15px;">Ihr Firmenrabatt: <strong style="font-size:18px;">${discount}%</strong></p>
          </div>` : ''}
          <div style="text-align:center;margin:28px 0 4px;">
            <a href="${portalUrl}" style="display:inline-block;background:#0c2d48;color:#fbbf24;padding:14px 32px;border-radius:8px;font-weight:bold;font-size:16px;text-decoration:none;">Zum Firmenkundenportal →</a>
          </div>`;
      const html = wrapBrandedEmail({ title: 'Ihr Firmenkonto wurde freigeschaltet', bodyHtml });
      await resend.emails.send({
        from: `Flughafen München Taxi <${fromEmail}>`,
        to: company.email,
        subject: 'Ihr Firmenkonto wurde freigeschaltet – Flughafen München Taxi',
        html,
      });
    } catch (emailErr) {
      console.error('Company approval email failed:', emailErr);
    }

    res.json({ success: true, temp_password: tempPassword });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve company' });
  }
});

router.post('/:id/reject', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run("UPDATE companies SET status = 'rejected' WHERE id = ? AND status = 'pending'", [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject company' });
  }
});

// ─── UPDATE COMPANY ─────────────────────────────────────────────────────────

router.put('/:id', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { discount_percent, allowed_payment_methods, pg_discount_override, discount_kombinierbar, payment_term_days, status, charge_mode } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (discount_percent !== undefined) { updates.push('discount_percent = ?'); params.push(Number(discount_percent)); }
    if (allowed_payment_methods !== undefined) { updates.push('allowed_payment_methods = ?'); params.push(allowed_payment_methods); }
    if (pg_discount_override !== undefined) { updates.push('pg_discount_override = ?'); params.push(pg_discount_override ? 1 : 0); }
    if (discount_kombinierbar !== undefined) { updates.push('discount_kombinierbar = ?'); params.push(discount_kombinierbar ? 1 : 0); }
    if (payment_term_days !== undefined) { updates.push('payment_term_days = ?'); params.push(Number(payment_term_days)); }
    if (status && ['active', 'suspended'].includes(status)) { updates.push('status = ?'); params.push(status); }
    if (charge_mode && ['manual', 'on_confirm', 'on_completion'].includes(charge_mode)) { updates.push('charge_mode = ?'); params.push(charge_mode); }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

    params.push(req.params.id);
    await run(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// ─── COMPANY BOOKINGS ───────────────────────────────────────────────────────

router.get('/:id/bookings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = req.query.month as string;
    let dateFilter = '';
    const params: any[] = [req.params.id];
    if (month) {
      const [start, end] = monthRange(month);
      dateFilter = ' AND b.pickup_datetime >= ? AND b.pickup_datetime < ?';
      params.push(start, end);
    }

    const bookings = await query(
      `SELECT b.*, cu.name AS booked_by_name
       FROM bookings b LEFT JOIN company_users cu ON b.company_user_id = cu.id
       WHERE b.company_id = ?${dateFilter} AND b.status != 'cancelled'
       ORDER BY b.pickup_datetime DESC`,
      params
    );
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Note: charging a saved card is now handled by the unified
// POST /api/admin/bookings/:id/charge-card endpoint (admin.ts), which works for
// both company and regular-customer bookings.

// ─── SAMMELRECHNUNG CREATION ────────────────────────────────────────────────

router.post('/:id/sammelrechnung', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyId = req.params.id;
    const { month, mwst_satz, send_email, project_name } = req.body;
    if (!month) { res.status(400).json({ error: 'month required (YYYY-MM)' }); return; }
    const mwst = [0, 7, 19].includes(Number(mwst_satz)) ? Number(mwst_satz) : 19;

    const [existing] = await query(
      'SELECT id FROM company_invoices WHERE company_id = ? AND period_month = ?',
      [companyId, month]
    );
    if (existing) { res.status(409).json({ error: 'Sammelrechnung for this month already exists' }); return; }

    const [monthStart, monthEnd] = monthRange(month);
    const bookings = await query(
      `SELECT * FROM bookings WHERE company_id = ? AND pickup_datetime >= ? AND pickup_datetime < ? AND status != 'cancelled' ORDER BY pickup_datetime`,
      [companyId, monthStart, monthEnd]
    );
    if (bookings.length === 0) { res.status(400).json({ error: 'No bookings found for this month' }); return; }

    const total = bookings.reduce((sum: number, b: any) => sum + roundGrossPrice(Number(b.price) || 0, b.source === 'calendar'), 0);
    const bookingIds = bookings.map((b: any) => b.id);

    const [company] = await query('SELECT * FROM companies WHERE id = ?', [companyId]);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }

    const invoiceNumber = `SR-${month.replace('-', '')}-${companyId}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (Number(company.payment_term_days) || 7));
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    await run(
      `INSERT INTO company_invoices (company_id, invoice_number, period_month, mwst_satz, booking_ids, total, due_date, status, project_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [companyId, invoiceNumber, month, mwst, JSON.stringify(bookingIds), total, dueDateStr, project_name?.trim() || null]
    );

    const [invoice] = await query('SELECT * FROM company_invoices WHERE invoice_number = ?', [invoiceNumber]);

    if (send_email) {
      try {
        const s = await fetchBankSettings();
        const pdfBuffer = await generateSammelrechnungPdf({
          company: { company_name: company.company_name, contact_name: company.contact_name, address: company.address, ust_idnr: company.ust_idnr },
          invoiceNumber, periodMonth: month, mwst: mwst as 0 | 7 | 19,
          bookings, total, dueDate: dueDateStr, mahngebuehr: 0, reminderLevel: 0, s,
        });

        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = 'info@flughafen-muenchen.taxi';
        const sammelBody = `
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Sehr geehrte Damen und Herren der <strong>${company.company_name}</strong>,<br><br>anbei erhalten Sie Ihre Sammelrechnung <strong>${invoiceNumber}</strong> für den Zeitraum <strong>${month}</strong>.</p>
          <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:140px;">Gesamtbetrag:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${total.toFixed(2).replace('.', ',')} €</td></tr>
              <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Zahlbar bis:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${dueDateStr}</td></tr>
            </table>
          </div>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">Mit freundlichen Grüßen,<br>${s.company_name || 'Taxi N&N GbR'}</p>`;
        await resend.emails.send({
          from: `Flughafen München Taxi <${fromEmail}>`,
          to: company.email,
          subject: `Sammelrechnung ${invoiceNumber} – Flughafen München Taxi`,
          html: wrapBrandedEmail({ title: `Sammelrechnung ${invoiceNumber}`, bodyHtml: sammelBody }),
          attachments: [{ filename: `Sammelrechnung_${invoiceNumber}.pdf`, content: pdfBuffer.toString('base64') }],
        });
      } catch (emailErr) {
        console.error('Sammelrechnung email failed:', emailErr);
      }
    }

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create Sammelrechnung' });
  }
});

// ─── ALL INVOICES (cross-company, for admin receivables view) ───────────────

router.get('/invoices/all', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    let where = '';
    const params: any[] = [];
    if (status === 'open') { where = " WHERE ci.status = 'sent'"; }
    else if (status === 'overdue') { where = " WHERE ci.status = 'sent' AND ci.due_date < CURDATE()"; }
    else if (status === 'paid') { where = " WHERE ci.status = 'paid'"; }

    const invoices = await query(
      `SELECT ci.*, c.company_name FROM company_invoices ci
       JOIN companies c ON ci.company_id = c.id${where}
       ORDER BY ci.due_date ASC`,
      params
    );
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ─── INVOICE PDF DOWNLOAD (admin) ───────────────────────────────────────────

router.get('/invoices/:invoiceId/pdf', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [invoice] = await query('SELECT * FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const bookingIds = JSON.parse(invoice.booking_ids || '[]');
    const bookings = bookingIds.length > 0
      ? await query(`SELECT * FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`, bookingIds)
      : [];
    const [company] = await query('SELECT * FROM companies WHERE id = ?', [invoice.company_id]);
    const s = await fetchBankSettings();

    const pdfBuffer = await generateSammelrechnungPdf({
      company: { company_name: company.company_name, contact_name: company.contact_name, address: company.address, ust_idnr: company.ust_idnr },
      invoiceNumber: invoice.invoice_number, periodMonth: invoice.period_month,
      mwst: Number(invoice.mwst_satz) as 0 | 7 | 19,
      bookings, total: Number(invoice.total), dueDate: invoice.due_date,
      mahngebuehr: Number(invoice.mahngebuehr) || 0, reminderLevel: Number(invoice.reminder_level) || 0, s,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Sammelrechnung_${invoice.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ─── MARK PAID / DELETE ─────────────────────────────────────────────────────

router.put('/invoices/:invoiceId', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['paid', 'sent'].includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
    await run('UPDATE company_invoices SET status = ? WHERE id = ?', [status, req.params.invoiceId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// ─── RECHNUNG BEARBEITEN (Positionen + Fälligkeit) ──────────────────────────

router.get('/invoices/:invoiceId/bookings', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [invoice] = await query('SELECT * FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    const bookingIds = JSON.parse(invoice.booking_ids || '[]');
    const bookings = bookingIds.length > 0
      ? await query(`SELECT id, pickup_datetime, pickup_address, dropoff_address, name, price, steuersatz, source FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`, bookingIds)
      : [];
    res.json({ due_date: invoice.due_date, bookings });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch invoice bookings' });
  }
});

router.put('/invoices/:invoiceId/details', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { due_date, bookings } = req.body as {
      due_date?: string;
      bookings?: { id: number; pickup_datetime: string; pickup_address: string; dropoff_address: string; name: string; price: number; steuersatz: number }[];
    };

    const [invoice] = await query('SELECT * FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    const originalBookingIds: number[] = JSON.parse(invoice.booking_ids || '[]');

    // Positionen, die im Request fehlen, wurden vom Admin aus der Rechnung entfernt
    // (die Buchung selbst bleibt bestehen, wird nur von dieser Rechnung gelöst).
    const keptIds = Array.isArray(bookings) ? bookings.map((b) => Number(b.id)) : originalBookingIds;
    const bookingIds = originalBookingIds.filter((id) => keptIds.includes(id));

    if (Array.isArray(bookings)) {
      for (const b of bookings) {
        if (!originalBookingIds.includes(Number(b.id))) continue; // nur Positionen dieser Rechnung
        const steuersatz = [0, 7, 19].includes(Number(b.steuersatz)) ? Number(b.steuersatz) : 7;
        await run(
          `UPDATE bookings SET pickup_datetime = ?, pickup_address = ?, dropoff_address = ?, name = ?, price = ?, steuersatz = ? WHERE id = ?`,
          [b.pickup_datetime, b.pickup_address, b.dropoff_address, b.name, Math.round(Number(b.price) * 100) / 100, steuersatz, b.id]
        );
      }
    }

    const updatedBookings = bookingIds.length > 0
      ? await query<any>(`SELECT price, source FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')})`, bookingIds)
      : [];
    const newTotal = updatedBookings.reduce((sum: number, b: any) => sum + roundGrossPrice(Number(b.price) || 0, b.source === 'calendar'), 0);

    const updates: string[] = ['total = ?', 'booking_ids = ?'];
    const params: any[] = [newTotal, JSON.stringify(bookingIds)];
    if (due_date) { updates.push('due_date = ?'); params.push(due_date); }
    params.push(req.params.invoiceId);
    await run(`UPDATE company_invoices SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, total: newTotal });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update invoice' });
  }
});

router.delete('/invoices/:invoiceId', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// ─── REMINDER / MAHNUNG ─────────────────────────────────────────────────────

router.post('/invoices/:invoiceId/remind', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [invoice] = await query('SELECT * FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    if (invoice.status === 'paid') { res.status(400).json({ error: 'Invoice already paid' }); return; }

    const currentLevel = Number(invoice.reminder_level) || 0;
    if (currentLevel >= 3) { res.status(400).json({ error: 'Maximum reminder level reached' }); return; }

    const newLevel = currentLevel + 1;
    const mahngebuehr = newLevel === 3 ? (Number(req.body.mahngebuehr) || 0) : Number(invoice.mahngebuehr) || 0;

    await run(
      'UPDATE company_invoices SET reminder_level = ?, reminder_sent_at = NOW(), mahngebuehr = ? WHERE id = ?',
      [newLevel, mahngebuehr, req.params.invoiceId]
    );

    if (mahngebuehr > 0 && newLevel === 3) {
      await run('UPDATE company_invoices SET total = total + ? WHERE id = ? AND mahngebuehr = ?',
        [mahngebuehr, req.params.invoiceId, mahngebuehr]);
    }

    const [company] = await query('SELECT * FROM companies WHERE id = ?', [invoice.company_id]);
    const s = await fetchBankSettings();

    const bookingIds = JSON.parse(invoice.booking_ids || '[]');
    const bookings = bookingIds.length > 0
      ? await query(`SELECT * FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`, bookingIds)
      : [];

    const updatedTotal = Number(invoice.total) + (newLevel === 3 ? mahngebuehr : 0);

    const pdfBuffer = await generateSammelrechnungPdf({
      company: { company_name: company.company_name, contact_name: company.contact_name, address: company.address, ust_idnr: company.ust_idnr },
      invoiceNumber: invoice.invoice_number, periodMonth: invoice.period_month,
      mwst: Number(invoice.mwst_satz) as 0 | 7 | 19,
      bookings, total: updatedTotal, dueDate: invoice.due_date,
      mahngebuehr: newLevel >= 3 ? mahngebuehr : 0, reminderLevel: newLevel, s,
    });

    const emailHtml = buildReminderEmail({
      level: newLevel as 1 | 2 | 3,
      invoice: {
        invoice_number: invoice.invoice_number,
        period_month: invoice.period_month,
        total: updatedTotal,
        due_date: invoice.due_date,
        mahngebuehr,
      },
      company: { company_name: company.company_name, contact_name: company.contact_name },
      s,
    });

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromEmail = 'info@flughafen-muenchen.taxi';
      const subjectPrefix = newLevel === 3 ? 'Mahnung' : `${newLevel}. Zahlungserinnerung`;
      await resend.emails.send({
        from: `Flughafen München Taxi <${fromEmail}>`,
        to: company.email,
        subject: `${subjectPrefix} – ${invoice.invoice_number}`,
        html: emailHtml,
        attachments: [{ filename: `Rechnung_${invoice.invoice_number}.pdf`, content: pdfBuffer.toString('base64') }],
      });
    } catch (emailErr) {
      console.error('Reminder email failed:', emailErr);
    }

    res.json({ success: true, new_level: newLevel });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// ─── RECHNUNG MANUELL AN BELIEBIGE E-MAIL SENDEN ─────────────────────────────

router.post('/invoices/:invoiceId/send', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Gültige E-Mail-Adresse erforderlich' });
      return;
    }

    const [invoice] = await query('SELECT * FROM company_invoices WHERE id = ?', [req.params.invoiceId]);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    const [company] = await query('SELECT * FROM companies WHERE id = ?', [invoice.company_id]);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }

    const bookingIds = JSON.parse(invoice.booking_ids || '[]');
    const bookings = bookingIds.length > 0
      ? await query(`SELECT * FROM bookings WHERE id IN (${bookingIds.map(() => '?').join(',')}) ORDER BY pickup_datetime`, bookingIds)
      : [];

    const s = await fetchBankSettings();
    const pdfBuffer = await generateSammelrechnungPdf({
      company: { company_name: company.company_name, contact_name: company.contact_name, address: company.address, ust_idnr: company.ust_idnr },
      invoiceNumber: invoice.invoice_number, periodMonth: invoice.period_month,
      mwst: Number(invoice.mwst_satz) as 0 | 7 | 19,
      bookings, total: Number(invoice.total), dueDate: invoice.due_date,
      mahngebuehr: Number(invoice.mahngebuehr) || 0, reminderLevel: Number(invoice.reminder_level) || 0, s,
    });

    const bodyHtml = `
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Sehr geehrte Damen und Herren der <strong>${company.company_name}</strong>,<br><br>anbei erhalten Sie Ihre Rechnung <strong>${invoice.invoice_number}</strong> für den Zeitraum <strong>${invoice.period_month}</strong>.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;width:140px;">Gesamtbetrag:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${Number(invoice.total).toFixed(2).replace('.', ',')} €</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">Zahlbar bis:</td><td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${invoice.due_date}</td></tr>
        </table>
      </div>
      <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">Mit freundlichen Grüßen,<br>${s.company_name || 'Taxi N&N GbR'}</p>`;

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: `Flughafen München Taxi <info@flughafen-muenchen.taxi>`,
      to: email.trim(),
      subject: `Rechnung ${invoice.invoice_number} – Flughafen München Taxi`,
      html: wrapBrandedEmail({ title: `Rechnung ${invoice.invoice_number}`, bodyHtml }),
      attachments: [{ filename: `Rechnung_${invoice.invoice_number}.pdf`, content: pdfBuffer.toString('base64') }],
    });
    if (sendError) { res.status(500).json({ error: sendError.message || 'E-Mail-Versand fehlgeschlagen' }); return; }

    await run('UPDATE company_invoices SET manual_sent_at = NOW() WHERE id = ?', [invoice.id]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to send invoice email' });
  }
});

// ─── USER MANAGEMENT (admin-side) ───────────────────────────────────────────

router.post('/:id/reset-password/:userId', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [user] = await query('SELECT id FROM company_users WHERE id = ? AND company_id = ?', [req.params.userId, req.params.id]);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const tempPassword = Math.random().toString(36).slice(-12);
    const hash = await bcrypt.hash(tempPassword, 10);
    await run('UPDATE company_users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hash, req.params.userId]);

    res.json({ success: true, temp_password: tempPassword });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
