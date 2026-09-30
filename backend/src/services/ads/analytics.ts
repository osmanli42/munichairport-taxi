// Google Ads numbers for the coach tab. Our own tracking (ad clicks = sessions with gclid / cpc,
// bookings via visitor_id, last ad click within 30 days, cancelled bookings excluded) joined with
// the uploaded Google Ads reports (cost, impressions, impression share, Google's conversions).
// All day/hour buckets are Berlin time.

import { query, run } from '../../db';
import { berlinDateSql } from '../../utils/berlinTime';
import { latestImport } from './imports';

const LOOKBACK_MS = 30 * 86400_000;

const berlinFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
export function berlinParts(d: Date) {
  const p: Record<string, string> = {};
  for (const x of berlinFmt.formatToParts(d)) p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: WD[p.weekday] ?? 0 };
}

/** UTC 'YYYY-MM-DD HH:mm:ss' of Berlin midnight for a Berlin date string. */
function berlinMidnightUtc(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const p = berlinParts(guess);
  // Berlin is UTC+1/+2: midnight Berlin = guess − offset.
  const offsetH = p.day === day ? p.hour : p.hour - 24;
  return new Date(guess.getTime() - offsetH * 3600_000);
}
const sqlTs = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

export type Range = { from: string; to: string; days: number };
export function rangeFor(days: number, offsetDays = 0): Range {
  const to = berlinDateSql(-offsetDays);
  const from = berlinDateSql(-offsetDays - days + 1);
  return { from, to, days };
}
export const previousRange = (r: Range): Range => {
  const fromD = new Date(`${r.from}T00:00:00Z`);
  const to = new Date(fromD.getTime() - 86400_000).toISOString().slice(0, 10);
  const from = new Date(fromD.getTime() - r.days * 86400_000).toISOString().slice(0, 10);
  return { from, to, days: r.days };
};

type Session = {
  visitor_id: string; campaign: string | null; device: string | null; city: string | null; country: string | null;
  landing: string; keyword: string | null; matchtype: string | null; network: string | null; ts: number; single: boolean; gclid: string | null;
};
type Booking = { id: number; visitor_id: string | null; price: number; ts: number; status: string; pickup: string };

export type Attribution = { booking: Booking; session: Session };

const path = (u: string) => (String(u || '/').split('?')[0].replace(/\/$/, '') || '/');

// The ValueTrack columns are added by the tracking route on its first pageview; make sure they
// exist before the first analytics query too (fresh process, no visit yet).
let adsColumnsReady = false;
async function ensureAdsColumns() {
  if (adsColumnsReady) return;
  for (const col of ['ads_keyword VARCHAR(255)', 'ads_matchtype VARCHAR(10)', 'ads_adgroup VARCHAR(40)', 'ads_network VARCHAR(10)', 'ads_creative VARCHAR(40)']) {
    try { await run(`ALTER TABLE visitor_sessions ADD COLUMN ${col} DEFAULT NULL`); } catch { /* exists */ }
  }
  adsColumnsReady = true;
}

/** Ad sessions + bookings of a range, each booking tied to the visitor's last ad click before it. */
export async function loadAttribution(r: Range) {
  await ensureAdsColumns();
  const start = berlinMidnightUtc(r.from);
  const end = new Date(berlinMidnightUtc(r.to).getTime() + 86400_000);
  const rows = await query<any>(`
    SELECT visitor_id, utm_campaign, ua_device, city, country, landing_page, first_seen, pageview_count, gclid,
           ads_keyword, ads_matchtype, ads_network
      FROM visitor_sessions
     WHERE is_bot = 0 AND first_seen >= ? AND first_seen < ?
       AND ((gclid IS NOT NULL AND gclid <> '') OR LOWER(COALESCE(utm_medium, '')) IN ('cpc', 'ppc', 'paid'))`,
    [sqlTs(new Date(start.getTime() - LOOKBACK_MS)), sqlTs(end)]);
  const sessions: Session[] = rows.map((s) => ({
    visitor_id: s.visitor_id, campaign: (s.utm_campaign || '').trim() || null, device: s.ua_device || null,
    city: s.city || null, country: s.country || null, landing: path(s.landing_page), keyword: s.ads_keyword || null,
    matchtype: s.ads_matchtype || null, network: s.ads_network || null, ts: new Date(s.first_seen).getTime(),
    single: (Number(s.pageview_count) || 1) <= 1, gclid: s.gclid || null,
  }));
  const byVisitor = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.visitor_id) continue;
    const l = byVisitor.get(s.visitor_id) || [];
    l.push(s);
    byVisitor.set(s.visitor_id, l);
  }
  for (const l of Array.from(byVisitor.values())) l.sort((a, b) => a.ts - b.ts);

  const bookingRows = await query<any>(`
    SELECT id, visitor_id, price, created_at, status, pickup_datetime FROM bookings
     WHERE created_at >= ? AND created_at < ? AND status <> 'cancelled' AND visitor_id IS NOT NULL`,
    [sqlTs(start), sqlTs(end)]);
  const attributed: Attribution[] = [];
  for (const b of bookingRows) {
    const ts = new Date(b.created_at).getTime();
    const list = byVisitor.get(b.visitor_id);
    if (!list) continue;
    let last: Session | null = null;
    for (const s of list) if (s.ts <= ts && ts - s.ts <= LOOKBACK_MS) last = s;
    if (last) attributed.push({ booking: { id: b.id, visitor_id: b.visitor_id, price: Number(b.price) || 0, ts, status: b.status, pickup: b.pickup_datetime }, session: last });
  }
  const inRange = sessions.filter((s) => s.ts >= start.getTime() && s.ts < end.getTime());
  return { sessions: inRange, attributed };
}

type Agg = { clicks: number; bookings: number; revenue: number; single: number };
const emptyAgg = (): Agg => ({ clicks: 0, bookings: 0, revenue: 0, single: 0 });
function groupBy(att: Awaited<ReturnType<typeof loadAttribution>>, key: (s: Session) => string | null) {
  const m = new Map<string, Agg>();
  for (const s of att.sessions) {
    const k = key(s);
    if (k == null) continue;
    const a = m.get(k) || emptyAgg();
    a.clicks++;
    if (s.single) a.single++;
    m.set(k, a);
  }
  for (const { booking, session } of att.attributed) {
    const k = key(session);
    if (k == null) continue;
    const a = m.get(k) || emptyAgg();
    a.bookings++;
    a.revenue += booking.price;
    m.set(k, a);
  }
  return Array.from(m.entries()).map(([name, a]) => ({ name, ...a, revenue: Math.round(a.revenue * 100) / 100, cvr: a.clicks ? a.bookings / a.clicks : 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

/** Spend per Berlin day: uploaded campaign reports win, the old daily „ads_spend“ fills the gaps. */
export async function spendByDay(r: Range) {
  const camp = await query<any>(`SELECT DATE_FORMAT(day, '%Y-%m-%d') AS d, SUM(cost) AS cost, SUM(clicks) AS clicks, SUM(impressions) AS impr, SUM(conversions) AS conv
    FROM ads_campaign_stats WHERE day BETWEEN ? AND ? GROUP BY day`, [r.from, r.to]);
  const manual = await query<any>(`SELECT DATE_FORMAT(spend_date, '%Y-%m-%d') AS d, amount FROM ads_spend WHERE spend_date BETWEEN ? AND ?`, [r.from, r.to]).catch(() => []);
  const out = new Map<string, { cost: number; clicks: number | null; impressions: number | null; conversions: number | null; source: 'report' | 'manual' }>();
  for (const m of manual) out.set(m.d, { cost: Number(m.amount) || 0, clicks: null, impressions: null, conversions: null, source: 'manual' });
  for (const c of camp) out.set(c.d, { cost: Number(c.cost) || 0, clicks: Number(c.clicks) || 0, impressions: Number(c.impr) || 0, conversions: Number(c.conv) || 0, source: 'report' });
  return out;
}

export async function campaignNames() {
  const rows = await query<any>(`SELECT campaign_id, name FROM ads_campaign_names`);
  return new Map<string, string>(rows.map((r) => [String(r.campaign_id), r.name]));
}

function days(r: Range) {
  const out: string[] = [];
  for (let t = new Date(`${r.from}T00:00:00Z`).getTime(); t <= new Date(`${r.to}T00:00:00Z`).getTime(); t += 86400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function totals(att: Awaited<ReturnType<typeof loadAttribution>>, spend: Map<string, any>) {
  const cost = Array.from(spend.values()).reduce((a, x) => a + x.cost, 0);
  const clicksReport = Array.from(spend.values()).reduce((a, x) => a + (x.clicks || 0), 0);
  const impressions = Array.from(spend.values()).reduce((a, x) => a + (x.impressions || 0), 0);
  const googleConv = Array.from(spend.values()).reduce((a, x) => a + (x.conversions || 0), 0);
  const bookings = att.attributed.length;
  const revenue = att.attributed.reduce((a, x) => a + x.booking.price, 0);
  const clicks = att.sessions.length;
  return {
    cost: Math.round(cost * 100) / 100, clicks, clicksReport, impressions, googleConv: Math.round(googleConv * 10) / 10,
    bookings, revenue: Math.round(revenue * 100) / 100,
    cvr: clicks ? bookings / clicks : 0,
    cpa: bookings && cost ? cost / bookings : null,
    roas: cost ? revenue / cost : null,
    cpc: clicksReport && cost ? cost / clicksReport : null,
    ctr: impressions ? clicksReport / impressions : null,
    hasSpend: cost > 0,
    reportDays: Array.from(spend.values()).filter((x) => x.source === 'report').length,
  };
}

export async function settings() {
  const rows = await query<any>(`SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'ads_coach_%'`);
  const m = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const n = (k: string, d: number) => (m[k] != null && m[k] !== '' && Number.isFinite(Number(m[k])) ? Number(m[k]) : d);
  return {
    targetCpa: n('ads_coach_target_cpa', 12),
    monthlyBudget: n('ads_coach_monthly_budget', 0),
    marginPct: n('ads_coach_margin_pct', 60),
    conversionName: m.ads_coach_conversion_name || 'Buchung Umsatz (Offline)',
    reminder: m.ads_coach_reminder !== '0',
  };
}

export async function cockpit(daysN: number) {
  const r = rangeFor(daysN);
  const p = previousRange(r);
  const [att, attPrev, spend, spendPrev, cfg] = await Promise.all([loadAttribution(r), loadAttribution(p), spendByDay(r), spendByDay(p), settings()]);
  const cur = totals(att, spend);
  const prev = totals(attPrev, spendPrev);
  const series = days(r).map((d) => {
    const s = spend.get(d);
    const bookings = att.attributed.filter((a) => berlinParts(new Date(a.booking.ts)).day === d);
    return {
      date: d,
      clicks: att.sessions.filter((x) => berlinParts(new Date(x.ts)).day === d).length,
      bookings: bookings.length,
      revenue: Math.round(bookings.reduce((a, x) => a + x.booking.price, 0) * 100) / 100,
      cost: s ? Math.round(s.cost * 100) / 100 : null,
    };
  });
  // Budget pacing for the calendar month (Berlin).
  const today = berlinDateSql(0);
  const monthFrom = `${today.slice(0, 8)}01`;
  const monthSpend = await spendByDay({ from: monthFrom, to: today, days: 31 });
  const spentMonth = Array.from(monthSpend.values()).reduce((a, x) => a + x.cost, 0);
  const dayOfMonth = Number(today.slice(8, 10));
  const [y, m] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastSpendDay = Array.from(monthSpend.keys()).sort().pop() || null;
  const coveredDays = lastSpendDay ? Number(lastSpendDay.slice(8, 10)) : 0;
  const projected = coveredDays ? (spentMonth / coveredDays) * daysInMonth : null;
  const profit = cur.revenue * (cfg.marginPct / 100) - cur.cost;
  const profitPrev = prev.revenue * (cfg.marginPct / 100) - prev.cost;
  return {
    range: r, previous: p, settings: cfg, current: { ...cur, profit }, prev: { ...prev, profit: profitPrev }, series,
    pacing: { month: today.slice(0, 7), spent: Math.round(spentMonth * 100) / 100, projected: projected == null ? null : Math.round(projected), budget: cfg.monthlyBudget || null, dayOfMonth, daysInMonth, coveredDays },
  };
}

export async function campaigns(daysN: number) {
  const r = rangeFor(daysN);
  const [att, names, cfg] = await Promise.all([loadAttribution(r), campaignNames(), settings()]);
  const ours = groupBy(att, (s) => s.campaign || '(ohne Kampagne)');
  // Report rows: daily rows in range, else the latest period snapshot.
  let rep = await query<any>(`SELECT campaign, MAX(campaign_id) AS campaign_id, MAX(status) AS status, MAX(budget) AS budget,
      SUM(cost) AS cost, SUM(clicks) AS clicks, SUM(impressions) AS impressions, SUM(conversions) AS conversions, SUM(conv_value) AS conv_value,
      SUM(impr_share * impressions) / NULLIF(SUM(CASE WHEN impr_share IS NOT NULL THEN impressions END), 0) AS impr_share,
      AVG(lost_budget) AS lost_budget, AVG(lost_rank) AS lost_rank
    FROM ads_campaign_stats WHERE day BETWEEN ? AND ? GROUP BY campaign`, [r.from, r.to]);
  let reportSource: any = rep.length ? { type: 'daily', from: r.from, to: r.to } : null;
  if (!rep.length) {
    const last = await latestImport('campaigns');
    if (last) {
      rep = await query<any>(`SELECT campaign, campaign_id, status, budget, cost, clicks, impressions, conversions, conv_value, impr_share, lost_budget, lost_rank
        FROM ads_campaign_stats WHERE import_id = ?`, [last.id]);
      reportSource = { type: 'snapshot', from: last.period_from, to: last.period_to };
    }
  }
  const nameToId = new Map<string, string>();
  for (const [id, name] of Array.from(names.entries())) nameToId.set(name, id);
  const rows = new Map<string, any>();
  for (const x of rep) {
    const id = x.campaign_id || nameToId.get(x.campaign) || null;
    rows.set(id || `name:${x.campaign}`, {
      id, name: x.campaign, status: x.status, budget: x.budget == null ? null : Number(x.budget),
      cost: Number(x.cost) || 0, reportClicks: Number(x.clicks) || 0, impressions: Number(x.impressions) || 0,
      googleConv: Number(x.conversions) || 0, impr_share: x.impr_share == null ? null : Number(x.impr_share),
      lost_budget: x.lost_budget == null ? null : Number(x.lost_budget), lost_rank: x.lost_rank == null ? null : Number(x.lost_rank),
      clicks: 0, bookings: 0, revenue: 0,
    });
  }
  for (const o of ours) {
    const key = o.name; // campaign id (gad_campaignid) — report rows are keyed by id once the name is mapped
    const row = rows.get(key) || { id: /^\d+$/.test(o.name) ? o.name : null, name: names.get(o.name) || o.name, status: null, budget: null, cost: 0, reportClicks: 0, impressions: 0, googleConv: 0, impr_share: null, lost_budget: null, lost_rank: null, clicks: 0, bookings: 0, revenue: 0 };
    row.clicks = o.clicks; row.bookings = o.bookings; row.revenue = o.revenue;
    rows.set(key, row);
  }
  const list = Array.from(rows.values()).map((c) => {
    const cpa = c.bookings && c.cost ? c.cost / c.bookings : null;
    const roas = c.cost ? c.revenue / c.cost : null;
    let verdict: 'scale' | 'watch' | 'optimize' | 'pause' | 'nodata' = 'nodata';
    if (c.cost > 0) {
      if (c.bookings === 0 && c.googleConv < 1 && c.cost >= cfg.targetCpa * 3) verdict = 'pause';
      else if (cpa != null && cpa <= cfg.targetCpa && (c.lost_budget ?? 0) >= 10) verdict = 'scale';
      else if (cpa != null && cpa <= cfg.targetCpa * 1.2) verdict = 'watch';
      else verdict = 'optimize';
    } else if (c.clicks) verdict = 'watch';
    return { ...c, cpa, roas, cpc: c.reportClicks ? c.cost / c.reportClicks : null, ctr: c.impressions ? c.reportClicks / c.impressions : null, cvr: c.clicks ? c.bookings / c.clicks : 0, verdict };
  }).sort((a, b) => b.cost - a.cost || b.clicks - a.clicks);
  return { range: r, reportSource, targetCpa: cfg.targetCpa, campaigns: list };
}

const mtOf = (s: string | null) => {
  const x = (s || '').toLowerCase();
  if (x === 'e' || /genau|exact/.test(x)) return 'exact';
  if (x === 'p' || /wortgruppe|phrase/.test(x)) return 'phrase';
  if (x === 'b' || /weitgehend|broad/.test(x)) return 'broad';
  return x || null;
};

export async function keywords(daysN: number) {
  const r = rangeFor(daysN);
  const att = await loadAttribution(r);
  const tracked = att.sessions.filter((s) => s.keyword).length;
  const ours = groupBy(att, (s) => (s.keyword ? `${s.keyword}\u0001${mtOf(s.matchtype) || ''}` : null));
  const last = await latestImport('keywords');
  const rep = last ? await query<any>(`SELECT keyword, match_type, campaign, ad_group, status, quality_score, max_cpc, clicks, impressions, cost, conversions, impr_share
    FROM ads_keywords WHERE import_id = ?`, [last.id]) : [];
  const rows = new Map<string, any>();
  for (const k of rep) {
    const key = `${k.keyword}\u0001${mtOf(k.match_type) || ''}`;
    const prev = rows.get(key);
    const base = prev || { keyword: k.keyword, matchType: mtOf(k.match_type), campaign: k.campaign, adGroup: k.ad_group, status: k.status, quality: k.quality_score, maxCpc: k.max_cpc, cost: 0, reportClicks: 0, impressions: 0, googleConv: 0, impr_share: k.impr_share, clicks: 0, bookings: 0, revenue: 0 };
    base.cost += Number(k.cost) || 0; base.reportClicks += Number(k.clicks) || 0; base.impressions += Number(k.impressions) || 0; base.googleConv += Number(k.conversions) || 0;
    rows.set(key, base);
  }
  for (const o of ours) {
    const [kw, mt] = o.name.split('\u0001');
    const row = rows.get(o.name) || { keyword: kw, matchType: mt || null, campaign: null, adGroup: null, status: null, quality: null, maxCpc: null, cost: 0, reportClicks: 0, impressions: 0, googleConv: 0, impr_share: null, clicks: 0, bookings: 0, revenue: 0 };
    row.clicks = o.clicks; row.bookings = o.bookings; row.revenue = o.revenue;
    rows.set(o.name, row);
  }
  const list = Array.from(rows.values()).map((k) => ({
    ...k, cpa: k.cost && (k.bookings || k.googleConv) ? k.cost / (k.bookings || k.googleConv) : null,
    cpc: k.reportClicks ? k.cost / k.reportClicks : null, ctr: k.impressions ? k.reportClicks / k.impressions : null,
  })).sort((a, b) => b.cost - a.cost || b.clicks - a.clicks);
  // Match-type comparison.
  const byMt = new Map<string, any>();
  for (const k of list) {
    const key = k.matchType || '—';
    const a = byMt.get(key) || { matchType: key, cost: 0, reportClicks: 0, googleConv: 0, clicks: 0, bookings: 0, revenue: 0 };
    a.cost += k.cost; a.reportClicks += k.reportClicks; a.googleConv += k.googleConv; a.clicks += k.clicks; a.bookings += k.bookings; a.revenue += k.revenue;
    byMt.set(key, a);
  }
  return { range: r, report: last, trackedClicks: tracked, totalClicks: att.sessions.length, keywords: list, matchTypes: Array.from(byMt.values()) };
}

// Search terms that are never taxi bookings (German + English); used for negative keyword suggestions.
export const IRRELEVANT = [
  'job', 'jobs', 'stellenangebot', 'stellenangebote', 'gehalt', 'verdienst', 'fahrer werden', 'taxifahrer werden', 'taxischein', 'ausbildung', 'karriere', 'bewerbung',
  'telefonnummer', 'nummer', 'hotline', 'kontakt', 'fundbüro', 'lost and found', 'gepäck verloren', 'lost luggage',
  's-bahn', 'sbahn', 'bahn', 'bus', 'lufthansa express bus', 'zug', 'train', 'mvv', 'fahrplan', 'ubahn', 'u-bahn',
  'parken', 'parkplatz', 'parking', 'mietwagen', 'autovermietung', 'car rental', 'sixt', 'europcar',
  'uber', 'bolt', 'freenow', 'free now', 'isarfunk', 'taxi zentrale münchen', 'taxi-zentrale',
  'kosten rechner', 'taxirechner', 'taxameter', 'kostenlos', 'gratis', 'free', 'ankunft', 'abflug', 'arrivals', 'departures', 'flugstatus',
];

export async function searchTerms() {
  const last = await latestImport('search_terms');
  if (!last) return { report: null, terms: [], ngrams: [] };
  const rows = await query<any>(`SELECT term, keyword, match_type, campaign, ad_group, added_status, SUM(clicks) AS clicks, SUM(impressions) AS impressions,
      SUM(cost) AS cost, SUM(conversions) AS conversions, SUM(conv_value) AS conv_value
    FROM ads_search_terms WHERE import_id = ? GROUP BY term, keyword, match_type, campaign, ad_group, added_status ORDER BY cost DESC`, [last.id]);
  const terms = rows.map((t) => {
    const term = String(t.term);
    const irrelevant = IRRELEVANT.find((w) => new RegExp(`(^|\\s)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(term)) || null;
    return {
      term, keyword: t.keyword, matchType: mtOf(t.match_type), campaign: t.campaign, adGroup: t.ad_group, added: t.added_status,
      clicks: Number(t.clicks) || 0, impressions: Number(t.impressions) || 0, cost: Number(t.cost) || 0, conversions: Number(t.conversions) || 0,
      irrelevant,
    };
  });
  // Word n-grams (1–2 words) across all terms: where does money go without conversions?
  const grams = new Map<string, { gram: string; terms: number; clicks: number; cost: number; conversions: number }>();
  for (const t of terms) {
    const words = t.term.split(/\s+/).filter(Boolean);
    const set = new Set<string>();
    for (let i = 0; i < words.length; i++) {
      set.add(words[i]);
      if (i + 1 < words.length) set.add(`${words[i]} ${words[i + 1]}`);
    }
    for (const g of Array.from(set)) {
      const a = grams.get(g) || { gram: g, terms: 0, clicks: 0, cost: 0, conversions: 0 };
      a.terms++; a.clicks += t.clicks; a.cost += t.cost; a.conversions += t.conversions;
      grams.set(g, a);
    }
  }
  const ngrams = Array.from(grams.values()).filter((g) => g.terms >= 2).sort((a, b) => b.cost - a.cost).slice(0, 40);
  return { report: last, terms, ngrams };
}

export async function audience(daysN: number) {
  const r = rangeFor(daysN);
  const att = await loadAttribution(r);
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ clicks: 0, bookings: 0 })));
  for (const s of att.sessions) { const p = berlinParts(new Date(s.ts)); heat[p.weekday][p.hour].clicks++; }
  for (const a of att.attributed) { const p = berlinParts(new Date(a.session.ts)); heat[p.weekday][p.hour].bookings++; }
  const total = { clicks: att.sessions.length, bookings: att.attributed.length };
  const base = total.clicks ? total.bookings / total.clicks : 0;
  // Bid adjustment suggestion: relative conversion rate vs account average, clamped to ±50 %, only with enough clicks.
  const adj = (clicks: number, bookings: number, minClicks: number) => {
    if (clicks < minClicks || !base) return null;
    const rel = (bookings / clicks) / base - 1;
    return Math.max(-50, Math.min(50, Math.round(rel * 100 / 5) * 5));
  };
  const withAdj = (rows: ReturnType<typeof groupBy>, min: number) => rows.map((x) => ({ ...x, adjust: adj(x.clicks, x.bookings, min) }));
  const hours = Array.from({ length: 24 }, (_, h) => {
    const clicks = heat.reduce((a, d) => a + d[h].clicks, 0);
    const bookings = heat.reduce((a, d) => a + d[h].bookings, 0);
    return { hour: h, clicks, bookings, cvr: clicks ? bookings / clicks : 0 };
  });
  const weekdays = heat.map((d, i) => {
    const clicks = d.reduce((a, x) => a + x.clicks, 0);
    const bookings = d.reduce((a, x) => a + x.bookings, 0);
    return { weekday: i, clicks, bookings, cvr: clicks ? bookings / clicks : 0, adjust: adj(clicks, bookings, 40) };
  });
  // Hour blocks of 4 h — the granularity that makes sense for an ad schedule.
  const blocks = [0, 4, 8, 12, 16, 20].map((h) => {
    const clicks = hours.slice(h, h + 4).reduce((a, x) => a + x.clicks, 0);
    const bookings = hours.slice(h, h + 4).reduce((a, x) => a + x.bookings, 0);
    return { from: h, to: h + 4, clicks, bookings, cvr: clicks ? bookings / clicks : 0, adjust: adj(clicks, bookings, 40) };
  });
  return {
    range: r, total, baseCvr: base, heat, hours, weekdays, blocks,
    devices: withAdj(groupBy(att, (s) => s.device || 'unbekannt'), 40),
    cities: withAdj(groupBy(att, (s) => s.city || '—'), 25).slice(0, 15),
    countries: groupBy(att, (s) => s.country || '—').slice(0, 10),
    landings: groupBy(att, (s) => s.landing).slice(0, 15),
    networks: groupBy(att, (s) => s.network || null),
  };
}

/** Is the Final-URL-Suffix live? Share of recent ad clicks that carry kw/mt. */
export async function trackingCheck() {
  await ensureAdsColumns();
  const rows = await query<any>(`SELECT COUNT(*) AS total, SUM(ads_matchtype IS NOT NULL OR ads_network IS NOT NULL) AS tagged,
      DATE_FORMAT(MAX(CASE WHEN ads_matchtype IS NOT NULL OR ads_network IS NOT NULL THEN first_seen END), '%Y-%m-%dT%H:%i:%sZ') AS last_tagged,
      DATE_FORMAT(MAX(first_seen), '%Y-%m-%dT%H:%i:%sZ') AS last_click
    FROM visitor_sessions WHERE is_bot = 0 AND gclid IS NOT NULL AND gclid <> '' AND first_seen >= NOW() - INTERVAL 7 DAY`).catch(() => [{ total: 0, tagged: 0 }]);
  const r = rows[0] || {};
  return { clicks7d: Number(r.total) || 0, tagged7d: Number(r.tagged) || 0, lastTagged: r.last_tagged || null, lastClick: r.last_click || null };
}
