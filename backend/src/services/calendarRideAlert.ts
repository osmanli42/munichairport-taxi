// E-mail when a ride is entered in the operator's Google Calendar (phone orders, partners,
// Get-e …). Web bookings already send their own mails and are left out — the same split as
// the dashboard's "Kalender-Fahrt" rows (calendarRides.classifyEvents).
//
// Two modes, chosen in System → E-posta Uyarıları (category calendar_new):
//   instant  one mail within ~5–10 minutes of the entry
//   daily    the entries are collected and sent together once a day at the chosen time
//
// Read-only towards Google. Seen events are kept in calendar_ride_alerts so restarts and
// deploys never announce the same ride twice; on the very first run everything already in
// the calendar is only recorded, not mailed. Each ride is stored with a snapshot of what the
// mail shows, so the daily mail still lists a ride that has already happened by then.

import cron from 'node-cron';
import { Resend } from 'resend';
import { query, run } from '../db';
import { berlinDateSql, berlinNowSql } from '../utils/berlinTime';
import { getAlertConfig, claimCooldown, getStateValue, setStateValue } from './alertCenter';
import { calendarEventsCached, classifyEvents, loadBookingRefs, ClassifiedEvent } from './calendarRides';

const AHEAD_DAYS = 60;
// A daily mail that missed its time (deploy, restart) still goes out within this window.
const DAILY_LATE_MIN = 180;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;

type RideSnap = {
  start: string; summary: string; from: string | null; to: string | null; via: string[];
  guest: string | null; price: number | null; note: string; link: string | null; seen?: string;
};

const live = () => !!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const toMin = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

/** 'YYYY-MM-DD' → 'Di 07.10.2026' */
function dayLabel(date: string): string {
  const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`)).replace('.', '');
  return `${wd} ${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

function snap(c: ClassifiedEvent): RideSnap {
  const note = c.event.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    start: c.event.start!, summary: c.event.summary.trim() || 'Kalender-Fahrt',
    from: c.from || (c.to ? null : c.event.location.trim() || null), to: c.to, via: c.via,
    guest: c.guest, price: c.price, note: note.length > 400 ? `${note.slice(0, 400)}…` : note, link: c.event.htmlLink,
  };
}

function rideRows(rides: RideSnap[]): string {
  return rides.map((r) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;white-space:nowrap">
        <div style="color:#555;font-size:12px">${esc(dayLabel(r.start.slice(0, 10)))}</div>
        <div style="font-weight:bold;font-size:18px">${esc(r.start.slice(11, 16))}</div>
        ${r.seen ? `<div style="color:#999;font-size:11px;margin-top:2px">eingetragen ${esc(r.seen)}</div>` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top">
        <div style="font-weight:bold">${esc(r.summary)}</div>
        ${r.from || r.to ? `<div style="font-size:13px;color:#333;margin-top:3px">${esc(r.from || '?')} → ${esc(r.to || '?')}</div>` : ''}
        ${r.via.length ? `<div style="font-size:12px;color:#888">über ${r.via.map(esc).join(', ')}</div>` : ''}
        ${r.guest ? `<div style="font-size:13px;color:#555;margin-top:2px">Fahrgast: ${esc(r.guest)}</div>` : ''}
        ${r.note ? `<div style="font-size:12px;color:#888;margin-top:4px">${esc(r.note)}</div>` : ''}
        ${r.link ? `<div style="margin-top:4px"><a href="${esc(r.link)}" style="font-size:12px;color:#1a365d">Im Kalender öffnen</a></div>` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;font-weight:bold;font-size:16px;white-space:nowrap">${r.price ? eur(r.price) : '—'}</td>
    </tr>`).join('');
}

export function rideMail(rides: RideSnap[], daily: boolean): { subject: string; html: string } {
  const total = rides.reduce((s, r) => s + (r.price || 0), 0);
  const first = rides[0];
  const subject = rides.length === 1 && !daily
    ? `📅 Neue Kalender-Fahrt: ${dayLabel(first.start.slice(0, 10))} ${first.start.slice(11, 16)}${first.price ? ` · ${eur(first.price)}` : ''}${first.from || first.to ? ` · ${first.from || '?'} → ${first.to || '?'}` : ''}`
    : `📅 ${rides.length} neue Kalender-Fahrt${rides.length === 1 ? '' : 'en'}${daily ? ' (Tagesübersicht)' : ''}${total ? ` · ${eur(total)}` : ''}`;
  const title = daily ? 'Neu im Google Kalender eingetragen' : rides.length === 1 ? 'Neue Fahrt im Google Kalender' : `${rides.length} neue Fahrten im Google Kalender`;
  const intro = daily
    ? `Seit der letzten Übersicht ${rides.length === 1 ? 'wurde 1 Fahrt' : `wurden ${rides.length} Fahrten`} im Kalender eingetragen (ohne Web-Buchungen)${total ? `, zusammen ${eur(total)}` : ''}:`
    : 'Gerade im Kalender eingetragen (keine Web-Buchung):';
  return {
    subject: subject.slice(0, 200),
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb">
        <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #0d9488">
          <h1 style="margin:0 0 8px;font-size:18px;color:#111">${title}</h1>
          <p style="margin:0 0 16px;color:#555;font-size:14px">${intro}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">${rideRows(rides)}</table>
          <p style="margin:16px 0 0"><a href="https://flughafen-muenchen.taxi/admin" style="background:#1a365d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Dashboard öffnen</a></p>
          <p style="margin:16px 0 0;color:#888;font-size:12px">Sofort oder einmal täglich, Uhrzeit einstellbar, abschaltbar: Admin → System → E-posta Uyarıları → „Yeni Kalender-Fahrt“.</p>
        </div>
      </div>`,
  };
}

async function send(mail: { subject: string; html: string }): Promise<boolean> {
  try {
    const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: `Munich Airport Taxi <${FROM_EMAIL}>`, to: ADMIN_EMAIL, subject: mail.subject, html: mail.html,
    });
    if ((r as any)?.error) throw new Error((r as any).error.message || 'resend error');
    return true;
  } catch (e: any) {
    console.error('[calendarRideAlert] mail failed:', e?.message || e);
    return false;
  }
}

async function pendingRides(): Promise<Array<{ uid: string } & RideSnap>> {
  const rows = await query<{ uid: string; snapshot: string }>(
    `SELECT uid, snapshot FROM calendar_ride_alerts WHERE pending = 1 ORDER BY seen_at`);
  return rows.flatMap((r) => {
    try { return [{ uid: r.uid, ...(JSON.parse(r.snapshot) as RideSnap) }]; } catch { return []; }
  });
}

async function sendPending(daily: boolean): Promise<void> {
  const rides = await pendingRides();
  if (!rides.length) return;
  const sorted = daily ? rides : [...rides].sort((a, b) => a.start.localeCompare(b.start)).map((r) => ({ ...r, seen: undefined }));
  if (!(await send(rideMail(sorted, daily)))) return;   // stays pending, retried next run
  await run(`UPDATE calendar_ride_alerts SET pending = 0 WHERE uid IN (${rides.map(() => '?').join(', ')})`, rides.map((r) => r.uid));
}

let checking = false;

async function check(): Promise<void> {
  if (!live() || checking) return;
  checking = true;
  try {
    const cfg = await getAlertConfig();
    const on = cfg.enabled && cfg.categories.calendar_new;

    const events = await calendarEventsCached(berlinDateSql(0), berlinDateSql(AHEAD_DAYS));
    if (events) {
      const classified = classifyEvents(events, await loadBookingRefs());
      const known = new Set((await query<{ uid: string }>('SELECT uid FROM calendar_ride_alerts')).map((r) => r.uid));
      // Every event is recorded, not only rides: a hand-copied web booking that later loses
      // its match (booking cancelled) must not turn up as a "new" ride.
      const fresh = classified.filter((c) => c.event.start && !known.has(c.event.uid.slice(0, 255)));
      if (fresh.length) {
        const baseline = await getStateValue('calendar_new:baseline');
        const now = berlinNowSql().replace(' ', 'T').slice(0, 16);
        const seenAt = `${now.slice(8, 10)}.${now.slice(5, 7)}. ${now.slice(11, 16)}`;   // shown in the daily mail
        const announce = (c: ClassifiedEvent) => !!baseline && on && c.kind === 'ride' && c.event.start! >= now;
        for (let i = 0; i < fresh.length; i += 200) {
          const chunk = fresh.slice(i, i + 200);
          await run(
            `INSERT IGNORE INTO calendar_ride_alerts (uid, ride_time, pending, snapshot) VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')}`,
            chunk.flatMap((c) => {
              const yes = announce(c);
              return [c.event.uid.slice(0, 255), c.event.start!, yes ? 1 : 0, yes ? JSON.stringify({ ...snap(c), seen: seenAt }) : null];
            }),
          );
        }
        if (!baseline) await setStateValue('calendar_new:baseline', new Date().toISOString());
      }
    }

    if (!on) return;
    if (cfg.calendar_new_mode === 'instant') {
      await sendPending(false);
      return;
    }
    const late = toMin(berlinNowSql().slice(11, 16)) - toMin(cfg.calendar_new_time);
    if (late < 0 || late > DAILY_LATE_MIN) return;
    if (!(await pendingRides()).length) return;
    // Once per day: the cooldown key carries the date, so a restart within the window does
    // not send twice.
    if (!(await claimCooldown(`calendar_new_daily:${berlinDateSql(0)}`, 20 * 3600))) return;
    await sendPending(true);
  } catch (e: any) {
    console.error('[calendarRideAlert] check failed:', e?.message || e);
  } finally {
    checking = false;
  }
}

/** The mail with real calendar data (the next rides), for the preview in the System tab. */
export async function calendarAlertPreview(): Promise<{ subject: string; html: string; empty: boolean } | null> {
  const cfg = await getAlertConfig();
  const events = await calendarEventsCached(berlinDateSql(0), berlinDateSql(AHEAD_DAYS));
  if (!events) return null;
  const now = berlinNowSql().replace(' ', 'T').slice(0, 16);
  const rides = classifyEvents(events, await loadBookingRefs())
    .filter((c) => c.kind === 'ride' && c.event.start! >= now)
    .sort((a, b) => a.event.start!.localeCompare(b.event.start!))
    .slice(0, cfg.calendar_new_mode === 'daily' ? 4 : 1)
    .map(snap);
  if (!rides.length) return { subject: '', html: '', empty: true };
  return { ...rideMail(rides, cfg.calendar_new_mode === 'daily'), empty: false };
}

export function startCalendarRideAlertJob(): void {
  cron.schedule('*/5 * * * *', () => { check().catch(() => {}); }, { timezone: 'Europe/Berlin' });
  // Rows of past rides are no use any more — unless still waiting for the daily mail.
  cron.schedule('50 3 * * *', () => {
    run(`DELETE FROM calendar_ride_alerts WHERE pending = 0 AND ride_time < ?`, [`${berlinDateSql(-3)}T00:00`]).catch(() => {});
  }, { timezone: 'Europe/Berlin' });
}
