import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin } from '../middleware/auth';
import { gutscheinUrl, newGutscheinCode, addDays } from '../services/gutschein';
import { Resend } from 'resend';
import { berlinDateSql } from '../utils/berlinTime';
import { customerGutscheinEmail, gutscheinDefaults, GUTSCHEIN_REASONS, GutscheinReason } from '../services/bookingEmailTemplates';

const router = Router();

const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  invalid:  { de: 'Dieser Code ist nicht gültig.',               en: 'This code is not valid.',              tr: 'Bu kod geçerli değil.' },
  expired:  { de: 'Dieser Aktionscode ist abgelaufen.',          en: 'This promo code has expired.',         tr: 'Bu promosyon kodunun süresi dolmuş.' },
  maxUsed:  { de: 'Dieser Code ist bereits vollständig eingelöst.', en: 'This code has been fully redeemed.', tr: 'Bu kod tamamen kullanıldı.' },
  inactive: { de: 'Dieser Code ist derzeit nicht aktiv.',        en: 'This code is currently inactive.',     tr: 'Bu kod şu anda aktif değil.' },
};

function msg(key: string, lang: string): string {
  return ERROR_MESSAGES[key]?.[lang] ?? ERROR_MESSAGES[key]?.['de'] ?? key;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// GET /api/promotions/has-active — public, returns true if any promo is active (ignores show_banner)
router.get('/has-active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = todayStr();
    const [promo] = await query<any>(
      `SELECT id FROM promotions
       WHERE active = 1 AND start_date <= ? AND end_date >= ?
         AND (max_uses IS NULL OR used_count < max_uses)
         AND (personal IS NULL OR personal = 0)
       LIMIT 1`,
      [today, today]
    );
    const [codePromo] = await query<any>(
      `SELECT id FROM promotions
       WHERE active = 1 AND start_date <= ? AND end_date >= ?
         AND (max_uses IS NULL OR used_count < max_uses)
         AND (apply_mode IS NULL OR apply_mode = 'code')
         AND (personal IS NULL OR personal = 0)
       LIMIT 1`,
      [today, today]
    );
    res.json({ hasActive: !!promo, hasCodePromo: !!codePromo });
  } catch {
    res.json({ hasActive: false, hasCodePromo: false });
  }
});

// GET /api/promotions/active — public (used by homepage banner only, requires show_banner=1)
router.get('/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = todayStr();
    const [promo] = await query<any>(
      `SELECT code, type, value, end_date FROM promotions
       WHERE active = 1 AND show_banner = 1 AND start_date <= ? AND end_date >= ?
         AND (max_uses IS NULL OR used_count < max_uses)
         AND (personal IS NULL OR personal = 0)
       ORDER BY end_date ASC LIMIT 1`,
      [today, today]
    );
    res.json(promo || null);
  } catch {
    res.json(null);
  }
});

// POST /api/promotions/validate — public
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  const { code, base_price, lang = 'de' } = req.body;
  if (!code || base_price === undefined || base_price === null) {
    res.status(400).json({ valid: false, message: msg('invalid', lang) });
    return;
  }

  try {
    // Datumsvergleich in SQL: DATE-Spalten kommen als Date-Objekte zurück, ein Vergleich mit dem
    // String todayStr() war immer false (abgelaufene Codes galten als gültig).
    const today = todayStr();
    const [promo] = await query<any>(
      'SELECT *, (start_date > ? OR end_date < ?) AS out_of_range FROM promotions WHERE UPPER(code) = ?',
      [today, today, String(code).toUpperCase()]
    );

    if (!promo) { res.json({ valid: false, message: msg('invalid', lang) }); return; }
    if (!promo.active) { res.json({ valid: false, message: msg('inactive', lang) }); return; }

    if (Number(promo.out_of_range) === 1) {
      res.json({ valid: false, message: msg('expired', lang) }); return;
    }
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      res.json({ valid: false, message: msg('maxUsed', lang) }); return;
    }

    const bp = parseFloat(base_price);
    let discount_amount: number;
    if (promo.type === 'fixed') {
      discount_amount = Math.min(parseFloat(promo.value), bp);
    } else {
      discount_amount = bp * (parseFloat(promo.value) / 100);
    }
    if (promo.max_amount != null && Number(promo.max_amount) > 0) discount_amount = Math.min(discount_amount, Number(promo.max_amount));
    discount_amount = Math.round(discount_amount * 100) / 100;
    const final_price = Math.max(0, Math.round((bp - discount_amount) * 100) / 100);

    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: parseFloat(promo.value),
      kombinierbar: !!promo.kombinierbar,
      discount_amount,
      final_price,
    });
  } catch {
    res.json({ valid: false, message: msg('invalid', lang) });
  }
});

// GET /api/promotions/admin/list — admin only
router.get('/admin/list', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const promos = await query<any>('SELECT * FROM promotions WHERE personal IS NULL OR personal = 0 ORDER BY created_at DESC');
    res.json(promos);
  } catch {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// POST /api/promotions/admin — create promotion
router.post('/admin', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { code, type, value, start_date, end_date, max_uses, description, kombinierbar, show_banner } = req.body;
  if (!code || !type || value === undefined || !start_date || !end_date) {
    res.status(400).json({ error: 'code, type, value, start_date, end_date erforderlich' });
    return;
  }
  if (!['fixed', 'percent'].includes(type)) {
    res.status(400).json({ error: 'type muss "fixed" oder "percent" sein' });
    return;
  }
  try {
    await run(
      `INSERT INTO promotions (code, type, value, start_date, end_date, max_uses, description, kombinierbar, show_banner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(code).toUpperCase().trim(),
        type,
        parseFloat(value),
        start_date,
        end_date,
        max_uses ? parseInt(max_uses) : null,
        description || null,
        kombinierbar ? 1 : 0,
        show_banner !== false ? 1 : 0,
      ]
    );
    res.json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('Duplicate')) {
      res.status(400).json({ error: 'Dieser Code existiert bereits.' });
    } else {
      res.status(500).json({ error: 'Failed to create promotion' });
    }
  }
});

// PUT /api/promotions/admin/:id — update promotion
router.put('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { code, type, value, start_date, end_date, max_uses, description, active, kombinierbar, show_banner } = req.body;
  const dateOnly = (d: string) => (d ? String(d).split('T')[0] : d);
  try {
    await run(
      `UPDATE promotions SET code=?, type=?, value=?, start_date=?, end_date=?, max_uses=?, description=?, active=?, kombinierbar=?, show_banner=?
       WHERE id=?`,
      [
        String(code).toUpperCase().trim(),
        type,
        parseFloat(value),
        dateOnly(start_date),
        dateOnly(end_date),
        max_uses ? parseInt(max_uses) : null,
        description || null,
        active ? 1 : 0,
        kombinierbar ? 1 : 0,
        show_banner !== false ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// DELETE /api/promotions/admin/:id — delete promotion
router.delete('/admin/:id', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await run('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

// ---- Persönliche Gutschein-Links (Rabatte → „Kişisel indirim“) -----------------------------
// Ein Code pro Kunde (max_uses = 1, personal = 1), per E-Mail im Stil der Buchungsbestätigung.
// Gilt wie jeder Aktionscode auch für Stammkunden und Firmen-/Rechnungskunden; gegen einen
// Auto-Rabatt gewinnt in bookings.ts der größere. kombinierbar = 1: kommt zum Hin-/Rückfahrt-Rabatt
// dazu — so rechnen /buchen (Rabatt auf den angezeigten Preis) und der Server gleich.

const GS_LANGS = ['de', 'en', 'tr'];
const newCode = newGutscheinCode;

interface PersonalInput {
  name: string; email: string; lang: string; percent: number; endDate: string;
  reason: GutscheinReason; subject: string; message: string; note: string;
}

/** Prüft die Formulareingaben; error = deutscher Hinweis für das Admin-Panel. */
function parsePersonal(body: any): { input?: PersonalInput; error?: string } {
  const today = berlinDateSql(0);
  const lang = GS_LANGS.includes(body?.lang) ? body.lang : 'de';
  const reason: GutscheinReason = GUTSCHEIN_REASONS.includes(body?.reason) ? body.reason : 'entschuldigung';
  const percent = Math.round(Number(body?.percent ?? 10) * 10) / 10;
  if (!(percent >= 1 && percent <= 30)) return { error: 'Rabatt muss zwischen 1 und 30 % liegen' };
  let endDate: string;
  if (body?.end_date) {
    endDate = String(body.end_date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < today) return { error: 'Gültig-bis-Datum ungültig' };
  } else {
    const days = parseInt(body?.valid_days ?? 90, 10);
    if (!(days >= 1 && days <= 730)) return { error: 'Gültigkeit 1–730 Tage' };
    endDate = addDays(today, days);
  }
  const email = String(body?.email || '').trim().slice(0, 190);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-Mail-Adresse ungültig' };
  const defaults = gutscheinDefaults(reason, lang as any, percent);
  return {
    input: {
      name: String(body?.name || '').trim().slice(0, 120),
      email, lang, percent, endDate, reason,
      subject: String(body?.subject ?? '').trim().slice(0, 255) || defaults.subject,
      message: String(body?.message ?? '').trim().slice(0, 4000) || defaults.message,
      note: String(body?.note || '').trim().slice(0, 255),
    },
  };
}

function gutscheinMail(row: { code: string; recipient_name?: string | null; recipient_lang?: string | null; value: any;
  end_date: string; reason?: string | null; email_subject?: string | null; email_message?: string | null }) {
  const lang = row.recipient_lang || 'de';
  return customerGutscheinEmail({
    name: row.recipient_name, lang, percent: Number(row.value), code: row.code, url: gutscheinUrl(row.code, lang),
    endDate: row.end_date, reason: (row.reason as GutscheinReason) || 'allgemein',
    subject: row.email_subject || '', message: row.email_message || '',
  });
}

async function sendGutschein(id: number): Promise<void> {
  const [row] = await query<any>(
    `SELECT *, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date FROM promotions WHERE id = ? AND personal = 1`, [id]);
  if (!row) throw new Error('Gutschein nicht gefunden');
  if (!row.recipient_email) throw new Error('Keine E-Mail-Adresse hinterlegt');
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY fehlt – E-Mail kann nicht gesendet werden');
  const { subject, html } = gutscheinMail(row);
  const admin = process.env.ADMIN_EMAIL || 'info@flughafen-muenchen.taxi';
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Flughafen-muenchen.TAXI <info@flughafen-muenchen.taxi>',
    to: row.recipient_email,
    bcc: admin.toLowerCase() === String(row.recipient_email).toLowerCase() ? undefined : admin,
    replyTo: 'info@flughafen-muenchen.taxi',
    subject,
    html,
  });
  if (error) throw new Error(error.message || 'E-Mail-Versand fehlgeschlagen');
  await run('UPDATE promotions SET sent_at = NOW() WHERE id = ?', [id]);
}

// GET /api/promotions/personal/:code — public: ist der Gutschein-Link (noch) einlösbar?
router.get('/personal/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const today = berlinDateSql(0);
    const [row] = await query<any>(
      `SELECT type, value, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date FROM promotions
        WHERE personal = 1 AND UPPER(code) = ? AND active = 1 AND start_date <= ? AND end_date >= ?
          AND (max_uses IS NULL OR used_count < max_uses)`,
      [String(req.params.code || '').toUpperCase().slice(0, 50), today, today]
    );
    res.json(row ? { valid: true, type: row.type, value: Number(row.value), end_date: row.end_date } : { valid: false });
  } catch {
    res.json({ valid: false });
  }
});

// POST /api/promotions/admin/personal/preview — E-Mail-Vorschau ohne zu speichern
router.post('/admin/personal/preview', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { input, error } = parsePersonal(req.body);
  if (!input) { res.status(400).json({ error }); return; }
  const defaults = gutscheinDefaults(input.reason, input.lang as any, input.percent);
  const code = String(req.body?.code || 'GS-XXXXXXXX');
  const { subject, html } = customerGutscheinEmail({
    name: input.name, lang: input.lang, percent: input.percent, code, url: gutscheinUrl(code, input.lang),
    endDate: input.endDate, reason: input.reason, subject: input.subject, message: input.message,
  });
  res.json({ subject, html, end_date: input.endDate, defaults });
});

// GET /api/promotions/admin/personal — Liste mit Status und eingelöster Buchung
router.get('/admin/personal', authenticateAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = berlinDateSql(0);
    const rows = await query<any>(
      `SELECT id, code, value, active, used_count, max_uses, recipient_name, recipient_email, recipient_lang, reason,
              description AS note, email_subject, sent_at, created_at,
              DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, (end_date < ?) AS expired
         FROM promotions WHERE personal = 1 AND campaign_id IS NULL ORDER BY created_at DESC LIMIT 300`,
      [today]
    );
    const codes = rows.map(r => r.code);
    const used = codes.length
      ? await query<any>(
        `SELECT id, booking_number, promo_code, discount_amount, price, status,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS booked_at, DATE_FORMAT(pickup_datetime, '%Y-%m-%d %H:%i') AS pickup
           FROM bookings WHERE promo_code IN (${codes.map(() => '?').join(',')}) ORDER BY created_at DESC`, codes)
      : [];
    res.json(rows.map(r => {
      const booking = used.find(b => String(b.promo_code).toUpperCase() === String(r.code).toUpperCase()) || null;
      const status = booking || (r.max_uses !== null && r.used_count >= r.max_uses) ? 'used'
        : !r.active ? 'inactive' : Number(r.expired) === 1 ? 'expired' : 'open';
      return {
        id: r.id, code: r.code, percent: Number(r.value), name: r.recipient_name, email: r.recipient_email,
        lang: r.recipient_lang || 'de', reason: r.reason, note: r.note, subject: r.email_subject,
        end_date: r.end_date, sent_at: r.sent_at, created_at: r.created_at, status,
        url: gutscheinUrl(r.code, r.recipient_lang || 'de'),
        booking: booking && {
          id: booking.id, booking_number: booking.booking_number, discount: Number(booking.discount_amount) || 0,
          price: Number(booking.price) || 0, status: booking.status, booked_at: booking.booked_at, pickup: booking.pickup,
        },
      };
    }));
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Liste konnte nicht geladen werden' });
  }
});

// POST /api/promotions/admin/personal — Gutschein anlegen, mit send: true direkt per E-Mail senden
router.post('/admin/personal', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  const { input, error } = parsePersonal(req.body);
  if (!input) { res.status(400).json({ error }); return; }
  const send = req.body?.send === true;
  if (send && !input.email) { res.status(400).json({ error: 'Für den Versand wird eine E-Mail-Adresse benötigt' }); return; }
  try {
    let id = 0;
    let code = '';
    for (let attempt = 0; attempt < 5 && !id; attempt++) {
      code = newCode();
      try {
        const r = await run(
          `INSERT INTO promotions (code, type, value, start_date, end_date, max_uses, description, kombinierbar, show_banner, active,
                                   personal, recipient_name, recipient_email, recipient_lang, reason, email_subject, email_message)
           VALUES (?, 'percent', ?, ?, ?, 1, ?, 1, 0, 1, 1, ?, ?, ?, ?, ?, ?)`,
          [code, input.percent, berlinDateSql(0), input.endDate, input.note || null,
            input.name || null, input.email || null, input.lang, input.reason, input.subject, input.message]
        );
        id = r.insertId;
      } catch (e: any) {
        if (!String(e.message).includes('Duplicate')) throw e;
      }
    }
    if (!id) throw new Error('Code konnte nicht erzeugt werden');
    let sendError: string | null = null;
    if (send) {
      try { await sendGutschein(id); } catch (e: any) { sendError = e.message || 'Versand fehlgeschlagen'; }
    }
    res.json({ success: true, id, code, url: gutscheinUrl(code, input.lang), end_date: input.endDate, sent: send && !sendError, sendError });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Gutschein konnte nicht angelegt werden' });
  }
});

// POST /api/promotions/admin/personal/:id/send — (erneut) per E-Mail senden
router.post('/admin/personal/:id/send', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await sendGutschein(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Versand fehlgeschlagen' });
  }
});

// PUT /api/promotions/admin/personal/:id/deactivate — Link sperren
router.put('/admin/personal/:id/deactivate', authenticateAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await run('UPDATE promotions SET active = 0 WHERE id = ? AND personal = 1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Konnte nicht gesperrt werden' });
  }
});

export default router;
