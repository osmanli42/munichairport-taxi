/**
 * "Canlı Asistan" — Nachrichten an Besucher, die gerade auf der Seite sind.
 *
 * Warum: ~1 Besucher pro 10 Minuten sieht Preise, die meisten springen zwischen
 * Preisseite und Buchungsformular ab. Der Admin kann einem solchen Besucher aus dem
 * Live-Tab eine kurze Nachricht schicken (Sprechblase auf der Seite), die Antwort
 * läuft über WhatsApp. Es werden KEINE eingetippten, nicht abgeschickten Formulardaten
 * verwendet — das wäre UWG §7 / DSGVO.
 *
 * Hier liegen Tabellen, Einstellungen und Admin-Alarme (Ton im Live-Tab + E-Mail),
 * damit Route und Hintergrundjob dieselbe Logik benutzen.
 */
import { Resend } from 'resend';
import { query, run } from '../db';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
export const ADMIN_EMAIL_DEFAULT = process.env.ADMIN_EMAIL || FROM_EMAIL;
const SITE_URL = (process.env.SITE_URL || 'https://flughafen-muenchen.taxi').replace(/\/$/, '');

export type AlertKind = 'chat' | 'reaction' | 'price_view' | 'hesitating';
export const ALERT_KINDS: AlertKind[] = ['chat', 'reaction', 'price_view', 'hesitating'];

// Alle Schalter als Strings — gleiche Konvention wie die `settings`-Tabelle ('0'/'1').
export const SETTING_DEFAULTS: Record<string, string> = {
  enabled: '1',
  auto_enabled: '1',
  auto_delay_sec: '40',
  wa_prefill_enabled: '1',
  agent_name: 'Osman',
  ai_draft_enabled: '1',
  hesitate_min: '2',
  email_to: '',            // leer = ADMIN_EMAIL
  email_max_per_hour: '10',
  notify_chat_sound: '1',
  notify_chat_email: '1',
  notify_reaction_sound: '1',
  notify_reaction_email: '1',
  notify_price_view_sound: '1',
  notify_price_view_email: '0',
  notify_hesitating_sound: '1',
  notify_hesitating_email: '0',
};

const BOOL_KEYS = new Set([
  'enabled', 'auto_enabled', 'wa_prefill_enabled', 'ai_draft_enabled',
  ...ALERT_KINDS.flatMap((k) => [`notify_${k}_sound`, `notify_${k}_email`]),
]);
const INT_RANGES: Record<string, [number, number]> = {
  auto_delay_sec: [10, 600],
  hesitate_min: [1, 30],
  email_max_per_hour: [0, 60],
};

let tablesReady = false;
export async function ensureLiveAssistTables(): Promise<void> {
  if (tablesReady) return;
  // Kollation explizit — die DB-Voreinstellung ist utf8mb4_0900_ai_ci, die übrigen
  // Tabellen aber utf8mb4_unicode_ci. Ohne das scheitern JOINs über session_id.
  await run(`
    CREATE TABLE IF NOT EXISTS live_messages (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      source VARCHAR(10) NOT NULL DEFAULT 'admin',
      template VARCHAR(40) DEFAULT NULL,
      body TEXT,
      promo_code VARCHAR(50) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at DATETIME DEFAULT NULL,
      seen_at DATETIME DEFAULT NULL,
      action VARCHAR(20) DEFAULT NULL,
      action_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_session (session_id),
      INDEX idx_created (created_at)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS live_assist_settings (
      setting_key VARCHAR(64) NOT NULL,
      setting_value VARCHAR(500) NOT NULL,
      PRIMARY KEY (setting_key)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS live_assist_alerts (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      kind VARCHAR(20) NOT NULL,
      detail VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      emailed_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_session_kind (session_id, kind),
      INDEX idx_created (created_at)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Bilder im Chat (beide Richtungen). In der DB statt auf der Platte: überlebt Deploys,
  // und der Chatverlauf bleibt samt Anhängen als Nachweis vollständig.
  await run(`
    CREATE TABLE IF NOT EXISTS live_chat_files (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      mime VARCHAR(50) NOT NULL,
      bytes INT NOT NULL,
      data MEDIUMBLOB NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_session (session_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try { await run(`ALTER TABLE live_messages ADD COLUMN attachment_id INT DEFAULT NULL`); } catch { /* existiert */ }
  tablesReady = true;
}

export const CHAT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const CHAT_MAX_BYTES = 4 * 1024 * 1024;

/** data:image/...;base64,... speichern → Datei-ID oder Fehlertext */
export async function saveChatImage(sessionId: string, dataUrl: unknown): Promise<number | string> {
  const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m || !CHAT_MIME.has(m[1])) return 'Nur Bilder (JPG, PNG, WebP, GIF)';
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > CHAT_MAX_BYTES) return 'Bild zu groß (max. 4 MB)';
  await ensureLiveAssistTables();
  const r = await run(`INSERT INTO live_chat_files (session_id, mime, bytes, data) VALUES (?, ?, ?, ?)`, [sessionId, m[1], buf.length, buf]);
  return r.insertId;
}

// Öffentliche Endpunkte (config/inbox) lesen die Einstellungen bei jedem Aufruf —
// kurz zwischenspeichern, damit nicht jeder Besucher alle 8 s eine DB-Abfrage auslöst.
let cache: { at: number; values: Record<string, string> } | null = null;
const CACHE_MS = 10_000;

export async function getLiveAssistSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;
  await ensureLiveAssistTables();
  const rows = await query<{ setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM live_assist_settings'
  );
  const values = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.setting_key in SETTING_DEFAULTS) values[r.setting_key] = r.setting_value;
  }
  cache = { at: Date.now(), values };
  return values;
}

/** Prüft und speichert Änderungen. Gibt eine Fehlermeldung zurück oder null. */
export async function saveLiveAssistSettings(updates: Record<string, unknown>): Promise<string | null> {
  const clean: [string, string][] = [];
  for (const [key, raw] of Object.entries(updates || {})) {
    if (!(key in SETTING_DEFAULTS)) continue;
    const value = String(raw ?? '').trim();
    if (BOOL_KEYS.has(key)) {
      if (value !== '0' && value !== '1') return `${key} must be 0 or 1`;
    } else if (key in INT_RANGES) {
      const n = parseInt(value, 10);
      const [min, max] = INT_RANGES[key];
      if (!Number.isFinite(n) || n < min || n > max) return `${key} must be between ${min} and ${max}`;
      clean.push([key, String(n)]);
      continue;
    } else if (key === 'email_to') {
      if (value && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(value)) return 'email_to is not a valid address';
    } else if (key === 'agent_name') {
      if (!value || value.length > 40) return 'agent_name must be 1-40 characters';
    }
    clean.push([key, value]);
  }
  await ensureLiveAssistTables();
  for (const [key, value] of clean) {
    await run(
      `INSERT INTO live_assist_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value]
    );
  }
  cache = null;
  return null;
}

/**
 * Aktuell einlösbare Aktionscodes — dieselben Bedingungen wie /promotions/has-active.
 * `apply_mode` fehlt in älteren DB-Kopien (z. B. munich_draft_test), daher der Fallback.
 */
export async function validCodePromos(code?: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const base = `SELECT id, code, type, value, end_date FROM promotions
     WHERE active = 1 AND start_date <= ? AND end_date >= ?
       AND (max_uses IS NULL OR used_count < max_uses)`;
  const codeFilter = code ? ' AND code = ?' : '';
  const params = code ? [today, today, code] : [today, today];
  try {
    return await query<any>(`${base} AND (apply_mode IS NULL OR apply_mode = 'code')${codeFilter} ORDER BY end_date ASC`, params);
  } catch (err: any) {
    if (!/Unknown column 'apply_mode'/.test(err.message || '')) throw err;
    return query<any>(`${base}${codeFilter} ORDER BY end_date ASC`, params);
  }
}

/** "Flughafen München → Freising · 86 € · 📱 · München" aus Pfad und price_shown. */
export function describeVisit(v: {
  path?: string | null; price_shown?: string | null; ua_device?: string | null;
  city?: string | null; country?: string | null; utm_source?: string | null; gclid?: string | null;
}): string {
  const parts: string[] = [];
  try {
    if (v.path) {
      const qs = new URLSearchParams(v.path.includes('?') ? v.path.slice(v.path.indexOf('?') + 1) : '');
      const short = (s: string | null) => (s || '').split(',')[0].trim();
      const pickup = short(qs.get('pickup'));
      const dropoff = short(qs.get('dropoff'));
      if (pickup || dropoff) parts.push(`${pickup || '?'} → ${dropoff || '?'}`);
      const date = qs.get('date');
      if (date) parts.push(`${date.split('-').reverse().join('.')}${qs.get('time') ? ` ${qs.get('time')}` : ''}`);
    }
  } catch { /* unlesbarer Pfad — ohne Strecke weiter */ }
  if (v.price_shown) {
    const [price, , vehicle] = v.price_shown.split('|');
    const p = Number(price);
    if (Number.isFinite(p) && p > 0) parts.push(`${(Math.ceil(p * 2) / 2).toFixed(2).replace('.', ',')} €${vehicle ? ` (${vehicle})` : ''}`);
  }
  if (v.ua_device) parts.push(v.ua_device === 'mobile' ? '📱 mobil' : v.ua_device === 'tablet' ? 'tablet' : '💻 masaüstü');
  if (v.city || v.country) parts.push(v.city || v.country || '');
  if (v.gclid || v.utm_source === 'google_ads') parts.push('Google Ads');
  return parts.filter(Boolean).join(' · ').slice(0, 500);
}

const KIND_SUBJECT: Record<AlertKind, string> = {
  chat: '💬 Ziyaretçi chat\'e yazdı',
  reaction: '💬 Ziyaretçi mesajına tepki verdi',
  price_view: '👀 Yeni ziyaretçi fiyat gördü',
  hesitating: '⏳ Ziyaretçi fiyat sayfasında kararsız',
};

const ACTION_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp'a tıkladı",
  callback: 'geri arama istedi',
  book: "rezervasyona geçti",
};

/**
 * Alarm anlegen (einmal pro Besuch und Art) und ggf. E-Mail senden.
 * Gibt die neue ID zurück oder null, wenn es den Alarm schon gab.
 */
export async function createAlert(sessionId: string, kind: AlertKind, detail: string, opts: { skipEmail?: boolean; key?: string } = {}): Promise<number | null> {
  await ensureLiveAssistTables();
  // Chat-Alarme gibt es pro Nachricht: der Schlüssel "chat:<id>" umgeht das UNIQUE(session, kind).
  const result = await run(
    `INSERT IGNORE INTO live_assist_alerts (session_id, kind, detail) VALUES (?, ?, ?)`,
    [sessionId, opts.key || kind, detail.slice(0, 500)]
  );
  if (!result.affectedRows) return null;
  const id = result.insertId;

  const s = await getLiveAssistSettings();
  if (!opts.skipEmail && s[`notify_${kind}_email`] === '1') {
    sendAlertEmail(id, kind, detail, s).catch((err) => console.error('[live-assist] alert mail failed:', err.message));
  }
  return id;
}

async function sendAlertEmail(id: number, kind: AlertKind, detail: string, s: Record<string, string>): Promise<void> {
  const max = parseInt(s.email_max_per_hour, 10) || 0;
  const [sent] = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM live_assist_alerts WHERE emailed_at >= NOW() - INTERVAL 1 HOUR`
  );
  if (Number(sent?.n || 0) >= max) {
    console.log(`[live-assist] Mail-Limit (${max}/h) erreicht — Alarm ${id} nur im Live-Tab`);
    return;
  }
  const to = s.email_to || ADMIN_EMAIL_DEFAULT;
  const subject = `${KIND_SUBJECT[kind]}${detail ? ` — ${detail.split(' · ')[0]}` : ''}`.slice(0, 180);
  if (!RESEND_API_KEY) {
    console.log(`[live-assist] RESEND_API_KEY fehlt — Mail an ${to} übersprungen: ${subject}`);
    return;
  }
  // Vor dem Senden markieren, damit ein paralleler Tick das Limit nicht überschreitet.
  await run(`UPDATE live_assist_alerts SET emailed_at = NOW() WHERE id = ?`, [id]);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await new Resend(RESEND_API_KEY).emails.send({
    from: `Flughafen-muenchen.TAXI <${FROM_EMAIL}>`,
    to,
    subject,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#f9fafb;">
        <div style="background:#fff;border-radius:12px;padding:20px;border-left:6px solid #16a34a;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#111;">${KIND_SUBJECT[kind]}</h1>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;">${esc(detail || '—')}</p>
          <a href="${SITE_URL}/admin" style="display:inline-block;background:#0c2d48;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px;">
            Live sekmesini aç →
          </a>
          <p style="margin:14px 0 0;font-size:11px;color:#9ca3af;">Bu bildirimleri Admin → Live → Canlı Asistan ayarlarından kapatabilirsin.</p>
        </div>
      </div>`,
  });
}

export function reactionDetail(action: string, visit: string): string {
  return [ACTION_LABEL[action] || action, visit].filter(Boolean).join(' · ');
}

// ── Anwesenheit: Admin "online", solange der Live-Tab offen ist ──────────────
// Nur im Speicher — ein Prozess, und nach einem Neustart meldet sich der Tab in 5 s wieder.
let adminSeenAt = 0;
export function markAdminOnline(): void { adminSeenAt = Date.now(); }
export function isAdminOnline(): boolean { return Date.now() - adminSeenAt < 30_000; }
