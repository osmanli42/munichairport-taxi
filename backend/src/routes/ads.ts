import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// --- Helpers ---------------------------------------------------------------

function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Local calendar day (server timezone) — used for ad-spend date matching.
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pct(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// A taxi booking from an ad click. Google Ads auto-tagging adds a `gclid`
// query param to the landing URL — that is our gold signal for "this visitor
// came from a paid Google Ads click". Manual UTM tagging (utm_medium=cpc) is
// also counted as a fallback.
function isAdSession(s: AdSession): boolean {
  if (s.gclid && s.gclid.trim() !== '') return true;
  const medium = (s.utm_medium || '').toLowerCase();
  return medium === 'cpc' || medium === 'ppc' || medium === 'paid';
}

interface AdSession {
  visitor_id: string;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  ua_device: string | null;
  country: string | null;
  city: string | null;
  landing_page: string | null;
  pageview_count: number;
  first_seen: Date | string;
  gclid: string | null;
}

interface BookingRow {
  visitor_id: string | null;
  price: number;
  created_at: Date | string;
  status: string;
}

interface PeriodMetrics {
  visitors: number;
  sessions: number;
  bookings: number;
  revenue: number;
  cvr: number;
  avgValue: number;
  bounceRate: number;
}

function emptyMetrics(): PeriodMetrics {
  return { visitors: 0, sessions: 0, bookings: 0, revenue: 0, cvr: 0, avgValue: 0, bounceRate: 0 };
}

const WEEKDAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']; // JS getDay() index

// --- ads_spend table -------------------------------------------------------

let spendTableReady = false;
async function ensureSpendTable(): Promise<void> {
  if (spendTableReady) return;
  await run(`
    CREATE TABLE IF NOT EXISTS ads_spend (
      spend_date DATE NOT NULL,
      amount DOUBLE NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (spend_date)
    )
  `);
  spendTableReady = true;
}

// --- Core computation ------------------------------------------------------

export interface OverviewResult {
  generatedAt: string;
  preset: string | null;
  days: number;
  isHourly: boolean;
  hasData: boolean;
  score: number | null;
  scoreBreakdown: { key: string; weight: number; points: number }[];
  kpis: Record<string, { value: number; prev: number; change: number | null }>;
  cost: {
    hasSpend: boolean;
    spend: { value: number; prev: number; change: number | null };
    cpa: { value: number | null; prev: number | null };
    roas: { value: number | null; prev: number | null };
    profit: { value: number; prev: number; change: number | null };
  };
  adShare: number;
  totalBookings: number;
  daily: { date: string; visitors: number; bookings: number; revenue: number }[];
  campaigns: { name: string; visitors: number; bookings: number; revenue: number; cvr: number }[];
  devices: { name: string; visitors: number; bookings: number; cvr: number }[];
  geo: {
    countries: { name: string; visitors: number; bookings: number; cvr: number }[];
    cities: { name: string; visitors: number; bookings: number; cvr: number }[];
  };
  dayparting: {
    byHour: { hour: number; visitors: number; bookings: number }[];
    byWeekday: { weekday: number; label: string; visitors: number; bookings: number }[];
  };
  comparison: {
    ad: { visitors: number; bookings: number; cvr: number };
    organic: { visitors: number; bookings: number; cvr: number };
  };
  conversionLag: {
    sampleSize: number;
    avgHours: number | null;
    buckets: { label: string; count: number }[];
  };
  alerts: { severity: 'high' | 'medium' | 'low'; title: string; detail: string }[];
  recommendations: { priority: 'high' | 'medium' | 'low'; title: string; detail: string }[];
}

export async function computeOverview(opts: { preset?: string; days?: number }): Promise<OverviewResult> {
  await ensureSpendTable();

  const preset = opts.preset || '';
  const now = new Date();

  function todayMidnight(): Date {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  let start: Date;
  let curEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let days: number;
  let isHourly = false;

  if (preset === 'today') {
    start = todayMidnight();
    curEnd = now;
    prevStart = new Date(start.getTime() - 86400000);
    prevEnd = start;
    days = 1;
    isHourly = true;
  } else if (preset === 'yesterday') {
    curEnd = todayMidnight();
    start = new Date(curEnd.getTime() - 86400000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 86400000);
    days = 1;
    isHourly = true;
  } else {
    days = Math.min(Math.max(opts.days || 30, 7), 90);
    curEnd = now;
    start = new Date(now.getTime() - days * 86400000);
    prevStart = new Date(now.getTime() - 2 * days * 86400000);
    prevEnd = start;
  }

  const sessions = await query<AdSession>(
    `SELECT visitor_id, utm_campaign, utm_source, utm_medium, ua_device,
            country, city, landing_page, pageview_count, first_seen, gclid
     FROM visitor_sessions
     WHERE is_bot = 0 AND first_seen >= ?
       AND ( (gclid IS NOT NULL AND gclid <> '')
             OR LOWER(COALESCE(utm_medium,'')) IN ('cpc','ppc','paid') )`,
    [fmt(prevStart)]
  );

  const bookings = await query<BookingRow>(
    `SELECT visitor_id, price, created_at, status
     FROM bookings
     WHERE created_at >= ?`,
    [fmt(prevStart)]
  );

  // Organic (non-ad) visitor count in the current period — for the ad-vs-organic
  // comparison. Computed as a SQL aggregate to avoid pulling all session rows.
  const organicRows = await query<{ c: number }>(
    `SELECT COUNT(DISTINCT visitor_id) AS c
     FROM visitor_sessions
     WHERE is_bot = 0 AND first_seen >= ? AND first_seen <= ?
       AND NOT ( (gclid IS NOT NULL AND gclid <> '')
                 OR LOWER(COALESCE(utm_medium,'')) IN ('cpc','ppc','paid') )`,
    [fmt(start), fmt(curEnd)]
  );
  const organicVisitors = Number(organicRows[0]?.c || 0);

  // Ad spend rows (daily) for the whole [prevStart, curEnd] range.
  const spendRows = await query<{ d: string; amount: number }>(
    `SELECT DATE_FORMAT(spend_date, '%Y-%m-%d') AS d, amount
     FROM ads_spend
     WHERE spend_date >= ? AND spend_date <= ?`,
    [localDay(prevStart), localDay(curEnd)]
  );

  const adSessions = sessions.filter(isAdSession);

  const adVisitorSet = new Set<string>();
  for (const s of adSessions) if (s.visitor_id) adVisitorSet.add(s.visitor_id);

  // visitor_id -> attributes from most recent ad session + earliest ad click.
  const visitorInfo = new Map<string, { campaign: string; device: string; country: string; city: string; ts: number }>();
  const firstAdClick = new Map<string, number>();
  for (const s of adSessions) {
    if (!s.visitor_id) continue;
    const ts = new Date(s.first_seen).getTime();
    if (!firstAdClick.has(s.visitor_id) || ts < firstAdClick.get(s.visitor_id)!) {
      firstAdClick.set(s.visitor_id, ts);
    }
    const prev = visitorInfo.get(s.visitor_id);
    if (prev && prev.ts >= ts) continue;
    const campaign =
      s.utm_campaign && s.utm_campaign.trim() !== ''
        ? s.utm_campaign.trim()
        : (s.gclid && s.gclid.trim() !== '' ? 'Google Ads (oto-etiket)' : '(etiketsiz)');
    visitorInfo.set(s.visitor_id, {
      campaign,
      device: s.ua_device || 'unbekannt',
      country: s.country || '—',
      city: s.city || '—',
      ts,
    });
  }

  const inCurrent = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= curEnd.getTime();
  };
  const inPrev = (d: Date | string) => {
    const t = new Date(d).getTime();
    return t >= prevStart.getTime() && t < prevEnd.getTime();
  };

  function periodMetrics(window: 'current' | 'prev'): PeriodMetrics {
    const inWin = window === 'current' ? inCurrent : inPrev;
    const winSessions = adSessions.filter((s) => inWin(s.first_seen));
    const visitorIds = new Set(winSessions.map((s) => s.visitor_id).filter(Boolean));
    const winBookings = bookings.filter(
      (b) => b.visitor_id && adVisitorSet.has(b.visitor_id) && inWin(b.created_at)
    );
    const revenue = winBookings.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const bounce = winSessions.filter((s) => (Number(s.pageview_count) || 1) <= 1).length;
    const m = emptyMetrics();
    m.visitors = visitorIds.size;
    m.sessions = winSessions.length;
    m.bookings = winBookings.length;
    m.revenue = Math.round(revenue * 100) / 100;
    m.cvr = m.visitors > 0 ? m.bookings / m.visitors : 0;
    m.avgValue = m.bookings > 0 ? Math.round((revenue / m.bookings) * 100) / 100 : 0;
    m.bounceRate = m.sessions > 0 ? bounce / m.sessions : 0;
    return m;
  }

  const cur = periodMetrics('current');
  const prev = periodMetrics('prev');

  const totalBookingsCurrent = bookings.filter((b) => inCurrent(b.created_at)).length;

  // --- Ad spend / ROAS / CPA / profit --------------------------------------
  const curDayLo = localDay(start), curDayHi = localDay(curEnd);
  const prevDayLo = localDay(prevStart), prevDayHi = localDay(prevEnd);
  let curCost = 0, prevCost = 0;
  for (const r of spendRows) {
    if (r.d >= curDayLo && r.d <= curDayHi) curCost += Number(r.amount) || 0;
    else if (r.d >= prevDayLo && r.d < prevDayHi) prevCost += Number(r.amount) || 0;
  }
  curCost = Math.round(curCost * 100) / 100;
  prevCost = Math.round(prevCost * 100) / 100;
  const hasSpend = curCost > 0;
  const curCpa = cur.bookings > 0 ? Math.round((curCost / cur.bookings) * 100) / 100 : null;
  const prevCpa = prev.bookings > 0 ? Math.round((prevCost / prev.bookings) * 100) / 100 : null;
  const curRoas = curCost > 0 ? Math.round((cur.revenue / curCost) * 100) / 100 : null;
  const prevRoas = prevCost > 0 ? Math.round((prev.revenue / prevCost) * 100) / 100 : null;
  const curProfit = Math.round((cur.revenue - curCost) * 100) / 100;
  const prevProfit = Math.round((prev.revenue - prevCost) * 100) / 100;

  // --- Daily / hourly series -----------------------------------------------
  const series: Record<string, { visitors: Set<string>; bookings: number; revenue: number }> = {};
  const hourKey = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:00`;

  if (isHourly) {
    const maxHour = preset === 'today' ? now.getHours() : 23;
    for (let h = 0; h <= maxHour; h++) {
      series[`${String(h).padStart(2, '0')}:00`] = { visitors: new Set(), bookings: 0, revenue: 0 };
    }
    for (const s of adSessions) {
      if (!inCurrent(s.first_seen)) continue;
      const k = hourKey(new Date(s.first_seen));
      if (series[k] && s.visitor_id) series[k].visitors.add(s.visitor_id);
    }
    for (const b of bookings) {
      if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
      const k = hourKey(new Date(b.created_at));
      if (series[k]) { series[k].bookings += 1; series[k].revenue += Number(b.price) || 0; }
    }
  } else {
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      series[dayKey(d)] = { visitors: new Set(), bookings: 0, revenue: 0 };
    }
    for (const s of adSessions) {
      if (!inCurrent(s.first_seen)) continue;
      const k = dayKey(new Date(s.first_seen));
      if (series[k] && s.visitor_id) series[k].visitors.add(s.visitor_id);
    }
    for (const b of bookings) {
      if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
      const k = dayKey(new Date(b.created_at));
      if (series[k]) { series[k].bookings += 1; series[k].revenue += Number(b.price) || 0; }
    }
  }
  const daily = Object.keys(series).sort().map((k) => ({
    date: k,
    visitors: series[k].visitors.size,
    bookings: series[k].bookings,
    revenue: Math.round(series[k].revenue * 100) / 100,
  }));

  const last7 = daily.slice(-7);
  const last7Visitors = last7.reduce((s, d) => s + d.visitors, 0);
  const last7Bookings = last7.reduce((s, d) => s + d.bookings, 0);

  // --- Campaign breakdown --------------------------------------------------
  const campAgg: Record<string, { visitors: Set<string>; bookings: number; revenue: number }> = {};
  for (const s of adSessions) {
    if (!inCurrent(s.first_seen) || !s.visitor_id) continue;
    const c = visitorInfo.get(s.visitor_id)?.campaign || '(etiketsiz)';
    (campAgg[c] ||= { visitors: new Set(), bookings: 0, revenue: 0 }).visitors.add(s.visitor_id);
  }
  for (const b of bookings) {
    if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
    const c = visitorInfo.get(b.visitor_id)?.campaign || '(etiketsiz)';
    if (campAgg[c]) { campAgg[c].bookings += 1; campAgg[c].revenue += Number(b.price) || 0; }
  }
  const campaigns = Object.entries(campAgg)
    .map(([name, v]) => ({
      name,
      visitors: v.visitors.size,
      bookings: v.bookings,
      revenue: Math.round(v.revenue * 100) / 100,
      cvr: v.visitors.size > 0 ? Math.round((v.bookings / v.visitors.size) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);

  // --- Device breakdown ----------------------------------------------------
  const devAgg: Record<string, { visitors: Set<string>; bookings: number }> = {};
  for (const s of adSessions) {
    if (!inCurrent(s.first_seen) || !s.visitor_id) continue;
    const d = visitorInfo.get(s.visitor_id)?.device || 'unbekannt';
    (devAgg[d] ||= { visitors: new Set(), bookings: 0 }).visitors.add(s.visitor_id);
  }
  for (const b of bookings) {
    if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
    const d = visitorInfo.get(b.visitor_id)?.device || 'unbekannt';
    if (devAgg[d]) devAgg[d].bookings += 1;
  }
  const devices = Object.entries(devAgg)
    .map(([name, v]) => ({
      name,
      visitors: v.visitors.size,
      bookings: v.bookings,
      cvr: v.visitors.size > 0 ? Math.round((v.bookings / v.visitors.size) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);

  // --- Geographic breakdown ------------------------------------------------
  function geoAgg(field: 'country' | 'city') {
    const agg: Record<string, { visitors: Set<string>; bookings: number }> = {};
    for (const s of adSessions) {
      if (!inCurrent(s.first_seen) || !s.visitor_id) continue;
      const info = visitorInfo.get(s.visitor_id);
      const key = (info?.[field] || '—').trim() || '—';
      (agg[key] ||= { visitors: new Set(), bookings: 0 }).visitors.add(s.visitor_id);
    }
    for (const b of bookings) {
      if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
      const key = (visitorInfo.get(b.visitor_id)?.[field] || '—').trim() || '—';
      if (agg[key]) agg[key].bookings += 1;
    }
    return Object.entries(agg)
      .map(([name, v]) => ({
        name,
        visitors: v.visitors.size,
        bookings: v.bookings,
        cvr: v.visitors.size > 0 ? Math.round((v.bookings / v.visitors.size) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);
  }
  const geo = { countries: geoAgg('country').slice(0, 6), cities: geoAgg('city').slice(0, 8) };

  // --- Dayparting (hour-of-day + weekday) ----------------------------------
  const hourAgg = Array.from({ length: 24 }, () => ({ visitors: new Set<string>(), bookings: 0 }));
  const wdAgg = Array.from({ length: 7 }, () => ({ visitors: new Set<string>(), bookings: 0 }));
  for (const s of adSessions) {
    if (!inCurrent(s.first_seen) || !s.visitor_id) continue;
    const d = new Date(s.first_seen);
    hourAgg[d.getHours()].visitors.add(s.visitor_id);
    wdAgg[d.getDay()].visitors.add(s.visitor_id);
  }
  for (const b of bookings) {
    if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
    const d = new Date(b.created_at);
    hourAgg[d.getHours()].bookings += 1;
    wdAgg[d.getDay()].bookings += 1;
  }
  const dayparting = {
    byHour: hourAgg.map((v, hour) => ({ hour, visitors: v.visitors.size, bookings: v.bookings })),
    // Monday-first display order
    byWeekday: [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
      weekday: wd,
      label: WEEKDAYS[wd],
      visitors: wdAgg[wd].visitors.size,
      bookings: wdAgg[wd].bookings,
    })),
  };

  // --- Ad vs organic comparison --------------------------------------------
  const organicBookings = bookings.filter(
    (b) => inCurrent(b.created_at) && b.visitor_id && !adVisitorSet.has(b.visitor_id)
  ).length;
  const comparison = {
    ad: {
      visitors: cur.visitors,
      bookings: cur.bookings,
      cvr: cur.visitors > 0 ? Math.round((cur.bookings / cur.visitors) * 1000) / 10 : 0,
    },
    organic: {
      visitors: organicVisitors,
      bookings: organicBookings,
      cvr: organicVisitors > 0 ? Math.round((organicBookings / organicVisitors) * 1000) / 10 : 0,
    },
  };

  // --- Conversion lag (ad click -> booking) --------------------------------
  const lags: number[] = [];
  for (const b of bookings) {
    if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
    const click = firstAdClick.get(b.visitor_id);
    if (click == null) continue;
    const lag = new Date(b.created_at).getTime() - click;
    if (lag >= 0) lags.push(lag);
  }
  const lagBuckets = [
    { label: '< 1 saat', count: 0 },
    { label: '1–24 saat', count: 0 },
    { label: '1–3 gün', count: 0 },
    { label: '3+ gün', count: 0 },
  ];
  for (const l of lags) {
    if (l < 3600000) lagBuckets[0].count += 1;
    else if (l < 86400000) lagBuckets[1].count += 1;
    else if (l < 3 * 86400000) lagBuckets[2].count += 1;
    else lagBuckets[3].count += 1;
  }
  const conversionLag = {
    sampleSize: lags.length,
    avgHours: lags.length > 0
      ? Math.round((lags.reduce((s, l) => s + l, 0) / lags.length / 3600000) * 10) / 10
      : null,
    buckets: lagBuckets,
  };

  // --- Health score --------------------------------------------------------
  let score: number | null = null;
  let scoreBreakdown: { key: string; weight: number; points: number }[] = [];
  if (cur.visitors > 0) {
    const cvrRatio = prev.cvr > 0 ? cur.cvr / prev.cvr : cur.cvr > 0 ? 1.2 : 1;
    const cvrTrend = cvrRatio >= 1.1 ? 100 : cvrRatio >= 0.9 ? 75 : cvrRatio >= 0.7 ? 50 : 25;

    const volRatio = prev.bookings > 0 ? cur.bookings / prev.bookings : cur.bookings > 0 ? 1.2 : 1;
    const volTrend = volRatio >= 1.1 ? 100 : volRatio >= 0.9 ? 75 : volRatio >= 0.7 ? 50 : 25;

    const cvrPct = cur.cvr * 100;
    const cvrLevel = cvrPct >= 6 ? 100 : cvrPct >= 4 ? 75 : cvrPct >= 2 ? 50 : 25;

    const brPct = cur.bounceRate * 100;
    const engagement = brPct <= 40 ? 100 : brPct <= 60 ? 75 : brPct <= 75 ? 50 : 25;

    if (hasSpend) {
      const roasVal = curRoas ?? 0;
      const roasPts = roasVal >= 5 ? 100 : roasVal >= 3 ? 75 : roasVal >= 1.5 ? 50 : 25;
      scoreBreakdown = [
        { key: 'Kârlılık (ROAS)', weight: 0.30, points: roasPts },
        { key: 'Dönüşüm trendi', weight: 0.25, points: cvrTrend },
        { key: 'Hacim trendi', weight: 0.15, points: volTrend },
        { key: 'Dönüşüm seviyesi', weight: 0.15, points: cvrLevel },
        { key: 'Ziyaretçi etkileşimi', weight: 0.15, points: engagement },
      ];
    } else {
      scoreBreakdown = [
        { key: 'Dönüşüm trendi', weight: 0.35, points: cvrTrend },
        { key: 'Hacim trendi', weight: 0.25, points: volTrend },
        { key: 'Dönüşüm seviyesi', weight: 0.25, points: cvrLevel },
        { key: 'Ziyaretçi etkileşimi', weight: 0.15, points: engagement },
      ];
    }
    score = Math.round(scoreBreakdown.reduce((s, p) => s + p.weight * p.points, 0));
  }

  // --- Anomalies / alerts --------------------------------------------------
  const alerts: { severity: 'high' | 'medium' | 'low'; title: string; detail: string }[] = [];

  if (hasSpend && curRoas !== null && curRoas < 1) {
    alerts.push({
      severity: 'high',
      title: 'Reklam zarar ediyor (ROAS < 1)',
      detail: `Bu dönem ${curCost.toFixed(0)}€ harcanıp ${cur.revenue.toFixed(0)}€ ciro elde edildi (ROAS ${curRoas}). Harcama cirodan fazla — kampanya/teklif acil gözden geçirilmeli.`,
    });
  }
  if (hasSpend && curCpa !== null && cur.avgValue > 0 && curCpa > cur.avgValue) {
    alerts.push({
      severity: 'high',
      title: 'Rezervasyon maliyeti, rezervasyon değerini aşıyor',
      detail: `Rezervasyon başına maliyet (CPA) ${curCpa}€, ortalama rezervasyon değeri ise ${cur.avgValue}€. Her rezervasyon zararına geliyor.`,
    });
  }
  if (prev.cvr > 0 && cur.cvr < prev.cvr * 0.75 && cur.visitors >= 10) {
    alerts.push({
      severity: 'high',
      title: 'Dönüşüm oranı belirgin düştü',
      detail: `Dönüşüm oranı %${(prev.cvr * 100).toFixed(1)} → %${(cur.cvr * 100).toFixed(1)} (önceki ${days} güne göre). İniş sayfası veya teklif gözden geçirilmeli.`,
    });
  }
  if (prev.visitors > 0 && cur.visitors < prev.visitors * 0.7) {
    alerts.push({
      severity: 'medium',
      title: 'Reklam trafiği azaldı',
      detail: `Reklamdan gelen ziyaretçi ${prev.visitors} → ${cur.visitors}. Bütçe, teklif (bid) veya kampanya durumu kontrol edilmeli.`,
    });
  }
  if (prev.revenue > 0 && cur.revenue < prev.revenue * 0.7 && cur.visitors >= 10) {
    alerts.push({
      severity: 'high',
      title: 'Reklam cirosu düştü',
      detail: `Reklam kaynaklı ciro ${prev.revenue.toFixed(0)}€ → ${cur.revenue.toFixed(0)}€.`,
    });
  }
  if (last7Visitors >= 8 && last7Bookings === 0) {
    alerts.push({
      severity: 'high',
      title: 'Dönüşüm takibi kopuk olabilir',
      detail: `Son 7 günde reklamdan ${last7Visitors} ziyaretçi geldi ama hiç rezervasyon eşleşmedi. Booking formundaki visitor_id takibi veya gtag conversion bozulmuş olabilir.`,
    });
  }
  const totalGclid = sessions.filter((s) => s.gclid && s.gclid.trim() !== '').length;
  if (totalGclid === 0 && adSessions.length > 0) {
    alerts.push({
      severity: 'medium',
      title: 'Google Ads otomatik etiketleme (auto-tagging) kapalı olabilir',
      detail: 'Hiç gclid parametresi yakalanmadı. Google Ads hesabında auto-tagging açık değilse kampanya bazlı atribüsyon eksik kalır.',
    });
  }

  // --- Recommendations -----------------------------------------------------
  const recommendations: { priority: 'high' | 'medium' | 'low'; title: string; detail: string }[] = [];

  if (!hasSpend && cur.visitors >= 5) {
    recommendations.push({
      priority: 'medium',
      title: 'Reklam harcamasını girin — ROAS ve kâr hesaplanamıyor',
      detail: 'Dönem harcaması girilmediği için CPA, ROAS ve net kâr hesaplanamıyor. Panelin üstündeki "Harcama" alanından dönem harcamanızı girin.',
    });
  }
  if (cur.visitors >= 10 && cur.cvr * 100 < 3) {
    recommendations.push({
      priority: 'high',
      title: 'Dönüşüm oranı düşük — iniş sayfasını iyileştir',
      detail: `Reklam ziyaretçisinin yalnızca %${(cur.cvr * 100).toFixed(1)}'i rezervasyon yapıyor. Buchen sayfasında fiyat netliği, güven unsurları (yorumlar, telefon) ve form adımı sayısı gözden geçirilmeli.`,
    });
  }
  if (cur.bounceRate * 100 > 65 && cur.sessions >= 10) {
    recommendations.push({
      priority: 'medium',
      title: 'Tek-sayfa çıkış oranı yüksek',
      detail: `Reklam oturumlarının %${(cur.bounceRate * 100).toFixed(0)}'i tek sayfada bitiyor. Sayfa hızı, mobil uyum ve reklam metni ↔ iniş sayfası uyumu kontrol edilmeli.`,
    });
  }
  for (const c of campaigns) {
    if (c.visitors >= 15 && c.bookings === 0) {
      recommendations.push({
        priority: 'high',
        title: `"${c.name}" kampanyası dönüşüm getirmiyor`,
        detail: `${c.visitors} ziyaretçi, 0 rezervasyon. Anahtar kelime/hedefleme alaka düzeyi düşük olabilir — durdurmayı veya negatif kelime eklemeyi düşünün.`,
      });
    }
  }
  const bestCampaign = campaigns.filter((c) => c.bookings >= 3).sort((a, b) => b.cvr - a.cvr)[0];
  if (bestCampaign && bestCampaign.cvr >= 6) {
    recommendations.push({
      priority: 'medium',
      title: `"${bestCampaign.name}" iyi performans gösteriyor`,
      detail: `Dönüşüm oranı %${bestCampaign.cvr}. Bütçe artışı veya teklif yükseltme bu kampanyada değerlendirilebilir.`,
    });
  }
  const mobile = devices.find((d) => /mobile|phone/i.test(d.name));
  const desktop = devices.find((d) => /desktop|pc/i.test(d.name));
  if (mobile && desktop && mobile.visitors >= 10 && desktop.cvr > 0 && mobile.cvr < desktop.cvr * 0.6) {
    recommendations.push({
      priority: 'medium',
      title: 'Mobil dönüşüm masaüstünün belirgin altında',
      detail: `Mobil %${mobile.cvr} ↔ masaüstü %${desktop.cvr}. Mobil form deneyimi ve sayfa hızı öncelikli iyileştirme alanı.`,
    });
  }
  // Dayparting recommendation — only when enough data
  const dpTotal = dayparting.byHour.reduce((s, h) => s + h.visitors, 0);
  if (dpTotal >= 20) {
    const bestHour = [...dayparting.byHour].sort((a, b) => b.bookings - a.bookings || b.visitors - a.visitors)[0];
    const bestWd = [...dayparting.byWeekday].sort((a, b) => b.bookings - a.bookings || b.visitors - a.visitors)[0];
    if (bestHour && (bestHour.bookings > 0 || bestHour.visitors >= 5)) {
      recommendations.push({
        priority: 'low',
        title: 'Reklam saatlerini yoğun döneme kaydır',
        detail: `En iyi dönüşüm ${bestWd.label} günü ve ${String(bestHour.hour).padStart(2, '0')}:00 saati civarında. Google Ads reklam takvimi (ad schedule) bu dilime ağırlık verecek şekilde ayarlanabilir.`,
      });
    }
  }
  // Ad vs organic recommendation
  if (comparison.ad.visitors >= 20 && comparison.organic.visitors >= 20 &&
      comparison.organic.cvr > 0 && comparison.ad.cvr < comparison.organic.cvr * 0.7) {
    recommendations.push({
      priority: 'medium',
      title: 'Reklam trafiği organikten daha kötü dönüşüyor',
      detail: `Reklam %${comparison.ad.cvr} ↔ organik %${comparison.organic.cvr}. Reklam hedefleme/anahtar kelimeleri, organik ziyaretçi kalitesine göre zayıf — hedefleme daraltılabilir.`,
    });
  }
  if (recommendations.length === 0 && alerts.length === 0 && score !== null && score >= 75) {
    recommendations.push({
      priority: 'low',
      title: 'Reklam performansı sağlıklı',
      detail: 'Belirgin bir sorun tespit edilmedi. Mevcut kampanya ve bütçe ayarları korunabilir.',
    });
  }

  return {
    generatedAt: now.toISOString(),
    preset: preset || null,
    days,
    isHourly,
    hasData: cur.visitors > 0 || prev.visitors > 0,
    score,
    scoreBreakdown,
    kpis: {
      visitors: { value: cur.visitors, prev: prev.visitors, change: pct(cur.visitors, prev.visitors) },
      bookings: { value: cur.bookings, prev: prev.bookings, change: pct(cur.bookings, prev.bookings) },
      cvr: {
        value: Math.round(cur.cvr * 1000) / 10,
        prev: Math.round(prev.cvr * 1000) / 10,
        change: pct(cur.cvr, prev.cvr),
      },
      revenue: { value: cur.revenue, prev: prev.revenue, change: pct(cur.revenue, prev.revenue) },
      avgValue: { value: cur.avgValue, prev: prev.avgValue, change: pct(cur.avgValue, prev.avgValue) },
      bounceRate: {
        value: Math.round(cur.bounceRate * 1000) / 10,
        prev: Math.round(prev.bounceRate * 1000) / 10,
        change: pct(cur.bounceRate, prev.bounceRate),
      },
    },
    cost: {
      hasSpend,
      spend: { value: curCost, prev: prevCost, change: pct(curCost, prevCost) },
      cpa: { value: curCpa, prev: prevCpa },
      roas: { value: curRoas, prev: prevRoas },
      profit: { value: curProfit, prev: prevProfit, change: pct(curProfit, prevProfit) },
    },
    adShare: totalBookingsCurrent > 0 ? Math.round((cur.bookings / totalBookingsCurrent) * 1000) / 10 : 0,
    totalBookings: totalBookingsCurrent,
    daily,
    campaigns,
    devices,
    geo,
    dayparting,
    comparison,
    conversionLag,
    alerts,
    recommendations,
  };
}

// --- Routes ----------------------------------------------------------------

router.get('/overview', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const preset = String(req.query.preset || '');
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    const result = await computeOverview({ preset, days });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List daily ad spend in a date range.
router.get('/spend', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureSpendTable();
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: 'from ve to (YYYY-MM-DD) gerekli' });
      return;
    }
    const rows = await query<{ d: string; amount: number }>(
      `SELECT DATE_FORMAT(spend_date, '%Y-%m-%d') AS d, amount
       FROM ads_spend WHERE spend_date >= ? AND spend_date <= ? ORDER BY spend_date`,
      [from, to]
    );
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    res.json({ entries: rows, total: Math.round(total * 100) / 100 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set ad spend for a date range — distributes the total evenly across days.
router.post('/spend', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureSpendTable();
    const from = String(req.body?.from || '').slice(0, 10);
    const to = String(req.body?.to || '').slice(0, 10);
    const total = Number(req.body?.total);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: 'from ve to (YYYY-MM-DD) gerekli' });
      return;
    }
    if (!Number.isFinite(total) || total < 0) {
      res.status(400).json({ error: 'Geçerli bir toplam tutar gerekli' });
      return;
    }
    const startD = new Date(`${from}T00:00:00`);
    const endD = new Date(`${to}T00:00:00`);
    if (endD < startD) {
      res.status(400).json({ error: 'Bitiş tarihi başlangıçtan önce olamaz' });
      return;
    }
    const dayCount = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
    if (dayCount > 366) {
      res.status(400).json({ error: 'Aralık en fazla 366 gün olabilir' });
      return;
    }
    const perDay = Math.round((total / dayCount) * 100) / 100;
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startD.getTime() + i * 86400000);
      await run(
        `INSERT INTO ads_spend (spend_date, amount) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [localDay(d), perDay]
      );
    }
    res.json({ ok: true, days: dayCount, perDay });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Parse & import Google Ads CSV report.
// Accepts { csv: string } — the raw text of a Google Ads report download.
// Supported column names (case-insensitive): Day/Date → date, Cost/Kosten → amount.
router.post('/spend/csv', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureSpendTable();
    const csv = String(req.body?.csv || '');
    if (!csv.trim()) {
      res.status(400).json({ error: 'CSV verisi boş' });
      return;
    }

    // Strip BOM if present
    const csvClean = csv.replace(/^﻿/, '');
    const lines = csvClean.split(/\r?\n/);

    // Auto-detect delimiter: semicolon (German locale) or comma
    const delim = detectDelimiter(lines);

    // Find the header row — first line that contains a date-like or cost-like column.
    let headerIdx = -1;
    let dateCol = -1;
    let costCol = -1;
    const DATE_NAMES = ['day', 'date', 'tag', 'datum'];
    const COST_NAMES = ['cost', 'kosten', 'spend', 'ausgaben'];

    for (let i = 0; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], delim).map(c => c.toLowerCase().trim().replace(/["""«»]/g, ''));
      const dIdx = cols.findIndex(c => DATE_NAMES.includes(c));
      const cIdx = cols.findIndex(c => COST_NAMES.some(n => c.includes(n)));
      if (dIdx >= 0 && cIdx >= 0) {
        headerIdx = i;
        dateCol = dIdx;
        costCol = cIdx;
        break;
      }
    }

    if (headerIdx < 0) {
      // Return the first few parsed lines for debugging
      const sample = lines.slice(0, 8).map(l => splitCsvLine(l, delim).map(c => c.trim().replace(/["""«»]/g, '')));
      res.status(400).json({
        error: 'Tarih ve maliyet sütunu bulunamadı.',
        debug_delim: delim,
        debug_columns: sample,
      });
      return;
    }

    const imported: { date: string; amount: number }[] = [];
    const skipped: string[] = [];

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = splitCsvLine(line, delim).map(c => c.replace(/["""«»]/g, '').trim());
      if (cols.length <= Math.max(dateCol, costCol)) continue;

      const rawDate = cols[dateCol];
      // German format: 1.234,56 → strip thousands dot, replace decimal comma
      const rawCostStr = cols[costCol].replace(/[^\d.,]/g, '');
      const rawCost = rawCostStr.includes(',')
        ? rawCostStr.replace(/\./g, '').replace(',', '.')
        : rawCostStr;
      const amount = parseFloat(rawCost);

      // Parse date — Google Ads formats: YYYY-MM-DD, DD.MM.YYYY, MM/DD/YYYY
      const date = parseGoogleDate(rawDate);
      if (!date || !Number.isFinite(amount)) {
        skipped.push(rawDate || line.slice(0, 40));
        continue;
      }

      // Skip summary / total rows
      if (rawDate.toLowerCase().includes('total') || rawDate.toLowerCase().includes('gesamt')) continue;

      imported.push({ date, amount: Math.round(amount * 100) / 100 });
    }

    if (imported.length === 0) {
      res.status(400).json({ error: 'Hiç geçerli satır bulunamadı.', skipped });
      return;
    }

    for (const { date, amount } of imported) {
      await run(
        `INSERT INTO ads_spend (spend_date, amount) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
        [date, amount]
      );
    }

    const total = imported.reduce((s, r) => s + r.amount, 0);
    res.json({ ok: true, days: imported.length, total: Math.round(total * 100) / 100, skipped });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function detectDelimiter(lines: string[]): string {
  for (const line of lines.slice(0, 10)) {
    if (line.includes(';')) return ';';
  }
  return ',';
}

function splitCsvLine(line: string, delim = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '”' || ch === '“' || ch === '”') && !inQuote) {
      inQuote = true;
    } else if ((ch === '”' || ch === '”') && inQuote) {
      inQuote = false;
    } else if (ch === delim && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

const DE_MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mar: '03', apr: '04', mai: '05',
  jun: '06', jul: '07', aug: '08', sep: '09', okt: '10', oct: '10',
  nov: '11', dez: '12', dec: '12',
};

function parseGoogleDate(raw: string): string | null {
  const s = raw.trim().replace(/^["']|["']$/g, '');
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  // German: "So., 19. Apr. 2026" or "19. Apr. 2026"
  const de = s.match(/(\d{1,2})\.\s*([A-Za-zä]+)\.?\s+(\d{4})/);
  if (de) {
    const month = DE_MONTHS[de[2].toLowerCase().slice(0, 3)];
    if (month) return `${de[3]}-${month}-${de[1].padStart(2, '0')}`;
  }
  return null;
}

export default router;
