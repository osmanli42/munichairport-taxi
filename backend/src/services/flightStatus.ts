// Live arrival status for airport pickups (driver app, customer tracking page, admin).
//
// Uses the same AeroDataBox account as routes/flights.ts (booking-time validation). The
// basic tier is rate-limited and billed per call, so results are cached per flight+date
// for 10 minutes and callers only ask for rides close to pickup (see driverTracking.ts).

const AERODATABOX_API_KEY = process.env.AERODATABOX_API_KEY || '';
const AERODATABOX_HOST = 'aerodatabox.p.rapidapi.com';
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 300;

export interface FlightStatus {
  flight: string;
  status: string | null;          // AeroDataBox status, e.g. "Expected", "Delayed", "Arrived"
  scheduled: string | null;       // "HH:mm" local
  expected: string | null;        // revised/predicted arrival "HH:mm" local
  actual: string | null;          // runway/actual arrival "HH:mm" local
  terminal: string | null;        // "1" / "2"
  origin: string | null;
  delay_minutes: number | null;   // expected/actual minus scheduled
}

const cache = new Map<string, { data: FlightStatus | null; ts: number }>();

function hhmm(local: unknown): string | null {
  return typeof local === 'string' && local.length >= 16 ? local.slice(11, 16) : null;
}

function minutesOf(local: unknown): number | null {
  if (typeof local !== 'string' || local.length < 16) return null;
  const t = Date.parse(local.slice(0, 16).replace(' ', 'T') + ':00Z');
  return Number.isNaN(t) ? null : t / 60_000;
}

export function normalizeFlightNumber(raw: string | null | undefined): string | null {
  const cleaned = String(raw || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(cleaned) ? cleaned : null;
}

export async function getFlightStatus(rawFlight: string | null | undefined, date: string): Promise<FlightStatus | null> {
  const flight = normalizeFlightNumber(rawFlight);
  if (!flight || !AERODATABOX_API_KEY || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const key = `${flight}|${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  let data: FlightStatus | null = null;
  try {
    const res = await fetch(`https://${AERODATABOX_HOST}/flights/number/${encodeURIComponent(flight)}/${date}`, {
      headers: { 'x-rapidapi-key': AERODATABOX_API_KEY, 'x-rapidapi-host': AERODATABOX_HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok && res.status !== 204) {
      const legs = await res.json() as any[];
      const leg = Array.isArray(legs)
        ? legs.find((l) => l?.arrival?.airport?.iata === 'MUC' || l?.arrival?.airport?.icao === 'EDDM') || legs[0]
        : null;
      if (leg) {
        const arr = leg.arrival || {};
        const scheduledLocal = arr.scheduledTime?.local || arr.scheduledTimeLocal;
        const expectedLocal = arr.revisedTime?.local || arr.predictedTime?.local || arr.estimatedTime?.local;
        const actualLocal = arr.runwayTime?.local || arr.actualTime?.local;
        const s = minutesOf(scheduledLocal);
        const e = minutesOf(actualLocal) ?? minutesOf(expectedLocal);
        const dep = leg.departure?.airport;
        data = {
          flight,
          status: typeof leg.status === 'string' ? leg.status : null,
          scheduled: hhmm(scheduledLocal),
          expected: hhmm(expectedLocal),
          actual: hhmm(actualLocal),
          terminal: arr.terminal ? String(arr.terminal).replace(/^T/i, '') : null,
          origin: dep ? `${dep.municipalityName || dep.name || ''}${dep.iata ? ` (${dep.iata})` : ''}`.trim() || null : null,
          delay_minutes: s != null && e != null ? Math.round(e - s) : null,
        };
      }
    }
  } catch {
    data = null;
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
  return data;
}
