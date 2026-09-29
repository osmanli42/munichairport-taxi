// Extra dashboard widgets, loaded next to GET /api/admin/dashboard:
//   GET /overview — driver plan, month forecast, missed customers, receivables,
//                   today's funnel, upcoming events
//   GET /flights  — live status of today's / tomorrow's airport pickups (AeroDataBox, billed
//                   per call → only for flights close in time, cached, with a daily cap)
//   PUT /events   — the admin's own event list (trade fairs etc.)
//   PUT /flight-status — switch live flight status on/off
// All calendar boundaries in Berlin time (see utils/berlinTime).

import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { berlinDateSql, berlinMidnightUtcSql, berlinNowSql } from '../utils/berlinTime';
import { calendarEventsCached, classifyEvents, loadBookingRefs, RE_CAL_CANCELLED } from '../services/calendarRides';
import { classifyEvent } from '../services/calendarInvoice';
import { getFlightStatus, normalizeFlightNumber, FlightStatus } from '../services/flightStatus';
import { sourcedEvents, DEFAULT_SOURCES, SourceSwitches, SourceKind } from '../services/eventSources';

const router = Router();

const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);
function wallMinutes(s: string): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, h, mi) / 60000;
}
const RE_AIRPORT = /flughafen|airport|terminal|\bMUC\b/i;
const RE_FLIGHT = /^((?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}[A-Z]?)\b/;

async function getSetting(key: string): Promise<string | null> {
  const [row] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [key]);
  return row?.setting_value ?? null;
}
async function setSetting(key: string, value: string): Promise<void> {
  await run(
    `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
    [key, value, value]);
}

// ---- Drivers from the calendar's "Ort" field ------------------------------------------
// The operator writes the driver at the end: "✅ Kk ödendi Abdülkadir", "✅ 2xBus16 M.ALi & Saban".
// The last word(s) are taken as driver candidates; only names that show up regularly count,
// so a stray hotel name or note in that spot is ignored.

const DRIVER_NOISE = /^(kk|ödendi|odendi|ödedi|bende|bargeld|bar|taxi|bus\S*|\d*x\S*|sitz\S*|maxi\S*|get-?e|rechnung\S*|g[öo]n\S*|kombi|van|fs-nr|nr|stamm|kein|e-?mail|ile|ok|iptal\S*|yok|var|\d+\S*)$/i;

function driverTokens(location: string): string[] {
  // "Taxi Gitti" = handed over to another taxi.
  if (/taxi\s+gitti/i.test(location)) return ['Fremdtaxi'];
  const tokens = location
    .replace(/[☀-➿️\u{1F000}-\u{1FAFF}]/gu, ' ')
    .replace(/\*+[^*]*\*+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && out.length < 3; i--) {
    const t = tokens[i].replace(/[,;:]+$/, '');
    if (t === '&' || /^und$/i.test(t) || t === '+') continue;
    if (!out.length && /^\p{L}\.$/u.test(t)) continue; // "Gökhan C." → Gökhan
    if (DRIVER_NOISE.test(t) || !/\p{L}/u.test(t) || t.length < 3) break;
    out.unshift(t);
    // Only keep going across an explicit "A & B".
    const prev = tokens[i - 1];
    if (!(prev === '&' || prev === '+' || /^und$/i.test(prev || ''))) break;
    i--;
  }
  return out;
}

let driverCache: { at: number; names: Map<string, string> } | null = null;
async function knownDrivers(): Promise<Map<string, string>> {
  if (driverCache && Date.now() - driverCache.at < 60 * 60_000) return driverCache.names;
  const rows = await query<{ location: string }>(
    `SELECT location FROM calendar_rides WHERE ride_time >= ? AND location IS NOT NULL AND location <> ''`,
    [`${berlinDateSql(-180)}T00:00`]);
  const freq = new Map<string, Map<string, number>>();
  for (const r of rows) {
    for (const t of driverTokens(r.location)) {
      const k = t.toLowerCase();
      const spellings = freq.get(k) || new Map<string, number>();
      spellings.set(t, (spellings.get(t) || 0) + 1);
      freq.set(k, spellings);
    }
  }
  const names = new Map<string, string>();
  for (const [k, spellings] of Array.from(freq.entries())) {
    const total = Array.from(spellings.values()).reduce((a, b) => a + b, 0);
    if (total < 6) continue;
    const display = Array.from(spellings.entries()).sort((a, b) => b[1] - a[1])[0][0];
    names.set(k, display);
  }
  driverCache = { at: Date.now(), names };
  return names;
}

type PlanEntry = {
  time: string;
  drivers: string[];
  title: string;
  from: string | null;
  to: string | null;
  source: 'calendar' | 'booking' | 'booking_only';
  booking_id: number | null;
  booking_number: string | null;
  html_link: string | null;
  duration: number;
};

async function driverPlan(now: string) {
  const today = now.slice(0, 10);
  const tomorrow = berlinDateSql(1);
  const [events, bookings, names] = await Promise.all([
    calendarEventsCached(today, tomorrow).catch(() => null),
    loadBookingRefs(),
    knownDrivers(),
  ]);
  if (!events) return null;

  const entries: PlanEntry[] = [];
  const covered = new Set<string>(); // booking id + date that has a calendar event
  for (const c of classifyEvents(events, bookings)) {
    const ev = c.event;
    // Cancelled in the calendar (❌/iptal) or as a booking — not a ride to plan. The booking
    // still counts as covered so it is not listed again as "nicht im Kalender".
    if (c.booking) covered.add(`${c.booking.id}|${ev.start!.slice(0, 10)}`);
    if (c.kind === 'cancelled' || c.booking?.status === 'cancelled' || RE_CAL_CANCELLED.test(`${ev.summary}\n${ev.location}`)) continue;
    const drivers = driverTokens(ev.location).map((t) => names.get(t.toLowerCase())).filter((n): n is string => !!n);
    const flight = ev.summary.trim().match(RE_FLIGHT)?.[1];
    entries.push({
      time: ev.start!,
      drivers: Array.from(new Set(drivers)),
      title: c.booking?.name || c.guest || (flight ? `Flug ${flight}` : ev.summary.trim().slice(0, 60) || 'Kalender-Fahrt'),
      from: c.from,
      to: c.to,
      source: c.booking ? 'booking' : 'calendar',
      booking_id: c.booking?.id ?? null,
      booking_number: c.booking?.booking_number ?? null,
      html_link: ev.htmlLink,
      duration: Math.max(Number(c.booking?.duration_minutes) || 0, 45),
    });
  }
  // Booking legs in the window that nobody put into the calendar yet → no driver planned.
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const legs: Array<[string, string | null, string | null]> = [[wall(b.pickup_datetime), b.pickup_address, b.dropoff_address]];
    if (b.trip_type === 'roundtrip' && b.return_datetime) legs.push([wall(b.return_datetime), b.dropoff_address, b.pickup_address]);
    for (const [t, from, to] of legs) {
      const d = t.slice(0, 10);
      if (d !== today && d !== tomorrow) continue;
      if (covered.has(`${b.id}|${d}`)) continue;
      entries.push({
        time: t, drivers: [], title: b.name, from, to, source: 'booking_only',
        booking_id: b.id, booking_number: b.booking_number, html_link: null,
        duration: Math.max(Number(b.duration_minutes) || 0, 45),
      });
    }
  }
  entries.sort((a, b) => a.time.localeCompare(b.time));

  // Per driver: consecutive rides that leave too little time (ride + 20 min to the next pickup).
  const byDriver = new Map<string, PlanEntry[]>();
  for (const e of entries) for (const d of e.drivers) {
    if (!byDriver.has(d)) byDriver.set(d, []);
    byDriver.get(d)!.push(e);
  }
  const conflicts: Array<{ driver: string; first: PlanEntry; second: PlanEntry; gap: number; need: number }> = [];
  const drivers = Array.from(byDriver.entries()).map(([driver, list]) => {
    for (let i = 1; i < list.length; i++) {
      const gap = wallMinutes(list[i].time) - wallMinutes(list[i - 1].time);
      const need = list[i - 1].duration + 20;
      if (gap < need && list[i].time >= now) conflicts.push({ driver, first: list[i - 1], second: list[i], gap, need });
    }
    return {
      driver,
      today: list.filter((e) => e.time.startsWith(today)).length,
      tomorrow: list.filter((e) => e.time.startsWith(tomorrow)).length,
      next: list.find((e) => e.time >= now) || null,
    };
  }).sort((a, b) => (b.today + b.tomorrow) - (a.today + a.tomorrow));

  const horizon = wallMinutes(now) + 36 * 60;
  const unassigned = entries.filter((e) => e.time >= now && wallMinutes(e.time) <= horizon && e.drivers.length === 0);
  return { drivers, entries, conflicts, unassigned, known: Array.from(names.values()) };
}

// ---- Month forecast (by ride date) ------------------------------------------------------

async function forecast(now: string, includeCalendar: boolean) {
  const nowSql = now.replace('T', ' ');
  const month = now.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = +now.slice(8, 10);
  const hour = +now.slice(11, 13);
  const remainingDays = daysInMonth - day + (24 - hour) / 24;
  const prevMonth = berlinDateSql(-day).slice(0, 7);
  const lastYear = `${y - 1}-${String(m).padStart(2, '0')}`;
  const paceFrom = `${berlinDateSql(-28)} 00:00:00`;

  const [b] = await query<any>(`
    SELECT
      COALESCE(SUM(CASE WHEN LEFT(pickup_datetime, 7) = ? AND REPLACE(pickup_datetime, 'T', ' ') <= ? THEN price END), 0) AS realized,
      COALESCE(SUM(CASE WHEN LEFT(pickup_datetime, 7) = ? AND REPLACE(pickup_datetime, 'T', ' ') > ? THEN price END), 0) AS scheduled,
      COALESCE(SUM(CASE WHEN REPLACE(pickup_datetime, 'T', ' ') BETWEEN ? AND ? THEN price END), 0) AS pace28,
      COALESCE(SUM(CASE WHEN LEFT(pickup_datetime, 7) = ? THEN price END), 0) AS prev_month,
      COALESCE(SUM(CASE WHEN LEFT(pickup_datetime, 7) = ? THEN price END), 0) AS last_year
    FROM bookings WHERE status <> 'cancelled'`,
    [month, nowSql, month, nowSql, paceFrom, nowSql, prevMonth, lastYear]);
  let c = { realized: 0, scheduled: 0, pace28: 0, prev_month: 0, last_year: 0 };
  if (includeCalendar) {
    const nowWall = now.slice(0, 16);
    const [r] = await query<any>(`
      SELECT
        COALESCE(SUM(CASE WHEN LEFT(ride_time, 7) = ? AND ride_time <= ? THEN price END), 0) AS realized,
        COALESCE(SUM(CASE WHEN LEFT(ride_time, 7) = ? AND ride_time > ? THEN price END), 0) AS scheduled,
        COALESCE(SUM(CASE WHEN ride_time BETWEEN ? AND ? THEN price END), 0) AS pace28,
        COALESCE(SUM(CASE WHEN LEFT(ride_time, 7) = ? THEN price END), 0) AS prev_month,
        COALESCE(SUM(CASE WHEN LEFT(ride_time, 7) = ? THEN price END), 0) AS last_year
      FROM calendar_rides WHERE kind = 'ride'`,
      [month, nowWall, month, nowWall, `${berlinDateSql(-28)}T00:00`, nowWall, prevMonth, lastYear]);
    c = { realized: +r.realized, scheduled: +r.scheduled, pace28: +r.pace28, prev_month: +r.prev_month, last_year: +r.last_year };
  }
  const realized = +b.realized + c.realized;
  const scheduled = +b.scheduled + c.scheduled;
  const perDay = (+b.pace28 + c.pace28) / 28;
  const expectedRest = Math.max(scheduled, perDay * remainingDays);
  return {
    month,
    realized,
    scheduled,
    per_day: perDay,
    remaining_days: remainingDays,
    forecast: realized + expectedRest,
    prev_month: +b.prev_month + c.prev_month,
    last_year: +b.last_year + c.last_year,
    include_calendar: includeCalendar,
  };
}

// ---- Missed customers today -------------------------------------------------------------

async function missedCustomers() {
  const since = berlinMidnightUtcSql(0);
  const drafts = await query<any>(`
    SELECT d.session_id, d.pickup, d.dropoff, d.price, d.distance_km, d.vehicle, d.last_stage,
           DATE_FORMAT(d.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_utc,
           s.city, s.country, s.gclid, s.utm_source, s.ua_device,
           (s.last_seen >= NOW() - INTERVAL 2 MINUTE) AS online
      FROM booking_drafts d
      LEFT JOIN visitor_sessions s ON s.session_id = d.session_id
     WHERE d.updated_at >= ?
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.created_at >= ?
                       AND ((b.session_id IS NOT NULL AND b.session_id = d.session_id)
                         OR (b.visitor_id IS NOT NULL AND b.visitor_id = d.visitor_id)))
     ORDER BY d.updated_at DESC LIMIT 30`, [since, since]);
  const callbacks = await query<any>(`
    SELECT id, phone, name, pickup, dropoff, price, trip_datetime, status,
           DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc
      FROM callback_requests
     WHERE handled_at IS NULL AND status = 'open' AND created_at >= NOW() - INTERVAL 7 DAY
     ORDER BY created_at DESC LIMIT 10`);
  const at = (utc: string) => wall(berlinNowSql(new Date(utc)));
  return {
    drafts: drafts.map((d) => ({ ...d, online: !!Number(d.online), updated_at: at(d.updated_utc), price: d.price != null ? Number(d.price) : null })),
    callbacks: callbacks.map((c) => ({ ...c, created_at: at(c.created_utc), price: c.price != null ? Number(c.price) : null })),
  };
}

// ---- Receivables ------------------------------------------------------------------------

async function receivables(now: string) {
  const today = now.slice(0, 10);
  const invoices = await query<any>(`
    SELECT ci.id, ci.invoice_number, ci.total, DATE_FORMAT(ci.due_date, '%Y-%m-%d') AS due_date,
           ci.reminder_level, ci.period_month, c.company_name, ci.company_id
      FROM company_invoices ci LEFT JOIN companies c ON c.id = ci.company_id
     WHERE ci.status = 'sent' ORDER BY ci.due_date ASC`);
  const [transfer] = await query<any>(`
    SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS total
      FROM bookings
     WHERE payment_method = 'ueberweisung' AND ueberweisung_paid_at IS NULL AND status <> 'cancelled'
       AND REPLACE(pickup_datetime, 'T', ' ') <= ?`, [now.replace('T', ' ')]);
  // Rechnung rides in the calendar that are still open (same markers as the Kalender inbox).
  const calRows = await query<any>(`
    SELECT uid, ride_time, summary, location, price FROM calendar_rides
     WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [`${berlinDateSql(-180)}T00:00`, now.slice(0, 16)]);
  const calOpen = calRows.filter((r) => classifyEvent({ uid: r.uid, htmlLink: null, start: r.ride_time, summary: r.summary || '', description: '', location: r.location || '' }) === 'open');
  return {
    invoices: invoices.map((i) => ({ ...i, total: Number(i.total) || 0, overdue: !!i.due_date && i.due_date < today })),
    invoices_total: invoices.reduce((s, i) => s + (Number(i.total) || 0), 0),
    overdue_total: invoices.filter((i) => i.due_date && i.due_date < today).reduce((s, i) => s + (Number(i.total) || 0), 0),
    transfers: { count: Number(transfer?.count) || 0, total: Number(transfer?.total) || 0 },
    calendar_open: { count: calOpen.length, total: calOpen.reduce((s, r) => s + (Number(r.price) || 0), 0) },
  };
}

// ---- Funnel today -----------------------------------------------------------------------

async function funnel(now: string) {
  const since = berlinMidnightUtcSql(0);
  const ySince = berlinMidnightUtcSql(-1);
  // Same clock time yesterday, as a UTC bound comparable with first_seen / created_at.
  const nowUtc = new Date();
  const yNow = new Date(nowUtc.getTime() - 24 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
  const stage = (from: string, to: string) => query<any>(`
    SELECT COUNT(*) AS visitors,
           SUM(s.gclid IS NOT NULL OR s.utm_medium = 'cpc') AS ads,
           SUM(EXISTS (SELECT 1 FROM visitor_pageviews p WHERE p.session_id = s.session_id AND p.path LIKE '%ergebnisse%')) AS prices,
           SUM(EXISTS (SELECT 1 FROM visitor_pageviews p WHERE p.session_id = s.session_id AND p.path LIKE '%buchen%')) AS form
      FROM visitor_sessions s
     WHERE s.is_bot = 0 AND s.first_seen >= ? AND s.first_seen <= ?`, [from, to]);
  const bookings = (from: string, to: string) => query<any>(`
    SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS revenue FROM bookings
     WHERE status <> 'cancelled' AND created_at >= ? AND created_at <= ?
       AND COALESCE(source, 'web') NOT IN ('calendar')`, [from, to]);
  const nowUtcSql = nowUtc.toISOString().slice(0, 19).replace('T', ' ');
  const [[t], [yv], [tb], [yb], [spend]] = await Promise.all([
    stage(since, nowUtcSql), stage(ySince, yNow), bookings(since, nowUtcSql), bookings(ySince, yNow),
    query<any>(`SELECT amount FROM ads_spend WHERE spend_date = ?`, [now.slice(0, 10)]),
  ]);
  const n = (v: unknown) => Number(v) || 0;
  return {
    today: { visitors: n(t.visitors), ads: n(t.ads), prices: n(t.prices), form: n(t.form), bookings: n(tb.n), revenue: n(tb.revenue) },
    yesterday: { visitors: n(yv.visitors), ads: n(yv.ads), prices: n(yv.prices), form: n(yv.form), bookings: n(yb.n), revenue: n(yb.revenue) },
    ads_spend_today: spend ? n(spend.amount) : null,
  };
}

// ---- Events (public holidays + the admin's list) ----------------------------------------

type DashEvent = { id: string; name: string; start: string; end: string; kind: 'holiday' | 'custom' | SourceKind; note?: string; time?: string };

// Oktoberfest 2026 as the first entry so the list is not empty; the admin edits the rest.
const DEFAULT_EVENTS: DashEvent[] = [
  { id: 'oktoberfest-2026', name: 'Oktoberfest', start: '2026-09-19', end: '2026-10-04', kind: 'custom' },
];

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function bavarianHolidays(year: number): DashEvent[] {
  const e = easter(year);
  const rel = (days: number) => new Date(e.getTime() + days * 86400_000).toISOString().slice(0, 10);
  const fixed = (md: string) => `${year}-${md}`;
  const list: Array<[string, string]> = [
    ['Neujahr', fixed('01-01')], ['Heilige Drei Könige', fixed('01-06')], ['Karfreitag', rel(-2)],
    ['Ostermontag', rel(1)], ['Tag der Arbeit', fixed('05-01')], ['Christi Himmelfahrt', rel(39)],
    ['Pfingstmontag', rel(50)], ['Fronleichnam', rel(60)], ['Mariä Himmelfahrt', fixed('08-15')],
    ['Tag der Deutschen Einheit', fixed('10-03')], ['Allerheiligen', fixed('11-01')],
    ['1. Weihnachtstag', fixed('12-25')], ['2. Weihnachtstag', fixed('12-26')],
  ];
  return list.map(([name, d]) => ({ id: `holiday-${d}`, name, start: d, end: d, kind: 'holiday' as const }));
}

async function customEvents(): Promise<DashEvent[]> {
  const raw = await getSetting('dashboard_events');
  if (raw == null) return DEFAULT_EVENTS;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function eventSwitches(): Promise<SourceSwitches> {
  try {
    return { ...DEFAULT_SOURCES, ...JSON.parse((await getSetting('dashboard_event_sources')) || '{}') };
  } catch {
    return { ...DEFAULT_SOURCES };
  }
}

async function upcomingEvents(today: string) {
  const until = berlinDateSql(45);
  const y = +today.slice(0, 4);
  const switches = await eventSwitches();
  const sourced = await sourcedEvents(switches);
  const custom = (await customEvents()).map((e) => ({ ...e, kind: 'custom' as const }));
  // Custom entries win over an automatic one with the same name and start (e.g. the preset
  // Oktoberfest), so the admin can correct a date.
  const customKeys = new Set(custom.map((e) => `${e.name.toLowerCase()}|${e.start}`));
  const all: DashEvent[] = [
    ...bavarianHolidays(y), ...bavarianHolidays(y + 1), ...custom,
    ...sourced.events.filter((e) => !customKeys.has(`${e.name.toLowerCase()}|${e.start}`)),
  ];
  return {
    events: all.filter((e) => e.end >= today && e.start <= until).sort((a, b) => a.start.localeCompare(b.start) || (a.time || '').localeCompare(b.time || '')),
    sources: { switches, errors: sourced.errors },
  };
}

// ---- Routes -----------------------------------------------------------------------------

router.get('/overview', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  const now = wall(berlinNowSql());
  const includeCalendar = ((await getSetting('stats_include_calendar')) ?? '1') === '1';
  const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try { return await fn(); } catch (e: any) { console.error(`[dashboard-widgets] ${label}:`, e?.message || e); return null; }
  };
  const [drivers, fc, missed, recv, fun, events, custom] = await Promise.all([
    safe('drivers', () => driverPlan(now)),
    safe('forecast', () => forecast(now, includeCalendar)),
    safe('missed', () => missedCustomers()),
    safe('receivables', () => receivables(now)),
    safe('funnel', () => funnel(now)),
    safe('events', () => upcomingEvents(now.slice(0, 10))),
    safe('customEvents', () => customEvents()),
  ]);
  res.json({
    now, drivers, forecast: fc, missed, receivables: recv, funnel: fun,
    events: events?.events ?? null, event_sources: events?.sources ?? null, custom_events: custom,
  });
});

router.put('/event-sources', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body || {};
  const next: SourceSwitches = { ...(await eventSwitches()) };
  for (const k of Object.keys(DEFAULT_SOURCES) as SourceKind[]) if (k in body) next[k] = !!body[k];
  await setSetting('dashboard_event_sources', JSON.stringify(next));
  res.json({ switches: next });
});

router.put('/events', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const list = Array.isArray(req.body?.events) ? req.body.events : null;
  if (!list || list.length > 200) { res.status(400).json({ error: 'events array required' }); return; }
  const clean: DashEvent[] = [];
  for (const e of list) {
    const name = String(e?.name || '').trim().slice(0, 80);
    const start = String(e?.start || '');
    const end = String(e?.end || start);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
      res.status(400).json({ error: `Ungültiger Eintrag: ${name || '(ohne Name)'}` });
      return;
    }
    clean.push({ id: String(e?.id || `${start}-${name}`).slice(0, 80), name, start, end, kind: 'custom', note: String(e?.note || '').slice(0, 200) || undefined });
  }
  await setSetting('dashboard_events', JSON.stringify(clean));
  res.json({ events: clean });
});

// ---- Flights ----------------------------------------------------------------------------

const FLIGHT_DAILY_CAP = 150;           // AeroDataBox calls per day from the dashboard
const FLIGHT_REFRESH_MS = 15 * 60_000;  // per flight
let flightBudget = { day: '', used: 0 };
const flightSeen = new Map<string, { at: number; data: FlightStatus | null }>();

router.put('/flight-status', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  await setSetting('dashboard_flight_status', req.body?.enabled ? '1' : '0');
  res.json({ enabled: !!req.body?.enabled });
});

router.get('/flights', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = wall(berlinNowSql());
    const today = now.slice(0, 10);
    const tomorrow = berlinDateSql(1);
    const enabled = ((await getSetting('dashboard_flight_status')) ?? '1') === '1';
    if (flightBudget.day !== today) flightBudget = { day: today, used: 0 };

    // Airport pickups: outbound legs of bookings with a flight number, and calendar-only
    // rides whose title is a flight number ("LH 2189").
    const rows = await query<any>(`
      SELECT id, booking_number, name, pickup_address, dropoff_address, pickup_datetime, flight_number, status
        FROM bookings
       WHERE status <> 'cancelled' AND flight_number IS NOT NULL AND flight_number <> ''
         AND LEFT(pickup_datetime, 10) IN (?, ?)`, [today, tomorrow]);
    type Pickup = { time: string; flight: string; name: string; to: string | null; source: 'booking' | 'calendar'; booking_id: number | null; html_link: string | null };
    const pickups: Pickup[] = [];
    for (const r of rows) {
      if (!RE_AIRPORT.test(r.pickup_address || '')) continue;
      const flight = normalizeFlightNumber(String(r.flight_number).match(RE_FLIGHT)?.[1] || r.flight_number);
      if (!flight) continue;
      pickups.push({ time: wall(r.pickup_datetime), flight, name: r.name, to: r.dropoff_address, source: 'booking', booking_id: r.id, html_link: null });
    }
    const events = await calendarEventsCached(today, tomorrow).catch(() => null);
    if (events) {
      for (const c of classifyEvents(events, await loadBookingRefs())) {
        if (c.kind !== 'ride') continue;
        const m = c.event.summary.trim().match(RE_FLIGHT);
        const flight = m ? normalizeFlightNumber(m[1]) : null;
        if (!flight) continue;
        pickups.push({ time: c.event.start!, flight, name: c.guest || '', to: c.to, source: 'calendar', booking_id: null, html_link: c.event.htmlLink });
      }
    }
    pickups.sort((a, b) => a.time.localeCompare(b.time));

    const nowMin = wallMinutes(now);
    const out = [];
    for (const p of pickups) {
      const date = p.time.slice(0, 10);
      const key = `${p.flight}|${date}`;
      const diff = wallMinutes(p.time) - nowMin;
      let status: FlightStatus | null = flightSeen.get(key)?.data ?? null;
      let live = false;
      // Only flights between an hour ago and 8 hours ahead are looked up — the rest would
      // cost calls without telling anything useful yet.
      if (enabled && diff >= -60 && diff <= 8 * 60) {
        live = true;
        const seen = flightSeen.get(key);
        if ((!seen || Date.now() - seen.at > FLIGHT_REFRESH_MS) && flightBudget.used < FLIGHT_DAILY_CAP) {
          flightBudget.used++;
          status = await getFlightStatus(p.flight, date);
          flightSeen.set(key, { at: Date.now(), data: status });
          if (flightSeen.size > 400) flightSeen.delete(flightSeen.keys().next().value!);
        }
      }
      out.push({ ...p, live, status });
    }
    res.json({ enabled, budget: { used: flightBudget.used, cap: FLIGHT_DAILY_CAP }, flights: out });
  } catch (error) {
    console.error('[dashboard-widgets] flights:', error);
    res.status(500).json({ error: 'Failed to load flights' });
  }
});

export default router;
