// Automatic event sources for the dashboard's "Demnächst" strip — days that change taxi
// demand at the airport:
//   - Messe München: trade fairs / congresses in Munich. Read from the search service the
//     official calendar page itself uses (messe-muenchen.de/de/veranstaltungen/
//     veranstaltungskalender). The public search key is taken from that page at runtime,
//     so nothing is stored here; if they change the page, this source just returns nothing.
//   - OpenHolidays (openholidaysapi.org): Bavarian school holidays. Free, no key.
//   - OpenLigaDB (api.openligadb.de): FC Bayern Bundesliga home games. Free, no key.
// Every source is cached for 12 h and fails soft (empty list + error text).

export type SourceKind = 'messe' | 'school' | 'football';

export type SourcedEvent = {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  kind: SourceKind;
  note?: string;
  time?: string; // HH:mm, football kick-off
};

type Cached = { at: number; events: SourcedEvent[]; error: string | null };
const CACHE_MS = 12 * 60 * 60_000;
const cache = new Map<SourceKind, Cached>();
const TIMEOUT = 15_000;

async function cached(kind: SourceKind, load: () => Promise<SourcedEvent[]>): Promise<Cached> {
  const hit = cache.get(kind);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  try {
    const events = await load();
    const entry = { at: Date.now(), events, error: null };
    cache.set(kind, entry);
    return entry;
  } catch (e: any) {
    // Keep serving the last good list; retry in an hour.
    const entry = { at: Date.now() - CACHE_MS + 60 * 60_000, events: hit?.events || [], error: e?.message || String(e) };
    cache.set(kind, entry);
    return entry;
  }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---- Messe München ------------------------------------------------------------------------

const MESSE_PAGE = 'https://messe-muenchen.de/de/veranstaltungen/veranstaltungskalender';

async function loadMesse(): Promise<SourcedEvent[]> {
  const page = await fetch(MESSE_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(TIMEOUT) });
  const html = await page.text();
  const endpoint = html.match(/data-api-endpoint="([^"]+)"/)?.[1];
  const token = html.match(/data-api-token="([^"]+)"/)?.[1];
  const engine = html.match(/id="event-calendar"[^>]*data-engine="([^"]+)"|data-engine="([^"]+)"[^>]*id="event-calendar"/);
  const engineName = engine?.[1] || engine?.[2] || html.match(/data-engine="([^"]+)"/)?.[1];
  if (!endpoint || !token || !engineName) throw new Error('Messe-Kalender: Seitenaufbau geändert');

  const from = new Date();
  const to = new Date(Date.now() + 550 * 86400_000);
  const res = await fetch(`${endpoint}${engineName}/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '',
      filters: { all: [
        { document_type: ['event-de'] },
        { event_start_date: { from: `${ymd(from)}T00:00:00+00:00`, to: `${ymd(to)}T00:00:00+00:00` } },
      ] },
      sort: { event_start_date: 'asc' },
      page: { size: 200 },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Messe-Kalender HTTP ${res.status}`);
  const data = await res.json() as { results?: any[] };
  const raw = (x: any, k: string) => x?.[k]?.raw;
  const out: SourcedEvent[] = [];
  const seen = new Set<string>();
  for (const x of data.results || []) {
    if (!/^m(ü|ue|u)nchen$|^munich$/i.test(String(raw(x, 'location_city') || '').trim())) continue;
    if (String(raw(x, 'event_status') || '') === 'cancelled') continue;
    const start = String(raw(x, 'event_start_date') || '').slice(0, 10);
    const end = String(raw(x, 'event_end_date') || start).slice(0, 10) || start;
    const name = String(raw(x, 'event_name') || raw(x, 'title') || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !name) continue;
    const key = `${name}|${start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = String(raw(x, 'location_name') || '').replace(/ Messe München$/, '');
    const status = raw(x, 'event_status') === 'new_date' ? 'neuer Termin' : '';
    out.push({ id: `messe-${start}-${name}`.slice(0, 80), name, start, end: end < start ? start : end, kind: 'messe', note: [place, status].filter(Boolean).join(' · ') || undefined });
  }
  return out;
}

// ---- School holidays (Bavaria) -------------------------------------------------------------

async function loadSchool(): Promise<SourcedEvent[]> {
  const from = new Date();
  const to = new Date(Date.now() + 400 * 86400_000);
  const url = `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&subdivisionCode=DE-BY&languageIsoCode=DE&validFrom=${ymd(from)}&validTo=${ymd(to)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`OpenHolidays HTTP ${res.status}`);
  const list = await res.json() as Array<{ id: string; startDate: string; endDate: string; name: Array<{ language: string; text: string }> }>;
  return list.map((h) => ({
    id: `school-${h.startDate}`,
    name: h.name.find((n) => n.language === 'DE')?.text || h.name[0]?.text || 'Schulferien',
    start: h.startDate,
    end: h.endDate,
    kind: 'school' as const,
    note: 'Schulferien Bayern',
  }));
}

// ---- FC Bayern home games ----------------------------------------------------------------

async function loadFootball(): Promise<SourcedEvent[]> {
  const now = new Date();
  // Bundesliga season "2026" runs Aug 2026 – May 2027.
  const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const out: SourcedEvent[] = [];
  for (const s of [season, season + 1]) {
    const res = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${s}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) { if (s === season) throw new Error(`OpenLigaDB HTTP ${res.status}`); continue; }
    const matches = await res.json() as any[];
    for (const m of matches) {
      const home = String(m?.team1?.teamName || '');
      if (!/bayern m(ü|ue)nchen/i.test(home)) continue;
      const dt = String(m.matchDateTime || ''); // local German time
      const date = dt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({
        id: `fcb-${date}`,
        name: `FC Bayern – ${String(m?.team2?.shortName || m?.team2?.teamName || '').trim()}`,
        start: date,
        end: date,
        kind: 'football',
        time: dt.slice(11, 16),
        note: 'Allianz Arena · Bundesliga',
      });
    }
  }
  return out;
}

// ---- Public -----------------------------------------------------------------------------

export type SourceSwitches = Record<SourceKind, boolean>;
export const DEFAULT_SOURCES: SourceSwitches = { messe: true, school: true, football: true };

export async function sourcedEvents(on: SourceSwitches): Promise<{ events: SourcedEvent[]; errors: Partial<Record<SourceKind, string>> }> {
  const jobs: Array<[SourceKind, () => Promise<SourcedEvent[]>]> = [
    ['messe', loadMesse], ['school', loadSchool], ['football', loadFootball],
  ];
  const results = await Promise.all(jobs.filter(([k]) => on[k]).map(async ([k, fn]) => [k, await cached(k, fn)] as const));
  const errors: Partial<Record<SourceKind, string>> = {};
  const events: SourcedEvent[] = [];
  for (const [k, r] of results) {
    events.push(...r.events);
    if (r.error) errors[k] = r.error;
  }
  return { events, errors };
}
