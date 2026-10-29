// Rides from the operator's Google Calendar, for the dashboard and the statistics.
//
// The calendar holds every ride the business does — web bookings copied in by hand
// (usually with their MAT… number, sometimes without) and rides that only exist there:
// phone orders, Get-e and other partners, and everything from before the website. Only
// that last group is added to the numbers; the rest is already counted as a booking.
//
// The statistics read a mirror table (calendar_rides) instead of Google: the whole
// history is ~6000 events and takes ~10 s to fetch. It is refreshed every 15 minutes for
// the recent window and once a night for everything. Read-only towards Google.

import cron from 'node-cron';
import { query, run } from '../db';
import { berlinDateSql } from '../utils/berlinTime';
import { salutationGuest } from '../utils/socialProofPlace';
import { estimateCalendarPrices } from './calendarPriceEstimate';
import { fetchEventsRange, parseInvoiceRide, parseAmount, CalEvent } from './calendarInvoice';
import { hasServiceAccount } from './calendarImport';
import { returnLeg } from '../utils/returnLeg';

// 'other' = a calendar entry that is no ride at all (workshop / barber appointment, a note, a
// settlement reminder …): counted nowhere, no mail, not on the dashboard.
export type CalendarKind = 'ride' | 'booking' | 'imported' | 'duplicate' | 'cancelled' | 'other';

export interface ClassifiedEvent {
  event: CalEvent;
  kind: CalendarKind;
  booking: BookingRef | null;
  price: number | null;
  from: string | null;
  to: string | null;
  via: string[];
  guest: string | null;
}

export interface BookingRef {
  id: number;
  booking_number: string;
  name: string;
  price: number;
  status: string;
  trip_type: string | null;
  pickup_datetime: string;
  return_datetime: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  return_pickup_address: string | null;
  return_dropoff_address: string | null;
  calendar_event_uid: string | null;
  duration_minutes: number | null;
}

// Earliest events in the calendar are from January 2023.
const HISTORY_START = '2023-01-01';
const RECENT_BACK_DAYS = 40;
const AHEAD_DAYS = 60;
// A hand-copied web booking sits at the same time (± a little) with the same address.
const DUPLICATE_WINDOW_MIN = 30;

// Titles of appointments that are no ride (checked only when the entry has no price and no destination).
const RE_NOT_A_RIDE = /werkstatt|kfz|garage|gargae|tüv|reifen|autohaus|meisterbetrieb|berber|friseur|barber/i;

export const RE_CAL_CANCELLED = /❌|ipta+l+|an+ul+iert|storn|cancel|abgesagt/iu;
const RE_BOOKING_NO = /\b[A-Z]{3}\d{6}-\d{4}\b/g;
const RE_AIRPORT = /flughafen|airport|terminal|\bMUC\b/i;

// The booking form used until early 2026 put its confirmation mail into the event:
// "Total: €87.97 creditcard", and for round trips the same total on both events plus
// "Return date: 11-01-2023, 08:00". The total is counted once, on the outbound event.
const RE_LEGACY_TOTAL = /Total:\s*(?:€|EUR)\s*(\d{1,5}(?:[.,]\d{1,2})?)/i;
const RE_LEGACY_RETURN = /Return date:\s*(\d{2})-(\d{2})-(\d{4}),?\s*(\d{1,2}):(\d{2})/i;

function legacyPrice(ev: CalEvent): number | null {
  const total = ev.description.match(RE_LEGACY_TOTAL);
  if (!total) return null;
  const ret = ev.description.match(RE_LEGACY_RETURN);
  if (ret && `${ret[3]}-${ret[2]}-${ret[1]}T${ret[4].padStart(2, '0')}:${ret[5]}` === ev.start) return 0;
  return parseAmount(total[1]);
}

// Fahrt ohne beschrifteten Preis: irgendein Betrag mit €/EUR/Euro in Titel, Ort oder Beschreibung
// („Fr. Wild … 112,50€“). Mehrere Beträge → der größte (meist der Gesamtpreis). Nur für Termine,
// die schon als Fahrt erkannt sind — eine Notiz wie „Werkstatt 80 €“ wird dadurch keine Fahrt.
const AMT = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,5}(?:[.,]\d{1,2})?)`;
const RE_EURO_ANY = new RegExp(String.raw`(?:€|\bEUR\b|\bEuro\b)\s*${AMT}(?![\d.,]*\d)|${AMT}\s*(?:€|\bEUR\b|\bEuro\b)`, 'gi');
export function looseEuroPrice(ev: Pick<CalEvent, 'summary' | 'location' | 'description'>): number | null {
  const text = [ev.summary, ev.location, ev.description].filter(Boolean).join('\n');
  const vals = [...text.matchAll(RE_EURO_ANY)]
    .map((m) => parseAmount(m[1] || m[2] || ''))
    .filter((v): v is number => v != null && v >= 5 && v <= 10000);
  return vals.length ? Math.max(...vals) : null;
}

const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);

function wallMinutes(s: string): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, h, mi) / 60000;
}

// "Mariahilfstraße 6, 81541 München" → "mariahilfstr6". Airports give null — every
// second ride goes there, so they say nothing about being the same ride.
function streetKey(addr: string | null | undefined): string | null {
  if (!addr || RE_AIRPORT.test(addr)) return null;
  const first = addr.split(',')[0].toLowerCase()
    .replace(/stra(ß|ss)e|str\./g, 'str')
    .replace(/[^\p{L}\p{N}]/gu, '');
  return first.length >= 5 ? first : null;
}

export async function calendarId(): Promise<string | null> {
  if (!hasServiceAccount()) return null;
  const [row] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = 'google_calendar_id'`);
  return row?.setting_value || null;
}

export async function loadBookingRefs(): Promise<BookingRef[]> {
  return query<BookingRef>(`
    SELECT id, booking_number, name, price, status, trip_type, pickup_datetime, return_datetime,
           pickup_address, dropoff_address, return_pickup_address, return_dropoff_address, calendar_event_uid, duration_minutes
      FROM bookings`);
}

export function classifyEvents(events: CalEvent[], bookings: BookingRef[]): ClassifiedEvent[] {
  const byNumber = new Map(bookings.map((b) => [b.booking_number, b]));
  const byUid = new Map(bookings.filter((b) => b.calendar_event_uid).map((b) => [b.calendar_event_uid!, b]));
  // Booking legs per day, for spotting calendar copies that carry no booking number.
  const legsByDay = new Map<string, Array<{ b: BookingRef; min: number; keys: string[] }>>();
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const legs: Array<[string | null, string | null, string | null]> = [[wall(b.pickup_datetime), b.pickup_address, b.dropoff_address]];
    if (b.trip_type === 'roundtrip' && b.return_datetime) legs.push([wall(b.return_datetime), returnLeg(b).from, returnLeg(b).to]);
    for (const [t, from, to] of legs) {
      if (!t) continue;
      const keys = [streetKey(from), streetKey(to)].filter((k): k is string => !!k);
      const day = t.slice(0, 10);
      if (!legsByDay.has(day)) legsByDay.set(day, []);
      legsByDay.get(day)!.push({ b, min: wallMinutes(t), keys });
    }
  }

  return events.filter((e) => e.start).map((event) => {
    const markers = `${event.summary}\n${event.location}`;
    const p = parseInvoiceRide(event, [], []);
    const base = {
      event,
      price: p.price ?? legacyPrice(event),
      from: p.pickup_address,
      to: p.dropoff_address,
      via: p.via,
      guest: p.guest_name ? p.guest_name.replace(/^name\s*:\s*/i, '') : null,
    };
    const imported = byUid.get(event.uid);
    if (imported) return { ...base, kind: 'imported' as const, booking: imported };
    const ref = (`${markers}\n${event.description}`.match(RE_BOOKING_NO) || []).map((n) => byNumber.get(n)).find(Boolean);
    if (ref) return { ...base, kind: 'booking' as const, booking: ref };
    if (RE_CAL_CANCELLED.test(markers)) return { ...base, kind: 'cancelled' as const, booking: null };

    const start = wallMinutes(event.start!);
    const keys = [streetKey(p.pickup_address), streetKey(p.dropoff_address), streetKey(event.summary)].filter((k): k is string => !!k);
    const twin = keys.length
      ? (legsByDay.get(event.start!.slice(0, 10)) || []).find((l) =>
          Math.abs(l.min - start) <= DUPLICATE_WINDOW_MIN && l.keys.some((k) => keys.some((e) => e === k || e.startsWith(k) || k.startsWith(e))))
      : undefined;
    if (twin) return { ...base, kind: 'duplicate' as const, booking: twin.b };
    // No price and no route at all — or a workshop-style title without a destination — is an
    // appointment or a note, not a ride. A priced entry always stays a ride.
    if (base.price == null && ((!base.from && !base.to) || (!base.to && RE_NOT_A_RIDE.test(event.summary)))) {
      return { ...base, kind: 'other' as const, booking: null };
    }
    return { ...base, price: base.price ?? looseEuroPrice(event), kind: 'ride' as const, booking: null };
  });
}

// ---- Live window (dashboard) ---------------------------------------------------------
// The dashboard reads the next days straight from Google so edits show within minutes;
// shared cache so the schedule and the widgets don't each call the API.

const WINDOW_CACHE_MS = 5 * 60_000;
const windowCache = new Map<string, { at: number; events: CalEvent[] }>();

export async function calendarEventsCached(from: string, to: string): Promise<CalEvent[] | null> {
  const id = await calendarId();
  if (!id) return null;
  const key = `${id}|${from}|${to}`;
  const hit = windowCache.get(key);
  if (hit && Date.now() - hit.at < WINDOW_CACHE_MS) return hit.events;
  const { events } = await fetchEventsRange(id, from, to);
  if (windowCache.size > 20) windowCache.clear();
  windowCache.set(key, { at: Date.now(), events });
  return events;
}

// ---- Mirror table --------------------------------------------------------------------

let syncing = false;
let lastSync: { at: string; from: string; to: string; events: number; rides: number; error: string | null } | null = null;

export function calendarSyncStatus() {
  return lastSync;
}

/** Re-reads [from, to] (Berlin dates, inclusive) from Google and replaces those rows. */
export async function syncCalendarRides(from: string, to: string, kmBudget = 40): Promise<{ events: number; rides: number } | null> {
  const id = await calendarId();
  if (!id || syncing) return null;
  syncing = true;
  try {
    const [{ events }, bookings] = await Promise.all([fetchEventsRange(id, from, to), loadBookingRefs()]);
    const rows = classifyEvents(events, bookings);
    // Fahrten ohne Preis: mit dem Website-Tarif schätzen (calendarPriceEstimate.ts) — als „geschätzt“ markiert
    const unpriced = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === 'ride' && r.price == null);
    const estimates = new Map<number, number>();
    try {
      const est = await estimateCalendarPrices(unpriced.map(({ r }) => ({ from: r.from, to: r.to, summary: r.event.summary, location: r.event.location })), { left: kmBudget });
      est.forEach((v, k) => estimates.set(unpriced[k].i, v));
    } catch (e: any) { console.error('[calendarRides] estimate failed:', e?.message || e); }
    await run(`DELETE FROM calendar_rides WHERE ride_time BETWEEN ? AND ?`, [`${from}T00:00`, `${to}T23:59`]);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await run(
        `INSERT INTO calendar_rides (uid, ride_time, kind, booking_id, price, price_estimated, pickup_address, dropoff_address, summary, location, entered_at, guest_name, synced_at)
         VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ')}
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), booking_id = VALUES(booking_id), price = VALUES(price), price_estimated = VALUES(price_estimated),
           pickup_address = VALUES(pickup_address), dropoff_address = VALUES(dropoff_address),
           summary = VALUES(summary), location = VALUES(location), entered_at = VALUES(entered_at),
           guest_name = VALUES(guest_name), synced_at = NOW()`,
        chunk.flatMap((r, j) => [
          r.event.uid.slice(0, 255), r.event.start!, r.kind, r.booking?.id ?? null,
          r.price ?? estimates.get(i + j) ?? null, r.price == null && estimates.has(i + j) ? 1 : 0,
          r.from, r.to, r.event.summary.slice(0, 500), r.event.location.slice(0, 500), r.event.created ?? null,
          (r.guest || salutationGuest(r.event.description))?.slice(0, 190) ?? null,
        ]),
      );
    }
    const rides = rows.filter((r) => r.kind === 'ride').length;
    lastSync = { at: new Date().toISOString(), from, to, events: events.length, rides, error: null };
    return { events: events.length, rides };
  } catch (e: any) {
    lastSync = { at: new Date().toISOString(), from, to, events: 0, rides: 0, error: e?.message || String(e) };
    console.error('[calendarRides] sync failed:', e?.message || e);
    return null;
  } finally {
    syncing = false;
  }
}

export const syncRecent = () => syncCalendarRides(berlinDateSql(-RECENT_BACK_DAYS), berlinDateSql(AHEAD_DAYS));
export const syncAll = () => syncCalendarRides(HISTORY_START, berlinDateSql(AHEAD_DAYS), 300);

export function startCalendarRidesJob(): void {
  // First run: fill the whole history once, otherwise just catch up on the recent window.
  setTimeout(async () => {
    if (!(await calendarId())) return;
    const [row] = await query<{ n: number; missing: number }>(
      `SELECT COUNT(*) AS n, SUM(entered_at IS NULL) AS missing FROM calendar_rides`);
    // Whole history once more when rows still lack their entry time (column was added later).
    await (Number(row?.n) > 0 && !Number(row?.missing) ? syncRecent() : syncAll());
  }, 20_000);
  cron.schedule('*/15 * * * *', () => { syncRecent(); });
  // Nightly full pass picks up edits to older events (prices added later, cancellations).
  cron.schedule('40 3 * * *', () => { syncAll(); }, { timezone: 'Europe/Berlin' });
}
