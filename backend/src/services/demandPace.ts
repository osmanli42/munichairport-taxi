// Auslastung eines Fahrtdatums für "Ruhiger-Tag"-Rabatte (Rabatte-Tab).
//
// Ein reiner Schwellenwert ("weniger als X Fahrten") taugt nicht: Kunden buchen meist
// 1–3 Tage vorher, also sieht jedes Datum in einer Woche leer aus. Verglichen wird daher
// wie im Revenue Management (Pickup/Pace): Fahrten, die für dieses Datum JETZT schon
// feststehen, gegen die Fahrten, die an den letzten gleichen Wochentagen mit demselben
// Vorlauf schon feststanden. pace = gebucht / erwartet.
//
// Gezählt werden Fahrten (Legs) wie im Dashboard: Buchungen (Hin- und Rückfahrt, ohne
// Stornos) plus reine Kalenderfahrten (calendar_rides.kind = 'ride' — Kopien von Buchungen
// und Nicht-Fahrten sind dort anders markiert, also nichts doppelt).

import { query } from '../db';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';

export interface DayPace {
  date: string; // YYYY-MM-DD
  booked: number; // Fahrten, die für dieses Datum jetzt feststehen
  expected: number; // Median der Vergleichstage mit gleichem Vorlauf
  pace: number | null; // booked / expected; null = kein belastbares Signal
  leadHours: number; // Vorlauf bis 00:00 des Datums (negativ = Tag läuft schon)
  samples: number[]; // Werte der Vergleichstage (neuester zuerst)
}

const HISTORY_WEEKS = 8;
const CACHE_MS = 5 * 60_000;
const SETTINGS_CACHE_MS = 30_000;

// Wanduhr-Strings ('YYYY-MM-DDTHH:MM') als Minuten rechnen — naiv über UTC, die eine
// Stunde Sommer-/Winterzeit-Versatz ist für den Vorlauf ohne Bedeutung.
const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);
const wallMs = (w: string) => Date.parse(`${w.length === 10 ? `${w}T00:00` : w}:00Z`);
const msWall = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const addDays = (date: string, n: number) => msWall(wallMs(date) + n * 86_400_000).slice(0, 10);

type DemandSettings = { enabled: boolean; minExpected: number; horizonDays: number };
let settingsCache: (DemandSettings & { at: number }) | null = null;

export async function demandSettings(): Promise<DemandSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) return settingsCache;
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('demand_discount_enabled', 'demand_min_expected', 'demand_horizon_days')`
  );
  const m = Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value]));
  const num = (v: unknown, d: number) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  settingsCache = {
    enabled: m.demand_discount_enabled === '1',
    minExpected: num(m.demand_min_expected, 2),
    horizonDays: num(m.demand_horizon_days, 14),
    at: Date.now(),
  };
  return settingsCache;
}

export function invalidateDemandCache(): void {
  settingsCache = null;
  paceCache.clear();
}

type Leg = { date: string; bookedAt: string }; // bookedAt = Berlin-Wanduhr

// Alle Fahrten an den gegebenen Tagen, jeweils mit dem Zeitpunkt, ab dem sie feststanden.
async function legsOn(dates: string[]): Promise<Leg[]> {
  if (dates.length === 0) return [];
  const set = new Set(dates);
  const ph = dates.map(() => '?').join(',');
  const legs: Leg[] = [];

  const bookings = await query<{ pickup_datetime: string; return_datetime: string | null; trip_type: string; created_utc: string }>(
    `SELECT pickup_datetime, return_datetime, trip_type,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc
       FROM bookings
      WHERE status != 'cancelled'
        AND (LEFT(REPLACE(pickup_datetime, ' ', 'T'), 10) IN (${ph})
             OR (trip_type = 'roundtrip' AND LEFT(REPLACE(return_datetime, ' ', 'T'), 10) IN (${ph})))`,
    [...dates, ...dates]
  );
  for (const b of bookings) {
    // created_at ist UTC → Berliner Wanduhr, damit alles in derselben Uhr verglichen wird
    const bookedAt = wall(berlinNowSql(new Date(b.created_utc)));
    const out = wall(b.pickup_datetime).slice(0, 10);
    if (set.has(out)) legs.push({ date: out, bookedAt });
    if (b.trip_type === 'roundtrip' && b.return_datetime) {
      const back = wall(b.return_datetime).slice(0, 10);
      if (set.has(back)) legs.push({ date: back, bookedAt });
    }
  }

  const cal = await query<{ ride_time: string; entered_at: string | null }>(
    `SELECT ride_time, entered_at FROM calendar_rides
      WHERE kind = 'ride' AND LEFT(ride_time, 10) IN (${ph})`,
    dates
  );
  for (const c of cal) {
    const rideTime = wall(c.ride_time);
    // Ältere Spiegelzeilen ohne Google-"created": typischer Vorlauf von einem Tag angenommen
    const bookedAt = c.entered_at ? wall(c.entered_at) : msWall(wallMs(rideTime) - 86_400_000);
    legs.push({ date: rideTime.slice(0, 10), bookedAt });
  }
  return legs;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const paceCache = new Map<string, { value: DayPace; at: number }>();

/**
 * Auslastung eines Fahrtdatums. Vergleichstage: die letzten 8 gleichen Wochentage vor
 * heute, jeweils mit demselben Vorlauf (Stand "so viele Stunden vor 00:00 des Tages").
 * Median statt Mittelwert, damit einzelne Ausreißerwochen (Oktoberfest, Messe) den
 * Maßstab nicht verschieben.
 */
export async function getDayPace(date: string): Promise<DayPace> {
  const hit = paceCache.get(date);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const { minExpected } = await demandSettings();
  const nowWall = wall(berlinNowSql());
  const today = berlinDateSql(0);
  const leadMs = wallMs(date) - wallMs(nowWall);

  // Vergleichstage: gleiche Wochentage strikt vor heute (dort ist das Ergebnis vollständig)
  const compare: string[] = [];
  let d = addDays(date, -7);
  while (d >= today) d = addDays(d, -7);
  for (let i = 0; i < HISTORY_WEEKS; i++, d = addDays(d, -7)) compare.push(d);

  const legs = await legsOn([date, ...compare]);
  const booked = legs.filter(l => l.date === date).length;
  const samples = compare.map(cd => {
    const cutoff = msWall(wallMs(cd) - leadMs);
    return legs.filter(l => l.date === cd && l.bookedAt <= cutoff).length;
  });
  const expected = median(samples);

  const value: DayPace = {
    date,
    booked,
    expected,
    pace: expected >= minExpected ? Math.round((booked / expected) * 100) / 100 : null,
    leadHours: Math.round(leadMs / 3_600_000),
    samples,
  };
  paceCache.set(date, { value, at: Date.now() });
  return value;
}

/**
 * Pace für ein Fahrtdatum innerhalb des Horizonts, sonst null (= kein Ruhiger-Tag-Rabatt).
 * Hauptschalter aus → immer null, alle Ruhiger-Tag-Regeln ruhen.
 */
export async function paceForTrip(date: string | null): Promise<number | null> {
  if (!date) return null;
  const { enabled, horizonDays } = await demandSettings();
  if (!enabled) return null;
  const today = berlinDateSql(0);
  if (date < today || date > berlinDateSql(horizonDays)) return null;
  return (await getDayPace(date)).pace;
}

/** Rabattierte Buchungen einer Regel für dasselbe Fahrtdatum (trip_date_max_uses). */
export async function ruleUsesOnTripDate(ruleId: number, date: string): Promise<number> {
  const rows = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM bookings
      WHERE auto_discount_id = ? AND status != 'cancelled'
        AND LEFT(REPLACE(pickup_datetime, ' ', 'T'), 10) = ?`,
    [ruleId, date]
  );
  return Number(rows[0]?.cnt || 0);
}
