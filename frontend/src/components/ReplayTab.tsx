'use client';

// Static CSS import so webpack bundles it properly (dynamic import() of CSS breaks in Next.js)
import 'rrweb-player/dist/style.css';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play, Trash2, RefreshCw, Database, Filter, Clock,
  Smartphone, Monitor, Tablet, CheckCircle2, XCircle, ExternalLink,
  AlertTriangle, ChevronLeft, ChevronRight, MapPin, Zap, TrendingDown, RotateCcw,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface RecordingRow {
  session_id: string;
  visitor_id: string;
  total_events: number;
  total_bytes: number;
  first_ts: number | null;
  last_ts: number | null;
  recorded_from: string;
  recorded_to: string;
  chunk_count: number;
  ua_browser: string | null;
  ua_os: string | null;
  ua_device: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  country: string | null;
  city: string | null;
  landing_page: string | null;
  first_seen: string | null;
  last_seen: string | null;
  pageview_count: number;
  session_seconds: number;
  pages: string | null;
  // Rezervasyon eşleştirmesi (backend'de türetilir — recording.ts):
  //  'session' = bu oturumdan yaratılmış rezervasyon (kesin)
  //  'visitor' = aynı cihazdan oturum penceresi içinde rezervasyon (olası)
  //  'none'    = rezervasyon yok
  booking_match: 'session' | 'visitor' | 'none';
  booked_id: number | null;
  booked_number: string | null;
  booked_price: number | null;
  visitor_booking_count: number;
  saw_prices: boolean;
  opened_form: boolean;
  exit_stage: 'booked' | 'called' | 'form' | 'prices' | 'landing';
  // Vazgeçme sinyalleri (BookingFunnelTracker → visitor_events)
  drop_reason: 'booked' | 'called' | 'tech_error' | 'field_error' | 'slow' | 'compare' | 'unknown';
  last_field: string | null;
  price_shown: string | null;      // "89.00|42.3|kombi"
  fields_touched: number;
  call_clicks: number;
  field_errors: number;
  tech_errors: number;
  compare_signals: number;
  max_load_time_ms: number | null;
  frustration: number;
  intent: number;
}

interface DraftRow {
  session_id: string;
  path: string;
  pickup: string;
  dropoff: string;
  price: number | null;
  distance_km: number | null;
  vehicle: string | null;
  last_stage: string | null;
  saved_at: string;
  updated_at: string;
  minutes_ago: number;
  ua_device: string | null;
  city: string | null;
  gclid: string | null;
  utm_campaign: string | null;
}

interface Dropoff {
  days: number;
  funnel: { visited: number; saw_prices: number; opened_form: number; booked: number; called: number };
  last_fields: { field: string; n: number }[];
  errors: { type: string; target: string; n: number }[];
  price_bands: { band: string; sessions: number; booked: number }[];
  breakdown: { device: string; source: string; sessions: number; booked: number; called: number }[];
  variants: { variant: string; sessions: number; opened_form: number; booked: number }[];
}

interface Stats {
  sessions: number;
  chunks: number;
  events: number;
  total_bytes: number;
  oldest: string;
  newest: string;
  daily?: { day: string; sessions: number; bytes: number }[];
}

function fmtBytes(b: number): string {
  if (!b || b < 1024) return `${b || 0} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtDuration(s: number): string {
  if (!s || s < 60) return `${s || 0}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🌍';
  const upper = code.toUpperCase();
  const cp1 = 0x1F1E6 - 65 + upper.charCodeAt(0);
  const cp2 = 0x1F1E6 - 65 + upper.charCodeAt(1);
  return String.fromCodePoint(cp1, cp2);
}

// `pages` is a GROUP_CONCAT of every path (with query string) the visitor hit,
// joined by ' → ' (see recording.ts). Find the first /ergebnisse or /buchen leg and
// parse its pickup/dropoff params with URLSearchParams so the address decodes
// correctly (handles both %XX escapes and '+' as space) instead of showing the raw,
// truncated query string.
// `/buchen` linki fiyat, mesafe ve araç tipini de query'de taşıyor (ergebnisse/page.tsx
// handleBook) — bu yüzden müşterinin gördüğü fiyat ayrı bir tabloya ihtiyaç olmadan
// buradan okunabiliyor.
interface ParsedTrip { pickup: string; dropoff: string; price?: number; km?: number; vehicle?: string }

function parseRouteFromPages(pages: string | null): ParsedTrip | null {
  if (!pages) return null;
  let best: ParsedTrip | null = null;
  for (const leg of pages.split(' → ')) {
    if (!/\/(ergebnisse|buchen)(\/|\?|$)/.test(leg)) continue;
    const qIndex = leg.indexOf('?');
    if (qIndex === -1) continue;
    const params = new URLSearchParams(leg.slice(qIndex + 1));
    const pickup = params.get('pickup') || params.get('from');
    const dropoff = params.get('dropoff') || params.get('to');
    if (!pickup || !dropoff) continue;
    const price = Number(params.get('price'));
    const km = Number(params.get('distance_km'));
    const trip: ParsedTrip = {
      pickup, dropoff,
      price: Number.isFinite(price) && price > 0 ? price : undefined,
      km: Number.isFinite(km) && km > 0 ? km : undefined,
      vehicle: params.get('vehicle') || undefined,
    };
    // Fiyatı taşıyan /buchen bacağı, fiyatsız /ergebnisse bacağına tercih edilir
    if (!best || (trip.price && !best.price)) best = trip;
    if (best.price) break;
  }
  return best;
}

// Vazgeçme sebebi — hangi sinyal baskınsa backend onu seçer (recording.ts drop_reason)
const DROP_REASON_LABEL: Record<RecordingRow['drop_reason'], { text: string; cls: string }> = {
  booked:      { text: 'Rezervasyon', cls: 'bg-green-100 text-green-700' },
  called:      { text: '📞 Telefona döndü', cls: 'bg-blue-100 text-blue-700' },
  tech_error:  { text: '⚠️ Teknik hata', cls: 'bg-red-100 text-red-700' },
  field_error: { text: '✏️ Form hatası', cls: 'bg-orange-100 text-orange-700' },
  slow:        { text: '🐌 Yavaş sayfa', cls: 'bg-yellow-100 text-yellow-800' },
  compare:     { text: '🔍 Fiyat karşılaştırdı', cls: 'bg-indigo-100 text-indigo-700' },
  unknown:     { text: 'Sinyal yok', cls: 'bg-gray-100 text-gray-500' },
};

// Oturumun hangi adımda bittiği — satır başındaki çipin metni ve rengi
const EXIT_STAGE_LABEL: Record<RecordingRow['exit_stage'], { text: string; cls: string }> = {
  booked:  { text: 'Rezervasyon tamamlandı', cls: 'bg-green-100 text-green-700' },
  called:  { text: '📞 Telefonla iletişime geçti', cls: 'bg-blue-100 text-blue-700' },
  form:    { text: '🛑 Form ekranında bıraktı', cls: 'bg-orange-100 text-orange-700' },
  prices:  { text: '🛑 Fiyat ekranında bıraktı', cls: 'bg-amber-100 text-amber-700' },
  landing: { text: 'Fiyata bakmadan çıktı', cls: 'bg-gray-100 text-gray-500' },
};

function devIcon(d: string | null) {
  if (d === 'mobile') return <Smartphone size={14} />;
  if (d === 'tablet') return <Tablet size={14} />;
  return <Monitor size={14} />;
}

function sourceBadge(row: RecordingRow) {
  if (row.gclid) return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">🎯 Google Ads</span>;
  if (row.utm_source) return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{row.utm_source}</span>;
  if (row.referrer) {
    try { return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[120px]">{new URL(row.referrer).hostname}</span>; } catch {}
  }
  return <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">Direkt</span>;
}

// Detect rage clicks: events with type 3 (IncrementalSnapshot) source 2 (MouseInteraction) rapidly
function detectRageClicks(events: any[]): number {
  if (!events) return 0;
  const clicks = events.filter(e => e?.type === 3 && e?.data?.source === 2 && (e?.data?.type === 2 || e?.data?.type === 1));
  let rageCount = 0;
  for (let i = 2; i < clicks.length; i++) {
    const gap1 = clicks[i].timestamp - clicks[i - 1].timestamp;
    const gap2 = clicks[i - 1].timestamp - clicks[i - 2].timestamp;
    if (gap1 < 500 && gap2 < 500) rageCount++;
  }
  return rageCount;
}

// Oynatıcı zaman çizelgesi işaretleri: sayfa geçişleri (rrweb Meta, type 4) ve
// sinirli tıklama kümeleri. `goto(ms)` ile tıklanabilir hale gelir.
interface Marker { at: number; label: string; kind: 'page' | 'rage' }

function buildMarkers(events: any[]): Marker[] {
  if (!events || events.length === 0) return [];
  const t0 = events[0].timestamp;
  const markers: Marker[] = [];

  for (const e of events) {
    if (e?.type === 4 && e?.data?.href) {
      let label = e.data.href;
      try { label = new URL(e.data.href).pathname; } catch {}
      const at = Math.max(0, e.timestamp - t0);
      // aynı sayfayı üst üste eklemeyelim
      if (!markers.some(m => m.kind === 'page' && m.label === label && Math.abs(m.at - at) < 1000)) {
        markers.push({ at, label, kind: 'page' });
      }
    }
  }

  const clicks = events.filter(e => e?.type === 3 && e?.data?.source === 2 && (e?.data?.type === 2 || e?.data?.type === 1));
  for (let i = 2; i < clicks.length; i++) {
    if (clicks[i].timestamp - clicks[i - 1].timestamp < 500 && clicks[i - 1].timestamp - clicks[i - 2].timestamp < 500) {
      const at = Math.max(0, clicks[i].timestamp - t0);
      if (!markers.some(m => m.kind === 'rage' && Math.abs(m.at - at) < 3000)) {
        markers.push({ at, label: 'sinirli tıklama', kind: 'rage' });
      }
    }
  }

  return markers.sort((a, b) => a.at - b.at);
}

export default function ReplayTab({ token }: { token: string }) {
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyBooked, setOnlyBooked] = useState(false);
  const [minDuration, setMinDuration] = useState(10);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [sort, setSort] = useState<'recent' | 'intent' | 'frustration'>('recent');
  const [dropoff, setDropoff] = useState<Dropoff | null>(null);
  const [showDropoff, setShowDropoff] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one' | 'older' | 'all'; value?: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (onlyBooked) params.set('only_booked', '1');
      if (minDuration > 0) params.set('min_duration_sec', String(minDuration));
      params.set('limit', '100');
      params.set('sort', sort);
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 365;
      if (dateRange !== 'all') {
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        params.set('since', since);
      }

      const [recR, statsR, dropR, draftR] = await Promise.all([
        fetch(`${API_BASE}/admin/recordings?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/recordings/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/recordings/dropoff?days=${days}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/booking-drafts?days=${Math.min(days, 30)}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!recR.ok) throw new Error('failed');
      const d = await recR.json();
      setRecordings(d.recordings || []);
      setTotal(d.total || 0);
      if (statsR.ok) setStats(await statsR.json());
      setDropoff(dropR.ok ? await dropR.json() : null);
      setDrafts(draftR.ok ? ((await draftR.json()).drafts || []) : []);
      setError('');
    } catch {
      setError('Kayıtlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, onlyBooked, minDuration, dateRange, sort]);

  useEffect(() => { load(); }, [load]);

  // Dönüşüm sayaçları: 'session' kesin eşleşme, 'visitor' aynı cihazdan olası eşleşme
  const confirmedBookings = recordings.filter(r => r.booking_match === 'session').length;
  const probableBookings = recordings.filter(r => r.booking_match === 'visitor').length;

  const deleteOne = async (sessionId: string) => {
    const r = await fetch(`${API_BASE}/admin/recordings/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      setConfirmDelete(null);
      setPlayingIndex(null);
      load();
    }
  };

  const deleteBulk = async (body: any) => {
    const r = await fetch(`${API_BASE}/admin/recordings/bulk`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) { setConfirmDelete(null); load(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Play size={28} />
            <h2 className="text-2xl font-bold">Session Replay</h2>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
        <p className="opacity-90 text-sm">
          Müşterilerin sitede neler yaptığını film gibi izle — neden rezervasyon yapmadıklarını gör.
          Şifre ve kart alanları maskelenir; diğer form alanları kayda girer.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Database size={14} /> Toplam Kayıt</div>
          <div className="text-2xl font-bold text-purple-700">{stats?.sessions || 0}</div>
          <div className="text-xs text-gray-400 mt-1">{stats?.chunks || 0} parça</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1">Disk Kullanımı</div>
          <div className="text-2xl font-bold text-gray-800">{fmtBytes(stats?.total_bytes || 0)}</div>
          <div className="text-xs text-gray-400 mt-1">ortalama {stats?.sessions ? fmtBytes(Math.round((stats.total_bytes || 0) / stats.sessions)) : '0'}/kayıt</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1">Toplam Event</div>
          <div className="text-2xl font-bold text-gray-800">{(stats?.events || 0).toLocaleString('de-DE')}</div>
          <div className="text-xs text-gray-400 mt-1">mouse, click, scroll</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1">Son 7 Gün</div>
          <div className="text-2xl font-bold text-gray-800">
            {stats?.daily?.slice(0, 7).reduce((a, d) => a + Number(d.sessions), 0) || 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats?.newest ? new Date(stats.newest).toLocaleDateString('de-DE') : '—'} en son
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <Filter size={18} className="text-gray-500" />

        {/* Date range */}
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(['7d', '30d', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 font-medium transition-colors ${dateRange === r ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {r === '7d' ? '7 Gün' : r === '30d' ? '30 Gün' : 'Hepsi'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={onlyBooked} onChange={(e) => setOnlyBooked(e.target.checked)} />
          Sadece rezervasyonlar
        </label>

        <label className="flex items-center gap-2 text-sm">
          Min. süre:
          <select value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
            <option value={0}>Hepsi</option>
            <option value={10}>10 sn</option>
            <option value={30}>30 sn</option>
            <option value={60}>1 dk</option>
            <option value={180}>3 dk</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Sırala:
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="border rounded px-2 py-1 text-sm">
            <option value="recent">En yeni</option>
            <option value="intent">Yüksek niyet + terk</option>
            <option value="frustration">En çok hayal kırıklığı</option>
          </select>
        </label>

        <button onClick={load} className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
          <RefreshCw size={14} /> Yenile
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setConfirmDelete({ kind: 'older', value: 30 })}
            className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Trash2 size={12} /> 30 günden eskiyi sil
          </button>
          <button
            onClick={() => setConfirmDelete({ kind: 'all' })}
            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Trash2 size={12} /> Hepsini sil
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {dropoff && <DropoffPanel data={dropoff} open={showDropoff} onToggle={() => setShowDropoff(v => !v)} />}

      <DraftsPanel rows={drafts} open={showDrafts} onToggle={() => setShowDrafts(v => !v)} />

      {/* Recordings list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b text-sm text-gray-600 flex items-center justify-between">
          <span>Toplam: <strong>{total}</strong> kayıt · Gösterilen: <strong>{recordings.length}</strong></span>
          {recordings.length > 0 && (
            <span className="text-xs text-gray-400">
              {/* Yalnız kesin (session_id) eşleşmeler dönüşüm sayılır; aynı cihazdan gelen
                  olası eşleşmeler ayrıca parantezde gösterilir. */}
              {confirmedBookings} rezervasyon ·{' '}
              {Math.round(confirmedBookings / recordings.length * 100)}% dönüşüm
              {probableBookings > 0 && ` (+${probableBookings} olası)`}
            </span>
          )}
        </div>
        {loading && <div className="px-6 py-8 text-center text-gray-500">Yükleniyor…</div>}
        {!loading && recordings.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Play size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Henüz kayıt yok.</p>
            <p className="text-gray-400 text-sm mt-1">Müşteriler sitenizi ziyaret etmeye başladığında otomatik kayıtlar burada görünecek.</p>
          </div>
        )}
        <div className="divide-y">
          {recordings.map((r, idx) => {
            const isPlaying = playingIndex === idx;
            const route = parseRouteFromPages(r.pages);
            const stage = EXIT_STAGE_LABEL[r.exit_stage] || EXIT_STAGE_LABEL.landing;
            const reason = DROP_REASON_LABEL[r.drop_reason] || DROP_REASON_LABEL.unknown;
            return (
              <div key={r.session_id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${isPlaying ? 'bg-purple-50 border-l-4 border-purple-400' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {r.booking_match === 'session' ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle2 size={11} /> Rezervasyon ✓
                      {r.booked_price != null && ` · ${Number(r.booked_price).toFixed(0)} €`}
                      {r.booked_number && <span className="opacity-70">{r.booked_number}</span>}
                    </span>
                  ) : r.booking_match === 'visitor' ? (
                    <span
                      className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium"
                      title="Rezervasyon bu oturuma değil, aynı cihaza (visitor_id) bağlı — muhtemelen aynı müşteri, kesin değil"
                    >
                      <AlertTriangle size={11} /> Aynı cihazdan rezervasyon (olası)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      <XCircle size={11} /> Rezervasyon yok
                    </span>
                  )}
                  {r.booking_match === 'none' && (
                    <>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.cls}`}>
                        {stage.text}
                      </span>
                      {r.drop_reason !== 'unknown' && r.drop_reason !== 'called' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reason.cls}`}>
                          {reason.text}
                        </span>
                      )}
                      {r.last_field && (
                        <span
                          className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full"
                          title="Oturumda en son odaklanılan form alanı — takıldığı nokta"
                        >
                          ✏️ {r.last_field} alanında bıraktı
                        </span>
                      )}
                    </>
                  )}
                  {sourceBadge(r)}
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    {devIcon(r.ua_device)} {r.ua_browser || '—'} · {r.ua_os || '—'}
                  </span>
                  {(r.country || r.city) && (
                    <span className="text-xs text-gray-600">
                      {countryFlag(r.country)} {r.city || r.country}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                    <Clock size={11} /> {fmtDuration(r.session_seconds)} · {r.pageview_count || 0} sayfa
                  </span>
                </div>

                {route ? (
                  <div className="text-xs text-gray-700 mb-2 flex items-start gap-1">
                    <MapPin size={11} className="mt-0.5 shrink-0 text-gray-400" />
                    <span className="break-words">
                      {route.pickup} → {route.dropoff}
                      {(route.price || route.km) && (
                        <span className="text-gray-500">
                          {route.price != null && ` · ${route.price.toFixed(0)} €`}
                          {route.km != null && ` · ${route.km.toFixed(0)} km`}
                          {route.vehicle && ` · ${route.vehicle}`}
                        </span>
                      )}
                    </span>
                  </div>
                ) : r.pages && (
                  <div className="text-xs text-gray-600 truncate mb-2 flex items-start gap-1">
                    <MapPin size={11} className="mt-0.5 shrink-0 text-gray-400" />
                    <span className="truncate">{r.pages}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>{new Date(r.recorded_from).toLocaleString('de-DE')}</span>
                  <span>·</span>
                  <span>{Number(r.total_events).toLocaleString('de-DE')} event</span>
                  <span>·</span>
                  <span>{fmtBytes(Number(r.total_bytes) || 0)}</span>
                  {r.utm_campaign && (
                    <><span>·</span><span className="text-purple-600">{r.utm_campaign}</span></>
                  )}
                  {r.field_errors > 0 && (
                    <><span>·</span><span className="text-orange-600">{r.field_errors} form hatası</span></>
                  )}
                  {r.tech_errors > 0 && (
                    <><span>·</span><span className="text-red-600">{r.tech_errors} teknik hata</span></>
                  )}
                  {r.compare_signals > 0 && (
                    <><span>·</span><span className="text-indigo-600">{r.compare_signals}× sekme/kopya</span></>
                  )}
                  {r.fields_touched > 0 && (
                    <><span>·</span><span>{r.fields_touched} alan dolduruldu</span></>
                  )}
                  <div className="ml-auto flex gap-2">
                    {isPlaying && (
                      <button
                        onClick={() => { setPlayingIndex(null); setTimeout(() => setPlayingIndex(idx), 50); }}
                        className="px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        title="Kaydı yeniden yükle"
                      >
                        <RefreshCw size={12} /> Yenile
                      </button>
                    )}
                    <button
                      onClick={() => setPlayingIndex(isPlaying ? null : idx)}
                      className={`px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-colors ${isPlaying ? 'bg-gray-200 text-gray-700' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                      <Play size={12} /> {isPlaying ? 'Kapat' : 'İzle'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ kind: 'one', value: r.session_id })}
                      className="text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg flex items-center gap-1"
                      title="Bu kaydı sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Inline player */}
                {isPlaying && (
                  <div className="mt-4 border-t pt-4">
                    <ReplayPlayer
                      sessionId={r.session_id}
                      token={token}
                      recordingRow={r}
                      onPrev={idx > 0 ? () => setPlayingIndex(idx - 1) : undefined}
                      onNext={idx < recordings.length - 1 ? () => setPlayingIndex(idx + 1) : undefined}
                      indexLabel={`${idx + 1} / ${recordings.length}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">Silme Onayı</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              {confirmDelete.kind === 'one' && 'Bu kaydı kalıcı olarak silmek istediğine emin misin?'}
              {confirmDelete.kind === 'older' && `${confirmDelete.value} günden eski tüm kayıtları silmek istediğine emin misin?`}
              {confirmDelete.kind === 'all' && (
                <><strong>Tüm session replay kayıtları</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz!</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">
                İptal
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.kind === 'one') deleteOne(confirmDelete.value);
                  else if (confirmDelete.kind === 'older') deleteBulk({ older_than_days: confirmDelete.value });
                  else deleteBulk({ all: true });
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Replay Player (inline, below the row)
// ============================================================
// ---------------------------------------------------------------------------
// "Neden vazgeçiyorlar" özet paneli — /admin/recordings/dropoff
// ---------------------------------------------------------------------------
function pct(a: number, b: number): string {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

function DropoffPanel({ data, open, onToggle }: { data: Dropoff; open: boolean; onToggle: () => void }) {
  const f = data.funnel;
  const steps = [
    { label: 'Ziyaret', n: f.visited },
    { label: 'Fiyat gördü', n: f.saw_prices },
    { label: 'Form açtı', n: f.opened_form },
    { label: 'Rezervasyon', n: f.booked },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50">
        <span className="font-semibold text-gray-800 flex items-center gap-2">
          <TrendingDown size={16} className="text-purple-600" /> Neden vazgeçiyorlar? · son {data.days} gün
        </span>
        <span className="text-xs text-gray-500">{open ? 'Kapat' : 'Aç'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-6 border-t pt-4">
          {/* Huni */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Huni</div>
            <div className="flex flex-wrap gap-2 items-stretch">
              {steps.map((st, i) => (
                <div key={st.label} className="flex items-center gap-2">
                  <div className="bg-gray-50 border rounded-xl px-4 py-2 min-w-[110px]">
                    <div className="text-lg font-bold text-gray-900">{st.n.toLocaleString('de-DE')}</div>
                    <div className="text-[11px] text-gray-500">{st.label}</div>
                    {i > 0 && (
                      <div className="text-[11px] text-gray-400">{pct(st.n, steps[i - 1].n)} geçti</div>
                    )}
                  </div>
                  {i < steps.length - 1 && <span className="text-gray-300">→</span>}
                </div>
              ))}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 min-w-[110px]">
                <div className="text-lg font-bold text-blue-700">{f.called.toLocaleString('de-DE')}</div>
                <div className="text-[11px] text-blue-600">📞 Telefona döndü</div>
                <div className="text-[11px] text-blue-400">web dışı dönüşüm</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Son dokunulan alan */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                En çok terk edilen form alanı
              </div>
              {data.last_fields.length === 0 ? (
                <p className="text-sm text-gray-400">Henüz veri yok — bu sinyal yeni eklendi.</p>
              ) : (
                <ul className="space-y-1">
                  {data.last_fields.map((r) => (
                    <li key={r.field} className="flex justify-between text-sm border-b last:border-0 py-1">
                      <span className="text-gray-700 truncate">{r.field}</span>
                      <strong className="text-gray-900">{r.n}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Hatalar */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">En sık görülen hatalar</div>
              {data.errors.length === 0 ? (
                <p className="text-sm text-gray-400">Hata kaydı yok.</p>
              ) : (
                <ul className="space-y-1">
                  {data.errors.map((r, i) => (
                    <li key={`${r.type}-${i}`} className="flex justify-between gap-2 text-sm border-b last:border-0 py-1">
                      <span className="truncate">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded mr-1 ${r.type === 'field_error' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                          {r.type === 'field_error' ? 'form' : 'teknik'}
                        </span>
                        <span className="text-gray-700">{r.target}</span>
                      </span>
                      <strong className="text-gray-900 shrink-0">{r.n}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Fiyat bandı */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Fiyat bandına göre dönüşüm</div>
              {data.price_bands.length === 0 ? (
                <p className="text-sm text-gray-400">Henüz fiyat görüntüleme kaydı yok.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 text-xs">
                    <th className="py-1">Fiyat</th><th>Oturum</th><th>Rezervasyon</th><th>Oran</th>
                  </tr></thead>
                  <tbody>
                    {data.price_bands.map((b) => (
                      <tr key={b.band} className="border-t">
                        <td className="py-1">{b.band} €</td>
                        <td>{b.sessions}</td>
                        <td>{b.booked}</td>
                        <td className="font-medium">{pct(Number(b.booked), Number(b.sessions))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Cihaz / kaynak */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Cihaz ve kaynak</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 text-xs">
                  <th className="py-1">Cihaz</th><th>Kaynak</th><th>Oturum</th><th>Rez.</th><th>📞</th><th>Oran</th>
                </tr></thead>
                <tbody>
                  {data.breakdown.slice(0, 8).map((b, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1">{b.device}</td>
                      <td>{b.source}</td>
                      <td>{b.sessions}</td>
                      <td>{b.booked}</td>
                      <td>{b.called}</td>
                      <td className="font-medium">{pct(Number(b.booked), Number(b.sessions))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* A/B varyantları */}
          {data.variants.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">A/B varyantları</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 text-xs">
                  <th className="py-1">Varyant</th><th>Oturum</th><th>Form açtı</th><th>Rezervasyon</th><th>Oran</th>
                </tr></thead>
                <tbody>
                  {data.variants.map((v) => (
                    <tr key={v.variant} className="border-t">
                      <td className="py-1">{v.variant}</td>
                      <td>{v.sessions}</td>
                      <td>{v.opened_form}</td>
                      <td>{v.booked}</td>
                      <td className="font-medium">
                        {pct(Number(v.booked), Number(v.sessions))}
                        {Number(v.sessions) < 100 && <span className="text-[10px] text-amber-600 ml-1">(örneklem küçük)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Yarım kalan rezervasyonlar — /admin/booking-drafts
// Bu liste PAZARLAMA E-POSTASI için değildir (Almanya'da izinsiz e-posta riskli);
// admin görünürlüğü ve telefon varsa manuel geri arama içindir.
function DraftsPanel({ rows, open, onToggle }: { rows: DraftRow[]; open: boolean; onToggle: () => void }) {
  const fmtAgo = (min: number) => {
    if (min < 60) return `${min} dk önce`;
    if (min < 1440) return `${Math.round(min / 60)} sa önce`;
    return `${Math.round(min / 1440)} gün önce`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50">
        <span className="font-semibold text-gray-800 flex items-center gap-2">
          <RotateCcw size={16} className="text-amber-600" /> Yarım kalan rezervasyonlar
          <span className="text-xs font-normal bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{rows.length}</span>
        </span>
        <span className="text-xs text-gray-500">{open ? 'Kapat' : 'Aç'}</span>
      </button>

      {open && (
        <div className="px-6 pb-5 border-t pt-4">
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">Tamamlanmamış taslak yok.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Müşterinin girdiği güzergâh ve gördüğü fiyat. Kişisel veri (ad/telefon/e-posta) saklanmaz —
                bu liste otomatik e-posta için değil, hangi güzergâhlarda kaybettiğini görmek içindir.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs">
                      <th className="py-1">Ne zaman</th><th>Güzergâh</th><th>Fiyat</th><th>km</th>
                      <th>Aşama</th><th>Cihaz</th><th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((d) => (
                      <tr key={d.session_id} className="border-t align-top">
                        <td className="py-1.5 whitespace-nowrap text-gray-600">{fmtAgo(Number(d.minutes_ago) || 0)}</td>
                        <td className="max-w-[420px]">
                          <span className="break-words">{d.pickup} → {d.dropoff}</span>
                        </td>
                        <td className="whitespace-nowrap">{d.price != null ? `${Number(d.price).toFixed(0)} €` : '—'}</td>
                        <td className="whitespace-nowrap">{d.distance_km != null ? Number(d.distance_km).toFixed(0) : '—'}</td>
                        <td>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.last_stage === 'form' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                            {d.last_stage === 'form' ? 'Form' : 'Fiyat'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-gray-600">{d.ua_device || '—'}{d.city ? ` · ${d.city}` : ''}</td>
                        <td className="whitespace-nowrap text-gray-600">{d.gclid ? '🎯 Ads' : d.utm_campaign || 'organik'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReplayPlayer({
  sessionId, token, recordingRow, onPrev, onNext, indexLabel,
}: {
  sessionId: string;
  token: string;
  recordingRow: RecordingRow;
  onPrev?: () => void;
  onNext?: () => void;
  indexLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageviews, setPageviews] = useState<{ path: string; title: string; viewed_at: string }[]>([]);
  const [rageClicks, setRageClicks] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/recordings/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Kayıt bulunamadı');
        const d = await r.json();
        if (cancelled) return;

        setPageviews(d.pageviews || []);
        setEventCount(d.event_count || 0);

        if (!d.events || d.events.length < 2) {
          setError('Bu kayıtta oynatılabilir veri yok (çok az event)');
          setLoading(false);
          return;
        }

        // Detect rage clicks
        setRageClicks(detectRageClicks(d.events));
        setMarkers(buildMarkers(d.events));

        // rrweb-player JS (CSS already imported statically at top of file)
        const mod = await import('rrweb-player');
        const RRWebPlayer = (mod as any).default || mod;

        if (cancelled || !containerRef.current) return;

        // Clear any previous instance
        containerRef.current.innerHTML = '';

        playerRef.current = new RRWebPlayer({
          target: containerRef.current,
          props: {
            events: d.events,
            width: Math.min(window.innerWidth - 80, 900),
            height: 500,
            autoPlay: false,
            showController: true,
            speedOption: [1, 2, 4, 8],
            // Hareketsiz boşlukları atla — 9 dakikalık oturum ~1 dakikada izlenir
            skipInactive: true,
          },
        });

        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Oynatıcı yüklenemedi');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        try { playerRef.current.$destroy?.(); } catch {}
        playerRef.current = null;
      }
    };
  }, [sessionId, token, reloadKey]);

  return (
    <div className="space-y-3">
      {/* Player nav bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {onPrev && (
            <button onClick={onPrev} className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <ChevronLeft size={14} /> Önceki
            </button>
          )}
          <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">{indexLabel}</span>
          {onNext && (
            <button onClick={onNext} className="bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              Sonraki <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
            {eventCount.toLocaleString('de-DE')} event
          </span>
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
            {fmtDuration(recordingRow.session_seconds)}
          </span>
          {rageClicks > 0 && (
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <Zap size={11} /> {rageClicks} sinirli tıklama
            </span>
          )}
          {recordingRow.booking_match === 'session' ? (
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 size={11} /> Rezervasyon ✓
              {recordingRow.booked_number ? ` ${recordingRow.booked_number}` : ''}
            </span>
          ) : recordingRow.booking_match === 'visitor' ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg flex items-center gap-1">
              <AlertTriangle size={11} /> Aynı cihazdan rezervasyon (olası)
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
              {(EXIT_STAGE_LABEL[recordingRow.exit_stage] || EXIT_STAGE_LABEL.landing).text}
            </span>
          )}
        </div>
      </div>

      {/* Olay zaman çizelgesi — tıklanınca oynatıcı o ana atlar */}
      {markers.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <Clock size={12} /> Olaylar — tıklayarak o ana atla
          </div>
          <div className="flex flex-wrap gap-1.5">
            {markers.map((m, i) => (
              <button
                key={`${m.kind}-${i}`}
                onClick={() => { try { playerRef.current?.goto?.(m.at); } catch {} }}
                className={`text-[11px] px-2 py-1 rounded-lg transition-colors ${
                  m.kind === 'rage'
                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                }`}
                title={`${fmtDuration(Math.round(m.at / 1000))} — ${m.label}`}
              >
                {fmtDuration(Math.round(m.at / 1000))} · {m.kind === 'rage' ? '⚡' : ''}{m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pageview timeline */}
      {pageviews.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
            <MapPin size={12} /> Sayfa Ziyaret Sırası
          </div>
          <div className="flex flex-wrap gap-1">
            {pageviews.map((pv, i) => (
              <span key={i} className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="text-gray-400 text-[10px]">{i + 1}.</span>
                {pv.path.length > 30 ? pv.path.slice(0, 30) + '…' : pv.path}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Player container */}
      {loading && (
        <div className="flex items-center justify-center py-16 bg-gray-50 rounded-xl">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Oynatıcı yükleniyor…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-2">
          <AlertTriangle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <div className="relative">
        <div
          ref={containerRef}
          className="flex justify-center overflow-hidden rounded-xl bg-gray-900"
          style={{ minHeight: loading || error ? '0' : '520px' }}
        />
        {/* Yenile button — floats over the player controls bar (bottom-right) */}
        {!loading && !error && (
          <button
            onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 hover:bg-white text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow transition-colors z-10"
            title="Kaydı yeniden yükle"
          >
            <RefreshCw size={12} /> Yenile
          </button>
        )}
      </div>
    </div>
  );
}
