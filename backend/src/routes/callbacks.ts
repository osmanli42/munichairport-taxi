import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { parsePhone, formatPhoneDisplay } from '../utils/phone';
import { isRateLimited, registerFailure } from '../utils/rateLimit';
import { sendWhatsAppAdmin } from '../services/whatsappNotify';

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;

/**
 * Rückruf-Anfragen ("Rückruf anfordern").
 *
 * Warum: die Session Replays zeigen ein Segment, das den Preis ansieht und dann
 * zum Telefon wechselt (call_click) statt das Buchungsformular auszufüllen. Diese
 * Kunden gingen bisher verloren, sobald sie nicht selbst anrufen wollten.
 * Hier wird nur die Telefonnummer plus die bereits eingegebene Route erfasst —
 * kein vollständiges Formular. Dem Kunden wird bewusst KEINE Rückrufzeit versprochen,
 * da die Benachrichtigung per E-Mail läuft; eilige Kunden bekommen die Direktnummer.
 */
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await run(`
    CREATE TABLE IF NOT EXISTS callback_requests (
      id INT NOT NULL AUTO_INCREMENT,
      phone VARCHAR(40) NOT NULL,
      name VARCHAR(120) DEFAULT NULL,
      pickup VARCHAR(255) DEFAULT NULL,
      dropoff VARCHAR(255) DEFAULT NULL,
      price DECIMAL(10,2) DEFAULT NULL,
      distance_km DECIMAL(10,2) DEFAULT NULL,
      vehicle VARCHAR(40) DEFAULT NULL,
      trip_datetime VARCHAR(50) DEFAULT NULL,
      passengers INT DEFAULT NULL,
      duration_min INT DEFAULT NULL,
      trip_type VARCHAR(10) DEFAULT NULL,
      return_datetime VARCHAR(50) DEFAULT NULL,
      prices_seen VARCHAR(255) DEFAULT NULL,
      source_url VARCHAR(500) DEFAULT NULL,
      locale VARCHAR(5) DEFAULT NULL,
      session_id VARCHAR(64) DEFAULT NULL,
      visitor_id VARCHAR(64) DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      note TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      handled_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_status_created (status, created_at),
      INDEX idx_session_id (session_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Kollation explizit wie bei den übrigen Tabellen dieses Projekts — sonst schlägt
  // ein JOIN über session_id auf visitor_sessions/bookings fehl ("Illegal mix of collations").
  try {
    await run(`ALTER TABLE callback_requests CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch { /* fehlende Rechte oder bereits korrekt */ }
  // Nachträglich ergänzte Fahrtdetails — damit der Kunde am Telefon nichts wiederholen muss
  for (const ddl of [
    'ALTER TABLE callback_requests ADD COLUMN duration_min INT DEFAULT NULL',
    'ALTER TABLE callback_requests ADD COLUMN trip_type VARCHAR(10) DEFAULT NULL',
    'ALTER TABLE callback_requests ADD COLUMN return_datetime VARCHAR(50) DEFAULT NULL',
    'ALTER TABLE callback_requests ADD COLUMN prices_seen VARCHAR(255) DEFAULT NULL',
    'ALTER TABLE callback_requests ADD COLUMN source_url VARCHAR(500) DEFAULT NULL',
  ]) {
    try { await run(ddl); } catch { /* Spalte existiert bereits */ }
  }
  tableReady = true;
}

const trunc = (v: any, n: number): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, n) : null;
};
const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// POST /api/callback-request — öffentlich
router.post('/callback-request', async (req: Request, res: Response) => {
  try {
    await ensureTable();

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    // Missbrauchsschutz: max. 5 Anfragen pro IP und Stunde.
    // registerFailure() ist hier der Zähler — isRateLimited() prüft nur den Stand.
    const rateKey = `callback:${ip}`;
    if (isRateLimited(rateKey, 5)) {
      res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
      return;
    }
    registerFailure(rateKey, 60 * 60 * 1000);

    const parsed = parsePhone(req.body?.phone);
    if (!parsed.ok) {
      res.status(400).json({ error: 'invalid_phone' });
      return;
    }

    const data = {
      phone: parsed.e164,
      name: trunc(req.body?.name, 120),
      pickup: trunc(req.body?.pickup, 255),
      dropoff: trunc(req.body?.dropoff, 255),
      price: num(req.body?.price),
      distance_km: num(req.body?.distance_km),
      vehicle: trunc(req.body?.vehicle, 40),
      trip_datetime: trunc(req.body?.trip_datetime, 50),
      passengers: num(req.body?.passengers),
      duration_min: num(req.body?.duration_min),
      trip_type: trunc(req.body?.trip_type, 10),
      return_datetime: trunc(req.body?.return_datetime, 50),
      prices_seen: trunc(req.body?.prices_seen, 255),
      source_url: trunc(req.body?.source_url, 500),
      locale: trunc(req.body?.locale, 5),
      session_id: trunc(req.body?.session_id, 64),
      visitor_id: trunc(req.body?.visitor_id, 64),
    };

    const result = await run(
      `INSERT INTO callback_requests
        (phone, name, pickup, dropoff, price, distance_km, vehicle, trip_datetime,
         passengers, duration_min, trip_type, return_datetime, prices_seen, source_url,
         locale, session_id, visitor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.phone, data.name, data.pickup, data.dropoff, data.price, data.distance_km,
        data.vehicle, data.trip_datetime, data.passengers, data.duration_min, data.trip_type,
        data.return_datetime, data.prices_seen, data.source_url,
        data.locale, data.session_id, data.visitor_id,
      ]
    );

    // Antwort nicht auf die E-Mail warten lassen — der Kunde soll sofort die
    // Bestätigung sehen, auch wenn Resend gerade langsam ist.
    res.json({ ok: true, id: result.insertId });

    // WhatsApp zuerst: dort kommt die Anfrage sofort an. Läuft unabhängig von der E-Mail,
    // damit ein fehlender WhatsApp-Zugang die E-Mail nicht verhindert (und umgekehrt).
    sendWhatsAppAdmin([
      `Rückruf gewünscht: ${formatPhoneDisplay(data.phone)}`,
      `Name: ${data.name || '—'}`,
      `Strecke: ${[data.pickup, data.dropoff].filter(Boolean).join(' → ') || '—'}`,
      `Termin: ${data.trip_datetime || '—'}${data.passengers ? ` · ${data.passengers} Pers.` : ''}${data.distance_km != null ? ` · ${Number(data.distance_km).toFixed(1)} km` : ''}`,
      `Preise: ${data.prices_seen || (data.price != null ? `${Number(data.price).toFixed(2)} €` : '—')}`,
    ]).catch(() => { /* Benachrichtigung darf den Request nie beeinflussen */ });

    if (!RESEND_API_KEY) return;
    const resend = new Resend(RESEND_API_KEY);

    // "19.09.2026 um 10:00" — der Kunde soll am Telefon nichts wiederholen müssen,
    // deshalb steht hier alles, was er in der Suche schon eingegeben hat.
    const fmtDateTime = (v: string | null): string => {
      if (!v) return '—';
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
      return m ? `${m[3]}.${m[2]}.${m[1]} um ${m[4]}:${m[5]}` : v;
    };
    const tripTypeLabel = data.trip_type === 'roundtrip' ? 'Hin- & Rückfahrt' : data.trip_type ? 'Einfache Fahrt' : '—';

    const rows: [string, string][] = [
      ['Telefon', formatPhoneDisplay(data.phone)],
      ['Name', data.name || '—'],
      ['Abholung', data.pickup || '—'],
      ['Ziel', data.dropoff || '—'],
      ['Termin', fmtDateTime(data.trip_datetime)],
      ['Fahrttyp', tripTypeLabel],
      ...(data.return_datetime ? [['Rückfahrt', fmtDateTime(data.return_datetime)] as [string, string]] : []),
      ['Personen', data.passengers != null ? String(data.passengers) : '—'],
      ['Strecke', data.distance_km != null ? `${Number(data.distance_km).toFixed(1)} km` : '—'],
      ['Fahrtzeit', data.duration_min != null ? `ca. ${data.duration_min} Min.` : '—'],
      ['Gesehene Preise', data.prices_seen || (data.price != null ? `${Number(data.price).toFixed(2)} €` : '—')],
      ['Sprache', (data.locale || 'de').toUpperCase()],
    ];

    resend.emails.send({
      from: `Flughafen-muenchen.TAXI <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `📞 Rückruf gewünscht: ${formatPhoneDisplay(data.phone)}${data.name ? ` (${data.name})` : ''}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb;">
          <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #16a34a;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#111;">📞 Rückruf-Anfrage</h1>
            <p style="margin:0 0 18px;color:#6b7280;font-size:13px;">
              Der Kunde bittet um einen Rückruf. Alle Fahrtdaten unten stammen aus seiner Suche —
              er muss am Telefon nichts wiederholen.
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              ${rows.map(([k, v]) => `
                <tr>
                  <td style="padding:7px 0;color:#6b7280;width:130px;vertical-align:top;">${k}</td>
                  <td style="padding:7px 0;color:#111;font-weight:600;">${v}</td>
                </tr>`).join('')}
            </table>
            <a href="tel:${data.phone}" style="display:inline-block;margin-top:18px;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">
              ${formatPhoneDisplay(data.phone)} anrufen
            </a>
            ${data.source_url ? `
              <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">
                Seite des Kunden:<br>
                <a href="${data.source_url}" style="color:#2563eb;word-break:break-all;">${data.source_url.slice(0, 160)}</a>
              </p>` : ''}
          </div>
        </div>`,
    }).catch((err: any) => console.error('callback email failed:', err.message));
  } catch (err: any) {
    console.error('callback-request error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'failed' });
  }
});

// GET /api/admin/callback-requests — offene Anfragen zuerst
router.get('/admin/callback-requests', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 365);
    const rows = await query<any>(
      `SELECT c.*, TIMESTAMPDIFF(MINUTE, c.created_at, NOW()) AS minutes_ago
         FROM callback_requests c
        WHERE c.created_at >= NOW() - INTERVAL ${days} DAY
        ORDER BY (c.status = 'open') DESC, c.created_at DESC
        LIMIT 200`
    );
    const [open] = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM callback_requests WHERE status = 'open'`
    );
    res.json({ days, open: Number(open?.n || 0), requests: rows });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// POST /api/admin/callback-requests/:id/done — als erledigt markieren
router.post('/admin/callback-requests/:id/done', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ error: 'bad id' }); return; }
    const note = trunc(req.body?.note, 500);
    await run(
      `UPDATE callback_requests SET status = 'done', handled_at = NOW(), note = COALESCE(?, note) WHERE id = ?`,
      [note, id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

export default router;
