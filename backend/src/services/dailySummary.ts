// The morning summary mail (alert category daily_summary, sent from 08:00 Berlin): what
// happened YESTERDAY — rides and revenue from the system's bookings plus the rides that only
// exist in the Google Calendar, the month so far against last month, and the website.
//
// Same counting as the dashboard's month card: bookings by booking date (created_at, UTC →
// Berlin day, cancellations out), calendar rides by ride date from the mirror table
// calendar_rides (kind 'ride' = not a copy of a booking), so nothing is counted twice.

import { query } from '../db';
import { berlinDateSql, berlinMidnightUtcSql } from '../utils/berlinTime';

type Sum = { n: number; eur: number; noPrice: number };

const num = (v: unknown) => Number(v) || 0;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const eur = (v: number, digits = 2) =>
  `${v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Days from Berlin today to `date` ('YYYY-MM-DD'), for berlinMidnightUtcSql. */
function offsetOf(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${berlinDateSql(0)}T00:00:00Z`)) / 86_400_000);
}
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Bookings created in [from, to] (Berlin dates, inclusive). */
async function bookingSum(from: string, to: string): Promise<Sum> {
  const [r] = await query<any>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS eur FROM bookings
      WHERE status <> 'cancelled' AND created_at >= ? AND created_at < ?`,
    [berlinMidnightUtcSql(offsetOf(from)), berlinMidnightUtcSql(offsetOf(to) + 1)]);
  return { n: num(r?.n), eur: num(r?.eur), noPrice: 0 };
}

/** Calendar-only rides on [from, to] (Berlin dates, inclusive). */
async function calendarSum(from: string, to: string): Promise<Sum> {
  const [r] = await query<any>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS eur, SUM(price IS NULL) AS no_price
       FROM calendar_rides WHERE kind = 'ride' AND ride_time BETWEEN ? AND ?`,
    [`${from}T00:00`, `${to}T23:59`]);
  return { n: num(r?.n), eur: num(r?.eur), noPrice: num(r?.no_price) };
}

function delta(cur: number, prev: number): string {
  if (!prev) return cur ? '<span style="color:#059669">neu</span>' : '';
  const p = Math.round(((cur - prev) / prev) * 100);
  const color = p > 0 ? '#059669' : p < 0 ? '#dc2626' : '#6b7280';
  return `<span style="color:${color};white-space:nowrap">${p > 0 ? '▲' : p < 0 ? '▼' : '■'} ${Math.abs(p)} %</span>`;
}

const TR_WEEKDAY = (d: string) =>
  new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

// ---- HTML pieces (tables + inline styles: what mail clients render reliably) -----------

const C = { navy: '#0f2747', gold: '#c99a2e', text: '#111827', muted: '#6b7280', line: '#e5e7eb', soft: '#f6f7f9' };

function tile(label: string, value: string, sub: string, accent = C.navy): string {
  return `
    <td width="50%" style="padding:6px">
      <div style="background:#fff;border:1px solid ${C.line};border-radius:12px;padding:14px 16px">
        <div style="font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.04em">${label}</div>
        <div style="font-size:24px;font-weight:700;color:${accent};margin-top:4px;white-space:nowrap">${value}</div>
        <div style="font-size:12px;color:${C.muted};margin-top:2px">${sub}</div>
      </div>
    </td>`;
}

function section(title: string, body: string, right = ''): string {
  return `
    <tr><td style="padding:22px 24px 0">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:15px;font-weight:700;color:${C.text}">${title}</td>
        <td style="font-size:12px;color:${C.muted};text-align:right">${right}</td>
      </tr></table>
      <div style="margin-top:10px">${body}</div>
    </td></tr>`;
}

function statRow(cells: Array<[string, string]>): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:10px"><tr>${
    cells.map(([k, v]) => `
      <td style="padding:12px 8px;text-align:center">
        <div style="font-size:18px;font-weight:700;color:${C.text}">${v}</div>
        <div style="font-size:11px;color:${C.muted};margin-top:2px">${k}</div>
      </td>`).join('')
  }</tr></table>`;
}

function listTable(rows: string[], empty: string): string {
  if (!rows.length) return `<div style="font-size:13px;color:${C.muted};padding:10px 0">${empty}</div>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse">${rows.join('')}</table>`;
}

const badge = (text: string, bg: string, fg: string) =>
  `<span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;white-space:nowrap">${text}</span>`;

const PAY: Record<string, [string, string, string]> = {
  cash: ['Bar', '#ecfdf5', '#047857'], card: ['Karte', '#eff6ff', '#1d4ed8'],
  invoice: ['Rechnung', '#f5f3ff', '#6d28d9'], ueberweisung: ['Überweisung', '#fff7ed', '#c2410c'],
};

// Some addresses were stored URL-encoded ("Center%2C Terminalstraße").
const decode = (a: unknown) => { const s = String(a || ''); try { return decodeURIComponent(s); } catch { return s; } };
const short = (a: unknown) => {
  const s = decode(a).split(',')[0].trim();
  return s.length > 38 ? `${s.slice(0, 37)}…` : s;
};

export async function buildDailySummary(): Promise<{ subject: string; html: string; day: string }> {
  const day = berlinDateSql(-1);                 // yesterday — the mail goes out at 08:00
  const before = addDays(day, -1);
  const monthStart = `${day.slice(0, 8)}01`;
  const dom = +day.slice(8, 10);
  const prevMonthStart = `${addDays(monthStart, -1).slice(0, 8)}01`;
  const prevMonthDays = +addDays(monthStart, -1).slice(8, 10);
  const prevMonthTo = addDays(prevMonthStart, Math.min(dom, prevMonthDays) - 1);

  const [webDay, calDay, webBefore, calBefore, webMonth, calMonth, webPrev, calPrev] = await Promise.all([
    bookingSum(day, day), calendarSum(day, day), bookingSum(before, before), calendarSum(before, before),
    bookingSum(monthStart, day), calendarSum(monthStart, day), bookingSum(prevMonthStart, prevMonthTo), calendarSum(prevMonthStart, prevMonthTo),
  ]);
  const dayTotal = { n: webDay.n + calDay.n, eur: webDay.eur + calDay.eur };
  const beforeTotal = { n: webBefore.n + calBefore.n, eur: webBefore.eur + calBefore.eur };
  const monthTotal = { n: webMonth.n + calMonth.n, eur: webMonth.eur + calMonth.eur };
  const prevTotal = { n: webPrev.n + calPrev.n, eur: webPrev.eur + calPrev.eur };

  const from = berlinMidnightUtcSql(offsetOf(day));
  const to = berlinMidnightUtcSql(offsetOf(day) + 1);
  const [site] = await query<any>(
    `SELECT
       (SELECT COUNT(*) FROM visitor_sessions WHERE is_bot = 0 AND first_seen >= ? AND first_seen < ?) AS sessions,
       (SELECT COUNT(*) FROM bookings WHERE status <> 'cancelled' AND source = 'web' AND created_at >= ? AND created_at < ?) AS web_bookings,
       (SELECT COUNT(DISTINCT session_id) FROM visitor_events WHERE type = 'call_click' AND occurred_at >= ? AND occurred_at < ?) AS calls,
       (SELECT COUNT(*) FROM visitor_events WHERE type IN ('js_error', 'api_error') AND occurred_at >= ? AND occurred_at < ?) AS tech_errors`,
    [from, to, from, to, from, to, from, to]);
  const sources = await query<{ src: string; n: number }>(
    `SELECT CASE
              WHEN gclid IS NOT NULL AND gclid <> '' THEN 'Google Ads'
              WHEN referrer REGEXP 'google\\\\.|bing\\\\.|duckduckgo|ecosia|yahoo\\\\.|qwant|startpage' THEN 'Organik'
              WHEN referrer REGEXP 'chatgpt|openai|perplexity|claude\\\\.ai|gemini|copilot' THEN 'AI'
              WHEN referrer IS NULL OR referrer = '' OR referrer LIKE '%flughafen-muenchen.taxi%' THEN 'Direkt'
              ELSE 'Diğer siteler' END AS src, COUNT(*) AS n
       FROM visitor_sessions WHERE is_bot = 0 AND first_seen >= ? AND first_seen < ?
      GROUP BY src ORDER BY n DESC`,
    [from, to]);
  const fields = await query<{ target: string; n: number }>(
    `SELECT target, COUNT(*) AS n FROM visitor_events
      WHERE type = 'field_focus' AND occurred_at >= ? AND occurred_at < ?
      GROUP BY target ORDER BY n DESC LIMIT 3`,
    [from, to]);
  const bookings = await query<any>(
    `SELECT b.booking_number, b.name, b.pickup_address, b.dropoff_address, b.pickup_datetime, b.trip_type,
            b.price, b.payment_method, b.status, c.company_name
       FROM bookings b LEFT JOIN companies c ON c.id = b.company_id
      WHERE b.created_at >= ? AND b.created_at < ?
      ORDER BY b.created_at`,
    [from, to]);
  const calRides = await query<any>(
    `SELECT ride_time, summary, pickup_address, dropoff_address, price FROM calendar_rides
      WHERE kind = 'ride' AND ride_time BETWEEN ? AND ? ORDER BY ride_time`,
    [`${day}T00:00`, `${day}T23:59`]);

  const sessions = num(site?.sessions);
  const webBookings = num(site?.web_bookings);
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

  // ---- Rows --------------------------------------------------------------------------
  const bookingRows = bookings.filter((b) => b.status !== 'cancelled').map((b) => {
    const pay = PAY[b.payment_method] || [b.payment_method || '—', C.soft, C.muted];
    const ride = String(b.pickup_datetime || '').replace(' ', 'T');
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top">
          <div style="font-weight:600;color:${C.text}">${esc(b.name)}${b.company_name ? ` <span style="color:${C.muted};font-weight:400">· ${esc(b.company_name)}</span>` : ''}</div>
          <div style="color:#374151;margin-top:2px">${esc(short(b.pickup_address))} → ${esc(short(b.dropoff_address))}</div>
          <div style="color:${C.muted};font-size:12px;margin-top:3px">
            Fahrt ${esc(dm(ride.slice(0, 10)))} ${esc(ride.slice(11, 16))}${b.trip_type === 'roundtrip' ? ' · Hin & Rück' : ''} · ${esc(b.booking_number)}
          </div>
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid ${C.line};vertical-align:top;text-align:right;white-space:nowrap">
          <div style="font-weight:700;color:${C.text}">${eur(num(b.price))}</div>
          <div style="margin-top:4px">${badge(pay[0], pay[1], pay[2])}</div>
        </td>
      </tr>`;
  });
  const calendarRows = calRides.map((r) => `
      <tr>
        <td style="padding:10px 10px 10px 0;border-bottom:1px solid ${C.line};vertical-align:top;white-space:nowrap;font-weight:700;color:${C.navy}">${esc(String(r.ride_time).slice(11, 16))}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${C.line};vertical-align:top">
          <div style="font-weight:600;color:${C.text}">${esc(String(r.summary || 'Kalender-Fahrt').slice(0, 80))}</div>
          ${r.pickup_address || r.dropoff_address ? `<div style="color:#374151;margin-top:2px">${esc(short(r.pickup_address) || '?')} → ${esc(short(r.dropoff_address) || '?')}</div>` : ''}
        </td>
        <td style="padding:10px 0 10px 10px;border-bottom:1px solid ${C.line};vertical-align:top;text-align:right;white-space:nowrap;font-weight:700;color:${C.text}">
          ${r.price == null ? badge('fiyatsız', '#fef3c7', '#92400e') : eur(num(r.price))}
        </td>
      </tr>`);

  const sourceText = sources.length
    ? sources.map((s) => `${esc(s.src)} <b>${num(s.n)}</b>`).join(' &nbsp;·&nbsp; ')
    : 'veri yok';
  const noPriceNote = (s: Sum) => (s.noPrice ? ` · ${s.noPrice} fiyatsız` : '');

  const subject = `📊 Günlük özet ${dm(day)} — ${dayTotal.n} fahrt · ${eur(dayTotal.eur, 0)} (web ${webDay.n} · takvim ${calDay.n})`;

  const html = `
<div style="background:#eef1f5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${C.line}">
    <tr><td style="background:${C.navy};padding:22px 24px">
      <div style="font-size:12px;color:${C.gold};font-weight:700;letter-spacing:.08em;text-transform:uppercase">Flughafen-München.TAXI · Günlük özet</div>
      <div style="font-size:22px;color:#fff;font-weight:700;margin-top:6px">${esc(TR_WEEKDAY(day))}, ${dmy(day)}</div>
      <div style="font-size:13px;color:#cbd5e1;margin-top:4px">Dünün rakamları — web/sistem rezervasyonları + Google Takvim fahrt’ları</div>
    </td></tr>

    <tr><td style="padding:16px 18px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${tile('Toplam fahrt', String(dayTotal.n), `önceki gün ${beforeTotal.n} &nbsp;${delta(dayTotal.n, beforeTotal.n)}`)}
          ${tile('Toplam ciro', eur(dayTotal.eur), `önceki gün ${eur(beforeTotal.eur, 0)} &nbsp;${delta(dayTotal.eur, beforeTotal.eur)}`, C.gold)}
        </tr>
        <tr>
          ${tile('Web / sistem', eur(webDay.eur, 0), `${webDay.n} rezervasyon geldi (iptaller hariç)`)}
          ${tile('Kalender', eur(calDay.eur, 0), `${calDay.n} takvim fahrt’ı${noPriceNote(calDay)}`)}
        </tr>
      </table>
    </td></tr>

    ${section(`Bu ay · ${dm(monthStart)}–${dm(day)}`, `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border-radius:10px;font-size:13px">
        <tr>
          <td style="padding:14px 16px">
            <div style="font-size:22px;font-weight:700;color:${C.text}">${eur(monthTotal.eur)}</div>
            <div style="color:${C.muted};margin-top:2px">${monthTotal.n} fahrt &nbsp;·&nbsp; geçen ay aynı dönem ${eur(prevTotal.eur, 0)} &nbsp;${delta(monthTotal.eur, prevTotal.eur)}</div>
          </td>
        </tr>
        <tr><td style="padding:0 16px 14px">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
            <tr>
              <td style="color:${C.muted}">Web / sistem</td>
              <td style="text-align:right;color:${C.text}"><b>${webMonth.n}</b> · ${eur(webMonth.eur)}</td>
            </tr>
            <tr>
              <td style="color:${C.muted};padding-top:4px">Kalender${noPriceNote(calMonth)}</td>
              <td style="text-align:right;color:${C.text};padding-top:4px"><b>${calMonth.n}</b> · ${eur(calMonth.eur)}</td>
            </tr>
          </table>
        </td></tr>
      </table>`, `${prevMonthStart.slice(5, 7)}/${prevMonthStart.slice(0, 4)} ile karşılaştırma`)}

    ${section('Web sitesi', `
      ${statRow([
        ['Ziyaret', String(sessions)],
        ['Web rezervasyon', String(webBookings)],
        ['Dönüşüm', sessions ? `${((webBookings / sessions) * 100).toFixed(1).replace('.', ',')}%` : '—'],
        ['Telefon tıklaması', String(num(site?.calls))],
        ['Teknik hata', String(num(site?.tech_errors))],
      ])}
      <div style="font-size:12px;color:${C.muted};margin-top:8px">Trafik: ${sourceText}</div>
      ${fields.length ? `<div style="font-size:12px;color:${C.muted};margin-top:4px">Formda en çok dokunulan: ${fields.map((f) => `${esc(f.target)} ×${num(f.n)}`).join(', ')}</div>` : ''}`)}

    ${section(`Dün gelen rezervasyonlar (${bookingRows.length})`, listTable(bookingRows, 'Dün yeni rezervasyon gelmedi.'),
      cancelled ? `${cancelled} iptal hariç` : '')}

    ${section(`Dünkü Kalender fahrt’ları (${calendarRows.length})`, listTable(calendarRows, 'Dün takvimde (web rezervasyonu olmayan) fahrt yoktu.'))}

    <tr><td style="padding:24px">
      <a href="https://flughafen-muenchen.taxi/admin" style="display:inline-block;background:${C.navy};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px">Dashboard’u aç</a>
      <div style="font-size:11px;color:#9ca3af;margin-top:16px;line-height:1.5">
        Web/sistem: gelen güne göre, iptaller hariç · Kalender: fahrt gününe göre, web rezervasyonlarının takvim kopyaları hariç — dashboard’daki ay kartıyla aynı hesap.<br>
        Kapatma: Admin → System → E-posta Uyarıları → „Günlük özet“.
      </div>
    </td></tr>
  </table>
</div>`;

  return { subject, html, day };
}
