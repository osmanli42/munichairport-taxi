import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// --- Helpers ---------------------------------------------------------------

function fmt(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  cvr: number;        // bookings / visitors
  avgValue: number;   // revenue / bookings
  bounceRate: number; // single-pageview sessions / sessions
}

function emptyMetrics(): PeriodMetrics {
  return { visitors: 0, sessions: 0, bookings: 0, revenue: 0, cvr: 0, avgValue: 0, bounceRate: 0 };
}

// --- Overview endpoint -----------------------------------------------------

router.get('/overview', authenticateAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const preset = String(req.query.preset || '');
    const now = new Date();

    // Compute calendar midnight in local server time via offset trick.
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
      prevStart = new Date(start.getTime() - 86400000); // yesterday 00:00
      prevEnd = start;                                   // today 00:00
      days = 1;
      isHourly = true;
    } else if (preset === 'yesterday') {
      curEnd = todayMidnight();
      start = new Date(curEnd.getTime() - 86400000);    // yesterday 00:00
      prevEnd = start;
      prevStart = new Date(start.getTime() - 86400000); // day before 00:00
      days = 1;
      isHourly = true;
    } else {
      days = Math.min(Math.max(parseInt(String(req.query.days || '30'), 10) || 30, 7), 90);
      curEnd = now;
      start = new Date(now.getTime() - days * 86400000);
      prevStart = new Date(now.getTime() - 2 * days * 86400000);
      prevEnd = start;
    }

    // Pull raw ad sessions and bookings for the full [prevStart, now] window.
    // Data volume for this site is small enough to aggregate in JS.
    const sessions = await query<AdSession>(
      `SELECT visitor_id, utm_campaign, utm_source, utm_medium, ua_device,
              country, landing_page, pageview_count, first_seen, gclid
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

    const adSessions = sessions.filter(isAdSession);

    // Every visitor that ever had an ad session in the window. Used to
    // attribute bookings: a booking counts as ad-sourced if its visitor_id
    // appears here.
    const adVisitorSet = new Set<string>();
    for (const s of adSessions) if (s.visitor_id) adVisitorSet.add(s.visitor_id);

    // visitor_id -> { campaign, device } from their most recent ad session.
    const visitorInfo = new Map<string, { campaign: string; device: string; ts: number }>();
    for (const s of adSessions) {
      if (!s.visitor_id) continue;
      const ts = new Date(s.first_seen).getTime();
      const prev = visitorInfo.get(s.visitor_id);
      if (prev && prev.ts >= ts) continue;
      const campaign =
        s.utm_campaign && s.utm_campaign.trim() !== ''
          ? s.utm_campaign.trim()
          : (s.gclid && s.gclid.trim() !== '' ? 'Google Ads (oto-etiket)' : '(etiketsiz)');
      visitorInfo.set(s.visitor_id, { campaign, device: (s.ua_device || 'unbekannt'), ts });
    }

    const inCurrent = (d: Date | string) => {
      const t = new Date(d).getTime();
      return t >= start.getTime() && t <= curEnd.getTime();
    };
    const inPrev = (d: Date | string) => {
      const t = new Date(d).getTime();
      return t >= prevStart.getTime() && t < prevEnd.getTime();
    };

    // --- Period metrics ----------------------------------------------------
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

    // Total (all-channel) bookings in current period, for ad-share context.
    const totalBookingsCurrent = bookings.filter((b) => inCurrent(b.created_at)).length;

    // --- Daily / hourly series ---------------------------------------------
    const series: Record<string, { visitors: Set<string>; bookings: number; revenue: number }> = {};
    const hourKey = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:00`;

    if (isHourly) {
      // Hourly buckets 00:00–23:00 (or up to current hour for today)
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
    const daily = Object.keys(series)
      .sort()
      .map((k) => ({
        date: k,
        visitors: series[k].visitors.size,
        bookings: series[k].bookings,
        revenue: Math.round(series[k].revenue * 100) / 100,
      }));

    // Last 7 days slice — used for the "tracking broken" check.
    const last7 = daily.slice(-7);
    const last7Visitors = last7.reduce((s, d) => s + d.visitors, 0);
    const last7Bookings = last7.reduce((s, d) => s + d.bookings, 0);

    // --- Campaign breakdown ------------------------------------------------
    const campAgg: Record<string, { visitors: Set<string>; bookings: number; revenue: number }> = {};
    for (const s of adSessions) {
      if (!inCurrent(s.first_seen) || !s.visitor_id) continue;
      const c = visitorInfo.get(s.visitor_id)?.campaign || '(etiketsiz)';
      (campAgg[c] ||= { visitors: new Set(), bookings: 0, revenue: 0 }).visitors.add(s.visitor_id);
    }
    for (const b of bookings) {
      if (!b.visitor_id || !adVisitorSet.has(b.visitor_id) || !inCurrent(b.created_at)) continue;
      const c = visitorInfo.get(b.visitor_id)?.campaign || '(etiketsiz)';
      if (campAgg[c]) {
        campAgg[c].bookings += 1;
        campAgg[c].revenue += Number(b.price) || 0;
      }
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

    // --- Device breakdown --------------------------------------------------
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

    // --- Health score ------------------------------------------------------
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

      scoreBreakdown = [
        { key: 'Dönüşüm trendi', weight: 0.35, points: cvrTrend },
        { key: 'Hacim trendi', weight: 0.25, points: volTrend },
        { key: 'Dönüşüm seviyesi', weight: 0.25, points: cvrLevel },
        { key: 'Ziyaretçi etkileşimi', weight: 0.15, points: engagement },
      ];
      score = Math.round(scoreBreakdown.reduce((s, p) => s + p.weight * p.points, 0));
    }

    // --- Anomalies / alerts ------------------------------------------------
    const alerts: { severity: 'high' | 'medium' | 'low'; title: string; detail: string }[] = [];

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

    // --- Recommendations ---------------------------------------------------
    const recommendations: { priority: 'high' | 'medium' | 'low'; title: string; detail: string }[] = [];

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
    if (recommendations.length === 0 && alerts.length === 0 && score !== null && score >= 75) {
      recommendations.push({
        priority: 'low',
        title: 'Reklam performansı sağlıklı',
        detail: 'Belirgin bir sorun tespit edilmedi. Mevcut kampanya ve bütçe ayarları korunabilir.',
      });
    }

    res.json({
      generatedAt: now.toISOString(),
      days,
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
      adShare: totalBookingsCurrent > 0 ? Math.round((cur.bookings / totalBookingsCurrent) * 1000) / 10 : 0,
      totalBookings: totalBookingsCurrent,
      daily,
      campaigns,
      devices,
      alerts,
      recommendations,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
