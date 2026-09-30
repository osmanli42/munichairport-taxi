// Offline conversion file for Google Ads („Conversions aus Klicks importieren“): which gclid really
// became a ride and how much it earned. Only rides that already took place and were not cancelled,
// click at most 90 days old (Google's limit). Rows are remembered so the next export only adds new ones.

import { query, run } from '../../db';
import { settings } from './analytics';
import { berlinNowSql } from '../../utils/berlinTime';

const LOOKBACK_MS = 30 * 86400_000;
// Google rejects clicks older than 90 days; keep a small safety margin.
const MAX_CLICK_AGE_MS = 88 * 86400_000;

type Row = { bookingId: number; gclid: string; time: string; value: number; bookingNumber: string };

/** Berlin wall-clock „YYYY-MM-DD HH:mm:ss“ for a UTC Date (the file declares TimeZone=Europe/Berlin). */
const berlin = (d: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(d);

export async function eligibleRows(onlyNew: boolean): Promise<Row[]> {
  // Ride already happened (pickup is Berlin wall-clock text) — cancellations are known by then.
  const now = berlinNowSql().slice(0, 16);
  const bookings = (await query<any>(`
    SELECT b.id, b.booking_number, b.visitor_id, b.price, b.created_at, b.pickup_datetime
      FROM bookings b
      ${onlyNew ? 'LEFT JOIN ads_offline_exported x ON x.booking_id = b.id' : ''}
     WHERE b.status <> 'cancelled' AND b.visitor_id IS NOT NULL
       AND b.created_at >= NOW() - INTERVAL 85 DAY
       ${onlyNew ? 'AND x.booking_id IS NULL' : ''}`))
    .filter((b) => String(b.pickup_datetime || '').replace('T', ' ').slice(0, 16) < now);
  if (!bookings.length) return [];
  const visitors = Array.from(new Set(bookings.map((b) => b.visitor_id)));
  const sessions = await query<any>(`
    SELECT visitor_id, gclid, first_seen FROM visitor_sessions
     WHERE visitor_id IN (${visitors.map(() => '?').join(',')}) AND gclid IS NOT NULL AND gclid <> '' AND is_bot = 0`, visitors);
  const byVisitor = new Map<string, Array<{ gclid: string; ts: number }>>();
  for (const s of sessions) {
    const l = byVisitor.get(s.visitor_id) || [];
    l.push({ gclid: s.gclid, ts: new Date(s.first_seen).getTime() });
    byVisitor.set(s.visitor_id, l);
  }
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const b of bookings) {
    const created = new Date(b.created_at);
    const clicks = (byVisitor.get(b.visitor_id) || []).filter((c) => c.ts <= created.getTime() && created.getTime() - c.ts <= LOOKBACK_MS && Date.now() - c.ts <= MAX_CLICK_AGE_MS).sort((a, c) => c.ts - a.ts);
    const click = clicks[0];
    if (!click || seen.has(click.gclid)) continue; // one conversion per click
    seen.add(click.gclid);
    out.push({ bookingId: b.id, bookingNumber: b.booking_number, gclid: click.gclid, time: berlin(created), value: Math.round((Number(b.price) || 0) * 100) / 100 });
  }
  return out;
}

const csvCell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** Google Ads click-conversion template (CSV). `record` stores the rows as exported. */
export async function buildExport(onlyNew: boolean, record: boolean) {
  const cfg = await settings();
  const rows = await eligibleRows(onlyNew);
  const lines = [
    'Parameters:TimeZone=Europe/Berlin',
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
    ...rows.map((r) => [r.gclid, cfg.conversionName, r.time, r.value.toFixed(2), 'EUR'].map(csvCell).join(',')),
  ];
  if (record && rows.length) {
    const res = await run(`INSERT INTO ads_offline_exports (rows_count, value_sum, created_at) VALUES (?, ?, NOW())`,
      [rows.length, rows.reduce((a, r) => a + r.value, 0)]) as any;
    for (const r of rows) await run(`INSERT IGNORE INTO ads_offline_exported (booking_id, export_id) VALUES (?, ?)`, [r.bookingId, res.insertId]);
  }
  return { csv: `${lines.join('\n')}\n`, rows: rows.length, value: rows.reduce((a, r) => a + r.value, 0) };
}

export async function exportStatus() {
  const pending = await eligibleRows(true);
  const [last] = await query<any>(`SELECT rows_count, value_sum, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at FROM ads_offline_exports ORDER BY id DESC LIMIT 1`);
  const [tot] = await query<any>(`SELECT COUNT(*) AS n, COALESCE(SUM(value_sum), 0) AS v FROM ads_offline_exports`);
  return { pending: pending.length, pendingValue: Math.round(pending.reduce((a, r) => a + r.value, 0) * 100) / 100, last: last || null, exports: Number(tot?.n) || 0 };
}
