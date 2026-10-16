// Leerfahrt-Rabatt (Rabatte-Tab): Ein Auto wird dort frei, wo eine bereits geplante Fahrt
// endet (z. B. 08:00 Abholung am Flughafen → ~08:45 in Schwabing). Bucht jemand kurz danach
// in der Nähe dieses Ziels, fährt das Auto nicht leer zurück — dafür gibt es Rabatt.
//
// Grundlage: Buchungen (Hin- und Rückfahrt einzeln) + reine Kalenderfahrten. Adressen werden
// einmal geokodiert und in geo_cache gespeichert; im Preisaufruf werden nur gespeicherte
// Koordinaten benutzt (kein Google-Aufruf pro Kunde), ein Job füllt den Cache im Voraus.

import crypto from 'crypto';
import cron from 'node-cron';
import { query, run } from '../db';
import { berlinDateSql } from '../utils/berlinTime';
import { haversineKm } from '../utils/geo';
import { geocodeAddress } from '../routes/maps';

export type Coords = { lat: number; lng: number };

const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);
const wallMs = (w: string) => Date.parse(`${w}:00Z`);
const msWall = (ms: number) => new Date(ms).toISOString().slice(0, 16);

// ---- Geocode-Cache -------------------------------------------------------------------------

const norm = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');
const keyOf = (a: string) => crypto.createHash('sha1').update(norm(a)).digest('hex');

/** Gespeicherte Koordinaten zu Adressen (ohne Google-Aufruf). Fehlende fehlen in der Map. */
export async function cachedCoords(addresses: string[]): Promise<Map<string, Coords>> {
  const out = new Map<string, Coords>();
  const uniq = [...new Set(addresses.filter(a => a && a.trim()))];
  if (uniq.length === 0) return out;
  const keys = uniq.map(keyOf);
  const rows = await query<{ addr_key: string; lat: number | null; lng: number | null }>(
    `SELECT addr_key, lat, lng FROM geo_cache WHERE addr_key IN (${keys.map(() => '?').join(',')})`, keys
  );
  const byKey = new Map(rows.map(r => [r.addr_key, r]));
  for (const a of uniq) {
    const r = byKey.get(keyOf(a));
    if (r && r.lat != null && r.lng != null) out.set(norm(a), { lat: Number(r.lat), lng: Number(r.lng) });
  }
  return out;
}

/** Koordinaten einer Adresse — aus dem Cache, sonst einmal geokodieren und merken. */
export async function geocodeCached(address: string | null | undefined): Promise<Coords | null> {
  if (!address || !address.trim()) return null;
  const hit = (await cachedCoords([address])).get(norm(address));
  if (hit) return hit;
  const [known] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM geo_cache WHERE addr_key = ?`, [keyOf(address)]);
  if (Number(known?.n)) return null; // schon versucht, nicht auffindbar
  const c = await geocodeAddress(address);
  await run(
    `INSERT INTO geo_cache (addr_key, address, lat, lng) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng)`,
    [keyOf(address), address.slice(0, 500), c?.lat ?? null, c?.lng ?? null]
  );
  return c;
}

// ---- Gebiete -------------------------------------------------------------------------------
// Bereich 'muenchen': nur Fahrten Flughafen → Stadt München, und die neue Abholung muss in der
// Stadt München liegen — andere Städte zählen nicht.

const AIRPORT: Coords = { lat: 48.3538, lng: 11.7861 };
const MARIENPLATZ: Coords = { lat: 48.1372, lng: 11.5756 };
const RE_AIRPORT = /flughafen|airport|\bmuc\b|terminal [12]/i;

export type LeerArea = 'muenchen' | null;

export function isAirport(address: string | null | undefined, c?: Coords | null): boolean {
  if (address && RE_AIRPORT.test(address)) return true;
  return !!c && haversineKm(c.lat, c.lng, AIRPORT.lat, AIRPORT.lng) <= 3;
}

/** Stadt München: PLZ 80331–81929; ohne PLZ in der Adresse höchstens 12 km vom Marienplatz. */
export function isMunichCity(address: string | null | undefined, c?: Coords | null): boolean {
  const plz = address?.match(/\b(\d{5})\b/)?.[1];
  if (plz) return Number(plz) >= 80331 && Number(plz) <= 81929;
  return !!c && haversineKm(c.lat, c.lng, MARIENPLATZ.lat, MARIENPLATZ.lng) <= 12;
}

// ---- Fahrten der nächsten Tage -------------------------------------------------------------

export interface PlannedLeg {
  start: string; // Abholzeit, Berliner Wanduhr 'YYYY-MM-DDTHH:MM'
  from: string;
  to: string;
  durationMin: number | null;
  label: string; // Kurzinfo für den Admin (Buchungsnummer oder Kalender)
}

async function legsBetween(fromDate: string, toDate: string): Promise<PlannedLeg[]> {
  const legs: PlannedLeg[] = [];
  const lo = `${fromDate}T00:00`;
  const hi = `${toDate}T23:59`;
  const bookings = await query<{ booking_number: string; pickup_address: string; dropoff_address: string;
    pickup_datetime: string; return_datetime: string | null; trip_type: string; duration_minutes: number | null }>(
    `SELECT booking_number, pickup_address, dropoff_address, pickup_datetime, return_datetime, trip_type, duration_minutes
       FROM bookings
      WHERE status != 'cancelled'
        AND (REPLACE(pickup_datetime, ' ', 'T') BETWEEN ? AND ?
             OR (trip_type = 'roundtrip' AND REPLACE(return_datetime, ' ', 'T') BETWEEN ? AND ?))`,
    [lo, hi, lo, hi]
  );
  for (const b of bookings) {
    const dur = b.duration_minutes != null ? Number(b.duration_minutes) : null;
    const out = wall(b.pickup_datetime);
    if (out >= lo && out <= hi) legs.push({ start: out, from: b.pickup_address, to: b.dropoff_address, durationMin: dur, label: b.booking_number });
    if (b.trip_type === 'roundtrip' && b.return_datetime) {
      const back = wall(b.return_datetime);
      if (back >= lo && back <= hi) legs.push({ start: back, from: b.dropoff_address, to: b.pickup_address, durationMin: dur, label: `${b.booking_number} (Rück)` });
    }
  }
  const cal = await query<{ ride_time: string; pickup_address: string | null; dropoff_address: string | null; summary: string | null }>(
    `SELECT ride_time, pickup_address, dropoff_address, summary FROM calendar_rides
      WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [lo, hi]
  );
  for (const c of cal) {
    legs.push({ start: wall(c.ride_time), from: c.pickup_address || '', to: c.dropoff_address || '', durationMin: null,
      label: (c.summary || 'Kalender').trim().slice(0, 40) });
  }
  return legs.sort((a, b) => a.start.localeCompare(b.start));
}

// Fahrzeit ohne gespeicherte Dauer: Luftlinie × 1,35 bei ~60 km/h + 10 Min. Rangieren
function estimateMinutes(a: Coords | undefined, b: Coords | undefined): number {
  if (!a || !b) return 45;
  return Math.round((haversineKm(a.lat, a.lng, b.lat, b.lng) * 1.35) / 60 * 60 + 10);
}

export interface Vacancy {
  leg: PlannedLeg;
  at: Coords; // wo das Auto frei wird (Ziel der Fahrt)
  freeAt: string; // geschätzte Ankunft (Wanduhr)
  usedBy: PlannedLeg | null; // eine bereits geplante Fahrt nutzt das freie Auto schon
}

const legCache = new Map<string, { legs: PlannedLeg[]; at: number }>();
const LEG_CACHE_MS = 2 * 60_000;

async function legsCached(fromDate: string, toDate: string): Promise<PlannedLeg[]> {
  const k = `${fromDate}|${toDate}`;
  const hit = legCache.get(k);
  if (hit && Date.now() - hit.at < LEG_CACHE_MS) return hit.legs;
  const legs = await legsBetween(fromDate, toDate);
  legCache.set(k, { legs, at: Date.now() });
  return legs;
}

export function invalidateLeerCache(): void { legCache.clear(); }

/**
 * Freie Autos rund um ein Datum. Eine Fahrt am Vortag kann ein Auto erst nach Mitternacht
 * freigeben, daher wird ab dem Vortag gelesen. Als "schon genutzt" gilt ein freies Auto, wenn
 * eine andere geplante Fahrt nahe am Ziel innerhalb von beforeMin nach der Ankunft startet.
 */
export async function vacanciesAround(date: string, radiusKm: number, beforeMin: number, area: LeerArea = null): Promise<Vacancy[]> {
  const prev = msWall(wallMs(`${date}T00:00`) - 86_400_000).slice(0, 10);
  const legs = await legsCached(prev, date);
  const coords = await cachedCoords(legs.flatMap(l => [l.from, l.to]));
  const c = (a: string) => coords.get(norm(a || ''));
  const out: Vacancy[] = [];
  for (const leg of legs) {
    const at = c(leg.to);
    if (!at) continue;
    // München-Modus: nur Flughafen → Stadt München zählt als freies Auto
    if (area === 'muenchen' && !(isAirport(leg.from, c(leg.from)) && isMunichCity(leg.to, at))) continue;
    const dur = leg.durationMin ?? estimateMinutes(c(leg.from), at);
    const freeMs = wallMs(leg.start) + dur * 60_000;
    const freeAt = msWall(freeMs);
    const usedBy = legs.find(o => {
      if (o === leg) return false;
      const t = wallMs(o.start);
      if (t < freeMs || t > freeMs + beforeMin * 60_000) return false;
      const p = c(o.from);
      return !!p && haversineKm(p.lat, p.lng, at.lat, at.lng) <= radiusKm;
    }) ?? null;
    out.push({ leg, at, freeAt, usedBy });
  }
  return out;
}

/**
 * Passt eine neue Abholung (Ort + Zeit) zu einem freien, noch ungenutzten Auto?
 * Fenster: [Ankunft + afterMin, Ankunft + beforeMin], Abstand ≤ radiusKm.
 */
export async function leerMatch(params: {
  pickup: Coords; pickupAddress?: string | null; pickupWall: string; radiusKm: number; afterMin: number; beforeMin: number;
  area?: LeerArea;
}): Promise<Vacancy | null> {
  // München-Modus: die neue Abholung muss selbst in der Stadt München liegen
  if (params.area === 'muenchen' && !isMunichCity(params.pickupAddress, params.pickup)) return null;
  const date = params.pickupWall.slice(0, 10);
  const t = wallMs(params.pickupWall);
  const vac = await vacanciesAround(date, params.radiusKm, params.beforeMin, params.area ?? null);
  return vac.find(v => {
    if (v.usedBy) return false;
    const free = wallMs(v.freeAt);
    if (t < free + params.afterMin * 60_000 || t > free + params.beforeMin * 60_000) return false;
    return haversineKm(v.at.lat, v.at.lng, params.pickup.lat, params.pickup.lng) <= params.radiusKm;
  }) ?? null;
}

// ---- Cache im Voraus füllen ----------------------------------------------------------------

const WARM_DAYS = 4;
const WARM_MAX_PER_RUN = 60;

export async function warmGeoCache(): Promise<number> {
  const legs = await legsBetween(berlinDateSql(-1), berlinDateSql(WARM_DAYS));
  const addrs = [...new Set(legs.flatMap(l => [l.from, l.to]).filter(a => a && a.trim()))];
  if (addrs.length === 0) return 0;
  const keys = addrs.map(keyOf);
  const known = new Set((await query<{ addr_key: string }>(
    `SELECT addr_key FROM geo_cache WHERE addr_key IN (${keys.map(() => '?').join(',')})`, keys
  )).map(r => r.addr_key));
  let n = 0;
  for (const a of addrs) {
    if (known.has(keyOf(a))) continue;
    if (n >= WARM_MAX_PER_RUN) break;
    await geocodeCached(a);
    n++;
  }
  return n;
}

export function startLeerfahrtJob(): void {
  setTimeout(() => { warmGeoCache().catch(e => console.error('[leerfahrt] warm failed:', e?.message)); }, 60_000);
  // Kurz nach dem Kalender-Abgleich (alle 15 Minuten) neue Adressen geokodieren
  cron.schedule('5,20,35,50 * * * *', () => {
    warmGeoCache().catch(e => console.error('[leerfahrt] warm failed:', e?.message));
  });
}
