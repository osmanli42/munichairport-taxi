'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Eye, Smartphone, Monitor, Tablet, RefreshCw,
  TrendingUp, MousePointerClick, ArrowRight, Globe, Clock,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface LiveSession {
  session_id: string;
  visitor_id: string;
  ua_browser: string;
  ua_os: string;
  ua_device: string;
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

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function sourceLabel(s: LiveSession): { label: string; color: string } {
  if (s.gclid) return { label: '🎯 Google Ads', color: 'bg-yellow-100 text-yellow-800' };
  if (s.utm_source === 'google_ads') return { label: '🎯 Google Ads', color: 'bg-yellow-100 text-yellow-800' };
  if (s.utm_source) return { label: `🔗 ${s.utm_source}`, color: 'bg-purple-100 text-purple-800' };
  if (s.referrer) {
    if (/google\./i.test(s.referrer)) return { label: '🔍 Google', color: 'bg-blue-100 text-blue-800' };
    if (/bing\./i.test(s.referrer)) return { label: '🔍 Bing', color: 'bg-blue-100 text-blue-800' };
    if (/facebook|instagram/i.test(s.referrer)) return { label: '📱 Social', color: 'bg-pink-100 text-pink-800' };
    return { label: '🔗 Referral', color: 'bg-gray-100 text-gray-800' };
  }
  return { label: '➡️ Direct', color: 'bg-green-100 text-green-800' };
}

function deviceIcon(d: string) {
  if (d === 'mobile') return <Smartphone size={14} />;
  if (d === 'tablet') return <Tablet size={14} />;
  return <Monitor size={14} />;
}

export default function LiveVisitorsTab({ token }: { token: string }) {
  const [live, setLive] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today');
  const [showBots, setShowBots] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadLive = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-visitors${showBots ? '?bots=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      setLive(d.sessions || []);
      setLastUpdated(new Date());
      setError('');
    } catch (e: any) {
      setError('Veri alınamadı');
    }
  }, [token, showBots]);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/visitor-stats?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      setStats(d);
    } catch {
      // ignore
    }
  }, [token, range]);

  useEffect(() => { loadLive(); loadStats(); setLoading(false); }, [loadLive, loadStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { loadLive(); }, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, loadLive]);

  const totals = stats?.totals || { total_sessions: 0, unique_visitors: 0, total_pageviews: 0, bounces: 0 };
  const bounceRate = totals.total_sessions > 0 ? Math.round((Number(totals.bounces) / Number(totals.total_sessions)) * 100) : 0;
  const funnel = stats?.funnel || { visited: 0, saw_prices: 0, started_booking: 0, bookings: 0 };
  const conv = funnel.visited > 0 ? ((funnel.bookings / funnel.visited) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Header / live count */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="w-3 h-3 bg-white rounded-full animate-ping absolute"></div>
                <div className="w-3 h-3 bg-white rounded-full relative"></div>
              </div>
              <span className="text-sm font-medium opacity-90">CANLI</span>
            </div>
            <div className="text-4xl font-bold">{live.length}</div>
            <div className="text-sm opacity-90">aktif ziyaretçi (son 60 saniye)</div>
          </div>
          <div className="flex flex-col gap-2 items-end text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Otomatik yenile (5sn)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showBots}
                onChange={(e) => setShowBots(e.target.checked)}
                className="rounded"
              />
              Botları göster
            </label>
            <button
              onClick={loadLive}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition"
            >
              <RefreshCw size={14} /> Yenile
            </button>
            {lastUpdated && (
              <span className="text-xs opacity-75">
                Son güncelleme: {lastUpdated.toLocaleTimeString('de-DE')}
              </span>
            )}
          </div>
        </div>
        {error && <div className="mt-3 text-yellow-100 text-sm">{error}</div>}
      </div>

      {/* Live visitor list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Users size={18} />
          <h3 className="font-semibold">Şu an sitede ne yapıyorlar?</h3>
        </div>
        {live.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <Eye size={32} className="mx-auto mb-2 opacity-40" />
            Şu an aktif ziyaretçi yok
          </div>
        ) : (
          <div className="divide-y">
            {live.map((s) => {
              const src = sourceLabel(s);
              return (
                <div key={s.session_id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${src.color}`}>
                      {src.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      {deviceIcon(s.ua_device)} {s.ua_browser} · {s.ua_os}
                    </span>
                    {s.is_bot === 1 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">BOT</span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                      <Clock size={12} /> {fmtDuration(s.session_seconds)} · {s.pageview_count} sayfa
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-gray-900">📍 {s.current_path}</span>
                    {s.idle_seconds > 30 && (
                      <span className="text-xs text-gray-400">({s.idle_seconds}s pasif)</span>
                    )}
                  </div>
                  {s.current_title && (
                    <div className="text-xs text-gray-500 mt-1 truncate">{s.current_title}</div>
                  )}
                  {(s.utm_campaign || s.gclid) && (
                    <div className="text-xs text-gray-400 mt-1">
                      {s.utm_campaign && <>Campaign: {s.utm_campaign} </>}
                      {s.gclid && <>· gclid: {s.gclid.slice(0, 20)}...</>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats range selector */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={18} /> İstatistikler</h3>
          <div className="flex gap-2">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  range === r ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {r === 'today' ? 'Bugün' : r === '7d' ? '7 Gün' : '30 Gün'}
              </button>
            ))}
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-xs text-blue-700 font-medium">Oturum</div>
            <div className="text-2xl font-bold text-blue-900">{totals.total_sessions || 0}</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="text-xs text-purple-700 font-medium">Tekil Ziyaretçi</div>
            <div className="text-2xl font-bold text-purple-900">{totals.unique_visitors || 0}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs text-green-700 font-medium">Sayfa Görüntüleme</div>
            <div className="text-2xl font-bold text-green-900">{totals.total_pageviews || 0}</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="text-xs text-orange-700 font-medium">Bounce Rate</div>
            <div className="text-2xl font-bold text-orange-900">{bounceRate}%</div>
          </div>
        </div>

        {/* Funnel */}
        <div className="border rounded-xl p-4 mb-6">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <MousePointerClick size={16} /> Conversion Funnel
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <FunnelStep label="Ziyaret" value={funnel.visited} color="bg-blue-500" />
            <ArrowRight size={16} className="text-gray-400" />
            <FunnelStep label="Fiyat Gördü" value={funnel.saw_prices} color="bg-yellow-500" />
            <ArrowRight size={16} className="text-gray-400" />
            <FunnelStep label="Buchen Sayfası" value={funnel.started_booking} color="bg-orange-500" />
            <ArrowRight size={16} className="text-gray-400" />
            <FunnelStep label="Rezervasyon" value={funnel.bookings} color="bg-green-500" />
          </div>
          <div className="text-xs text-gray-500 mt-3">
            Toplam dönüşüm oranı: <span className="font-semibold text-gray-700">{conv}%</span>
          </div>
        </div>

        {/* Top pages + sources */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2">En çok ziyaret edilen sayfalar</h4>
            <div className="space-y-1">
              {(stats?.topPages || []).slice(0, 10).map((p) => (
                <div key={p.path} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-gray-700">{p.path}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{p.views}</span>
                </div>
              ))}
              {(!stats?.topPages || stats.topPages.length === 0) && (
                <div className="text-sm text-gray-400">Veri yok</div>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <Globe size={14} /> Trafik kaynakları
            </h4>
            <div className="space-y-1">
              {(stats?.sources || []).map((s) => {
                const total = (stats?.sources || []).reduce((a, b) => a + Number(b.sessions), 0);
                const pct = total > 0 ? Math.round((Number(s.sessions) / total) * 100) : 0;
                return (
                  <div key={s.source} className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">{s.source}</span>
                      <span className="text-xs text-gray-500">{s.sessions} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(!stats?.sources || stats.sources.length === 0) && (
                <div className="text-sm text-gray-400">Veri yok</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FunnelStep({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`${color} text-white font-bold rounded-lg px-4 py-2 min-w-[60px] text-center`}>
        {value || 0}
      </div>
      <div className="text-xs text-gray-600 mt-1">{label}</div>
    </div>
  );
}
