// Numbers for the SEO tab, from Search Console (seo_gsc_*) and our own visit tracking
// (visitor_sessions → bookings). Periods are compared with the same length just before.

import { query } from '../../db';
import { berlinDateSql, berlinMidnightUtcSql } from '../../utils/berlinTime';

// Search engines counted as organic (paid clicks carry gclid / utm_medium=cpc).
const ORGANIC_SQL = `s.is_bot = 0 AND s.gclid IS NULL AND COALESCE(s.utm_medium, '') <> 'cpc'
  AND (s.referrer LIKE '%google.%' OR s.referrer LIKE '%bing.%' OR s.referrer LIKE '%duckduckgo.%'
    OR s.referrer LIKE '%ecosia.%' OR s.referrer LIKE '%yahoo.%' OR s.referrer LIKE '%yandex.%'
    OR s.referrer LIKE '%qwant.%' OR s.referrer LIKE '%startpage.%')`;

/** Average CTR by position (industry curve) — to spot results that get too few clicks. */
export function expectedCtr(position: number): number {
  const curve = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  const p = Math.max(1, Math.round(position));
  return p <= 10 ? curve[p - 1] : 0.01;
}

export const pathOf = (u: string) => {
  try { return decodeURIComponent(new URL(u).pathname).replace(/\/$/, '') || '/'; } catch { return u; }
};

function periods(days: number) {
  // GSC data ends ~2 days ago; compare [end-days+1, end] with the period before it.
  const end = berlinDateSql(-2);
  const start = berlinDateSql(-(days + 1));
  const prevEnd = berlinDateSql(-(days + 2));
  const prevStart = berlinDateSql(-(2 * days + 1));
  return { start, end, prevStart, prevEnd };
}

type Agg = { clicks: number; impressions: number; ctr: number; position: number };
const aggSql = `COALESCE(SUM(clicks), 0) AS clicks, COALESCE(SUM(impressions), 0) AS impressions,
  COALESCE(SUM(position * impressions) / NULLIF(SUM(impressions), 0), 0) AS position`;
const toAgg = (r: any): Agg => {
  const clicks = Number(r?.clicks) || 0;
  const impressions = Number(r?.impressions) || 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: Number(r?.position) || 0 };
};

export async function gscTotals(days: number) {
  const p = periods(days);
  const [cur] = await query<any>(`SELECT ${aggSql} FROM seo_gsc_totals WHERE date BETWEEN ? AND ?`, [p.start, p.end]);
  const [prev] = await query<any>(`SELECT ${aggSql} FROM seo_gsc_totals WHERE date BETWEEN ? AND ?`, [p.prevStart, p.prevEnd]);
  const series = await query<any>(`
    SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, ${aggSql} FROM seo_gsc_totals
     WHERE date >= ? GROUP BY date ORDER BY date`, [berlinDateSql(-92)]);
  const devices = await query<any>(`SELECT device, ${aggSql} FROM seo_gsc_totals WHERE date BETWEEN ? AND ? GROUP BY device`, [p.start, p.end]);
  return {
    period: p,
    current: toAgg(cur),
    previous: toAgg(prev),
    series: series.map((r) => ({ date: r.date, ...toAgg(r) })),
    devices: devices.map((r) => ({ device: r.device, ...toAgg(r) })),
  };
}

export async function organicFunnel(days: number) {
  const since = berlinMidnightUtcSql(-(days - 1));
  const prevSince = berlinMidnightUtcSql(-(2 * days - 1));
  const row = (from: string, to: string | null) => query<any>(`
    SELECT COUNT(*) AS sessions,
           COUNT(b.id) AS bookings,
           COALESCE(SUM(b.price), 0) AS revenue
      FROM visitor_sessions s
      LEFT JOIN bookings b ON b.session_id = s.session_id AND b.status <> 'cancelled'
     WHERE ${ORGANIC_SQL} AND s.first_seen >= ? ${to ? 'AND s.first_seen < ?' : ''}`, to ? [from, to] : [from]);
  const [[cur], [prev]] = await Promise.all([row(since, null), row(prevSince, since)]);
  const series = await query<any>(`
    SELECT DATE(s.first_seen) AS d, COUNT(*) AS sessions, COUNT(b.id) AS bookings
      FROM visitor_sessions s
      LEFT JOIN bookings b ON b.session_id = s.session_id AND b.status <> 'cancelled'
     WHERE ${ORGANIC_SQL} AND s.first_seen >= ?
     GROUP BY DATE(s.first_seen) ORDER BY d`, [berlinMidnightUtcSql(-89)]);
  const engines = await query<any>(`
    SELECT CASE WHEN s.referrer LIKE '%google.%' THEN 'Google' WHEN s.referrer LIKE '%bing.%' THEN 'Bing'
                WHEN s.referrer LIKE '%duckduckgo.%' THEN 'DuckDuckGo' WHEN s.referrer LIKE '%ecosia.%' THEN 'Ecosia' ELSE 'Andere' END AS engine,
           COUNT(*) AS sessions, COUNT(b.id) AS bookings
      FROM visitor_sessions s LEFT JOIN bookings b ON b.session_id = s.session_id AND b.status <> 'cancelled'
     WHERE ${ORGANIC_SQL} AND s.first_seen >= ? GROUP BY engine ORDER BY sessions DESC`, [since]);
  const n = (r: any) => ({ sessions: Number(r?.sessions) || 0, bookings: Number(r?.bookings) || 0, revenue: Number(r?.revenue) || 0 });
  return {
    current: n(cur), previous: n(prev),
    series: series.map((r) => ({ date: new Date(r.d).toISOString().slice(0, 10), sessions: Number(r.sessions), bookings: Number(r.bookings) })),
    engines: engines.map((r) => ({ engine: r.engine, sessions: Number(r.sessions), bookings: Number(r.bookings) })),
  };
}

/** Organic landing pages with bookings (own tracking). Key = path without query. */
export async function organicLandingPages(days: number) {
  const rows = await query<any>(`
    SELECT SUBSTRING_INDEX(s.landing_page, '?', 1) AS path, COUNT(*) AS sessions, COUNT(b.id) AS bookings, COALESCE(SUM(b.price), 0) AS revenue
      FROM visitor_sessions s LEFT JOIN bookings b ON b.session_id = s.session_id AND b.status <> 'cancelled'
     WHERE ${ORGANIC_SQL} AND s.first_seen >= ?
     GROUP BY path ORDER BY sessions DESC LIMIT 200`, [berlinMidnightUtcSql(-(days - 1))]);
  return rows.map((r) => ({ path: (String(r.path || '/').replace(/\/$/, '') || '/'), sessions: Number(r.sessions), bookings: Number(r.bookings), revenue: Number(r.revenue) }));
}

export async function queryTable(days: number, device?: string) {
  const p = periods(days);
  const dev = device && ['DESKTOP', 'MOBILE', 'TABLET'].includes(device) ? device : null;
  const devSql = dev ? 'AND device = ?' : '';
  const params = (a: string, b: string) => (dev ? [a, b, dev] : [a, b]);
  const cur = await query<any>(`
    SELECT query, ${aggSql} FROM seo_gsc_daily WHERE date BETWEEN ? AND ? ${devSql}
     GROUP BY query ORDER BY clicks DESC, impressions DESC LIMIT 1000`, params(p.start, p.end));
  const prev = await query<any>(`
    SELECT query, ${aggSql} FROM seo_gsc_daily WHERE date BETWEEN ? AND ? ${devSql}
     GROUP BY query`, params(p.prevStart, p.prevEnd));
  const topPage = await query<any>(`
    SELECT query, page, SUM(impressions) AS imp FROM seo_gsc_daily WHERE date BETWEEN ? AND ? ${devSql}
     GROUP BY query, page`, params(p.start, p.end));
  const bestPage = new Map<string, { page: string; imp: number }>();
  for (const r of topPage) {
    const b = bestPage.get(r.query);
    if (!b || Number(r.imp) > b.imp) bestPage.set(r.query, { page: r.page, imp: Number(r.imp) });
  }
  const prevMap = new Map(prev.map((r) => [r.query, toAgg(r)]));
  const rows = cur.map((r) => {
    const a = toAgg(r);
    const b = prevMap.get(r.query) || null;
    return { query: r.query, ...a, prev: b, page: bestPage.get(r.query)?.page || null };
  });
  const striking = rows
    .filter((r) => r.position >= 4 && r.position <= 20 && r.impressions >= 20)
    .sort((a, b) => b.impressions - a.impressions).slice(0, 25);
  const ctrOpp = rows
    .filter((r) => r.position > 0 && r.position <= 6 && r.impressions >= 30 && r.ctr < expectedCtr(r.position) * 0.6)
    .map((r) => ({ ...r, expected: expectedCtr(r.position), missed: Math.round(r.impressions * expectedCtr(r.position) - r.clicks) }))
    .sort((a, b) => b.missed - a.missed).slice(0, 20);
  const curSet = new Set(rows.map((r) => r.query));
  const newQ = rows.filter((r) => !prevMap.has(r.query) && r.impressions >= 5).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
  const lost = prev.map((r) => ({ query: r.query, ...toAgg(r) }))
    .filter((r) => !curSet.has(r.query) && r.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
  // Position movers (Semrush „Position changes“): queries seen in both periods with enough impressions.
  const moved = rows
    .filter((r) => r.prev && r.impressions >= 10 && r.prev.impressions >= 10 && r.position > 0 && r.prev.position > 0)
    .map((r) => ({ query: r.query, page: r.page, position: r.position, prevPosition: r.prev!.position, change: r.prev!.position - r.position, impressions: r.impressions, clicks: r.clicks }))
    .filter((r) => Math.abs(r.change) >= 1);
  const winners = moved.filter((r) => r.change > 0).sort((a, b) => b.change * Math.log10(b.impressions + 1) - a.change * Math.log10(a.impressions + 1)).slice(0, 15);
  const losers = moved.filter((r) => r.change < 0).sort((a, b) => a.change * Math.log10(a.impressions + 1) - b.change * Math.log10(b.impressions + 1)).slice(0, 15);
  return { period: p, rows, striking, ctrOpp, newQueries: newQ, lostQueries: lost, winners, losers };
}

export async function trackedKeywords(keywords: string[]) {
  if (!keywords.length) return [];
  const rows = await query<any>(`
    SELECT query, DATE_FORMAT(date, '%Y-%m-%d') AS date, ${aggSql} FROM seo_gsc_daily
     WHERE date >= ? AND query IN (${keywords.map(() => '?').join(',')})
     GROUP BY query, date ORDER BY date`, [berlinDateSql(-92), ...keywords.map((k) => k.toLowerCase())]);
  return keywords.map((k) => {
    const list = rows.filter((r) => String(r.query).toLowerCase() === k.toLowerCase()).map((r) => ({ date: r.date, ...toAgg(r) }));
    const last7 = list.slice(-7);
    const prev7 = list.slice(-14, -7);
    const avg = (l: typeof list) => {
      const imp = l.reduce((s, x) => s + x.impressions, 0);
      return imp ? l.reduce((s, x) => s + x.position * x.impressions, 0) / imp : null;
    };
    return {
      keyword: k,
      position: avg(last7),
      prev_position: avg(prev7),
      clicks: last7.reduce((s, x) => s + x.clicks, 0),
      impressions: last7.reduce((s, x) => s + x.impressions, 0),
      series: list.map((x) => ({ date: x.date, position: x.position })),
    };
  });
}

export async function pageTable(days: number) {
  const p = periods(days);
  const cur = await query<any>(`SELECT page, ${aggSql} FROM seo_gsc_daily WHERE date BETWEEN ? AND ? GROUP BY page`, [p.start, p.end]);
  const prev = await query<any>(`SELECT page, ${aggSql} FROM seo_gsc_daily WHERE date BETWEEN ? AND ? GROUP BY page`, [p.prevStart, p.prevEnd]);
  const organic = await organicLandingPages(days);
  const issues = await query<any>(`SELECT url, SUM(severity = 'error') AS errors, SUM(severity = 'warning') AS warnings, COUNT(*) AS total
    FROM seo_audit_issues WHERE resolved_at IS NULL GROUP BY url`);
  const byPath = new Map<string, any>();
  const row = (path: string) => {
    if (!byPath.has(path)) byPath.set(path, { path, gsc: null, prev: null, organic: null, issues: null });
    return byPath.get(path);
  };
  for (const r of cur) { const x = row(pathOf(r.page)); x.gsc = toAgg(r); x.url = r.page; }
  for (const r of prev) row(pathOf(r.page)).prev = toAgg(r);
  for (const o of organic) row(o.path).organic = o;
  for (const i of issues) row(pathOf(i.url)).issues = { errors: Number(i.errors), warnings: Number(i.warnings), total: Number(i.total) };
  const list = Array.from(byPath.values()).filter((x) => x.gsc || x.organic);
  list.sort((a, b) => (b.gsc?.clicks || 0) - (a.gsc?.clicks || 0) || (b.organic?.sessions || 0) - (a.organic?.sessions || 0));
  const decay = list
    .filter((x) => x.prev && x.prev.clicks >= 5 && (x.gsc?.clicks || 0) < x.prev.clicks * 0.7)
    .map((x) => ({ path: x.path, clicks: x.gsc?.clicks || 0, prev_clicks: x.prev.clicks, change: ((x.gsc?.clicks || 0) - x.prev.clicks) / x.prev.clicks }))
    .sort((a, b) => a.change - b.change).slice(0, 10);
  return { period: p, pages: list.slice(0, 300), decay };
}

const BUCKETS = [
  { key: 'top3', label: '1–3', max: 3 },
  { key: 'top10', label: '4–10', max: 10 },
  { key: 'top20', label: '11–20', max: 20 },
  { key: 'top50', label: '21–50', max: 50 },
  { key: 'rest', label: '51+', max: Infinity },
] as const;
const bucketOf = (pos: number) => BUCKETS.find((b) => pos <= b.max)!.key;

/** Keyword position distribution (like Semrush „Organic positions“): now vs. before + weekly history. */
export async function positionDistribution(days: number) {
  const p = periods(days);
  const count = async (a: string, b: string) => {
    const rows = await query<any>(`
      SELECT query, SUM(position * impressions) / NULLIF(SUM(impressions), 0) AS pos FROM seo_gsc_daily
       WHERE date BETWEEN ? AND ? GROUP BY query HAVING SUM(impressions) > 0`, [a, b]);
    const out: Record<string, number> = { top3: 0, top10: 0, top20: 0, top50: 0, rest: 0 };
    for (const r of rows) out[bucketOf(Number(r.pos) || 999)]++;
    return out;
  };
  const weekly = await query<any>(`
    SELECT wk, DATE_FORMAT(MIN(d), '%Y-%m-%d') AS week,
           SUM(pos <= 3) AS top3, SUM(pos > 3 AND pos <= 10) AS top10, SUM(pos > 10 AND pos <= 20) AS top20,
           SUM(pos > 20 AND pos <= 50) AS top50, SUM(pos > 50) AS rest
      FROM (SELECT YEARWEEK(date, 3) AS wk, MIN(date) AS d, query,
                   SUM(position * impressions) / NULLIF(SUM(impressions), 0) AS pos
              FROM seo_gsc_daily WHERE date >= ? GROUP BY wk, query HAVING SUM(impressions) > 0) t
     GROUP BY wk ORDER BY wk`, [berlinDateSql(-7 * 17)]);
  return {
    buckets: BUCKETS.map((b) => ({ key: b.key, label: b.label })),
    current: await count(p.start, p.end),
    previous: await count(p.prevStart, p.prevEnd),
    weekly: weekly.map((w) => ({ week: w.week, top3: +w.top3, top10: +w.top10, top20: +w.top20, top50: +w.top50, rest: +w.rest })),
  };
}

/** Keyword cannibalization: one query, several of our pages splitting the impressions. */
export async function cannibalization(days: number) {
  const p = periods(days);
  const rows = await query<any>(`
    SELECT query, page, ${aggSql} FROM seo_gsc_daily WHERE date BETWEEN ? AND ? GROUP BY query, page`, [p.start, p.end]);
  const byQuery = new Map<string, Array<{ page: string } & Agg>>();
  for (const r of rows) {
    const list = byQuery.get(r.query) || [];
    list.push({ page: r.page, ...toAgg(r) });
    byQuery.set(r.query, list);
  }
  const out = [];
  for (const [q, pages] of Array.from(byQuery.entries())) {
    const total = pages.reduce((a, x) => a + x.impressions, 0);
    if (total < 20) continue;
    const competing = pages.filter((x) => x.impressions / total >= 0.1).sort((a, b) => b.impressions - a.impressions);
    if (competing.length < 2) continue;
    out.push({ query: q, impressions: total, clicks: pages.reduce((a, x) => a + x.clicks, 0), pages: competing.slice(0, 4).map((x) => ({ ...x, share: x.impressions / total })) });
  }
  return out.sort((a, b) => b.impressions - a.impressions).slice(0, 20);
}
