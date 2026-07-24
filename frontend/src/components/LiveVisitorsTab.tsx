'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false });
import {
  Users, Eye, Smartphone, Monitor, Tablet, RefreshCw,
  TrendingUp, MousePointerClick, ArrowRight, Globe, Clock,
  Bell, BellOff, Activity, Zap, ShoppingCart, Euro,
  BarChart3, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface LiveSession {
  session_id: string;
  visitor_id: string;
  ua_browser: string;
  ua_os: string;
  ua_device: string;
  screen_w: number | null;
  screen_h: number | null;
  lang: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  landing_page: string;
  first_seen: string;
  last_seen: string;
  pageview_count: number;
  session_seconds: number;
  idle_seconds: number;
  current_path: string;
  current_title: string | null;
  is_bot: number;
  country: string | null;
  city: string | null;
  prev_visits: number;
  max_scroll: number | null;
  page_history: string | null;
  booking_clicks: number;
  price_clicks: number;
  form_fields_touched: number;
  form_fields_list: string | null;
  form_submit_clicks: number;
  past_bookings_count: number;
  last_booking_date: string | null;
  last_booking_pickup_address: string | null;
  last_booking_dropoff_address: string | null;
  last_booking_datetime: string | null;
  last_booking_trip_type: string | null;
  last_booking_return_datetime: string | null;
  avg_load_ms: number | null;
  lat: number | null;
  lng: number | null;
}

interface Stats {
  range: string;
  totals: { total_sessions: number; unique_visitors: number; total_pageviews: number; bounces: number };
  topPages: Array<{ path: string; views: number }>;
  sources: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string; sessions: number }>;
  hourly: Array<{ hour: string; sessions: number }>;
  funnel: { visited: number; saw_prices: number; started_booking: number; bookings: number };
}

interface TodayKpi {
  count: number;
  revenue: number;
}

interface ActivityEvent {
  id: string;
  time: Date;
  type: 'new_visitor' | 'booking_completed' | 'visitor_left' | 'price_viewed' | 'booking_started';
  message: string;
  detail?: string;
  icon: string;
  color: string;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}dk ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}s ${m % 60}dk`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// stats.hourly[].hour is `YYYY-MM-DD HH:00` in UTC (DATE_FORMAT(first_seen, ...) —
// first_seen is stored in UTC, see backend/src/utils/berlinTime.ts). Parse it as UTC
// explicitly and display in Berlin local time so labels match Germany's actual clock.
function fmtHourLabel(hour: string | undefined): string {
  if (!hour) return '';
  const d = new Date(hour.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

// Formats a `YYYY-MM-DDTHH:MM:00`-shaped datetime string — either a confirmed
// booking's pickup_datetime/return_datetime column value, or a synthetic
// `${date}T${time}:00` built from /ergebnisse|/buchen URL query params.
function fmtPickupDateTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const datePart = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart} Uhr`;
}

// Best-effort "in progress" pickup/dropoff + date/time, parsed from the
// /ergebnisse or /buchen query string in current_path / page_history / landing_page.
// Param names come from SearchBar.tsx. URLSearchParams (unlike the old regex +
// decodeURIComponent) turns `+` into a space before %-decoding.
function parseProspectiveRoute(s: LiveSession): {
  pickup: string; dropoff: string; date: string; time: string;
  tripType: string; returnDate: string; returnTime: string;
} | null {
  const candidates = [
    s.current_path,
    ...(s.page_history ? s.page_history.split('|||') : []),
    s.landing_page,
  ].filter((p): p is string => !!p);

  for (const candidate of candidates) {
    if (!/\/(ergebnisse|buchen)(\/|\?|$)/.test(candidate)) continue;
    const qIndex = candidate.indexOf('?');
    if (qIndex === -1) continue;
    const params = new URLSearchParams(candidate.slice(qIndex + 1));
    const pickup = params.get('pickup') || params.get('from') || '';
    const dropoff = params.get('dropoff') || params.get('to') || '';
    if (!pickup || !dropoff) continue;
    return {
      pickup, dropoff,
      date: params.get('date') || '',
      time: params.get('time') || '',
      tripType: params.get('trip_type') || 'oneway',
      returnDate: params.get('return_date') || '',
      returnTime: params.get('return_time') || '',
    };
  }
  return null;
}

function sourceLabel(s: LiveSession): { label: string; color: string } {
  if (s.gclid) return { label: '🎯 Google Ads', color: 'bg-yellow-100 text-yellow-800' };
  if (s.utm_source === 'google_ads') return { label: '🎯 Google Ads', color: 'bg-yellow-100 text-yellow-800' };
  if (s.utm_source) return { label: `🔗 ${s.utm_source}`, color: 'bg-purple-100 text-purple-800' };
  if (s.referrer) {
    if (/google\./i.test(s.referrer)) return { label: '🔍 Google', color: 'bg-blue-100 text-blue-800' };
    if (/bing\./i.test(s.referrer)) return { label: '🔍 Bing', color: 'bg-sky-100 text-sky-800' };
    if (/chatgpt|openai/i.test(s.referrer)) return { label: '🤖 ChatGPT', color: 'bg-green-100 text-green-800' };
    if (/facebook|instagram/i.test(s.referrer)) return { label: '📱 Social', color: 'bg-pink-100 text-pink-800' };
    return { label: '🔗 Referral', color: 'bg-gray-100 text-gray-800' };
  }
  return { label: '➡️ Direct', color: 'bg-green-100 text-green-800' };
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  const upper = code.toUpperCase();
  const cp1 = 0x1F1E6 - 65 + upper.charCodeAt(0);
  const cp2 = 0x1F1E6 - 65 + upper.charCodeAt(1);
  return String.fromCodePoint(cp1, cp2);
}

function deviceIcon(d: string) {
  if (d === 'mobile') return <Smartphone size={14} />;
  if (d === 'tablet') return <Tablet size={14} />;
  return <Monitor size={14} />;
}

function getFunnelStage(s: LiveSession): { label: string; color: string; step: number } {
  // past_bookings_count is the authoritative signal (a real row in `bookings`).
  // form_submit_clicks only counts clicks on buttons matching "Weiter"/"submit"/etc,
  // which fires even when the actual booking request fails — don't claim completion from it.
  if (s.past_bookings_count > 0) return { label: '✅ Rezervasyon Yaptı', color: 'bg-green-500 text-white', step: 4 };
  if (s.form_submit_clicks > 0) return { label: '📤 Gönderim Denedi', color: 'bg-orange-600 text-white', step: 3 };
  if (s.form_fields_touched > 0) return { label: '📝 Form Dolduruyor', color: 'bg-orange-500 text-white', step: 3 };
  if (s.booking_clicks > 0 || (s.current_path && s.current_path.includes('/buchen'))) return { label: '🛒 Buchen\'de', color: 'bg-orange-400 text-white', step: 3 };
  if (s.price_clicks > 0 || (s.current_path && s.current_path.includes('/ergebnisse'))) return { label: '💰 Fiyata Bakıyor', color: 'bg-yellow-500 text-white', step: 2 };
  return { label: '👀 Geziniyor', color: 'bg-blue-400 text-white', step: 1 };
}

function getStatus(s: LiveSession): { label: string; dot: string; text: string } {
  if (s.idle_seconds <= 10) return { label: 'Aktif', dot: 'bg-green-500 animate-pulse', text: 'text-green-700' };
  if (s.idle_seconds <= 60) return { label: `Boşta ${s.idle_seconds}s`, dot: 'bg-yellow-400', text: 'text-yellow-700' };
  return { label: `Pasif ${fmtDuration(s.idle_seconds)}`, dot: 'bg-red-400', text: 'text-red-600' };
}

// SVG Sparkline. `labels[i]`, if given, becomes a native hover tooltip ("HH:00 · N ziyaretçi")
// on each point via <title> — lets you read every hour's count, not just the endpoints.
function Sparkline({ data, labels, width = 120, height = 36, color = '#10b981' }: {
  data: number[]; labels?: string[]; width?: number; height?: number; color?: string;
}) {
  if (!data || data.length < 2) return <div className="text-xs text-gray-400">Veri yok</div>;
  const max = Math.max(...data, 1);
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (v / max) * height,
    v,
  }));
  const points = coords.map(c => `${c.x},${c.y}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* hover targets — one per hour, wider invisible circle for an easy hit area + a visible dot */}
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="8" fill="transparent">
            <title>{labels?.[i] ? `${labels[i]} · ${c.v} ziyaretçi` : `${c.v} ziyaretçi`}</title>
          </circle>
          <circle cx={c.x} cy={c.y} r={i === coords.length - 1 ? 3 : 2} fill={color} className={i === coords.length - 1 ? '' : 'opacity-60'} />
        </g>
      ))}
    </svg>
  );
}

// Mini bar chart for devices
function DeviceBar({ devices }: { devices: Array<{ device: string; sessions: number }> }) {
  const total = devices.reduce((a, b) => a + Number(b.sessions), 0);
  if (total === 0) return <div className="text-xs text-gray-400">Veri yok</div>;
  const colors: Record<string, string> = {
    mobile: 'bg-blue-500',
    desktop: 'bg-emerald-500',
    tablet: 'bg-purple-500',
  };
  const icons: Record<string, JSX.Element> = {
    mobile: <Smartphone size={12} />,
    desktop: <Monitor size={12} />,
    tablet: <Tablet size={12} />,
  };
  return (
    <div className="space-y-2">
      {devices.map(d => {
        const pct = Math.round((Number(d.sessions) / total) * 100);
        const key = d.device?.toLowerCase() || 'desktop';
        return (
          <div key={d.device}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="flex items-center gap-1 text-gray-600 capitalize">
                {icons[key] || <Monitor size={12} />} {d.device || 'Desktop'}
              </span>
              <span className="font-medium text-gray-700">{d.sessions} ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${colors[key] || 'bg-gray-400'} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Funnel progress bar
function FunnelProgress({ step }: { step: number }) {
  const steps = ['Ziyaret', 'Fiyat', 'Buchen', 'Rezervasyon'];
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {steps.map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

export default function LiveVisitorsTab({ token }: { token: string }) {
  const [live, setLive] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayKpi, setTodayKpi] = useState<TodayKpi | null>(null);
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today');
  const [showBots, setShowBots] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [milestone, setMilestone] = useState<string | null>(null);
  const prevSessionsRef = useRef<Map<string, LiveSession>>(new Map());
  const feedIdRef = useRef(0);
  const prevBookingCountRef = useRef<number | null>(null);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MILESTONES = useRef([1, 2, 5, 10, 15, 20, 25, 30, 50]);

  const addEvent = useCallback((ev: Omit<ActivityEvent, 'id' | 'time'>) => {
    const newEv: ActivityEvent = { ...ev, id: String(feedIdRef.current++), time: new Date() };
    setActivityFeed(prev => [newEv, ...prev].slice(0, 50));
  }, []);

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted');
    }
  }, []);

  const loadLive = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-visitors${showBots ? '?bots=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      const sessions: LiveSession[] = d.sessions || [];
      setLive(sessions);
      setLastUpdated(new Date());
      setError('');

      // Diff against previous for activity feed
      const prev = prevSessionsRef.current;
      const currMap = new Map(sessions.map(s => [s.session_id, s]));

      sessions.forEach(s => {
        const old = prev.get(s.session_id);
        if (!old) {
          const loc = s.city ? `${countryFlag(s.country || '')} ${s.city}` : '';
          const src = sourceLabel(s);
          addEvent({ type: 'new_visitor', icon: '🟢', color: 'text-green-600', message: `Yeni ziyaretçi geldi`, detail: `${loc} · ${src.label}` });
        } else {
          if (s.past_bookings_count > old.past_bookings_count) {
            addEvent({ type: 'booking_completed', icon: '✅', color: 'text-emerald-700', message: `Rezervasyon tamamlandı!`, detail: s.city || '' });
            sendNotification('🎉 Yeni Rezervasyon!', `${s.city || 'Müşteri'} bir rezervasyon yaptı.`);
          } else if (s.form_submit_clicks > old.form_submit_clicks) {
            addEvent({ type: 'booking_started', icon: '📤', color: 'text-orange-600', message: `Rezervasyon gönderimi denendi`, detail: s.city || '' });
          } else if (s.booking_clicks > old.booking_clicks && old.booking_clicks === 0) {
            addEvent({ type: 'booking_started', icon: '🛒', color: 'text-orange-600', message: `Buchen sayfasına geçti`, detail: s.city || '' });
          } else if (s.price_clicks > old.price_clicks && old.price_clicks === 0) {
            addEvent({ type: 'price_viewed', icon: '💰', color: 'text-yellow-600', message: `Fiyatları görüntüledi`, detail: s.city || '' });
          }
        }
      });

      prev.forEach((oldSess, id) => {
        if (!currMap.has(id)) {
          const loc = oldSess.city || oldSess.country || '';
          addEvent({ type: 'visitor_left', icon: '🔴', color: 'text-gray-500', message: `Ziyaretçi ayrıldı`, detail: `${loc} · ${fmtDuration(oldSess.session_seconds)}` });
        }
      });

      prevSessionsRef.current = currMap;
    } catch {
      setError('Veri alınamadı');
    }
  }, [token, showBots, addEvent, sendNotification]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/visitor-stats?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      setStats(await r.json());
    } catch {}
  }, [token, range]);

  const showMilestone = useCallback((msg: string) => {
    setMilestone(msg);
    if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
    milestoneTimerRef.current = setTimeout(() => setMilestone(null), 6000);
  }, []);

  const loadTodayKpi = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      const count: number = d.today?.count || 0;
      const revenue: number = d.today?.revenue || 0;
      setTodayKpi({ count, revenue });

      const prev = prevBookingCountRef.current;
      if (prev !== null && count > prev) {
        // Check if we crossed a milestone
        const crossed = MILESTONES.current.filter(m => m > prev && m <= count);
        if (crossed.length > 0) {
          const m = crossed[crossed.length - 1];
          const msg = m === 1
            ? '🎉 Bugünün ilk rezervasyonu geldi!'
            : `🏆 Bugün ${m}. rezervasyon tamamlandı!`;
          showMilestone(msg);
          sendNotification(msg, `Toplam bugünkü gelir: ${revenue.toFixed(0)}€`);
          addEvent({ type: 'booking_completed', icon: '🏆', color: 'text-yellow-600', message: msg, detail: `Toplam gelir: ${revenue.toFixed(0)}€` });
        }
      }
      prevBookingCountRef.current = count;
    } catch {}
  }, [token, showMilestone, sendNotification, addEvent]);

  useEffect(() => { loadLive(); loadStats(); loadTodayKpi(); }, [loadLive, loadStats, loadTodayKpi]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t1 = setInterval(loadLive, 5000);
    const t2 = setInterval(loadTodayKpi, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [autoRefresh, loadLive, loadTodayKpi]);

  const totals = stats?.totals || { total_sessions: 0, unique_visitors: 0, total_pageviews: 0, bounces: 0 };
  const bounceRate = totals.total_sessions > 0 ? Math.round((Number(totals.bounces) / Number(totals.total_sessions)) * 100) : 0;
  const funnel = stats?.funnel || { visited: 0, saw_prices: 0, started_booking: 0, bookings: 0 };
  const conv = funnel.visited > 0 ? ((funnel.bookings / funnel.visited) * 100).toFixed(2) : '0.00';
  const hourlyValues = (stats?.hourly || []).map(h => Number(h.sessions));

  return (
    <div className="space-y-4">

      {/* ─── KPI Strip ─── */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Live count */}
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="relative">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping absolute opacity-75"></div>
                  <div className="w-3 h-3 bg-white rounded-full relative"></div>
                </div>
                <span className="text-xs font-semibold tracking-widest opacity-90">CANLI</span>
              </div>
              <div className="text-5xl font-black leading-none">{live.filter(s => s.is_bot === 0).length}</div>
              <div className="text-xs opacity-75 mt-1">aktif ziyaretçi (60sn)</div>
            </div>
            {/* Divider */}
            <div className="w-px h-16 bg-white/30" />
            {/* Today's bookings */}
            <div>
              <div className="text-xs opacity-75 font-medium mb-1 flex items-center gap-1"><ShoppingCart size={11} /> Bugün Rezervasyon</div>
              <div className="text-3xl font-bold">{todayKpi?.count ?? '—'}</div>
              <div className="text-xs opacity-60">adet</div>
            </div>
            <div>
              <div className="text-xs opacity-75 font-medium mb-1 flex items-center gap-1"><Euro size={11} /> Bugün Gelir</div>
              <div className="text-3xl font-bold">{todayKpi ? `${Number(todayKpi.revenue).toFixed(0)}€` : '—'}</div>
              <div className="text-xs opacity-60">toplam</div>
            </div>
            {todayKpi && todayKpi.count > 0 && (
              <div>
                <div className="text-xs opacity-75 font-medium mb-1 flex items-center gap-1"><TrendingUp size={11} /> Ort. Sipariş</div>
                <div className="text-3xl font-bold">{(Number(todayKpi.revenue) / todayKpi.count).toFixed(0)}€</div>
                <div className="text-xs opacity-60">sipariş başı</div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 items-end text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
              Otomatik yenile (5sn)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showBots} onChange={e => setShowBots(e.target.checked)} className="rounded" />
              Botları göster
            </label>
            <div className="flex gap-2">
              <button onClick={loadLive} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition text-xs">
                <RefreshCw size={12} /> Yenile
              </button>
              <button onClick={notifEnabled ? undefined : enableNotifications}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition text-xs ${notifEnabled ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'}`}>
                {notifEnabled ? <Bell size={12} /> : <BellOff size={12} />}
                {notifEnabled ? 'Bildirim Açık' : 'Bildirimleri Aç'}
              </button>
            </div>
            {lastUpdated && <span className="text-xs opacity-60">Son güncelleme: {lastUpdated.toLocaleTimeString('de-DE')}</span>}
          </div>
        </div>
        {error && <div className="mt-2 text-yellow-100 text-sm">{error}</div>}

        {/* Milestone banner */}
        {milestone && (
          <div className="mt-3 flex items-center gap-3 bg-yellow-400 text-yellow-900 rounded-xl px-4 py-3 font-semibold text-sm animate-bounce">
            <span className="text-xl">🏆</span>
            {milestone}
            <button onClick={() => setMilestone(null)} className="ml-auto text-yellow-700 hover:text-yellow-900 text-xs font-normal">✕</button>
          </div>
        )}
      </div>

      {/* ─── Main Panel: Visitor List + Activity Feed ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Visitor cards (3/5) */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-500" />
              <h3 className="font-semibold text-sm">Şu an sitede ne yapıyorlar?</h3>
            </div>
            <div className="flex gap-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Aktif</span>
              <span className="mx-1">·</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span> Boşta</span>
              <span className="mx-1">·</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Pasif</span>
            </div>
          </div>

          {live.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Eye size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">Şu an aktif ziyaretçi yok</div>
            </div>
          ) : (
            <div className="divide-y max-h-[680px] overflow-y-auto">
              {live.map(s => {
                const src = sourceLabel(s);
                const pages = s.page_history ? s.page_history.split('|||') : [];
                const isReturning = (s.prev_visits || 0) > 0;
                const funnel = getFunnelStage(s);
                const status = getStatus(s);
                const confirmedBooking = s.past_bookings_count > 0 && s.last_booking_pickup_address && s.last_booking_dropoff_address
                  ? {
                      pickup: s.last_booking_pickup_address,
                      dropoff: s.last_booking_dropoff_address,
                      when: fmtPickupDateTime(s.last_booking_datetime),
                      isRoundtrip: s.last_booking_trip_type === 'roundtrip',
                      returnWhen: fmtPickupDateTime(s.last_booking_return_datetime),
                    }
                  : null;
                const prospective = !confirmedBooking ? parseProspectiveRoute(s) : null;
                const prospectiveWhen = prospective?.date
                  ? fmtPickupDateTime(`${prospective.date}T${prospective.time || '00:00'}:00`)
                  : null;
                const prospectiveReturnWhen = prospective?.tripType === 'roundtrip' && prospective.returnDate
                  ? fmtPickupDateTime(`${prospective.returnDate}T${prospective.returnTime || '00:00'}:00`)
                  : null;

                return (
                  <div key={s.session_id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    {/* Row 1: Status light + Source + Device + Geo + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {/* Traffic light */}
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.dot}`} title={status.label} />
                        <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
                      </div>
                      <div className="w-px h-3 bg-gray-200" />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${src.color}`}>{src.label}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {deviceIcon(s.ua_device)} {s.ua_browser} · {s.ua_os}
                      </span>
                      {(s.country || s.city) && (
                        <span className="text-xs text-gray-600">
                          {s.country ? countryFlag(s.country) : '🌍'} {s.city || s.country}
                        </span>
                      )}
                      {s.past_bookings_count > 0 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium"
                          title={s.last_booking_date ? `Son sipariş: ${new Date(s.last_booking_date).toLocaleDateString('de-DE')}` : ''}>
                          ⭐ {s.past_bookings_count}x müşteri
                        </span>
                      )}
                      {isReturning && s.past_bookings_count === 0 && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          🔄 {(s.prev_visits || 0) + 1}. ziyaret
                        </span>
                      )}
                      {s.is_bot === 1 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">BOT</span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                        <Clock size={11} /> {fmtDuration(s.session_seconds)} · {s.pageview_count} sayfa
                      </span>
                    </div>

                    {/* Row 2: Funnel badge + progress */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${funnel.color}`}>{funnel.label}</span>
                      </div>
                      <FunnelProgress step={funnel.step} />
                    </div>

                    {/* Row 2b: Route detail — confirmed booking (emerald) or prospective (blue) */}
                    {confirmedBooking && (
                      <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
                        <div className="flex items-center gap-1 font-semibold mb-1">
                          <span>🗺 Rezervasyon Güzergahı</span>
                          {confirmedBooking.when && (
                            <span className="ml-auto font-normal text-emerald-700 flex items-center gap-1">
                              <Clock size={11} /> {confirmedBooking.when}
                            </span>
                          )}
                        </div>
                        <div className="break-words">{confirmedBooking.pickup} → {confirmedBooking.dropoff}</div>
                        {confirmedBooking.isRoundtrip && confirmedBooking.returnWhen && (
                          <div className="mt-1 text-emerald-700">↩ Dönüş: {confirmedBooking.returnWhen}</div>
                        )}
                      </div>
                    )}
                    {!confirmedBooking && prospective && (
                      <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                        <div className="flex items-center gap-1 font-semibold mb-1">
                          <span>🗺 Muhtemel Güzergah</span>
                          {prospectiveWhen && (
                            <span className="ml-auto font-normal text-blue-700 flex items-center gap-1">
                              <Clock size={11} /> {prospectiveWhen}
                            </span>
                          )}
                        </div>
                        <div className="break-words">{prospective.pickup} → {prospective.dropoff}</div>
                        {prospectiveReturnWhen && (
                          <div className="mt-1 text-blue-700">↩ Dönüş: {prospectiveReturnWhen}</div>
                        )}
                      </div>
                    )}

                    {/* Row 3: Current page */}
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-gray-800 text-sm truncate">📍 {s.current_path}</span>
                    </div>

                    {/* Row 4: Page history breadcrumb */}
                    {pages.length > 1 && (
                      <div className="flex items-center gap-1 flex-wrap mb-1.5">
                        {pages.slice().reverse().map((p, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-gray-300 text-xs">›</span>}
                            <span className={`text-xs px-1.5 py-0.5 rounded ${i === pages.length - 1 ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-400'}`}>
                              {p.split('?')[0] || '/'}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Row 5: Scroll + behaviors */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.max_scroll != null && (
                        <div className="flex items-center gap-1">
                          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.max_scroll}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">%{s.max_scroll}</span>
                        </div>
                      )}
                      {s.price_clicks > 0 && (
                        <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                          💰 Fiyata {s.price_clicks}x baktı
                        </span>
                      )}
                      {s.booking_clicks > 0 && (
                        <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                          🛒 Buchene {s.booking_clicks}x tıkladı
                        </span>
                      )}
                      {s.form_fields_touched > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${s.form_submit_clicks > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                          title={s.form_fields_list || ''}>
                          📝 {s.form_fields_touched} alan{s.form_submit_clicks > 0 ? ' ✓' : ''}
                        </span>
                      )}
                      {s.screen_w && (
                        <span className="text-xs text-gray-300">🖥 {s.screen_w}×{s.screen_h}</span>
                      )}
                      {s.avg_load_ms != null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          s.avg_load_ms < 1500 ? 'bg-green-50 text-green-700 border-green-200'
                          : s.avg_load_ms < 3000 ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          ⚡ {s.avg_load_ms < 1000 ? `${s.avg_load_ms}ms` : `${(s.avg_load_ms / 1000).toFixed(1)}s`} yükleme
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed (2/5) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Activity size={16} className="text-gray-500" />
            <h3 className="font-semibold text-sm">Canlı Olay Akışı</h3>
            {activityFeed.length > 0 && (
              <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{activityFeed.length}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[640px]">
            {activityFeed.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-400">
                <Zap size={28} className="mx-auto mb-2 opacity-30" />
                <div className="text-xs">Ziyaretçi aktivitesi burada görünecek</div>
              </div>
            ) : (
              <div className="divide-y">
                {activityFeed.map(ev => (
                  <div key={ev.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{ev.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold ${ev.color}`}>{ev.message}</div>
                        {ev.detail && <div className="text-xs text-gray-400 truncate">{ev.detail}</div>}
                        <div className="text-xs text-gray-300 mt-0.5">{fmtTime(ev.time)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {activityFeed.length > 0 && (
            <div className="px-5 py-3 border-t">
              <button onClick={() => setActivityFeed([])} className="text-xs text-gray-400 hover:text-gray-600 transition">
                Akışı temizle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Live Map ─── */}
      {(() => {
        const mappable = live.filter(s => s.lat && s.lng && s.is_bot === 0);
        return (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <span className="text-base">🗺</span>
              <h3 className="font-semibold text-sm">Canlı Ziyaretçi Haritası</h3>
              <span className="ml-2 text-xs text-gray-400">
                {mappable.length > 0 ? `${mappable.length} konum tespit edildi` : 'Konum bekleniyor…'}
              </span>
              <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Aktif</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span> Boşta</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span> Pasif</span>
              </div>
            </div>
            <div className="p-3 relative">
              <LiveMap
                visitors={mappable.map(s => {
                  const funnel = getFunnelStage(s);
                  const src = sourceLabel(s);
                  return {
                    session_id: s.session_id,
                    lat: s.lat!,
                    lng: s.lng!,
                    city: s.city,
                    country: s.country,
                    ua_device: s.ua_device,
                    current_path: s.current_path,
                    session_seconds: s.session_seconds,
                    idle_seconds: s.idle_seconds,
                    funnel_label: funnel.label,
                    funnel_color: funnel.color.includes('blue') ? '#60a5fa'
                      : funnel.color.includes('yellow') ? '#f59e0b'
                      : funnel.color.includes('orange') ? '#f97316'
                      : funnel.color.includes('green') ? '#10b981'
                      : '#94a3b8',
                    source_label: src.label,
                  };
                })}
              />
              {mappable.length === 0 && (
                <div className="absolute inset-3 flex flex-col items-center justify-center bg-white/80 rounded-xl pointer-events-none">
                  <span className="text-3xl mb-2">📍</span>
                  <div className="text-sm font-medium text-gray-500">Koordinatlı ziyaretçi bekleniyor</div>
                  <div className="text-xs text-gray-400 mt-1">Yeni oturumlar otomatik konumlanır</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ─── Statistics ─── */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm"><TrendingUp size={16} /> İstatistikler</h3>
          <div className="flex gap-2">
            {(['today', '7d', '30d'] as const).map(r => (
              <button key={r} onClick={() => { setRange(r); }}
                className={`px-3 py-1 text-xs rounded-lg transition font-medium ${range === r ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                {r === 'today' ? 'Bugün' : r === '7d' ? '7 Gün' : '30 Gün'}
              </button>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Oturum', value: totals.total_sessions || 0, cls: 'bg-blue-50 text-blue-900', label_cls: 'text-blue-600' },
            { label: 'Tekil Ziyaretçi', value: totals.unique_visitors || 0, cls: 'bg-purple-50 text-purple-900', label_cls: 'text-purple-600' },
            { label: 'Sayfa Görüntüleme', value: totals.total_pageviews || 0, cls: 'bg-green-50 text-green-900', label_cls: 'text-green-600' },
            { label: 'Bounce Rate', value: `${bounceRate}%`, cls: 'bg-orange-50 text-orange-900', label_cls: 'text-orange-600' },
          ].map(c => (
            <div key={c.label} className={`${c.cls} rounded-xl p-4`}>
              <div className={`text-xs font-medium ${c.label_cls} mb-1`}>{c.label}</div>
              <div className="text-2xl font-bold">{c.value}</div>
            </div>
          ))}
        </div>

        {/* Hourly sparkline */}
        {hourlyValues.length > 1 && (
          <div className="border rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><BarChart3 size={13} /> Saatlik Ziyaretçi Trendi</div>
              <div className="text-xs text-gray-400">
                Tepe: {Math.max(...hourlyValues)} · Toplam: {hourlyValues.reduce((a, b) => a + b, 0)}
              </div>
            </div>
            <Sparkline
              data={hourlyValues}
              labels={(stats?.hourly || []).map(h => fmtHourLabel(h.hour))}
              width={600} height={56} color="#10b981"
            />
            {/* Every hour's count, not just the chart's start/middle/end — hover a point above for the same info */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-2 pt-2 border-t">
              {(stats?.hourly || []).map((h, i) => (
                <span key={h.hour} className="whitespace-nowrap">
                  <span className="text-gray-400">{fmtHourLabel(h.hour)}</span>
                  <span className="font-semibold text-gray-700"> · {hourlyValues[i]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Funnel */}
        <div className="border rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold mb-3 flex items-center gap-1.5 text-gray-700">
            <MousePointerClick size={13} /> Conversion Funnel
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <FunnelStep label="Ziyaret" value={funnel.visited} color="bg-blue-500" />
            <ArrowRight size={14} className="text-gray-300" />
            <FunnelStep label="Fiyat Gördü" value={funnel.saw_prices} color="bg-yellow-500" />
            <ArrowRight size={14} className="text-gray-300" />
            <FunnelStep label="Buchen Sayfası" value={funnel.started_booking} color="bg-orange-500" />
            <ArrowRight size={14} className="text-gray-300" />
            <FunnelStep label="Rezervasyon" value={funnel.bookings} color="bg-emerald-500" />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-xs text-gray-500">
              Toplam dönüşüm: <span className="font-semibold text-gray-700">{conv}%</span>
            </div>
            {funnel.visited > 0 && funnel.saw_prices > 0 && (
              <div className="text-xs text-gray-500">
                Fiyat → Buchen: <span className="font-semibold text-gray-700">
                  {funnel.started_booking > 0 ? ((funnel.started_booking / funnel.saw_prices) * 100).toFixed(0) : 0}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top pages + Sources + Devices */}
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-xs font-semibold mb-3 text-gray-600 uppercase tracking-wide">En Çok Ziyaret Edilen</h4>
            <div className="space-y-1.5">
              {(stats?.topPages || []).slice(0, 10).map(p => (
                <div key={p.path} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-xs text-gray-600">{p.path}</span>
                  <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded">{p.views}</span>
                </div>
              ))}
              {(!stats?.topPages || stats.topPages.length === 0) && <div className="text-xs text-gray-400">Veri yok</div>}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold mb-3 text-gray-600 uppercase tracking-wide flex items-center gap-1">
              <Globe size={11} /> Trafik Kaynakları
            </h4>
            <div className="space-y-2">
              {(stats?.sources || []).map(s => {
                const total = (stats?.sources || []).reduce((a, b) => a + Number(b.sessions), 0);
                const pct = total > 0 ? Math.round((Number(s.sessions) / total) * 100) : 0;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-600">{s.source}</span>
                      <span className="text-xs text-gray-500 font-medium">{s.sessions} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(!stats?.sources || stats.sources.length === 0) && <div className="text-xs text-gray-400">Veri yok</div>}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold mb-3 text-gray-600 uppercase tracking-wide">Cihaz Dağılımı</h4>
            <DeviceBar devices={stats?.devices || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`${color} text-white font-bold rounded-lg px-3 py-2 min-w-[52px] text-center text-sm`}>
        {value || 0}
      </div>
      <div className="text-xs text-gray-500 mt-1 text-center">{label}</div>
    </div>
  );
}
