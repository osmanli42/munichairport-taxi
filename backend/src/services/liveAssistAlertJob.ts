/**
 * Canlı Asistan — Hintergrundjob für die Admin-Alarme "Preis gesehen" und "zögert".
 *
 * Läuft alle 20 s und liest nur die Tracking-Tabellen. Ein Alarm entsteht höchstens
 * einmal pro Besuch und Art (UNIQUE in live_assist_alerts); ob er im Live-Tab piept
 * und/oder per E-Mail rausgeht, entscheiden die Schalter in den Einstellungen.
 */
import { query } from '../db';
import { getLiveAssistSettings, createAlert, describeVisit, ensureLiveAssistTables } from './liveAssist';

const TICK_MS = 20_000;
let running = false;

const wanted = (s: Record<string, string>, kind: string) =>
  s[`notify_${kind}_sound`] === '1' || s[`notify_${kind}_email`] === '1';

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const s = await getLiveAssistSettings();
    if (s.enabled !== '1') return;
    await ensureLiveAssistTables();

    const columns = `s.session_id, s.ua_device, s.city, s.country, s.utm_source, s.gclid,
      (SELECT p.path FROM visitor_pageviews p WHERE p.session_id = s.session_id
         AND p.path LIKE '%/ergebnisse%' ORDER BY p.id DESC LIMIT 1) AS path,
      (SELECT e.target FROM visitor_events e WHERE e.session_id = s.session_id
         AND e.type = 'price_shown' ORDER BY e.id DESC LIMIT 1) AS price_shown`;

    if (wanted(s, 'price_view')) {
      const rows = await query<any>(
        `SELECT ${columns} FROM visitor_sessions s
          WHERE s.last_seen >= NOW() - INTERVAL 60 SECOND
            AND s.first_seen >= NOW() - INTERVAL 4 HOUR
            AND s.is_bot = 0
            AND EXISTS (SELECT 1 FROM visitor_pageviews p WHERE p.session_id = s.session_id AND p.path LIKE '%/ergebnisse%')
            AND NOT EXISTS (SELECT 1 FROM live_assist_alerts a WHERE a.session_id = s.session_id AND a.kind = 'price_view')
          LIMIT 20`
      );
      for (const r of rows) await createAlert(r.session_id, 'price_view', describeVisit(r));
    }

    if (wanted(s, 'hesitating')) {
      const minutes = Math.max(1, parseInt(s.hesitate_min, 10) || 2);
      const rows = await query<any>(
        `SELECT ${columns} FROM visitor_sessions s
          WHERE s.last_seen >= NOW() - INTERVAL 60 SECOND
            AND s.first_seen >= NOW() - INTERVAL 4 HOUR
            AND s.is_bot = 0
            AND (SELECT MIN(p.viewed_at) FROM visitor_pageviews p
                  WHERE p.session_id = s.session_id AND p.path LIKE '%/ergebnisse%') <= NOW() - INTERVAL ${minutes} MINUTE
            AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.session_id)
            AND NOT EXISTS (SELECT 1 FROM live_assist_alerts a WHERE a.session_id = s.session_id AND a.kind = 'hesitating')
          LIMIT 20`
      );
      for (const r of rows) await createAlert(r.session_id, 'hesitating', `${minutes}+ dk · ${describeVisit(r)}`);
    }
  } catch (err: any) {
    console.error('[live-assist] alert tick failed:', err.message);
  } finally {
    running = false;
  }
}

export function startLiveAssistAlertJob(): void {
  setInterval(tick, TICK_MS);
  console.log('[live-assist] Alarm-Job gestartet — alle 20 s');
}
