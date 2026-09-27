import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { getClientIp } from '../utils/ipGeo';
import { isRateLimited, registerFailure } from '../utils/rateLimit';
import { berlinMidnightUtcSql } from '../utils/berlinTime';
import {
  ensureLiveAssistTables, getLiveAssistSettings, saveLiveAssistSettings, validCodePromos,
  createAlert, describeVisit, reactionDetail, ADMIN_EMAIL_DEFAULT, ALERT_KINDS,
} from '../services/liveAssist';

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
    });
  } catch (err: any) {
    console.error('live-assist config error:', err.message);
    res.json({ enabled: false, auto_enabled: false, auto_delay_sec: 40, wa_prefill_enabled: false, agent_name: '' });
  }
});

// GET /api/live-assist/inbox?session_id= — neue Admin-Nachrichten abholen
router.get('/live-assist/inbox', async (req: Request, res: Response) => {
  try {
    if (limited(req, 'inbox', 120)) { res.status(429).json({ messages: [] }); return; }
    const sessionId = validSession(req.query.session_id);
    if (!sessionId) { res.status(400).json({ messages: [] }); return; }
    const s = await getLiveAssistSettings();
    if (s.enabled !== '1') { res.json({ enabled: false, messages: [] }); return; }

    const rows = await query<any>(
      `SELECT id, template, body, promo_code FROM live_messages
        WHERE session_id = ? AND source = 'admin' AND delivered_at IS NULL
          AND created_at >= NOW() - INTERVAL 30 MINUTE
        ORDER BY id`,
      [sessionId]
    );
    if (rows.length) {
      await run(
        `UPDATE live_messages SET delivered_at = NOW() WHERE id IN (${rows.map(() => '?').join(',')})`,
        rows.map((r) => r.id)
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
      messages.push({ id: r.id, template: r.template, body: r.body, promo });
    }
    res.json({ enabled: true, agent_name: s.agent_name, messages });
  } catch (err: any) {
    console.error('live-assist inbox error:', err.message);
    res.status(500).json({ messages: [] });
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

// ── Admin ─────────────────────────────────────────────────────────────────

router.get('/admin/live-assist/settings', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const s = await getLiveAssistSettings();
    res.json({ settings: s, admin_email_default: ADMIN_EMAIL_DEFAULT, email_configured: !!process.env.RESEND_API_KEY });
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
    if (!sessionId || !body) { res.status(400).json({ error: 'session_id ve mesaj gerekli' }); return; }

    const [session] = await query<any>(
      `SELECT session_id FROM visitor_sessions WHERE session_id = ? AND last_seen >= NOW() - INTERVAL 2 MINUTE`,
      [sessionId]
    );
    if (!session) { res.status(410).json({ error: 'Ziyaretçi artık sitede değil' }); return; }

    if (promoCode) {
      const [promo] = await validCodePromos(promoCode);
      if (!promo) { res.status(400).json({ error: 'Bu kod şu an geçerli değil' }); return; }
    }

    const r = await run(
      `INSERT INTO live_messages (session_id, source, template, body, promo_code) VALUES (?, 'admin', ?, ?, ?)`,
      [sessionId, template, body, promoCode]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (err: any) {
    console.error('live-assist send error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/admin/live-assist/overview?session_ids=a,b&since_alert_id=N
router.get('/admin/live-assist/overview', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureLiveAssistTables();
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
        const cur = sessions[m.session_id] || (sessions[m.session_id] = { messages: 0, auto_shown: false, last: null });
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
         SUM(action IN ('whatsapp', 'callback', 'book')) AS clicks
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
        bookings: Number(booked?.n || 0),
      },
      alerts,
      last_alert_id: lastAlertId,
      sound: Object.fromEntries(ALERT_KINDS.map((k) => [k, s[`notify_${k}_sound`] === '1'])),
    });
  } catch (err: any) {
    console.error('live-assist overview error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
