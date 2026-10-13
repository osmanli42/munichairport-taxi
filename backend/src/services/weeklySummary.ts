// The Monday report mail (alert category weekly_summary, sent from 08:00 Berlin on Mondays):
// LAST WEEK (Mon–Sun) at a glance — rides and revenue taken, day by day, against the week
// before and the same week last year, where they came from, the rides actually driven,
// money still outstanding, what's planned this week, and the website.
//
// Counting is the daily summary's (and the dashboard's): bookings by booking date, calendar
// rides by the day they were entered — see dailySummary.ts. The building blocks come from there.

import { query } from '../db';
import { berlinDateSql, berlinMidnightUtcSql, berlinNowSql } from '../utils/berlinTime';
import {
  Sum, num, esc, eur, dmy, dm, offsetOf, addDays, bookingSum, calendarSum, delta,
  C, tile, section, statRow, listTable,
} from './dailySummary';
import { receivables } from '../routes/admin-dashboard-widgets';

const plus = (a: Sum, b: Sum) => ({ n: a.n + b.n, eur: a.eur + b.eur, noPrice: a.noPrice + b.noPrice });
const wall = (s: unknown) => String(s || '').replace(' ', 'T').slice(0, 16);

const TR_DAY_SHORT = (d: string) =>
  new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

/** Monday of the week containing `date` ('YYYY-MM-DD'). */
function mondayOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function pctText(cur: number, prev: number): string {
  if (!prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  return ` (${p > 0 ? '+' : ''}${p} %)`;
}

/** Ride legs taking place in [from, to] (Berlin dates): booking outbound + return legs, calendar-only rides. */
async function legCount(from: string, to: string): Promise<{ bookings: number; calendar: number }> {
  const lo = `${from}T00:00`;
  const hi = `${to}T23:59`;
  const [b] = await query<any>(
    `SELECT
       SUM(REPLACE(pickup_datetime, ' ', 'T') BETWEEN ? AND ?) +
       SUM(trip_type = 'roundtrip' AND return_datetime IS NOT NULL AND REPLACE(return_datetime, ' ', 'T') BETWEEN ? AND ?) AS n
       FROM bookings WHERE status <> 'cancelled'`,
    [lo, hi, lo, hi]);
  const [c] = await query<any>(
    `SELECT COUNT(*) AS n FROM calendar_rides WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`, [lo, hi]);
  return { bookings: num(b?.n), calendar: num(c?.n) };
}

/**
 * @param weekStart Monday ('YYYY-MM-DD') of the week to report; defaults to last week.
 *                  Only the preview passes it (to look at an older week).
 */
export async function buildWeeklySummary(weekStart?: string): Promise<{ subject: string; html: string; week: string }> {
  const today = berlinDateSql(0);
  const from = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? mondayOf(weekStart) : addDays(mondayOf(today), -7);
  const to = addDays(from, 6);
  const prevFrom = addDays(from, -7);
  const prevTo = addDays(from, -1);
  const lyFrom = addDays(from, -364);              // same weekday, 52 weeks earlier
  const lyTo = addDays(lyFrom, 6);
  const nextFrom = addDays(from, 7);
  const nextTo = addDays(from, 13);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));

  const [web, cal, webPrev, calPrev, webLy, calLy] = await Promise.all([
    bookingSum(from, to), calendarSum(from, to),
    bookingSum(prevFrom, prevTo), calendarSum(prevFrom, prevTo),
    bookingSum(lyFrom, lyTo), calendarSum(lyFrom, lyTo),
  ]);
  const total = plus(web, cal);
  const prev = plus(webPrev, calPrev);
  const ly = plus(webLy, calLy);

  const perDay = await Promise.all(days.map(async (d) => {
    const [w, c] = await Promise.all([bookingSum(d, d), calendarSum(d, d)]);
    return { d, w, c };
  }));

  const utcFrom = berlinMidnightUtcSql(offsetOf(from));
  const utcTo = berlinMidnightUtcSql(offsetOf(to) + 1);

  const sources = await query<{ src: string; n: number; eur: number }>(
    `SELECT CASE
              WHEN company_id IS NOT NULL THEN 'Firma müşterisi'
              WHEN source = 'calendar' THEN 'Takvimden aktarılan'
              WHEN source = 'admin' THEN 'Admin (elle)'
              ELSE 'Web sitesi' END AS src,
            COUNT(*) AS n, COALESCE(SUM(price), 0) AS eur
       FROM bookings WHERE status <> 'cancelled' AND created_at >= ? AND created_at < ?
      GROUP BY src ORDER BY eur DESC`,
    [utcFrom, utcTo]);
  const [cancel] = await query<any>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS eur FROM bookings
      WHERE status = 'cancelled' AND created_at >= ? AND created_at < ?`,
    [utcFrom, utcTo]);

  const [driven, planned] = await Promise.all([legCount(from, to), legCount(nextFrom, nextTo)]);

  const [site] = await query<any>(
    `SELECT
       (SELECT COUNT(*) FROM visitor_sessions WHERE is_bot = 0 AND first_seen >= ? AND first_seen < ?) AS sessions,
       (SELECT COUNT(*) FROM bookings WHERE status <> 'cancelled' AND source = 'web' AND created_at >= ? AND created_at < ?) AS web_bookings,
       (SELECT COUNT(DISTINCT session_id) FROM visitor_events WHERE type = 'call_click' AND occurred_at >= ? AND occurred_at < ?) AS calls`,
    [utcFrom, utcTo, utcFrom, utcTo, utcFrom, utcTo]);
  const traffic = await query<{ src: string; n: number }>(
    `SELECT CASE
              WHEN gclid IS NOT NULL AND gclid <> '' THEN 'Google Ads'
              WHEN referrer REGEXP 'google\\\\.|bing\\\\.|duckduckgo|ecosia|yahoo\\\\.|qwant|startpage' THEN 'Organik'
              WHEN referrer REGEXP 'chatgpt|openai|perplexity|claude\\\\.ai|gemini|copilot' THEN 'AI'
              WHEN referrer IS NULL OR referrer = '' OR referrer LIKE '%flughafen-muenchen.taxi%' THEN 'Direkt'
              ELSE 'Diğer siteler' END AS src, COUNT(*) AS n
       FROM visitor_sessions WHERE is_bot = 0 AND first_seen >= ? AND first_seen < ?
      GROUP BY src ORDER BY n DESC`,
    [utcFrom, utcTo]);

  const now = wall(berlinNowSql());
  const rec = await receivables(now);
  const [failed] = await query<any>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS eur FROM bookings
      WHERE status <> 'cancelled' AND charge_status = 'failed'
        AND REPLACE(pickup_datetime, ' ', 'T') >= ?`,
    [`${berlinDateSql(-14)}T00:00`]);

  const sessions = num(site?.sessions);
  const webBookings = num(site?.web_bookings);
  const kw = isoWeek(from);

  // ---- Rows --------------------------------------------------------------------------
  const maxDay = Math.max(1, ...perDay.map((x) => x.w.eur + x.c.eur));
  const dayRows = perDay.map(({ d, w, c }) => {
    const sum = w.eur + c.eur;
    const bar = Math.round((sum / maxDay) * 100);
    return `
      <tr>
        <td style="padding:7px 8px 7px 0;border-bottom:1px solid ${C.line};white-space:nowrap;color:${C.text}">
          <b>${esc(TR_DAY_SHORT(d))}</b> <span style="color:${C.muted}">${esc(dm(d))}</span>
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid ${C.line};width:45%">
          <div style="background:${C.soft};border-radius:4px;height:8px"><div style="background:${C.gold};height:8px;border-radius:4px;width:${bar}%"></div></div>
        </td>
        <td style="padding:7px 0 7px 8px;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;color:${C.muted};font-size:12px">
          web ${w.n} · takvim ${c.n}
        </td>
        <td style="padding:7px 0 7px 10px;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;font-weight:700;color:${C.text}">
          ${w.n + c.n} · ${eur(sum, 0)}
        </td>
      </tr>`;
  });

  const sourceRows = [
    ...sources.map((s) => `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:${C.text}">${esc(s.src)}</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap"><b>${num(s.n)}</b> · ${eur(num(s.eur), 0)}</td>
      </tr>`),
    cal.n ? `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:${C.text}">Sadece takvimde (telefon, WhatsApp…)${cal.noPrice ? ` <span style="color:${C.muted}">· ${cal.noPrice} fiyatsız</span>` : ''}</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap"><b>${cal.n}</b> · ${eur(cal.eur, 0)}</td>
      </tr>` : '',
  ].filter(Boolean);

  const overdue = rec.invoices.filter((i: any) => i.overdue);
  const moneyRows = [
    rec.invoices.length ? `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:${C.text}">Açık firma faturaları${overdue.length ? ` <span style="color:#dc2626">· ${overdue.length} vadesi geçmiş (${eur(rec.overdue_total, 0)})</span>` : ''}</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap"><b>${rec.invoices.length}</b> · ${eur(rec.invoices_total, 0)}</td>
      </tr>` : '',
    rec.transfers.count ? `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:${C.text}">Gelmemiş Überweisung'lar (fahrt yapıldı)</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap"><b>${rec.transfers.count}</b> · ${eur(rec.transfers.total, 0)}</td>
      </tr>` : '',
    rec.calendar_open.count ? `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:${C.text}">Faturası kesilmemiş takvim fahrt'ları (Rechnung)</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap"><b>${rec.calendar_open.count}</b> · ${eur(rec.calendar_open.total, 0)}</td>
      </tr>` : '',
    num(failed?.n) ? `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};color:#dc2626">Başarısız kart çekimleri (son 14 gün)</td>
        <td style="padding:7px 0;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap;color:#dc2626"><b>${num(failed.n)}</b> · ${eur(num(failed.eur), 0)}</td>
      </tr>` : '',
  ].filter(Boolean);

  const trafficText = traffic.length
    ? traffic.map((s) => `${esc(s.src)} <b>${num(s.n)}</b>`).join(' &nbsp;·&nbsp; ')
    : 'veri yok';

  const subject = `📈 Haftalık rapor ${dm(from)}–${dm(to)} — ${total.n} fahrt · ${eur(total.eur, 0)}${pctText(total.eur, prev.eur)}`;

  const html = `
<div style="background:#eef1f5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${C.line}">
    <tr><td style="background:${C.navy};padding:22px 24px">
      <div style="font-size:12px;color:${C.gold};font-weight:700;letter-spacing:.08em;text-transform:uppercase">Flughafen-München.TAXI · Haftalık rapor</div>
      <div style="font-size:22px;color:#fff;font-weight:700;margin-top:6px">${kw}. hafta · ${dmy(from)} – ${dmy(to)}</div>
      <div style="font-size:13px;color:#cbd5e1;margin-top:4px">Geçen hafta alınan fahrt’lar — web/sistem rezervasyonları + takvime eklenenler</div>
    </td></tr>

    <tr><td style="padding:16px 18px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${tile('Alınan fahrt', String(total.n), `önceki hafta ${prev.n} &nbsp;${delta(total.n, prev.n)}`)}
          ${tile('Ciro', eur(total.eur, 0), `önceki hafta ${eur(prev.eur, 0)} &nbsp;${delta(total.eur, prev.eur)}`, C.gold)}
        </tr>
        <tr>
          ${tile('Geçen yıl aynı hafta', eur(ly.eur, 0), `${ly.n} fahrt &nbsp;${delta(total.eur, ly.eur)}`)}
          ${tile('Yapılan fahrt', String(driven.bookings + driven.calendar), `bu hafta yola çıkılan · rezervasyon ${driven.bookings} · takvim ${driven.calendar}`)}
        </tr>
      </table>
    </td></tr>

    ${section('Günlere göre', listTable(dayRows, 'Bu hafta fahrt alınmadı.'), 'alındığı güne göre')}

    ${section('Nereden geldi', listTable(sourceRows, 'Bu hafta rezervasyon yok.'),
      num(cancel?.n) ? `${num(cancel.n)} iptal hariç (${eur(num(cancel.eur), 0)})` : '')}

    ${section('Bekleyen para', listTable(moneyRows, 'Açık alacak yok. 👍'), 'bugünkü durum')}

    ${section(`Bu hafta · ${dm(nextFrom)}–${dm(nextTo)}`, statRow([
      ['Planlı fahrt', String(planned.bookings + planned.calendar)],
      ['Rezervasyon', String(planned.bookings)],
      ['Takvim', String(planned.calendar)],
    ]))}

    ${section('Web sitesi', `
      ${statRow([
        ['Ziyaret', String(sessions)],
        ['Web rezervasyon', String(webBookings)],
        ['Dönüşüm', sessions ? `${((webBookings / sessions) * 100).toFixed(1).replace('.', ',')}%` : '—'],
        ['Telefon tıklaması', String(num(site?.calls))],
      ])}
      <div style="font-size:12px;color:${C.muted};margin-top:8px">Trafik: ${trafficText}</div>`)}

    <tr><td style="padding:24px">
      <a href="https://flughafen-muenchen.taxi/admin" style="display:inline-block;background:${C.navy};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px">Dashboard’u aç</a>
      <div style="font-size:11px;color:#9ca3af;margin-top:16px;line-height:1.5">
        Fahrt’lar alındığı gün sayılır (günlük özet ve dashboard ile aynı hesap). „Yapılan fahrt“ ise fahrt tarihine göredir; gidiş-dönüş iki fahrt sayılır.
        <br>
        Kapatma: Admin → System → E-posta Uyarıları → „Haftalık rapor“.
      </div>
    </td></tr>
  </table>
</div>`;

  return { subject, html, week: from };
}
