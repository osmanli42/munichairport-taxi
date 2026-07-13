import { Router, Request, Response } from 'express';

const router = Router();

const AERODATABOX_API_KEY = process.env.AERODATABOX_API_KEY || '';
const AERODATABOX_HOST = 'aerodatabox.p.rapidapi.com';

// IATA airline designators are 2 alphanumeric chars, not always 2 letters
// (e.g. "4Y" Eurowings Discover, "6E" IndiGo, "9U" Air Moldova).
const FLIGHT_NUMBER_RE = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;

interface FlightValidationResult {
  available: boolean;
  found: boolean;
  arrivesMUC?: boolean;
  airline?: string;
  origin?: string;
  scheduledArrival?: string;
  status?: string;
}

// In-memory cache: "FLIGHT|DATE" → result, TTL 6h (schedules don't change minute to minute,
// and this keeps us well under the free-tier monthly quota for repeat lookups of the same flight).
const cache = new Map<string, { data: FlightValidationResult; ts: number }>();
const CACHE_TTL = 6 * 3600_000;
const CACHE_MAX = 200;

function setCache(key: string, data: FlightValidationResult): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

function normalizeFlightNumber(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  return FLIGHT_NUMBER_RE.test(cleaned) ? cleaned : null;
}

// AeroDataBox's flight-by-number-and-date endpoint returns an array of legs (a flight
// number can be flown on multiple routes/dates or as a codeshare). Field names follow
// AeroDataBox's documented "FlightApiResultV2" shape; kept defensive with optional
// chaining since this hasn't been verified against a live response yet.
function parseAeroDataBoxResponse(data: unknown): FlightValidationResult {
  if (!Array.isArray(data) || data.length === 0) {
    return { available: true, found: false };
  }

  const legs = data as any[];
  const leg = legs.find(f =>
    f?.arrival?.airport?.iata === 'MUC' || f?.arrival?.airport?.icao === 'EDDM'
  ) || legs[0];

  const arrivesMUC = leg?.arrival?.airport?.iata === 'MUC' || leg?.arrival?.airport?.icao === 'EDDM';
  const dep = leg?.departure?.airport;
  const origin = dep ? `${dep.municipalityName || dep.name || ''}${dep.iata ? ` (${dep.iata})` : ''}`.trim() : undefined;
  const scheduledLocal: string | undefined = leg?.arrival?.scheduledTime?.local || leg?.arrival?.scheduledTimeLocal;
  const scheduledArrival = scheduledLocal ? scheduledLocal.slice(11, 16) : undefined; // "YYYY-MM-DD HH:mm..." -> "HH:mm"

  return {
    available: true,
    found: true,
    arrivesMUC,
    airline: leg?.airline?.name,
    origin: origin || undefined,
    scheduledArrival,
    status: leg?.status,
  };
}

// GET /api/flights/validate?flight=TK1629&date=2026-07-16
// Best-effort flight lookup for the Flugnummer field on the booking page. Never blocks
// booking: any failure or missing API key degrades to { available: false } rather than
// an error status, since this is a nice-to-have confirmation, not a required gate.
router.get('/validate', async (req: Request, res: Response): Promise<void> => {
  const rawFlight = req.query.flight as string | undefined;
  const date = req.query.date as string | undefined;

  if (!rawFlight || !date) {
    res.status(400).json({ error: 'flight and date required' });
    return;
  }

  const flight = normalizeFlightNumber(rawFlight);
  if (!flight) {
    res.json({ available: true, found: false, reason: 'format' });
    return;
  }

  if (!AERODATABOX_API_KEY) {
    res.json({ available: false, found: false });
    return;
  }

  const cacheKey = `${flight}|${date}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = `https://${AERODATABOX_HOST}/flights/number/${encodeURIComponent(flight)}/${encodeURIComponent(date)}`;
    const fetchOpts = {
      headers: {
        'x-rapidapi-key': AERODATABOX_API_KEY,
        'x-rapidapi-host': AERODATABOX_HOST,
      },
      signal: AbortSignal.timeout(8000),
    };

    let response = await fetch(url, fetchOpts);
    // Basic tier has a very low per-second rate limit — one short retry
    // absorbs the occasional collision instead of surfacing a false negative.
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 1100));
      response = await fetch(url, fetchOpts);
    }

    // AeroDataBox returns 204 (empty body) or 404 when no matching flight exists.
    if (response.status === 204 || response.status === 404) {
      const result: FlightValidationResult = { available: true, found: false };
      setCache(cacheKey, result);
      res.json(result);
      return;
    }

    if (!response.ok) {
      res.json({ available: false, found: false });
      return;
    }

    const data = await response.json();
    const result = parseAeroDataBoxResponse(data);
    setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Flight validation error:', error);
    res.json({ available: false, found: false });
  }
});

export default router;
