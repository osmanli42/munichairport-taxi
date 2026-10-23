// Admin dashboard data in one request, all in Berlin time.
//
// pickup_datetime / return_datetime are Berlin wall-clock strings ('YYYY-MM-DDTHH:mm:ss'),
// while created_at is a UTC DATETIME and the server clock is UTC. Every calendar boundary
// here is therefore taken from the Berlin clock (utils/berlinTime), never from new Date().

import { monthEndInvoices } from '../services/monthEndInvoices';
import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { marketingReminders } from '../services/marketingCalendar';
import { berlinDateSql, berlinMidnightUtcSql, berlinNowSql } from '../utils/berlinTime';
import { MAX_ATTEMPTS as RECHNUNG_MAX_ATTEMPTS } from '../services/autoRechnungJob';
import { unchargedCards, cardDeadline } from '../services/cardChargeReminder';
import { CalEvent } from '../services/calendarInvoice';
import { calendarId, calendarEventsCached, classifyEvents, loadBookingRefs, RE_CAL_CANCELLED, calendarSyncStatus, syncAll } from '../services/calendarRides';
import { backlinkReminder } from '../services/seo/backlinks';
import { indexReminder } from '../services/seo/indexing';
import { adsReminder } from '../services/ads/coach';

const router = Router();

// What the ride list and the attention panel show. Card data stays out on purpose — the
// detail modal loads the full booking when a row is opened.
const RIDE_COLS = `b.id, b.booking_number, b.status, b.name, b.phone, b.email,
  b.pickup_address, b.dropoff_address, b.zwischenstopp_address, b.pickup_datetime, b.return_datetime,
  b.trip_type, b.vehicle_type, b.passengers, b.luggage_count, b.child_seat, b.fahrrad_count,
  b.flight_number, b.notes, b.price, b.payment_method, b.ueberweisung_paid_at, b.charge_status,
  b.charge_error, b.company_id, c.company_name, b.assigned_driver_id, d.name AS driver_name,
  b.driver_status, b.rechnung_number, b.rechnung_error, b.duration_minutes, b.source`;
const RIDE_FROM = `FROM bookings b
  LEFT JOIN companies c ON c.id = b.company_id
  LEFT JOIN drivers d ON d.id = b.assigned_driver_id`;

// Wall-clock strings come as 'YYYY-MM-DDTHH:mm:ss', older rows sometimes with a space.
// Normalised to 'YYYY-MM-DDTHH:mm' so they sort and compare as plain strings.
const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);
// Same expression in SQL, for comparing against a Berlin 'YYYY-MM-DD HH:mm:ss' bound.
const wallSql = (col: string) => `REPLACE(${col}, 'T', ' ')`;
// When a booking's last leg ends: the Rückfahrt for round trips, else the pickup.
const lastLegSql = `CASE WHEN b.trip_type = 'roundtrip' AND b.return_datetime IS NOT NULL AND b.return_datetime <> ''
  THEN b.return_datetime ELSE b.pickup_datetime END`;

const DAYS_AHEAD = 7;
// Day a calendar ride was taken: Google's "created"; older mirror rows without it fall back to the ride time.
const ENTERED = `COALESCE(NULLIF(entered_at, ''), ride_time)`;
const CHART_DAYS = 14;

// ---- Google Kalender ---------------------------------------------------------------
// The operator's calendar holds every ride: web bookings (with their MAT… number in the
// text) and rides that only exist there (phone, Get-e, partners). The dashboard adds the
// latter to the schedule; the former are already there as bookings. Read-only.



export type CalendarLeg = {
  uid: string;
  leg_time: string;
  summary: string;
  location: string;
  from: string | null;
  to: string | null;
  via: string[];
  guest: string | null;
  price: number | null;
  html_link: string | null;
};

export type CalendarMismatch = {
  id: number;
  booking_number: string;
  name: string;
  price: number;
  booking_time: string;
  calendar_time: string;
  html_link: string | null;
};

async function loadCalendar(from: string, to: string): Promise<{
  enabled: boolean; error: string | null; legs: CalendarLeg[]; mismatches: CalendarMismatch[];
}> {
  const empty = { legs: [] as CalendarLeg[], mismatches: [] as CalendarMismatch[] };
  const id = await calendarId();
  if (!id) return { enabled: false, error: null, ...empty };

  let events: CalEvent[];
  try {
    events = (await calendarEventsCached(from, to)) || [];
  } catch (e: any) {
    return { enabled: true, error: e?.message || 'Kalender nicht erreichbar', ...empty };
  }

  const legs: CalendarLeg[] = [];
  const mismatches: CalendarMismatch[] = [];
  for (const c of classifyEvents(events, await loadBookingRefs())) {
    const ev = c.event;
    if (c.kind === 'booking' && c.booking) {
      // The calendar copy of a booking: flag it when its time matches none of the legs —
      // the operator moved the ride in the calendar, or the booking has a wrong time.
      const b = c.booking;
      if (b.status === 'cancelled' || RE_CAL_CANCELLED.test(`${ev.summary}\n${ev.location}`)) continue;
      const times = [wall(b.pickup_datetime), b.trip_type === 'roundtrip' && b.return_datetime ? wall(b.return_datetime) : null]
        .filter((t): t is string => !!t);
      if (!times.includes(ev.start!)) {
        mismatches.push({
          id: b.id, booking_number: b.booking_number, name: b.name, price: Number(b.price) || 0,
          booking_time: times.find((t) => t.slice(0, 10) === ev.start!.slice(0, 10)) || times[0],
          calendar_time: ev.start!, html_link: ev.htmlLink,
        });
      }
      continue;
    }
    if (c.kind !== 'ride') continue;
    legs.push({
      uid: ev.uid,
      leg_time: ev.start!,
      summary: ev.summary.trim(),
      location: ev.location.trim(),
      from: c.from,
      to: c.to,
      via: c.via,
      guest: c.guest,
      price: c.price,
      html_link: ev.htmlLink,
    });
  }
  return { enabled: true, error: null, legs, mismatches };
}

type Agg = { count: number; revenue: number };
const agg = (): Agg => ({ count: 0, revenue: 0 });
const add = (a: Agg, price: number) => { a.count += 1; a.revenue += Number(price) || 0; };

router.get('/', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = berlinNowSql();                 // 'YYYY-MM-DD HH:mm:ss', Berlin
    const today = now.slice(0, 10);
    const nowTime = now.slice(11);
    const todayStart = `${today} 00:00:00`;
    const lastDay = berlinDateSql(DAYS_AHEAD - 1);

    // ---- Rides: one row per leg ------------------------------------------------------
    // Hinfahrt on pickup_datetime and, for round trips, the Rückfahrt on return_datetime.
    // The old "Heutige Fahrten" only looked at pickup_datetime, so Rückfahrten never showed.
    const legRows = await query<any>(`
      SELECT ${RIDE_COLS}, 'hin' AS leg, b.pickup_datetime AS leg_time ${RIDE_FROM}
       WHERE b.status <> 'cancelled' AND LEFT(b.pickup_datetime, 10) BETWEEN ? AND ?
      UNION ALL
      SELECT ${RIDE_COLS}, 'rueck' AS leg, b.return_datetime AS leg_time ${RIDE_FROM}
       WHERE b.status <> 'cancelled' AND b.trip_type = 'roundtrip'
         AND b.return_datetime IS NOT NULL AND b.return_datetime <> ''
         AND LEFT(b.return_datetime, 10) BETWEEN ? AND ?`,
      [today, lastDay, today, lastDay]);
    const legs = legRows
      .map((r) => ({ ...r, leg_time: wall(r.leg_time) }))
      .sort((a, b) => a.leg_time.localeCompare(b.leg_time) || (a.leg === 'hin' ? -1 : 1));

    // ---- Booking intake (created_at) -------------------------------------------------
    // Reaches back to the 1st of last month, so month-to-date can be set against the same
    // span of last month.
    const dom = +today.slice(8, 10);
    const created = await query<{ created_utc: string; price: number; status: string; payment_method: string; source: string | null }>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc, price, status, payment_method, source
        FROM bookings WHERE created_at >= ?`,
      [berlinMidnightUtcSql(-(dom - 1) - 31)]);

    const yesterday = berlinDateSql(-1);
    const weekStart = berlinDateSql(-6);        // today + the 6 days before
    const prevWeekStart = berlinDateSql(-13);
    const month = today.slice(0, 7);
    const prevMonth = berlinDateSql(-dom).slice(0, 7);
    const chartStart = berlinDateSql(-(CHART_DAYS - 1));

    const intake = {
      today: agg(), yesterdaySameTime: agg(), yesterday: agg(),
      week: agg(), prevWeek: agg(), mtd: agg(), prevMtd: agg(), prevMonth: agg(),
    };
    const chartMap = new Map<string, Agg>();
    for (let i = CHART_DAYS - 1; i >= 0; i--) chartMap.set(berlinDateSql(-i), agg());
    const payment: Record<string, Agg> = {};
    const status: Record<string, number> = {};

    for (const r of created) {
      const berlin = berlinNowSql(new Date(r.created_utc));
      const date = berlin.slice(0, 10);
      const time = berlin.slice(11);
      if (date.slice(0, 7) === month) status[r.status] = (status[r.status] || 0) + 1;
      if (r.status === 'cancelled') continue;
      const price = Number(r.price) || 0;
      // Rides taken from the calendar become bookings only when the Rechnung is made. They already counted on the
      // day they were entered in the calendar (see below), so the "taken" windows and the chart skip them here.
      const viaCalendar = r.source === 'calendar';
      if (!viaCalendar) {
        if (date === today) add(intake.today, price);
        if (date === yesterday) {
          add(intake.yesterday, price);
          if (time <= nowTime) add(intake.yesterdaySameTime, price);
        }
        if (date >= weekStart) add(intake.week, price);
        else if (date >= prevWeekStart) add(intake.prevWeek, price);
      }
      if (date.slice(0, 7) === month) {
        add(intake.mtd, price);
        const pm = r.payment_method || 'cash';
        add(payment[pm] || (payment[pm] = agg()), price);
      } else if (date.slice(0, 7) === prevMonth) {
        add(intake.prevMonth, price);
        const day = +date.slice(8, 10);
        if (day < dom || (day === dom && time <= nowTime)) add(intake.prevMtd, price);
      }
      if (!viaCalendar && date >= chartStart && chartMap.has(date)) add(chartMap.get(date)!, price);
    }
    // "Neue Buchungen" = rides taken: calendar-only rides count on the day they were entered in the
    // calendar (Google "created"), next to the web bookings. Only today / yesterday / the 7-day
    // windows and the chart get them; the month cards keep adding the calendar by ride date below.
    const includeCalendar = await includeCalendarInStats();
    const intakeCalendar = { today: agg(), yesterday: agg(), week: agg() };
    if (includeCalendar) {
      const entries = await query<{ at: string; price: number | null }>(
        `SELECT ${ENTERED} AS at, price FROM calendar_rides WHERE kind IN ('ride', 'imported') AND ${ENTERED} >= ?`,
        [`${prevWeekStart}T00:00`]);
      for (const e of entries) {
        const date = e.at.slice(0, 10);
        const time = `${e.at.slice(11, 16)}:00`;
        const price = Number(e.price) || 0;
        if (date === today) { add(intake.today, price); add(intakeCalendar.today, price); }
        if (date === yesterday) {
          add(intake.yesterday, price); add(intakeCalendar.yesterday, price);
          if (time <= nowTime) add(intake.yesterdaySameTime, price);
        }
        if (date >= weekStart) { add(intake.week, price); add(intakeCalendar.week, price); }
        else if (date >= prevWeekStart) add(intake.prevWeek, price);
        if (date >= chartStart && chartMap.has(date)) add(chartMap.get(date)!, price);
      }
    }
    const chart = Array.from(chartMap.entries()).map(([date, a]) => ({ date, ...a }));

    // All-time booking total (the "Gesamt" card of the old dashboard).
    const [allTime] = await query<{ count: number; revenue: number }>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue FROM bookings WHERE status <> 'cancelled'`);

    // ---- Things that need a hand -----------------------------------------------------
    // Marketing-Erinnerung parallel zu den übrigen Abfragen starten (max. 4 s)
    const marketingPending = Promise.race([
      marketingReminders(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]).catch(() => null);
    const since14 = `${berlinDateSql(-14)} 00:00:00`;
    const since60 = `${berlinDateSql(-60)} 00:00:00`;
    const in3Days = `${berlinDateSql(3)} 23:59:59`;
    const attentionQuery = (where: string, params: unknown[], order = 'ASC') => query<any>(`
      SELECT ${RIDE_COLS}, 'hin' AS leg, b.pickup_datetime AS leg_time ${RIDE_FROM}
       WHERE ${where}
       ORDER BY ${wallSql('b.pickup_datetime')} ${order} LIMIT 20`, params)
      .then((rows) => rows.map((r) => ({ ...r, leg_time: wall(r.leg_time) })));

    // Card rides that should be charged by now: tomorrow's after the deadline (System tab), today's still ahead.
    const cardsUncharged = await unchargedCards();
    // Monthly Search Console backlink export not uploaded yet (SEO → Backlinks).
    const seoBacklinks = await backlinkReminder().catch(() => null);
    // Pages that dropped out of Google's index (SEO → Indexierung).
    const seoIndex = await indexReminder().catch(() => null);
    // Weekly Google Ads report upload not done yet (Google Ads → Veri & Bağlantı).
    const adsReports = await adsReminder().catch(() => null);
    const monthEnd = await monthEndInvoices().catch(() => null);
    // Marketing-Anlass mit offenem Erinnerungsfenster (Ferien, Weihnachten, …) — Admin → Marketing
    const marketing = await marketingPending;
    const [unconfirmed, failedCharges, unpaidTransfers, invoiceFailed, openStatus] = await Promise.all([
      // Not yet confirmed, ride still ahead.
      attentionQuery(`b.status = 'new' AND ${wallSql(lastLegSql)} >= ?`, [todayStart]),
      // Stripe charge failed — money for a ride that happened or is about to.
      attentionQuery(`b.status <> 'cancelled' AND b.charge_status = 'failed' AND ${wallSql('b.pickup_datetime')} >= ?`, [since14]),
      // Bank transfer not marked as received, ride within 3 days or already done.
      attentionQuery(`b.status <> 'cancelled' AND b.payment_method = 'ueberweisung' AND b.ueberweisung_paid_at IS NULL
        AND ${wallSql('b.pickup_datetime')} BETWEEN ? AND ?`, [since60, in3Days]),
      // The automatic invoice gave up after its retries.
      attentionQuery(`b.status <> 'cancelled' AND (b.rechnung_number IS NULL OR b.rechnung_number = '')
        AND b.rechnung_attempts >= ? AND ${wallSql('b.pickup_datetime')} >= ?`, [RECHNUNG_MAX_ATTEMPTS, since60], 'DESC'),
      // Ride over (last leg before today) but still 'confirmed' — status never closed.
      attentionQuery(`b.status = 'confirmed' AND ${wallSql(lastLegSql)} < ? AND ${wallSql(lastLegSql)} >= ?`, [todayStart, since14], 'DESC'),
    ]);

    // ---- Latest bookings ---------------------------------------------------------------
    const recentRows = await query<any>(`
      SELECT b.id, b.booking_number, b.name, b.pickup_address, b.dropoff_address, b.pickup_datetime,
             b.return_datetime, b.trip_type, b.vehicle_type, b.price, b.status, b.payment_method,
             b.company_id, c.company_name, b.source, b.ueberweisung_paid_at, b.charge_status,
             DATE_FORMAT(b.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc
        FROM bookings b LEFT JOIN companies c ON c.id = b.company_id
       ORDER BY b.created_at DESC LIMIT 12`);
    const recent = recentRows.map((r) => ({
      ...r,
      pickup_datetime: wall(r.pickup_datetime),
      return_datetime: r.return_datetime ? wall(r.return_datetime) : null,
      created_berlin: wall(berlinNowSql(new Date(r.created_utc))),
    }));

    const calendar = await loadCalendar(today, lastDay);

    // Calendar-only rides this month up to now (by ride date), for the month card.
    const calSum = async (from: string, to: string) => {
      const [r] = await query<{ count: number; priced: number; revenue: number }>(`
        SELECT COUNT(*) AS count, COUNT(price) AS priced, COALESCE(SUM(price), 0) AS revenue
          FROM calendar_rides WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [from, to]);
      return { count: Number(r?.count) || 0, priced: Number(r?.priced) || 0, revenue: Number(r?.revenue) || 0 };
    };
    const calMonth = includeCalendar ? await calSum(`${month}-01T00:00`, wall(now)) : null;
    const calPrevMonth = includeCalendar ? await calSum(`${prevMonth}-01T00:00`, `${prevMonth}-31T23:59`) : null;
    const calTotal = includeCalendar ? await calSum('0000-01-01T00:00', wall(now)) : null;

    res.json({
      now: wall(now),
      today,
      legs,
      intake,
      intakeCalendar,
      chart,
      month: { month, payment, status },
      attention: { unconfirmed, failedCharges, unpaidTransfers, invoiceFailed, openStatus, cardsUncharged, seoBacklinks: seoBacklinks?.due ? seoBacklinks : null, seoIndex: seoIndex?.due ? { dropped: seoIndex.dropped } : null, adsReports: adsReports?.due ? adsReports : null, monthEndInvoices: monthEnd, marketing },
      card_deadline: await cardDeadline(),
      recent,
      calendar,
      calendarMonth: calMonth,
      calendarPrevMonth: calPrevMonth,
      calendarTotal: calTotal,
      allTime: { count: Number(allTime?.count) || 0, revenue: Number(allTime?.revenue) || 0 },
    });
  } catch (error) {
    console.error('[admin-dashboard]', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/admin/dashboard/day?date=YYYY-MM-DD&mode=booked|driven — what one day brought in:
// web/system bookings plus calendar-only rides. booked = taken that day (booking date / entered
// in the calendar), driven = rides of that day (pickup date; a round trip's whole price sits on
// the outbound day).
// Also ?from=YYYY-MM-DD&to=YYYY-MM-DD for a period (7/14/30 Tage or any range): same totals,
// plus a per-day breakdown and the previous period of the same length for comparison.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const shiftDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function loadPeriod(from: string, to: string, mode: 'booked' | 'driven', includeCalendar: boolean) {
  const today = berlinDateSql(0);
  const bookings = mode === 'booked'
    ? await query<any>(`
        SELECT b.id, b.booking_number, b.name, b.pickup_address, b.dropoff_address, b.pickup_datetime, b.trip_type,
               b.price, b.payment_method, c.company_name, DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS created_utc
          FROM bookings b LEFT JOIN companies c ON c.id = b.company_id
         WHERE b.status <> 'cancelled' AND COALESCE(b.source, '') <> 'calendar' AND b.created_at >= ? AND b.created_at < ?
         ORDER BY b.created_at`,
        [berlinMidnightUtcSql(dayDiff(today, from)), berlinMidnightUtcSql(dayDiff(today, to) + 1)])
    : await query<any>(`
        SELECT b.id, b.booking_number, b.name, b.pickup_address, b.dropoff_address, b.pickup_datetime, b.trip_type,
               b.price, b.payment_method, c.company_name, DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i:%s') AS created_utc
          FROM bookings b LEFT JOIN companies c ON c.id = b.company_id
         WHERE b.status <> 'cancelled' AND LEFT(b.pickup_datetime, 10) BETWEEN ? AND ?
         ORDER BY b.pickup_datetime`, [from, to]);

  const rides = !includeCalendar ? [] : await query<any>(`
    SELECT ride_time, ${ENTERED} AS entered, summary, pickup_address, dropoff_address, price
      FROM calendar_rides
     WHERE kind IN (${mode === 'booked' ? "'ride', 'imported'" : "'ride'"}) AND ${mode === 'booked' ? ENTERED : 'ride_time'} BETWEEN ? AND ?
     ORDER BY ${mode === 'booked' ? ENTERED : 'ride_time'}`,
    [`${from}T00:00`, `${to}T23:59`]);

  // Day each item counts for: Berlin booking day (created_at is UTC) or the ride day
  const webDay = (b: any) => mode === 'booked'
    ? berlinNowSql(new Date(`${String(b.created_utc).replace(' ', 'T')}Z`)).slice(0, 10)
    : wall(b.pickup_datetime).slice(0, 10);
  const calDay = (r: any) => String(mode === 'booked' ? r.entered : r.ride_time).slice(0, 10);
  return { bookings, rides, webDay, calDay };
}

// "Heute" für die Live-Karten (Bugün rezervasyon/gelir) — exakt dieselbe Rechnung wie das Tagesarchiv
// "Nach Buchungsdatum" (Web + Kalender), damit beide Stellen nie auseinanderlaufen.
export async function todayBookedTotals(): Promise<{ count: number; revenue: number }> {
  const day = berlinDateSql(0);
  const { bookings, rides } = await loadPeriod(day, day, 'booked', await includeCalendarInStats());
  return {
    count: bookings.length + rides.length,
    revenue: bookings.reduce((s, b) => s + (Number(b.price) || 0), 0) + rides.reduce((s, r) => s + (Number(r.price) || 0), 0),
  };
}

router.get('/day', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const single = String(req.query.date || '');
    const from = String(req.query.from || single);
    const to = String(req.query.to || single);
    if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || to < from) { res.status(400).json({ error: 'date or from/to required (YYYY-MM-DD)' }); return; }
    const span = dayDiff(from, to) + 1;
    if (span > 400) { res.status(400).json({ error: 'Zeitraum zu lang (max. 400 Tage)' }); return; }
    const mode = req.query.mode === 'driven' ? 'driven' : 'booked';
    const includeCalendar = await includeCalendarInStats();

    const { bookings, rides, webDay, calDay } = await loadPeriod(from, to, mode, includeCalendar);
    const webRevenue = bookings.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const calRevenue = rides.reduce((s, r) => s + (Number(r.price) || 0), 0);

    // Per-day breakdown (every day of the period, also empty ones) — only for a period
    let days: { date: string; web: Agg; calendar: Agg }[] | undefined;
    let prev: { from: string; to: string; total: Agg } | undefined;
    if (span > 1) {
      const byDay = new Map<string, { date: string; web: Agg; calendar: Agg }>();
      for (let i = 0; i < span; i++) { const d = shiftDay(from, i); byDay.set(d, { date: d, web: agg(), calendar: agg() }); }
      for (const b of bookings) { const d = byDay.get(webDay(b)); if (d) add(d.web, b.price); }
      for (const r of rides) { const d = byDay.get(calDay(r)); if (d) add(d.calendar, r.price); }
      days = [...byDay.values()];

      // Same length directly before — for "+12 % zum Vorzeitraum"
      const pFrom = shiftDay(from, -span), pTo = shiftDay(from, -1);
      const p = await loadPeriod(pFrom, pTo, mode, includeCalendar);
      prev = {
        from: pFrom, to: pTo,
        total: {
          count: p.bookings.length + p.rides.length,
          revenue: p.bookings.reduce((s, b) => s + (Number(b.price) || 0), 0) + p.rides.reduce((s, r) => s + (Number(r.price) || 0), 0),
        },
      };
    }

    res.json({
      date: from, from, to, mode, calendar_enabled: includeCalendar,
      web: {
        count: bookings.length, revenue: webRevenue,
        items: bookings.map((b) => ({
          id: b.id, booking_number: b.booking_number, name: b.name, from: b.pickup_address, to: b.dropoff_address,
          pickup: wall(b.pickup_datetime), trip_type: b.trip_type, price: Number(b.price) || 0,
          payment_method: b.payment_method, company: b.company_name || null, day: webDay(b),
        })),
      },
      calendar: {
        count: rides.length, revenue: calRevenue, unpriced: rides.filter((r) => r.price == null).length,
        items: rides.map((r) => ({
          ride_time: r.ride_time, entered: r.entered, summary: String(r.summary || '').slice(0, 80),
          from: r.pickup_address, to: r.dropoff_address, price: r.price == null ? null : Number(r.price),
        })),
      },
      total: { count: bookings.length + rides.length, revenue: webRevenue + calRevenue },
      days, prev,
    });
  } catch (error) {
    console.error('[admin-dashboard/day]', error);
    res.status(500).json({ error: 'Failed to load day' });
  }
});

// ---- Calendar revenue for the statistics ---------------------------------------------

async function includeCalendarInStats(): Promise<boolean> {
  const [row] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = 'stats_include_calendar'`);
  return (row?.setting_value ?? '1') === '1';
}

// GET /api/admin/dashboard/calendar-stats — calendar-only rides (kind 'ride') by month and
// year, plus booking totals per year so the Statistik tab can show both side by side.
router.get('/calendar-stats', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enabled = !!(await calendarId());
    const include = await includeCalendarInStats();
    const now = berlinNowSql();
    const today = now.slice(0, 10);
    const dom = +today.slice(8, 10);
    const month = today.slice(0, 7);
    const prevMonth = berlinDateSql(-dom).slice(0, 7);
    const prevEnd = `${prevMonth}-${String(dom).padStart(2, '0')}T${now.slice(11, 16)}`;

    const monthly = await query<any>(`
      SELECT LEFT(ride_time, 7) AS month, COUNT(*) AS count, COUNT(price) AS priced, COALESCE(SUM(price), 0) AS revenue
        FROM calendar_rides WHERE kind = 'ride'
       GROUP BY LEFT(ride_time, 7) ORDER BY month`);
    const [mtdCur] = await query<any>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue FROM calendar_rides
       WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [`${month}-01T00:00`, wall(now)]);
    const [mtdPrev] = await query<any>(`
      SELECT COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue FROM calendar_rides
       WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [`${prevMonth}-01T00:00`, prevEnd]);
    const bookingYears = await query<any>(`
      SELECT LEFT(pickup_datetime, 4) AS year, COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue
        FROM bookings WHERE status <> 'cancelled'
       GROUP BY LEFT(pickup_datetime, 4) ORDER BY year`);
    const [kinds] = await query<any>(`
      SELECT COUNT(*) AS events, SUM(kind = 'ride') AS rides, SUM(kind = 'duplicate') AS duplicates,
             SUM(kind IN ('booking', 'imported')) AS bookings, SUM(kind = 'cancelled') AS cancelled,
             MAX(synced_at) AS synced_at
        FROM calendar_rides`);

    const num = (r: any) => ({ count: Number(r?.count) || 0, revenue: Number(r?.revenue) || 0 });
    res.json({
      enabled,
      include,
      sync: {
        last: calendarSyncStatus(),
        synced_at: kinds?.synced_at || null,
        events: Number(kinds?.events) || 0,
        rides: Number(kinds?.rides) || 0,
        duplicates: Number(kinds?.duplicates) || 0,
        bookings: Number(kinds?.bookings) || 0,
        cancelled: Number(kinds?.cancelled) || 0,
      },
      monthly: monthly.map((m) => ({ month: m.month, count: Number(m.count), priced: Number(m.priced), revenue: Number(m.revenue) })),
      mtd: { current: num(mtdCur), previous: num(mtdPrev) },
      bookingYears: bookingYears.map((y) => ({ year: y.year, ...num(y) })),
    });
  } catch (error) {
    console.error('[calendar-stats]', error);
    res.status(500).json({ error: 'Failed to load calendar stats' });
  }
});

// POST /api/admin/dashboard/calendar-sync — re-read the whole calendar now (≈10 s).
router.post('/calendar-sync', authenticateAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  if (!(await calendarId())) { res.status(400).json({ error: 'Kalender nicht verbunden' }); return; }
  const result = await syncAll();
  if (!result) { res.status(409).json({ error: calendarSyncStatus()?.error || 'Synchronisierung läuft bereits' }); return; }
  res.json({ success: true, ...result });
});

export default router;
