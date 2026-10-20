// Arama talebi (Rabatte-Tab): Wofür suchen Besucher wirklich — welche Fahrtage und Uhrzeiten —
// und wie viele dieser Suchen werden zur Buchung? Grundlage sind die /ergebnisse-Seitenaufrufe
// (Fahrtdatum/-zeit stehen in der URL, dieselben Daten wie im Replay) und bookings.session_id.
// Ziel: prüfen, ob Rabatte dort wirken, wo tatsächlich gesucht wird (leere Stunden/Tage), und
// eine Woche mit der nächsten vergleichen.

import { query } from '../db';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';

const BLOCKS = [
  { key: '00–06', from: 0, to: 6 }, { key: '06–10', from: 6, to: 10 }, { key: '10–14', from: 10, to: 14 },
  { key: '14–18', from: 14, to: 18 }, { key: '18–22', from: 18, to: 22 }, { key: '22–24', from: 22, to: 24 },
];
const LEADS = [
  { key: 'aynı gün', min: 0, max: 0 }, { key: '1 gün', min: 1, max: 1 }, { key: '2–3 gün', min: 2, max: 3 },
  { key: '4–7 gün', min: 4, max: 7 }, { key: '8–14 gün', min: 8, max: 14 }, { key: '15+ gün', min: 15, max: 9999 },
];

type Bucket = { searches: number; booked: number };
const bucket = (): Bucket => ({ searches: 0, booked: 0 });

export interface SearchStats {
  from: string; to: string;
  totals: { searches: number; sessions: number; booked: number; bookings: number };
  byHour: Bucket[]; // 24, nach Abholstunde der Suche — ohne Suchen mit Standardzeit 10:00
  /** Suchen mit genau 10:00 = Voreinstellung des Suchformulars, meist nicht bewusst gewählt. */
  defaultTime: Bucket;
  byBlock: (Bucket & { key: string })[];
  byWeekday: Bucket[]; // 7, 0 = Montag
  byLead: (Bucket & { key: string })[]; // Vorlauf Suche → Fahrt
  discount: { shown: Bucket; notShown: Bucket };
  upcoming: (Bucket & { date: string })[]; // künftige Fahrtage, für die gesucht wurde
}

/** Berliner Kalendertag 'YYYY-MM-DD' 00:00 → UTC 'YYYY-MM-DD HH:MM:SS' (DST-sicher). */
function berlinDayStartUtc(date: string): string {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const wallOf = (ms: number) => Date.parse(`${berlinNowSql(new Date(ms)).replace(' ', 'T')}Z`);
  let ms = guess - (wallOf(guess) - guess);
  ms = guess - (wallOf(ms) - ms);
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const isoWeekday0 = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Mo

function tripOf(path: string): { date: string; hour: number; isDefault: boolean } | null {
  const q = path.indexOf('?');
  if (q < 0) return null;
  const sp = new URLSearchParams(path.slice(q + 1));
  const date = sp.get('date') || '';
  const time = sp.get('time') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}/.test(time)) return null;
  const hour = Number(time.split(':')[0]);
  return hour >= 0 && hour <= 23 ? { date, hour, isDefault: time.slice(0, 5) === '10:00' } : null;
}

/** Suchen, deren Seitenaufruf im Zeitraum [from, to] (Berliner Tage, inklusive) lag. */
export async function searchStats(from: string, to: string): Promise<SearchStats> {
  const lo = berlinDayStartUtc(from);
  const hi = berlinDayStartUtc(addDays(to, 1));
  const rows = await query<{ session_id: string; path: string; viewed_utc: string }>(
    `SELECT pv.session_id, pv.path, DATE_FORMAT(pv.viewed_at, '%Y-%m-%dT%H:%i:%sZ') AS viewed_utc
       FROM visitor_pageviews pv
       JOIN visitor_sessions s ON s.session_id = pv.session_id
      WHERE (s.is_bot = 0 OR s.is_bot IS NULL)
        AND pv.viewed_at >= ? AND pv.viewed_at < ?
        AND pv.path LIKE '%/ergebnisse?%'`,
    [lo, hi]
  );

  // Eine Suche = Sitzung × Fahrtdatum × Abholstunde (Neuladen/Fahrzeugwechsel zählt nicht doppelt)
  const searches = new Map<string, { session: string; date: string; hour: number; isDefault: boolean; searchDay: string }>();
  for (const r of rows) {
    const t = tripOf(r.path);
    if (!t) continue;
    const key = `${r.session_id}|${t.date}|${t.hour}`;
    if (!searches.has(key)) {
      searches.set(key, { session: r.session_id, ...t, searchDay: berlinNowSql(new Date(r.viewed_utc)).slice(0, 10) });
    }
  }
  const sessions = [...new Set([...searches.values()].map(s => s.session))];

  // Gebucht = dieselbe Sitzung hat eine (nicht stornierte) Buchung für dieses Fahrtdatum
  const bookedKeys = new Set<string>();
  let bookings = 0;
  const shownKeys = new Set<string>();
  if (sessions.length) {
    const ph = sessions.map(() => '?').join(',');
    const bk = await query<{ session_id: string; pickup_datetime: string }>(
      `SELECT session_id, pickup_datetime FROM bookings WHERE status != 'cancelled' AND session_id IN (${ph})`, sessions
    );
    bookings = bk.length;
    for (const b of bk) bookedKeys.add(`${b.session_id}|${String(b.pickup_datetime).replace(' ', 'T').slice(0, 10)}`);
    const ev = await query<{ session_id: string; path: string }>(
      `SELECT session_id, path FROM visitor_events WHERE type = 'discount_shown' AND session_id IN (${ph})`, sessions
    );
    for (const e of ev) {
      const t = tripOf(e.path);
      if (t) shownKeys.add(`${e.session_id}|${t.date}|${t.hour}`);
    }
  }

  const stats: SearchStats = {
    from, to,
    totals: { searches: 0, sessions: sessions.length, booked: 0, bookings },
    byHour: Array.from({ length: 24 }, bucket),
    defaultTime: bucket(),
    byBlock: BLOCKS.map(b => ({ key: b.key, ...bucket() })),
    byWeekday: Array.from({ length: 7 }, bucket),
    byLead: LEADS.map(l => ({ key: l.key, ...bucket() })),
    discount: { shown: bucket(), notShown: bucket() },
    upcoming: [],
  };
  const today = berlinDateSql(0);
  const upcoming = new Map<string, Bucket>();
  const add = (b: Bucket, booked: boolean) => { b.searches++; if (booked) b.booked++; };

  for (const [key, s] of searches) {
    const booked = bookedKeys.has(`${s.session}|${s.date}`);
    stats.totals.searches++;
    if (booked) stats.totals.booked++;
    // Standardzeit 10:00 getrennt zählen, sonst verzerrt sie die Stunden-/Blockverteilung
    if (s.isDefault) {
      add(stats.defaultTime, booked);
    } else {
      add(stats.byHour[s.hour], booked);
      const blk = BLOCKS.findIndex(b => s.hour >= b.from && s.hour < b.to);
      if (blk >= 0) add(stats.byBlock[blk], booked);
    }
    add(stats.byWeekday[isoWeekday0(s.date)], booked);
    const lead = Math.round((Date.parse(`${s.date}T12:00:00Z`) - Date.parse(`${s.searchDay}T12:00:00Z`)) / 86_400_000);
    const li = LEADS.findIndex(l => lead >= l.min && lead <= l.max);
    if (li >= 0) add(stats.byLead[li], booked);
    add(shownKeys.has(key) ? stats.discount.shown : stats.discount.notShown, booked);
    if (s.date >= today && s.date <= addDays(today, 14)) {
      if (!upcoming.has(s.date)) upcoming.set(s.date, bucket());
      add(upcoming.get(s.date)!, booked);
    }
  }
  stats.upcoming = [...upcoming.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, b]) => ({ date, ...b }));
  return stats;
}
