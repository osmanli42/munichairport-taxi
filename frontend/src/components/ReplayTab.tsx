'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play, Trash2, RefreshCw, Database, Filter, Clock,
  Smartphone, Monitor, Tablet, CheckCircle2, XCircle, ExternalLink, AlertTriangle,
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

export default function ReplayTab({ token }: { token: string }) {
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyBooked, setOnlyBooked] = useState(false);
  const [minDuration, setMinDuration] = useState(10);
  const [playingSession, setPlayingSession] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one' | 'older' | 'all'; value?: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (onlyBooked) params.set('only_booked', '1');
      if (minDuration > 0) params.set('min_duration_sec', String(minDuration));
      params.set('limit', '100');

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
  }, [token, onlyBooked, minDuration]);

  useEffect(() => { load(); }, [load]);

  const deleteOne = async (sessionId: string) => {
    const r = await fetch(`${API_BASE}/admin/recordings/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) { setConfirmDelete(null); load(); }
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
        <div className="flex items-center gap-3 mb-2">
          <Play size={28} />
          <h2 className="text-2xl font-bold">Session Replay</h2>
        </div>
        <p className="opacity-90 text-sm">
          Müşterilerin sitede neler yaptığını film gibi izle. Form alanları, telefon, email gizlenir.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><Database size={14} /> Toplam Kayıt</div>
          <div className="text-2xl font-bold text-purple-700">{stats?.sessions || 0}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500">Disk Kullanımı</div>
          <div className="text-2xl font-bold text-gray-800">{fmtBytes(stats?.total_bytes || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500">Toplam Event</div>
          <div className="text-2xl font-bold text-gray-800">{(stats?.events || 0).toLocaleString('de-DE')}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500">En Eski</div>
          <div className="text-sm font-bold text-gray-800">{stats?.oldest ? new Date(stats.oldest).toLocaleDateString('de-DE') : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">En yeni: {stats?.newest ? new Date(stats.newest).toLocaleDateString('de-DE') : '—'}</div>
        </div>
      </div>

      {/* Filters + bulk actions */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <Filter size={18} className="text-gray-500" />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={onlyBooked} onChange={(e) => setOnlyBooked(e.target.checked)} />
          Sadece rezervasyon yapanlar
        </label>
        <label className="flex items-center gap-2 text-sm">
          Min. süre:
          <select value={minDuration} onChange={(e) => setMinDuration(Number(e.target.value))} className="border rounded px-2 py-1">
            <option value={0}>Hepsi</option>
            <option value={10}>10 sn</option>
            <option value={30}>30 sn</option>
            <option value={60}>1 dk</option>
            <option value={180}>3 dk</option>
          </select>
        </label>
        <button onClick={load} className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-sm flex items-center gap-1">
          <RefreshCw size={14} /> Yenile
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setConfirmDelete({ kind: 'older', value: 30 })}
            className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg flex items-center gap-1"
          >
            <Trash2 size={12} /> 30 günden eskiyi sil
          </button>
          <button
            onClick={() => setConfirmDelete({ kind: 'all' })}
            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 rounded-lg flex items-center gap-1"
          >
            <Trash2 size={12} /> Hepsini sil
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {/* Recordings list */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b text-sm text-gray-600">
          Toplam: <strong>{total}</strong> kayıt · Gösterilen: <strong>{recordings.length}</strong>
        </div>
        {loading && <div className="px-6 py-8 text-center text-gray-500">Yükleniyor…</div>}
        {!loading && recordings.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-500">
            Henüz kayıt yok. Müşteriler sitenizi ziyaret etmeye başladığında otomatik kayıtlar burada görünecek.
          </div>
        )}
        <div className="divide-y">
          {recordings.map((r) => {
            const booked = (r.booking_count || 0) > 0;
            return (
              <div key={r.session_id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  {booked ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Rezervasyon yapıldı
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      <XCircle size={12} /> Rezervasyon yok
                    </span>
                  )}
                  {r.gclid && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">🎯 Google Ads</span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    {devIcon(r.ua_device)} {r.ua_browser || '—'} · {r.ua_os || '—'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
                    <Clock size={12} /> {fmtDuration(r.session_seconds)} · {r.pageview_count || 0} sayfa
                  </span>
                </div>
                {r.pages && (
                  <div className="text-xs text-gray-600 truncate mb-2">
                    📍 {r.pages}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span>{new Date(r.recorded_from).toLocaleString('de-DE')}</span>
                  <span>·</span>
                  <span>{r.total_events.toLocaleString('de-DE')} event</span>
                  <span>·</span>
                  <span>{fmtBytes(Number(r.total_bytes) || 0)}</span>
                  {r.utm_campaign && <><span>·</span><span>Campaign: {r.utm_campaign}</span></>}
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setPlayingSession(r.session_id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg flex items-center gap-1"
                    >
                      <Play size={12} /> İzle
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ kind: 'one', value: r.session_id })}
                      className="text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1"
                      title="Bu kaydı sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player modal */}
      {playingSession && (
        <ReplayPlayer
          sessionId={playingSession}
          token={token}
          onClose={() => setPlayingSession(null)}
        />
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">Silme Onayı</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              {confirmDelete.kind === 'one' && 'Bu tek kaydı silmek istediğine emin misin?'}
              {confirmDelete.kind === 'older' && `${confirmDelete.value} günden eski tüm kayıtları silmek istediğine emin misin?`}
              {confirmDelete.kind === 'all' && (
                <><strong>Tüm session replay kayıtları</strong> silinecek. Bu işlem geri alınamaz!</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
                İptal
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.kind === 'one') deleteOne(confirmDelete.value);
                  else if (confirmDelete.kind === 'older') deleteBulk({ older_than_days: confirmDelete.value });
                  else deleteBulk({ all: true });
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Replay Player (modal)
// ============================================================
function ReplayPlayer({
  sessionId, token, onClose,
}: { sessionId: string; token: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/recordings/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('failed');
        const d = await r.json();
        if (cancelled) return;
        setMeta(d.meta);

        if (!d.events || d.events.length < 2) {
          setError('Bu kayıtta yeterli event yok');
          setLoading(false);
          return;
        }

        // Dynamically load rrweb-player CSS + module
        await import('rrweb-player/dist/style.css' as any).catch(() => {});
        const mod = await import('rrweb-player');
        const RRWebPlayer = (mod as any).default || mod;

        if (cancelled || !containerRef.current) return;

        playerRef.current = new RRWebPlayer({
          target: containerRef.current,
          props: {
            events: d.events,
            width: 900,
            height: 500,
            autoPlay: false,
            showController: true,
            speedOption: [1, 2, 4, 8],
          },
        });

        setLoading(false);
      } catch (e: any) {
        setError(e.message || 'oynatıcı yüklenemedi');
        setLoading(false);
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="px-6 py-3 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold">Session Replay</h3>
            {meta && (
              <div className="text-xs text-gray-600 mt-1">
                {meta.ua_browser} · {meta.ua_os} · {meta.ua_device} · {meta.session_seconds}s · {meta.pageview_count} sayfa
              </div>
            )}
          </div>
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg">
            Kapat
          </button>
        </div>
        <div className="p-4">
          {loading && <div className="text-center py-12 text-gray-500">Oynatıcı yükleniyor…</div>}
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}
          <div ref={containerRef} className="flex justify-center" />
        </div>
      </div>
    </div>
  );
}
