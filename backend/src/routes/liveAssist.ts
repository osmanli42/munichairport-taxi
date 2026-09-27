import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { getClientIp } from '../utils/ipGeo';
import { isRateLimited, registerFailure } from '../utils/rateLimit';
import { berlinMidnightUtcSql } from '../utils/berlinTime';
import {
  ensureLiveAssistTables, getLiveAssistSettings, saveLiveAssistSettings, validCodePromos,
  createAlert, describeVisit, reactionDetail, ADMIN_EMAIL_DEFAULT, ALERT_KINDS,
  markAdminOnline, isAdminOnline, saveChatImage,
} from '../services/liveAssist';
import { draftReply, isAiConfigured } from '../services/liveAssistAi';

/**
 * Canlı Asistan — siehe services/liveAssist.ts für das Warum.
 *
 * Öffentlich: config, inbox (Besucher fragt alle 8 s nach neuen Nachrichten), ack.
 * Admin: Einstellungen, Codes, Nachricht senden, Übersicht für den Live-Tab.
 */
const router = Router();

const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/;
const ACK_EVENTS = new Set(['seen', 'whatsapp', 'callback', 'book', 'dismiss', 'auto_shown']);
const REACTIONS = new Set(['whatsapp', 'callback', 'book']);

function validSession(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return SESSION_RE.test(s) ? s : null;
}

// Öffentliche Endpunkte: großzügig pro IP (Flughafen-WLAN = viele Besucher hinter einer IP).
function limited(req: Request, bucket: string, max: number): boolean {
  const key = `live-assist:${bucket}:${getClientIp(req)}`;
  if (isRateLimited(key, max)) return true;
  registerFailure(key, 60 * 1000);
  return false;
}

async function visitSummary(sessionId: string): Promise<string> {
  const [row] = await query<any>(
    `SELECT s.ua_device, s.city, s.country, s.utm_source, s.gclid,
       (SELECT p.path FROM visitor_pageviews p WHERE p.session_id = s.session_id
          AND (p.path LIKE '%/ergebnisse%' OR p.path LIKE '%/buchen%') ORDER BY p.id DESC LIMIT 1) AS path,
       (SELECT e.target FROM visitor_events e WHERE e.session_id = s.session_id
          AND e.type = 'price_shown' ORDER BY e.id DESC LIMIT 1) AS price_shown
     FROM visitor_sessions s WHERE s.session_id = ?`,
    [sessionId]
  );
  return row ? describeVisit(row) : '';
}

/**
 * Fahrtdaten des Besuchers für den Kopf des Admin-Chats: aus der letzten Preis-/Buchungsseite
 * (URL-Parameter) plus allen angezeigten Preisen (price_shown) — damit der Admin vor der
 * Antwort Strecke, Termin, Personen und Preis kennt.
 */
async function tripContext(sessionId: string): Promise<any> {
  const [row] = await query<any>(
    `SELECT s.city, s.country, s.ua_device, s.utm_source, s.gclid, s.referrer,
       (SELECT p.path FROM visitor_pageviews p WHERE p.session_id = s.session_id
          AND (p.path LIKE '%/ergebnisse%' OR p.path LIKE '%/buchen%') ORDER BY p.id DESC LIMIT 1) AS path,
       (SELECT GROUP_CONCAT(e.target ORDER BY e.id DESC SEPARATOR ';') FROM visitor_events e
          WHERE e.session_id = s.session_id AND e.type = 'price_shown') AS prices,
       (SELECT b.booking_number FROM bookings b WHERE b.session_id = s.session_id ORDER BY b.id DESC LIMIT 1) AS booking_number
     FROM visitor_sessions s WHERE s.session_id = ?`,
    [sessionId]
  );
  if (!row) return null;
  const qs = new URLSearchParams(row.path && row.path.includes('?') ? row.path.slice(row.path.indexOf('?') + 1) : '');
  // price_shown: "preis|km|fahrzeug" — je Fahrzeug den neuesten Wert
  const prices: Record<string, number> = {};
  let km: number | null = null;
  for (const p of String(row.prices || '').split(';').filter(Boolean)) {
    const [price, dist, vehicle] = p.split('|');
    const n = Number(price);
    if (vehicle && !(vehicle in prices) && Number.isFinite(n) && n > 0) prices[vehicle] = Math.ceil(n * 2) / 2;
    if (km == null && Number(dist) > 0) km = Number(dist);
  }
  const selPrice = Number(qs.get('price'));
  if (qs.get('vehicle') && selPrice > 0) prices[qs.get('vehicle')!] = Math.ceil(selPrice * 2) / 2;
  return {
    pickup: qs.get('pickup'),
    dropoff: qs.get('dropoff'),
    date: qs.get('date'),
    time: qs.get('time'),
    passengers: qs.get('passengers') ? Number(qs.get('passengers')) : null,
    trip_type: qs.get('trip_type'),
    return_date: qs.get('return_date'),
    return_time: qs.get('return_time'),
    zwischenstopp: qs.get('zwischenstopp_address'),
    vehicle: qs.get('vehicle'),
    distance_km: Number(qs.get('distance_km')) || km,
    duration_min: Number(qs.get('duration')) || null,
    prices,
    page: row.path ? (row.path.includes('/buchen') ? 'buchen' : 'ergebnisse') : null,
    city: row.city, country: row.country, device: row.ua_device,
    source: row.gclid || row.utm_source === 'google_ads' ? 'Google Ads' : row.utm_source || (row.referrer ? 'Referral' : 'Direct'),
    booking_number: row.booking_number,
  };
}

// ── Öffentlich ────────────────────────────────────────────────────────────

// GET /api/live-assist/config — nur, was die Seite braucht (keine E-Mail-Adresse o. Ä.)
router.get('/live-assist/config', async (_req: Request, res: Response) => {
  try {
    const s = await getLiveAssistSettings();
    res.json({
      enabled: s.enabled === '1',
      auto_enabled: s.enabled === '1' && s.auto_enabled === '1',
      auto_delay_sec: parseInt(s.auto_delay_sec, 10) || 40,
      wa_prefill_enabled: s.wa_prefill_enabled === '1',
      agent_name: s.agent_name,
      agent_online: s.enabled === '1' && isAdminOnline(),
    });
  } catch (err: any) {
    console.error('live-assist config error:', err.message);
    res.json({ enabled: false, auto_enabled: false, auto_delay_sec: 40, wa_prefill_enabled: false, agent_name: '' });
  }
});

// GET /api/live-assist/inbox?session_id=&after_id= — Chatverlauf ab after_id
// (Admin- und eigene Nachrichten; die automatische Blase ist kein Chat-Eintrag).
router.get('/live-assist/inbox', async (req: Request, res: Response) => {
  try {
    if (limited(req, 'inbox', 180)) { res.status(429).json({ messages: [] }); return; }
    const sessionId = validSession(req.query.session_id);
    if (!sessionId) { res.status(400).json({ messages: [] }); return; }
    const s = await getLiveAssistSettings();
    if (s.enabled !== '1') { res.json({ enabled: false, messages: [] }); return; }
    const afterId = Math.max(0, parseInt(String(req.query.after_id ?? '0'), 10) || 0);

    const rows = await query<any>(
      `SELECT id, source, template, body, promo_code, attachment_id, created_at FROM live_messages
        WHERE session_id = ? AND source IN ('admin', 'visitor') AND id > ?
          AND created_at >= NOW() - INTERVAL 6 HOUR
        ORDER BY id LIMIT 100`,
      [sessionId, afterId]
    );
    const undelivered = rows.filter((r) => r.source === 'admin').map((r) => r.id);
    if (undelivered.length) {
      await run(
        `UPDATE live_messages SET delivered_at = COALESCE(delivered_at, NOW()) WHERE id IN (${undelivered.map(() => '?').join(',')})`,
        undelivered
      );
    }
    const messages = [];
    for (const r of rows) {
      // Code beim Zustellen erneut prüfen — er kann seit dem Senden abgelaufen sein.
      let promo = null;
      if (r.promo_code) {
        const [p] = await validCodePromos(r.promo_code);
        if (p) promo = { code: p.code, type: p.type, value: Number(p.value) };
      }
      messages.push({ id: r.id, from: r.source === 'visitor' ? 'visitor' : 'agent', body: r.body, promo, attachment_id: r.attachment_id, created_at: r.created_at });
    }
    res.json({ enabled: true, agent_name: s.agent_name, agent_online: isAdminOnline(), messages });
  } catch (err: any) {
    console.error('live-assist inbox error:', err.message);
    res.status(500).json({ messages: [] });
  }
});

// POST /api/live-assist/reply — { session_id, body } — Besucher schreibt im Chat
router.post('/live-assist/reply', async (req: Request, res: Response) => {
  try {
    if (limited(req, 'reply', 20)) { res.status(429).json({ ok: false }); return; }
    const sessionId = validSession(req.body?.session_id);
    const body = String(req.body?.body || '').trim().slice(0, 1000);
    if (!sessionId || (!body && !req.body?.image)) { res.status(400).json({ ok: false }); return; }
    const s = await getLiveAssistSettings();
    if (s.enabled !== '1') { res.status(409).json({ ok: false }); return; }
    await ensureLiveAssistTables();
    let attachmentId: number | null = null;
    if (req.body?.image) {
      const saved = await saveChatImage(sessionId, req.body.image);
      if (typeof saved === 'string') { res.status(400).json({ ok: false, error: saved }); return; }
      attachmentId = saved;
    }
    const r = await run(
      `INSERT INTO live_messages (session_id, source, template, body, attachment_id, delivered_at) VALUES (?, 'visitor', 'chat', ?, ?, NOW())`,
      [sessionId, body, attachmentId]
    );
    res.json({ ok: true, id: r.insertId });

    // Antwort auf Admin-Nachricht / Auto-Blase als Reaktion vermerken (Status im Live-Tab)
    await run(
      `UPDATE live_messages SET action = 'chat', action_at = NOW(), seen_at = COALESCE(seen_at, NOW())
        WHERE session_id = ? AND source IN ('admin', 'auto') AND (action IS NULL OR action = 'dismiss')`,
      [sessionId]
    );
    const visit = await visitSummary(sessionId);
    createAlert(sessionId, 'chat', `${body ? `"${body.slice(0, 160)}"` : '📷 Bild'} · ${visit}`, { key: `chat:${r.insertId}` })
      .catch((err) => console.error('[live-assist] chat alert failed:', err.message));
  } catch (err: any) {
    console.error('live-assist reply error:', err.message);
    if (!res.headersSent) res.status(500).json({ ok: false });
  }
});

// POST /api/live-assist/ack — { session_id, id?, event }
router.post('/live-assist/ack', async (req: Request, res: Response) => {
  try {
    if (limited(req, 'ack', 60)) { res.status(429).json({ ok: false }); return; }
    const sessionId = validSession(req.body?.session_id);
    const event = String(req.body?.event || '');
    if (!sessionId || !ACK_EVENTS.has(event)) { res.status(400).json({ ok: false }); return; }
    await ensureLiveAssistTables();

    if (event === 'auto_shown') {
      const s = await getLiveAssistSettings();
      if (s.enabled !== '1' || s.auto_enabled !== '1') { res.json({ ok: false }); return; }
      // Einmal pro Besuch — ein zweiter Tab derselben Session legt keine zweite Zeile an.
      const [existing] = await query<{ id: number }>(
        `SELECT id FROM live_messages WHERE session_id = ? AND source = 'auto' ORDER BY id LIMIT 1`,
        [sessionId]
      );
      if (existing) { res.json({ ok: true, id: existing.id }); return; }
      const r = await run(
        `INSERT INTO live_messages (session_id, source, template, delivered_at, seen_at)
         VALUES (?, 'auto', 'auto', NOW(), NOW())`,
        [sessionId]
      );
      res.json({ ok: true, id: r.insertId });
      return;
    }

    const id = parseInt(String(req.body?.id ?? ''), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ ok: false }); return; }
    const [msg] = await query<any>(
      `SELECT id, source, action FROM live_messages WHERE id = ? AND session_id = ?`,
      [id, sessionId]
    );
    if (!msg) { res.status(404).json({ ok: false }); return; }

    if (event === 'seen') {
      await run(`UPDATE live_messages SET seen_at = COALESCE(seen_at, NOW()) WHERE id = ?`, [id]);
    } else if (event === 'dismiss') {
      await run(`UPDATE live_messages SET action = 'dismiss', action_at = NOW() WHERE id = ? AND action IS NULL`, [id]);
    } else {
      // whatsapp | callback | book — stärkere Aktion überschreibt 'dismiss'
      await run(
        `UPDATE live_messages SET action = ?, action_at = NOW(), seen_at = COALESCE(seen_at, NOW()) WHERE id = ?`,
        [event, id]
      );
    }
    res.json({ ok: true });

    if (REACTIONS.has(event)) {
      const visit = await visitSummary(sessionId);
      const via = msg.source === 'auto' ? '🤖 otomatik balon' : '💬 mesajın';
      // Rückruf verschickt schon selbst eine E-Mail — keine zweite.
      createAlert(sessionId, 'reaction', reactionDetail(event, `${via} · ${visit}`), { skipEmail: event === 'callback' })
        .catch((err) => console.error('[live-assist] reaction alert failed:', err.message));
    }
  } catch (err: any) {
    console.error('live-assist ack error:', err.message);
    if (!res.headersSent) res.status(500).json({ ok: false });
  }
});

// GET /api/live-assist/file/:id?session_id= — Bild aus dem eigenen Chat
router.get('/live-assist/file/:id', async (req: Request, res: Response) => {
  try {
    const sessionId = validSession(req.query.session_id);
    const id = parseInt(req.params.id, 10);
    if (!sessionId || !Number.isFinite(id)) { res.status(400).end(); return; }
    await ensureLiveAssistTables();
    const [f] = await query<any>(`SELECT mime, data FROM live_chat_files WHERE id = ? AND session_id = ?`, [id, sessionId]);
    if (!f) { res.status(404).end(); return; }
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(f.data);
  } catch {
    res.status(500).end();
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────

router.get('/admin/live-assist/settings', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const s = await getLiveAssistSettings();
    res.json({ settings: s, admin_email_default: ADMIN_EMAIL_DEFAULT, email_configured: !!process.env.RESEND_API_KEY, ai_configured: isAiConfigured() });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.put('/admin/live-assist/settings', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const error = await saveLiveAssistSettings(req.body || {});
    if (error) { res.status(400).json({ error }); return; }
    res.json({ settings: await getLiveAssistSettings() });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// Einlösbare Codes für das Dropdown im Nachrichtenfenster
router.get('/admin/live-assist/promos', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const promos = await validCodePromos();
    res.json({ promos: promos.map((p) => ({ code: p.code, type: p.type, value: Number(p.value), end_date: p.end_date })) });
  } catch (err: any) {
    console.error('live-assist promos error:', err.message);
    res.json({ promos: [] });
  }
});

// POST /api/admin/live-assist/messages — { session_id, template, body, promo_code? }
router.post('/admin/live-assist/messages', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureLiveAssistTables();
    const s = await getLiveAssistSettings();
    if (s.enabled !== '1') { res.status(409).json({ error: 'Canlı Asistan kapalı' }); return; }

    const sessionId = validSession(req.body?.session_id);
    const body = String(req.body?.body || '').trim().slice(0, 500);
    const template = String(req.body?.template || 'custom').slice(0, 40);
    const promoCode = String(req.body?.promo_code || '').trim() || null;
    if (!sessionId || (!body && !req.body?.image && !promoCode)) { res.status(400).json({ error: 'session_id ve mesaj gerekli' }); return; }

    const [session] = await query<any>(
      `SELECT session_id FROM visitor_sessions WHERE session_id = ? AND last_seen >= NOW() - INTERVAL 2 MINUTE`,
      [sessionId]
    );
    if (!session) { res.status(410).json({ error: 'Ziyaretçi artık sitede değil' }); return; }

    if (promoCode) {
      const [promo] = await validCodePromos(promoCode);
      if (!promo) { res.status(400).json({ error: 'Bu kod şu an geçerli değil' }); return; }
    }

    let attachmentId: number | null = null;
    if (req.body?.image) {
      const saved = await saveChatImage(sessionId, req.body.image);
      if (typeof saved === 'string') { res.status(400).json({ error: saved }); return; }
      attachmentId = saved;
    }
    markAdminOnline();
    const r = await run(
      `INSERT INTO live_messages (session_id, source, template, body, promo_code, attachment_id) VALUES (?, 'admin', ?, ?, ?, ?)`,
      [sessionId, template, body, promoCode, attachmentId]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (err: any) {
    console.error('live-assist send error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/admin/live-assist/thread?session_id= — ganzer Chat, markiert Besucher-Nachrichten als gelesen
router.get('/admin/live-assist/thread', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureLiveAssistTables();
    markAdminOnline();
    const sessionId = validSession(req.query.session_id);
    if (!sessionId) { res.status(400).json({ messages: [] }); return; }
    const rows = await query<any>(
      `SELECT id, source, template, body, promo_code, attachment_id, created_at, delivered_at, seen_at, action
         FROM live_messages WHERE session_id = ? ORDER BY id LIMIT 500`,
      [sessionId]
    );
    await run(
      `UPDATE live_messages SET seen_at = NOW() WHERE session_id = ? AND source = 'visitor' AND seen_at IS NULL`,
      [sessionId]
    );
    res.json({ messages: rows, context: await tripContext(sessionId) });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// GET /api/admin/live-assist/file/:id — Bild für den Admin (per fetch mit Token)
router.get('/admin/live-assist/file/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [f] = await query<any>(`SELECT mime, data FROM live_chat_files WHERE id = ?`, [id]);
    if (!f) { res.status(404).end(); return; }
    res.setHeader('Content-Type', f.mime);
    res.send(f.data);
  } catch {
    res.status(500).end();
  }
});

// GET /api/admin/live-assist/conversations?q=&days= — Chat-Archiv (alle Gespräche mit Besucher-Nachricht
// oder Admin-Nachricht), damit man bei Streitfällen den Verlauf wiederfindet.
router.get('/admin/live-assist/conversations', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureLiveAssistTables();
    const days = Math.min(Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 1), 3650);
    const q = String(req.query.q || '').trim().slice(0, 80);
    const params: any[] = [days];
    let filter = '';
    if (q) {
      // Ref-Code (erste 4 Zeichen der Session) oder Text
      filter = ` AND (m.session_id LIKE ? OR m.session_id IN (SELECT session_id FROM live_messages WHERE body LIKE ?))`;
      params.push(`${q.toLowerCase()}%`, `%${q}%`);
    }
    const rows = await query<any>(
      `SELECT m.session_id,
              MIN(m.created_at) AS started_at, MAX(m.created_at) AS last_at,
              SUM(m.source = 'admin') AS agent_msgs, SUM(m.source = 'visitor') AS visitor_msgs,
              SUM(m.attachment_id IS NOT NULL) AS images,
              GROUP_CONCAT(DISTINCT m.promo_code) AS promos,
              (SELECT body FROM live_messages x WHERE x.session_id = m.session_id AND x.body IS NOT NULL AND x.body <> ''
                 ORDER BY x.id DESC LIMIT 1) AS last_body,
              (SELECT b.booking_number FROM bookings b WHERE b.session_id = m.session_id ORDER BY b.id DESC LIMIT 1) AS booking_number,
              (SELECT CONCAT_WS(' · ', s.city, s.ua_device) FROM visitor_sessions s WHERE s.session_id = m.session_id) AS visitor
         FROM live_messages m
        WHERE m.source IN ('admin', 'visitor') AND m.created_at >= NOW() - INTERVAL ? DAY${filter}
        GROUP BY m.session_id
        ORDER BY last_at DESC
        LIMIT 200`,
      params
    );
    res.json({ conversations: rows });
  } catch (err: any) {
    console.error('live-assist conversations error:', err.message);
    res.status(500).json({ error: 'failed', conversations: [] });
  }
});

// POST /api/admin/live-assist/suggest — { session_id } → KI-Entwurf (wird nicht gesendet)
router.post('/admin/live-assist/suggest', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const s = await getLiveAssistSettings();
    if (s.ai_draft_enabled !== '1') { res.status(409).json({ error: 'Yapay zekâ taslağı kapalı' }); return; }
    if (!isAiConfigured()) { res.status(503).json({ error: 'ANTHROPIC_API_KEY tanımlı değil' }); return; }
    const sessionId = validSession(req.body?.session_id);
    if (!sessionId) { res.status(400).json({ error: 'session_id gerekli' }); return; }
    const text = await draftReply(sessionId, s.agent_name);
    res.json({ text: text.slice(0, 500) });
  } catch (err: any) {
    console.error('live-assist suggest error:', err.message);
    const msg = String(err.message || '');
    res.status(502).json({
      error: msg === 'refusal' ? 'Yapay zekâ bu mesaja taslak üretmedi'
        : /credit balance/i.test(msg) ? 'Claude hesabında kredi bitmiş — console.anthropic.com → Plans & Billing'
        : /authentication|api[_ ]key/i.test(msg) ? 'Claude API anahtarı geçersiz'
        : 'Taslak oluşturulamadı',
    });
  }
});

// GET /api/admin/live-assist/overview?session_ids=a,b&since_alert_id=N
router.get('/admin/live-assist/overview', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureLiveAssistTables();
    markAdminOnline(); // Live-Tab offen = im Chat erreichbar
    const s = await getLiveAssistSettings();
    const ids = String(req.query.session_ids || '')
      .split(',').map((v) => validSession(v)).filter((v): v is string => !!v).slice(0, 100);

    const sessions: Record<string, any> = {};
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      const msgs = await query<any>(
        `SELECT m.id, m.session_id, m.source, m.template, m.promo_code, m.created_at, m.delivered_at,
                m.seen_at, m.action, m.action_at
           FROM live_messages m
          WHERE m.session_id IN (${ph})
          ORDER BY m.id`,
        ids
      );
      for (const m of msgs) {
        const cur = sessions[m.session_id] || (sessions[m.session_id] = { messages: 0, auto_shown: false, last: null, unread: 0, visitor_msgs: 0 });
        if (m.source === 'visitor') {
          cur.visitor_msgs = (cur.visitor_msgs || 0) + 1;
          if (!m.seen_at) cur.unread = (cur.unread || 0) + 1;
          continue;
        }
        // Admin-Nachricht hat Vorrang vor der automatischen Blase — deren Status zählt.
        if (m.source === 'auto') {
          cur.auto_shown = true;
          if (!cur.last) cur.last = m;
        } else {
          cur.messages += 1;
          cur.last = m;
        }
      }
      const prices = await query<any>(
        `SELECT e.session_id, e.target FROM visitor_events e
          WHERE e.id IN (SELECT MAX(id) FROM visitor_events WHERE type = 'price_shown' AND session_id IN (${ph}) GROUP BY session_id)`,
        ids
      );
      for (const p of prices) {
        const cur = sessions[p.session_id] || (sessions[p.session_id] = { messages: 0, auto_shown: false, last: null });
        const [price, km, vehicle] = String(p.target || '').split('|');
        const n = Number(price);
        if (Number.isFinite(n) && n > 0) cur.price_shown = { price: Math.ceil(n * 2) / 2, km: Number(km) || null, vehicle: vehicle || null };
      }
    }

    const since = berlinMidnightUtcSql(0);
    const [kpi] = await query<any>(
      `SELECT
         SUM(source = 'admin') AS sent,
         SUM(source = 'auto') AS auto_shown,
         SUM(source = 'admin' AND seen_at IS NOT NULL) AS seen,
         SUM(action IN ('whatsapp', 'callback', 'book', 'chat')) AS clicks,
         COUNT(DISTINCT CASE WHEN source = 'visitor' THEN session_id END) AS chats
       FROM live_messages WHERE created_at >= ?`,
      [since]
    );
    const [booked] = await query<any>(
      `SELECT COUNT(DISTINCT b.id) AS n FROM bookings b
        WHERE b.created_at >= ?
          AND b.session_id IN (SELECT DISTINCT session_id FROM live_messages WHERE created_at >= ?)`,
      [since, since]
    );

    // Erster Aufruf ohne since_alert_id: nur die aktuelle Obergrenze liefern, damit der
    // Live-Tab beim Öffnen nicht für alte Alarme piept.
    const sinceAlert = parseInt(String(req.query.since_alert_id ?? ''), 10);
    const [maxRow] = await query<{ id: number | null }>(`SELECT MAX(id) AS id FROM live_assist_alerts`);
    const lastAlertId = Number(maxRow?.id || 0);
    const alerts = Number.isFinite(sinceAlert)
      ? await query<any>(
          `SELECT id, session_id, kind, detail, created_at FROM live_assist_alerts WHERE id > ? ORDER BY id LIMIT 20`,
          [sinceAlert]
        )
      : [];

    res.json({
      enabled: s.enabled === '1',
      sessions,
      kpi: {
        sent: Number(kpi?.sent || 0),
        auto_shown: Number(kpi?.auto_shown || 0),
        seen: Number(kpi?.seen || 0),
        clicks: Number(kpi?.clicks || 0),
        chats: Number(kpi?.chats || 0),
        bookings: Number(booked?.n || 0),
      },
      alerts,
      last_alert_id: lastAlertId,
      online: s.enabled === '1',
      sound: Object.fromEntries(ALERT_KINDS.map((k) => [k, s[`notify_${k}_sound`] === '1'])),
    });
  } catch (err: any) {
    console.error('live-assist overview error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
