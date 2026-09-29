// Admin dashboard data in one request, all in Berlin time.
//
// pickup_datetime / return_datetime are Berlin wall-clock strings ('YYYY-MM-DDTHH:mm:ss'),
// while created_at is a UTC DATETIME and the server clock is UTC. Every calendar boundary
// here is therefore taken from the Berlin clock (utils/berlinTime), never from new Date().

import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { berlinDateSql, berlinMidnightUtcSql, berlinNowSql } from '../utils/berlinTime';
import { MAX_ATTEMPTS as RECHNUNG_MAX_ATTEMPTS } from '../services/autoRechnungJob';

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
const CHART_DAYS = 14;

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
    const created = await query<{ created_utc: string; price: number; status: string; payment_method: string }>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_utc, price, status, payment_method
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
      week: agg(), prevWeek: agg(), mtd: agg(), prevMtd: agg(),
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
      if (date === today) add(intake.today, price);
      if (date === yesterday) {
        add(intake.yesterday, price);
        if (time <= nowTime) add(intake.yesterdaySameTime, price);
      }
      if (date >= weekStart) add(intake.week, price);
      else if (date >= prevWeekStart) add(intake.prevWeek, price);
      if (date.slice(0, 7) === month) {
        add(intake.mtd, price);
        const pm = r.payment_method || 'cash';
        add(payment[pm] || (payment[pm] = agg()), price);
      } else if (date.slice(0, 7) === prevMonth) {
        const day = +date.slice(8, 10);
        if (day < dom || (day === dom && time <= nowTime)) add(intake.prevMtd, price);
      }
      if (date >= chartStart && chartMap.has(date)) add(chartMap.get(date)!, price);
    }
    const chart = Array.from(chartMap.entries()).map(([date, a]) => ({ date, ...a }));

    // ---- Things that need a hand -----------------------------------------------------
    const since14 = `${berlinDateSql(-14)} 00:00:00`;
    const since60 = `${berlinDateSql(-60)} 00:00:00`;
    const in3Days = `${berlinDateSql(3)} 23:59:59`;
    const attentionQuery = (where: string, params: unknown[], order = 'ASC') => query<any>(`
      SELECT ${RIDE_COLS}, 'hin' AS leg, b.pickup_datetime AS leg_time ${RIDE_FROM}
       WHERE ${where}
       ORDER BY ${wallSql('b.pickup_datetime')} ${order} LIMIT 20`, params)
      .then((rows) => rows.map((r) => ({ ...r, leg_time: wall(r.leg_time) })));

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

    res.json({
      now: wall(now),
      today,
      legs,
      intake,
      chart,
      month: { month, payment, status },
      attention: { unconfirmed, failedCharges, unpaidTransfers, invoiceFailed, openStatus },
      recent,
    });
  } catch (error) {
    console.error('[admin-dashboard]', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
