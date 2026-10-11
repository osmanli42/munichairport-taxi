/**
 * Rechnungskunden — Privatkunden (meist Mitarbeiter von Firmen), denen ein Admin nach
 * einer ersten Fahrt die Zahlung per Überweisung freigeschaltet hat.
 *
 * Grundsatz aus routes/admin.ts bleibt bestehen: Überweisung ist öffentlich NICHT
 * buchbar, sonst könnte jeder ohne Bezahlung buchen. Ausnahme nur für Einträge in
 * invoice_customers, und auch dann nur, wenn E-Mail UND Telefon (E.164) zusammen passen,
 * höchstens `max_open` unbezahlte Überweisungs-Buchungen offen sind. Bewusst KEIN globaler
 * Schalter: die Freischaltung durch den Admin ist maßgeblich und wird pro Kunde gesteuert
 * (pausieren / entziehen / löschen). Die Prüfung passiert serverseitig beim Buchen
 * (assertTransferAllowed) — die öffentliche Abfrage dient nur der Anzeige im Formular
 * und gibt keine gespeicherten Daten (Adresse etc.) heraus.
 *
 * Admin:
 *   GET    /api/admin/invoice-customers
 *   GET    /api/admin/invoice-customers/by-booking/:bookingId
 *   POST   /api/admin/invoice-customers          { booking_id }
 *   PATCH  /api/admin/invoice-customers/:id      { active?, max_open?, rechnung_adresse?, note? }
 *   DELETE /api/admin/invoice-customers/:id
 * Öffentlich:
 *   POST   /api/invoice-customers/eligibility    { email, phone }
 */
import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { parsePhone } from '../utils/phone';
import { isRateLimited, registerFailure } from '../utils/rateLimit';
import { getClientIp } from '../utils/ipGeo';

const router = Router();

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  // Kolasyon explizit: JOINs/Vergleiche mit bookings (utf8mb4_unicode_ci) sollen nicht an
  // einem abweichenden Datenbank-Standard scheitern.
  await run(`
    CREATE TABLE IF NOT EXISTS invoice_customers (
      id INT NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      phone_e164 VARCHAR(32) NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      rechnung_adresse TEXT DEFAULT NULL,
      max_open INT NOT NULL DEFAULT 2,
      active TINYINT(1) NOT NULL DEFAULT 1,
      source_booking_id INT DEFAULT NULL,
      note VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_email_phone (email, phone_e164)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

const normEmail = (e: unknown) => String(e || '').trim().toLowerCase().slice(0, 255);
const normPhone = (p: unknown): string | null => {
  const r = parsePhone(String(p || ''));
  return r.ok ? r.e164 : null;
};


export interface InvoiceCustomer {
  id: number;
  email: string;
  phone_e164: string;
  name: string | null;
  rechnung_adresse: string | null;
  max_open: number;
  active: number;
}

async function findCustomer(email: unknown, phone: unknown): Promise<InvoiceCustomer | null> {
  const e = normEmail(email);
  const p = normPhone(phone);
  if (!e || !p) return null;
  await ensureTable();
  const [c] = await query<InvoiceCustomer>(
    `SELECT * FROM invoice_customers WHERE email = ? AND phone_e164 = ? AND active = 1 LIMIT 1`,
    [e, p]
  );
  return c || null;
}

// Unbezahlte Überweisungs-Buchungen dieses Kunden (nicht storniert)
async function openTransfers(email: string): Promise<number> {
  const [r] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM bookings
      WHERE LOWER(email) = ? AND payment_method = 'ueberweisung'
        AND ueberweisung_paid_at IS NULL AND status <> 'cancelled'`,
    [email]
  );
  return Number(r?.n || 0);
}

/**
 * Wird von POST /api/bookings aufgerufen, bevor eine öffentliche Buchung mit
 * payment_method 'ueberweisung' angenommen wird. Liefert den Kunden oder einen Fehlertext.
 */
export async function assertTransferAllowed(
  email: unknown, phone: unknown
): Promise<{ ok: true; customer: InvoiceCustomer } | { ok: false; error: string }> {
  const customer = await findCustomer(email, phone);
  if (!customer) return { ok: false, error: 'Invalid payment method' };
  if ((await openTransfers(customer.email)) >= customer.max_open) {
    return {
      ok: false,
      error: 'Es gibt noch offene Rechnungen. Bitte wählen Sie Bar- oder Kartenzahlung.',
    };
  }
  return { ok: true, customer };
}

// ---------- Öffentlich: Anzeige im /buchen-Formular ----------
const ELIG_MAX = 30;
const ELIG_WINDOW_MS = 15 * 60_000;

router.post('/invoice-customers/eligibility', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone } = req.body || {};
    // Jede Abfrage zählt, nicht nur Fehlschläge: so lässt sich die Liste nicht durch
    // massenhaftes Raten von E-Mail/Telefon-Paaren abklopfen. Zusätzlich pro E-Mail,
    // weil die IP aus X-Forwarded-For stammt und gefälscht werden kann.
    const keys = [`invcust:ip:${getClientIp(req) || 'unknown'}`, `invcust:mail:${normEmail(email)}`];
    if (keys.some(k => isRateLimited(k, ELIG_MAX))) { res.json({ eligible: false }); return; }
    keys.forEach(k => registerFailure(k, ELIG_WINDOW_MS));

    const customer = await findCustomer(email, phone);
    if (!customer) { res.json({ eligible: false }); return; }
    const limitReached = (await openTransfers(customer.email)) >= customer.max_open;
    res.json({ eligible: !limitReached, limit_reached: limitReached, has_address: !!customer.rechnung_adresse });
  } catch (err: any) {
    console.error('invoice-customers eligibility:', err.message);
    res.json({ eligible: false });
  }
});

// ---------- Admin ----------
router.get('/admin/invoice-customers', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const rows = await query<any>(
      `SELECT c.*,
         (SELECT COUNT(*) FROM bookings b WHERE LOWER(b.email) = c.email AND b.payment_method = 'ueberweisung'
            AND b.ueberweisung_paid_at IS NULL AND b.status <> 'cancelled') AS open_transfers,
         (SELECT COUNT(*) FROM bookings b WHERE LOWER(b.email) = c.email AND b.status <> 'cancelled') AS bookings_total
       FROM invoice_customers c ORDER BY c.active DESC, c.created_at DESC`
    );
    res.json({ customers: rows });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.get('/admin/invoice-customers/by-booking/:bookingId', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const [b] = await query<any>(`SELECT email, phone, phone_e164 FROM bookings WHERE id = ?`, [req.params.bookingId]);
    if (!b) { res.status(404).json({ error: 'not found' }); return; }
    const e = normEmail(b.email);
    const p = b.phone_e164 || normPhone(b.phone);
    const [c] = e && p
      ? await query<any>(`SELECT * FROM invoice_customers WHERE email = ? AND phone_e164 = ? LIMIT 1`, [e, p])
      : [];
    const open = c ? await openTransfers(c.email) : 0;
    res.json({ customer: c || null, open_transfers: open, can_approve: !!(e && p) });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.post('/admin/invoice-customers', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const bookingId = Number(req.body?.booking_id);
    const [b] = await query<any>(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
    if (!b) { res.status(404).json({ error: 'Buchung nicht gefunden' }); return; }
    if (b.company_id) { res.status(400).json({ error: 'Firmenkunden (B2B) laufen über das Firmenportal' }); return; }
    const e = normEmail(b.email);
    const p = b.phone_e164 || normPhone(b.phone);
    if (!e || !p) { res.status(400).json({ error: 'E-Mail und gültige Telefonnummer erforderlich' }); return; }
    const maxOpen = Math.min(Math.max(Number(req.body?.max_open) || 2, 1), 20);
    await run(
      `INSERT INTO invoice_customers (email, phone_e164, name, rechnung_adresse, max_open, active, source_booking_id)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE active = 1,
         name = VALUES(name),
         rechnung_adresse = COALESCE(VALUES(rechnung_adresse), rechnung_adresse),
         source_booking_id = VALUES(source_booking_id)`,
      [e, p, b.name || null, b.rechnung_adresse || null, maxOpen, b.id]
    );
    const [c] = await query<any>(`SELECT * FROM invoice_customers WHERE email = ? AND phone_e164 = ?`, [e, p]);
    res.json({ customer: c, open_transfers: await openTransfers(e) });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.patch('/admin/invoice-customers/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const sets: string[] = [];
    const params: any[] = [];
    const { active, max_open, rechnung_adresse, note } = req.body || {};
    if (typeof active === 'boolean') { sets.push('active = ?'); params.push(active ? 1 : 0); }
    if (max_open !== undefined) { sets.push('max_open = ?'); params.push(Math.min(Math.max(Number(max_open) || 1, 1), 20)); }
    if (rechnung_adresse !== undefined) {
      const a = typeof rechnung_adresse === 'string' ? rechnung_adresse.trim().slice(0, 500) : '';
      sets.push('rechnung_adresse = ?'); params.push(a || null);
    }
    if (note !== undefined) { sets.push('note = ?'); params.push(typeof note === 'string' ? note.trim().slice(0, 255) || null : null); }
    if (sets.length) await run(`UPDATE invoice_customers SET ${sets.join(', ')} WHERE id = ?`, [...params, req.params.id]);
    const [c] = await query<any>(`SELECT * FROM invoice_customers WHERE id = ?`, [req.params.id]);
    res.json({ customer: c || null });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.delete('/admin/invoice-customers/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    await run(`DELETE FROM invoice_customers WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

export default router;
