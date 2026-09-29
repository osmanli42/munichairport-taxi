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
import { fetchEventsRange, parseInvoiceRide, parseAmount, CalEvent } from './calendarInvoice';
import { hasServiceAccount } from './calendarImport';

export type CalendarKind = 'ride' | 'booking' | 'imported' | 'duplicate' | 'cancelled';

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
  calendar_event_uid: string | null;
}

// Earliest events in the calendar are from January 2023.
const HISTORY_START = '2023-01-01';
const RECENT_BACK_DAYS = 40;
const AHEAD_DAYS = 60;
// A hand-copied web booking sits at the same time (± a little) with the same address.
const DUPLICATE_WINDOW_MIN = 30;

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
           pickup_address, dropoff_address, calendar_event_uid
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
    if (b.trip_type === 'roundtrip' && b.return_datetime) legs.push([wall(b.return_datetime), b.dropoff_address, b.pickup_address]);
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
    return { ...base, kind: 'ride' as const, booking: null };
  });
}

// ---- Mirror table --------------------------------------------------------------------

let syncing = false;
let lastSync: { at: string; from: string; to: string; events: number; rides: number; error: string | null } | null = null;

export function calendarSyncStatus() {
  return lastSync;
}

/** Re-reads [from, to] (Berlin dates, inclusive) from Google and replaces those rows. */
export async function syncCalendarRides(from: string, to: string): Promise<{ events: number; rides: number } | null> {
  const id = await calendarId();
  if (!id || syncing) return null;
  syncing = true;
  try {
    const [{ events }, bookings] = await Promise.all([fetchEventsRange(id, from, to), loadBookingRefs()]);
    const rows = classifyEvents(events, bookings);
    await run(`DELETE FROM calendar_rides WHERE ride_time BETWEEN ? AND ?`, [`${from}T00:00`, `${to}T23:59`]);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      await run(
        `INSERT INTO calendar_rides (uid, ride_time, kind, booking_id, price, pickup_address, dropoff_address, summary, location, synced_at)
         VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ')}
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), booking_id = VALUES(booking_id), price = VALUES(price),
           pickup_address = VALUES(pickup_address), dropoff_address = VALUES(dropoff_address),
           summary = VALUES(summary), location = VALUES(location), synced_at = NOW()`,
        chunk.flatMap((r) => [
          r.event.uid.slice(0, 255), r.event.start!, r.kind, r.booking?.id ?? null, r.price,
          r.from, r.to, r.event.summary.slice(0, 500), r.event.location.slice(0, 500),
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
export const syncAll = () => syncCalendarRides(HISTORY_START, berlinDateSql(AHEAD_DAYS));

export function startCalendarRidesJob(): void {
  // First run: fill the whole history once, otherwise just catch up on the recent window.
  setTimeout(async () => {
    if (!(await calendarId())) return;
    const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM calendar_rides`);
    await (Number(row?.n) > 0 ? syncRecent() : syncAll());
  }, 20_000);
  cron.schedule('*/15 * * * *', () => { syncRecent(); });
  // Nightly full pass picks up edits to older events (prices added later, cancellations).
  cron.schedule('40 3 * * *', () => { syncAll(); }, { timezone: 'Europe/Berlin' });
}
