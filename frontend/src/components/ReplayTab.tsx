'use client';

// Static CSS import so webpack bundles it properly (dynamic import() of CSS breaks in Next.js)
import 'rrweb-player/dist/style.css';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play, Trash2, RefreshCw, Database, Filter, Clock,
  Smartphone, Monitor, Tablet, CheckCircle2, XCircle, ExternalLink,
  AlertTriangle, ChevronLeft, ChevronRight, MapPin, Zap,
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
  landing_page: string | null;
  first_seen: string | null;
  last_seen: string | null;
  pageview_count: number;
  session_seconds: number;
  pages: string | null;
  booking_count: number;
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

export default function ReplayTab({ token }: { token: string }) {
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyBooked, setOnlyBooked] = useState(false);
  const [minDuration, setMinDuration] = useState(10);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one' | 'older' | 'all'; value?: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (onlyBooked) params.set('only_booked', '1');
      if (minDuration > 0) params.set('min_duration_sec', String(minDuration));
      params.set('limit', '100');
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : 30;
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        params.set('since', since);
      }

      const [recR, statsR] = await Promise.all([
        fetch(`${API_BASE}/admin/recordings?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/recordings/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!recR.ok) throw new Error('failed');
      const d = await recR.json();
      setRecordings(d.recordings || []);
      setTotal(d.total || 0);
      if (statsR.ok) setStats(await statsR.json());
      setError('');
    } catch {
      setError('Kayıtlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, onlyBooked, minDuration, dateRange]);

  useEffect(() => { load(); }, [load]);

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
          Form alanları, telefon ve e-posta otomatik maskelenir.
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

      {/* Recordings list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b text-sm text-gray-600 flex items-center justify-between">
          <span>Toplam: <strong>{total}</strong> kayıt · Gösterilen: <strong>{recordings.length}</strong></span>
          {recordings.length > 0 && (
            <span className="text-xs text-gray-400">
              {recordings.filter(r => r.booking_count > 0).length} rezervasyon ·{' '}
              {Math.round(recordings.filter(r => r.booking_count > 0).length / recordings.length * 100)}% dönüşüm
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
            const booked = (r.booking_count || 0) > 0;
            const isPlaying = playingIndex === idx;
            return (
              <div key={r.session_id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${isPlaying ? 'bg-purple-50 border-l-4 border-purple-400' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {booked ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle2 size={11} /> Rezervasyon yapıldı ✓
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      <XCircle size={11} /> Rezervasyon yok
                    </span>
                  )}
                  {sourceBadge(r)}
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    {devIcon(r.ua_device)} {r.ua_browser || '—'} · {r.ua_os || '—'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                    <Clock size={11} /> {fmtDuration(r.session_seconds)} · {r.pageview_count || 0} sayfa
                  </span>
                </div>

                {r.pages && (
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
  }, [sessionId, token]);

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
          {recordingRow.booking_count > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 size={11} /> Rezervasyon yapıldı
            </span>
          )}
        </div>
      </div>

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
      <div
        ref={containerRef}
        className="flex justify-center overflow-hidden rounded-xl bg-gray-900"
        style={{ minHeight: loading || error ? '0' : '520px' }}
      />
    </div>
  );
}
