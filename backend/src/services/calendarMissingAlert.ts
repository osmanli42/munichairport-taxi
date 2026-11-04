// Hourly reminder for bookings nobody has copied into the operator's Google Calendar yet. The
// calendar is what the drivers plan from, so a booking missing there is a ride nobody drives.
// One mail to the admin and the partner, every full hour until the entry exists; no mail when
// nothing is missing. Switched in System → E-posta Uyarıları (category calendar_missing).
//
// A leg counts when it is still ahead and the booking is active: 'new' / 'confirmed', or a
// round trip whose outbound leg auto-completed the booking while the return is still to come.
// It stops by itself once the entry exists, the booking is cancelled or the ride has passed.
//
// Read-only towards Google. If the calendar can't be read nothing is sent — otherwise an outage
// would report every single booking as missing.

import cron from 'node-cron';
import { Resend } from 'resend';
import { query, run } from '../db';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';
import { returnLeg } from '../utils/returnLeg';
import { getAlertConfig, claimCooldown, setStateValue, getStateValue, CalendarMissingQuiet } from './alertCenter';
import { fetchEventsRange, CalEvent } from './calendarInvoice';
import { calendarId, classifyEvents, loadBookingRefs, BookingRef } from './calendarRides';

// A fresh booking gets this long to be entered by hand before it is reported.
const GRACE_MIN = 30;
// An entry without the booking number, recognised by name / phone / flight near the leg's time.
const SOFT_MATCH_WINDOW_MIN = 90;
const RE_BOOKING_NO = /\b[A-Z]{3}\d{6}-\d{4}\b/g;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const IGNORE_PREFIX = 'calendar_missing:ignored:';

export type MissingBooking = BookingRef & {
  phone: string | null;
  flight_number: string | null;
  return_flight_number: string | null;
  fresh?: number | boolean;
};

export interface MissingLeg {
  booking_id: number;
  booking_number: string;
  name: string;
  phone: string | null;
  price: number;
  status: string;
  leg: 'outbound' | 'return';
  roundtrip: boolean;
  time: string;
  from: string | null;
  to: string | null;
  ignored: boolean;
}

const live = () => !!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);
const ignoreKey = (id: number, time: string) => `${IGNORE_PREFIX}${id}:${time}`;

function wallMinutes(s: string): number {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, h, mi) / 60000;
}

/** 'YYYY-MM-DD' → 'Di 07.10.2026' */
function dayLabel(date: string): string {
  const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`)).replace('.', '');
  return `${wd} ${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss');
const eventText = (ev: CalEvent) => `${ev.summary}\n${ev.location}\n${ev.description}`;

// The same person's entry without the number: the surname, the phone's last digits
// or the flight number. Only ever checked close to the leg's time on the same day.
function softMatch(b: MissingBooking, leg: 'outbound' | 'return', text: string): boolean {
  const folded = fold(text);
  // Without the first name: "Anna" alone says little, the surname does.
  const parts = fold(b.name || '').split(/[^\p{L}]+/u).filter(Boolean);
  if ((parts.length > 1 ? parts.slice(1) : parts).some((n) => n.length >= 4 && folded.includes(n))) return true;
  const phone = String(b.phone || '').replace(/\D/g, '');
  if (phone.length >= 7 && text.replace(/\D/g, '').includes(phone.slice(-7))) return true;
  const flight = String((leg === 'return' ? b.return_flight_number : b.flight_number) || '').replace(/\s/g, '').toLowerCase();
  return flight.length >= 4 && folded.replace(/\s/g, '').includes(flight);
}

/**
 * Which legs still ahead of `now` have no calendar entry. Every leg (past ones too) claims one
 * entry, so the outbound entry of a round trip never passes as its return:
 *   1. an entry linked to the booking on the leg's day — by number or by classifyEvents' twin check
 *   2. an entry without any link, same day and close by, that names the customer
 *   3. an entry with the booking's number on another day — a ride moved in the calendar
 */
export function findMissingLegs(
  events: CalEvent[], bookings: MissingBooking[], now: string, ignored: Set<string> = new Set(),
): MissingLeg[] {
  const byNumber = new Map(bookings.map((b) => [b.booking_number, b]));
  const linked = new Map<number, CalEvent[]>();
  const unlinked: CalEvent[] = [];
  for (const c of classifyEvents(events, bookings)) {
    const ids = new Set<number>(c.booking ? [c.booking.id] : []);
    for (const n of eventText(c.event).match(RE_BOOKING_NO) || []) {
      const b = byNumber.get(n);
      if (b) ids.add(b.id);
    }
    if (!ids.size) unlinked.push(c.event);
    for (const id of ids) {
      if (!linked.has(id)) linked.set(id, []);
      linked.get(id)!.push(c.event);
    }
  }

  const usedSoft = new Set<string>();
  const out: MissingLeg[] = [];
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const roundtrip = b.trip_type === 'roundtrip' && !!b.return_datetime;
    const legs: Array<{ leg: 'outbound' | 'return'; time: string; from: string | null; to: string | null }> = [
      { leg: 'outbound', time: wall(b.pickup_datetime), from: b.pickup_address, to: b.dropoff_address },
    ];
    if (roundtrip) {
      const r = returnLeg(b);
      legs.push({ leg: 'return', time: wall(b.return_datetime), from: r.from || null, to: r.to || null });
    }

    const own = [...(linked.get(b.id) || [])];
    const take = (ev: CalEvent) => { own.splice(own.indexOf(ev), 1); };
    const open = legs.filter((l) => {
      const hit = own.find((ev) => ev.start!.slice(0, 10) === l.time.slice(0, 10));
      if (hit) take(hit);
      return !hit;
    }).filter((l) => {
      const min = wallMinutes(l.time);
      const hit = unlinked.find((ev) => !usedSoft.has(ev.uid)
        && ev.start!.slice(0, 10) === l.time.slice(0, 10)
        && Math.abs(wallMinutes(ev.start!) - min) <= SOFT_MATCH_WINDOW_MIN
        && softMatch(b, l.leg, eventText(ev)));
      if (hit) usedSoft.add(hit.uid);
      return !hit;
    }).filter((l) => {
      const hit = own[0];
      if (hit) take(hit);
      return !hit;
    });

    for (const l of open) {
      if (l.time < now || b.fresh) continue;
      const active = b.status === 'new' || b.status === 'confirmed'
        || (b.status === 'completed' && l.leg === 'return' && wall(b.pickup_datetime) < now);
      if (!active) continue;
      out.push({
        booking_id: b.id, booking_number: b.booking_number, name: b.name, phone: b.phone,
        price: Number(b.price) || 0, status: b.status, leg: l.leg, roundtrip,
        time: l.time, from: l.from, to: l.to, ignored: ignored.has(ignoreKey(b.id, l.time)),
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export function missingMail(legs: MissingLeg[]): { subject: string; html: string } {
  const first = legs[0];
  const rows = legs.map((l) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;white-space:nowrap">
        <div style="color:#555;font-size:12px">${esc(dayLabel(l.time.slice(0, 10)))}</div>
        <div style="font-weight:bold;font-size:18px">${esc(l.time.slice(11, 16))}</div>
        ${l.roundtrip ? `<div style="color:#b45309;font-size:11px;margin-top:2px">${l.leg === 'return' ? 'Rückfahrt' : 'Hinfahrt'}</div>` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top">
        <div style="font-weight:bold">${esc(l.name)}</div>
        ${l.phone ? `<div style="font-size:13px;color:#555;margin-top:2px">${esc(l.phone)}</div>` : ''}
        ${l.from || l.to ? `<div style="font-size:13px;color:#333;margin-top:3px">${esc(l.from || '?')} → ${esc(l.to || '?')}</div>` : ''}
        <div style="font-size:12px;color:#888;margin-top:3px;font-family:monospace">${esc(l.booking_number)}</div>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;font-weight:bold;font-size:16px;white-space:nowrap">${eur(l.price)}${l.roundtrip ? '<div style="color:#888;font-size:11px;font-weight:normal">gesamt</div>' : ''}</td>
    </tr>`).join('');
  return {
    subject: `⚠️ ${legs.length === 1 ? '1 Fahrt' : `${legs.length} Fahrten`} nicht im Kalender · nächste: ${dayLabel(first.time.slice(0, 10))} ${first.time.slice(11, 16)}`.slice(0, 200),
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb">
        <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #dc2626">
          <h1 style="margin:0 0 8px;font-size:18px;color:#111">Nicht im Google Kalender eingetragen</h1>
          <p style="margin:0 0 16px;color:#555;font-size:14px">Diese Fahrten sind gebucht, stehen aber noch nicht im Kalender. Bitte eintragen, am besten mit der Buchungsnummer im Termin:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
          <p style="margin:16px 0 0"><a href="https://flughafen-muenchen.taxi/admin" style="background:#1a365d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Admin öffnen</a></p>
          <p style="margin:16px 0 0;color:#888;font-size:12px">Kommt jede volle Stunde, bis die Fahrt im Kalender steht. Abschaltbar: Admin → System → E-posta Uyarıları → „Takvime eklenmemiş fahrt“.</p>
        </div>
      </div>`,
  };
}

export function recipients(extra: string): string[] {
  const seen = new Set<string>();
  return [ADMIN_EMAIL, ...extra.split(',')].map((e) => e.trim()).filter((e) => {
    const k = e.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function loadIgnored(): Promise<Set<string>> {
  const rows = await query<{ state_key: string }>(`SELECT state_key FROM alert_state WHERE state_key LIKE ?`, [`${IGNORE_PREFIX}%`]);
  return new Set(rows.map((r) => r.state_key));
}

/** Current state, read fresh from Google. null = no calendar connected. Throws if Google fails. */
export async function currentMissing(): Promise<MissingLeg[] | null> {
  const id = await calendarId();
  if (!id) return null;
  const now = berlinNowSql().replace(' ', 'T').slice(0, 16);
  const [refs, extra, ignored] = await Promise.all([
    loadBookingRefs(),
    query<{ id: number; phone: string | null; flight_number: string | null; return_flight_number: string | null; fresh: number }>(
      `SELECT id, phone, flight_number, return_flight_number, created_at > NOW() - INTERVAL ? MINUTE AS fresh
         FROM bookings WHERE status <> 'cancelled' AND (pickup_datetime >= ? OR return_datetime >= ?)`,
      [GRACE_MIN, `${berlinDateSql(-2)}T00:00`, `${berlinDateSql(-2)}T00:00`]),
    loadIgnored(),
  ]);
  const extraById = new Map(extra.map((e) => [e.id, e]));
  const bookings: MissingBooking[] = refs.map((b) => {
    const e = extraById.get(b.id);
    return { ...b, phone: e?.phone ?? null, flight_number: e?.flight_number ?? null, return_flight_number: e?.return_flight_number ?? null, fresh: e?.fresh };
  });
  const relevant = bookings.filter((b) => extraById.has(b.id));
  const lastDay = relevant.reduce((max, b) => {
    const d = (b.return_datetime && wall(b.return_datetime) > wall(b.pickup_datetime) ? wall(b.return_datetime) : wall(b.pickup_datetime)).slice(0, 10);
    return d > max ? d : max;
  }, berlinDateSql(1));
  const { events } = await fetchEventsRange(id, berlinDateSql(-2), lastDay);
  // No entries at all is an unreadable or wrong calendar, never a real state of this business.
  if (!events.length) throw new Error('Kalender liefert keine Termine');
  const legs = findMissingLegs(events, bookings, now, ignored);
  // An ignored leg whose time has passed has done its job.
  for (const key of ignored) {
    const m = key.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/);
    if (m && m[1] < now) await run(`DELETE FROM alert_state WHERE state_key = ?`, [key]).catch(() => {});
  }
  return legs;
}

export function inQuietHours(quiet: CalendarMissingQuiet, hhmm: string): boolean {
  if (quiet === 'off') return false;
  const [start, end] = quiet.split('-');
  return start > end ? hhmm >= start || hhmm < end : hhmm >= start && hhmm < end;
}

async function send(mail: { subject: string; html: string }, to: string[]): Promise<boolean> {
  try {
    const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Munich Airport Taxi <${FROM_EMAIL}>`, to, subject: mail.subject, html: mail.html,
    });
    if ((r as any)?.error) throw new Error((r as any).error.message || 'resend error');
    return true;
  } catch (e: any) {
    console.error('[calendarMissingAlert] mail failed:', e?.message || e);
    return false;
  }
}

let checking = false;

async function check(): Promise<void> {
  if (!live() || checking) return;
  checking = true;
  try {
    const cfg = await getAlertConfig();
    if (!cfg.enabled || !cfg.categories.calendar_missing) return;
    if (inQuietHours(cfg.calendar_missing_quiet, berlinNowSql().slice(11, 16))) return;
    if (!(await claimCooldown('calendar_missing_hourly', 50 * 60))) return;

    const at = new Date().toISOString();
    let legs: MissingLeg[] | null;
    try {
      legs = await currentMissing();
    } catch (e: any) {
      console.error('[calendarMissingAlert] calendar read failed:', e?.message || e);
      await setStateValue('calendar_missing:last', JSON.stringify({ at, error: String(e?.message || e).slice(0, 200) }));
      return;
    }
    if (!legs) return;
    const open = legs.filter((l) => !l.ignored);
    const sent = open.length ? await send(missingMail(open), recipients(cfg.calendar_missing_emails)) : false;
    await setStateValue('calendar_missing:last', JSON.stringify({ at, count: open.length, sent, error: open.length && !sent ? 'mail failed' : null }));
  } catch (e: any) {
    console.error('[calendarMissingAlert] check failed:', e?.message || e);
  } finally {
    checking = false;
  }
}

/** For the System tab: what is missing right now and what the mail would look like. Nothing is sent. */
export async function calendarMissingStatus() {
  const legs = await currentMissing();
  if (!legs) return null;
  const open = legs.filter((l) => !l.ignored);
  const cfg = await getAlertConfig();
  const last = await getStateValue('calendar_missing:last');
  return {
    legs,
    recipients: recipients(cfg.calendar_missing_emails),
    last: last ? JSON.parse(last) : null,
    ...(open.length ? { ...missingMail(open), empty: false } : { subject: '', html: '', empty: true }),
  };
}

/** Leave a leg out of the mail (it really isn't going into the calendar), or take it back in. */
export async function setLegIgnored(bookingId: number, time: string, ignored: boolean): Promise<void> {
  const key = ignoreKey(bookingId, wall(time));
  if (ignored) await setStateValue(key, '1');
  else await run(`DELETE FROM alert_state WHERE state_key = ?`, [key]);
}

export function startCalendarMissingAlertJob(): void {
  cron.schedule('0 * * * *', () => { check().catch(() => {}); }, { timezone: 'Europe/Berlin' });
}
