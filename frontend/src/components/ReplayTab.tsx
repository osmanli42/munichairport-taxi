'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BarChart3, Clock, Eye, Filter, Loader2, Monitor, Phone, Play, RefreshCw, RotateCcw,
  Search, Settings2, Smartphone, Star, Tablet, Trash2, X,
} from 'lucide-react';
import ReplayPlayer, { MarkPatch } from './replay/ReplayPlayer';
import { DraftsPanel, Drill, InsightsPanel, SettingsPanel } from './replay/Panels';
import {
  API_BASE, DROP_REASON, DraftRow, Dropoff, EXIT_STAGE, RecordingRow, Stats,
  countryFlag, fmtAgo, recSeconds, fmtBytes, fmtDuration, parseRouteFromPages, pct, prettyPath, shortAddr, shownPrice, sourceLabel,
} from './replay/lib';

type View = 'sessions' | 'insights' | 'drafts' | 'settings';
type Period = '1d' | '7d' | '30d' | 'all';
type Segment = 'all' | 'form' | 'prices' | 'issues' | 'booked' | 'called' | 'starred' | 'unwatched';
type Sort = 'recent' | 'intent' | 'frustration' | 'longest';

const PERIOD_DAYS: Record<Period, number> = { '1d': 1, '7d': 7, '30d': 30, all: 365 };
const PAGE = 50;

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'form', label: 'Formda terk' },
  { id: 'prices', label: 'Fiyatta terk' },
  { id: 'issues', label: 'Hata yaşayan' },
  { id: 'booked', label: 'Rezervasyon' },
  { id: 'called', label: 'Telefon' },
  { id: 'unwatched', label: 'İzlenmemiş' },
  { id: 'starred', label: '⭐ Yıldızlı' },
];

function devIcon(d: string | null, size = 12) {
  if (d === 'mobile') return <Smartphone size={size} />;
  if (d === 'tablet') return <Tablet size={size} />;
  return <Monitor size={size} />;
}

export default function ReplayTab({ token }: { token: string }) {
  const [view, setView] = useState<View>('sessions');
  const [period, setPeriod] = useState<Period>('30d');
  const [segment, setSegment] = useState<Segment>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [minDuration, setMinDuration] = useState(10);
  const [device, setDevice] = useState('');
  const [source, setSource] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<Drill | null>(null);

  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [dropoff, setDropoff] = useState<Dropoff | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingSeek, setPendingSeek] = useState<number | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'one' | 'older' | 'all'; value?: any } | null>(null);
  const [isLg, setIsLg] = useState(true);
  const [wide, setWide] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deepLinkRef = useRef<string | null>(null);
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Derin bağlantı: ?tab=replay&replay=<session_id>&t=<sn> → o kaydı o saniyeden aç
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const sid = sp.get('replay');
    if (sid) {
      deepLinkRef.current = sid;
      setPeriod('all');
      setMinDuration(0);
      setQInput(sid);
      setQ(sid);
      const t = Number(sp.get('t'));
      if (Number.isFinite(t) && t > 0) setPendingSeek(t * 1000);
    }
    const mq = window.matchMedia('(min-width: 1024px)');
    const onMq = () => setIsLg(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  // Arama kutusu: yazmayı bitirince ara
  useEffect(() => {
    const id = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(id);
  }, [qInput]);

  // "/" ile aramaya odaklan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        setView('sessions');
        searchRef.current?.focus();
      }
      // Seçim yokken N ile listenin başından izlemeye başla (seçim varken oynatıcı yönetir)
      if ((e.key === 'n' || e.key === 'N') && !selectedId && view === 'sessions' && recordings.length
          && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !e.metaKey && !e.ctrlKey) {
        setPendingSeek(undefined);
        setSelectedId(recordings[0].session_id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, view, recordings]);

  const days = PERIOD_DAYS[period];

  const listParams = useCallback((offset: number) => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    p.set('sort', sort);
    if (minDuration > 0) p.set('min_duration_sec', String(minDuration));
    if (period !== 'all') p.set('since', new Date(Date.now() - days * 86400_000).toISOString());
    if (q) p.set('q', q);
    if (device) p.set('device', device);
    if (source) p.set('source', source);
    if (segment === 'form' || segment === 'prices' || segment === 'booked' || segment === 'called') p.set('stage', segment);
    if (segment === 'issues') p.set('issues', '1');
    if (segment === 'starred') p.set('starred', '1');
    if (segment === 'unwatched') p.set('unwatched', '1');
    if (drill?.kind === 'error_target') p.set('error_target', drill.value);
    if (drill?.kind === 'last_field') p.set('last_field', drill.value);
    return p;
  }, [sort, minDuration, period, days, q, device, source, segment, drill]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/recordings?${listParams(0)}`, { headers: auth });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const rows: RecordingRow[] = d.recordings || [];
      setRecordings(rows);
      setTotal(d.total || 0);
      setError('');
      if (deepLinkRef.current) {
        const hit = rows.find(x => x.session_id === deepLinkRef.current);
        if (hit) setSelectedId(hit.session_id);
        deepLinkRef.current = null;
      }
    } catch {
      setError('Kayıtlar yüklenemedi');
    } finally {
      setListLoading(false);
    }
  }, [listParams, auth]);

  const loadMore = useCallback(async () => {
    setMoreLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/recordings?${listParams(recordings.length)}`, { headers: auth });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setRecordings(prev => {
        const seen = new Set(prev.map(x => x.session_id));
        return [...prev, ...(d.recordings || []).filter((x: RecordingRow) => !seen.has(x.session_id))];
      });
      setTotal(d.total || 0);
    } catch {} finally {
      setMoreLoading(false);
    }
  }, [listParams, recordings.length, auth]);

  const loadOverview = useCallback(async () => {
    const [statsR, dropR, draftR] = await Promise.all([
      fetch(`${API_BASE}/admin/recordings/stats?days=${days}`, { headers: auth }).catch(() => null),
      fetch(`${API_BASE}/admin/recordings/dropoff?days=${days}`, { headers: auth }).catch(() => null),
      fetch(`${API_BASE}/admin/booking-drafts?days=${Math.min(days, 30)}`, { headers: auth }).catch(() => null),
    ]);
    if (statsR?.ok) setStats(await statsR.json());
    setDropoff(dropR?.ok ? await dropR.json() : null);
    setDrafts(draftR?.ok ? ((await draftR.json()).drafts || []) : []);
  }, [days, auth]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  const refreshAll = () => { loadList(); loadOverview(); };

  // Seçili satır
  const selIndex = selectedId ? recordings.findIndex(r => r.session_id === selectedId) : -1;
  const selected = selIndex >= 0 ? recordings[selIndex] : null;

  const select = useCallback((id: string | null, seekMs?: number) => {
    setPendingSeek(seekMs);
    setSelectedId(id);
  }, []);

  // N/P ile değişen seçimi listede görünür tut (sayfayı kaydırmadan)
  useEffect(() => {
    const list = listRef.current;
    if (!list || !selectedId) return;
    const el = list.querySelector<HTMLElement>(`[data-sid="${selectedId}"]`);
    if (!el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' });
    }
  }, [selectedId]);

  const onMark = useCallback((sid: string, patch: MarkPatch) => {
    setRecordings(prev => prev.map(r => r.session_id === sid ? {
      ...r,
      ...(patch.starred !== undefined ? { starred: patch.starred } : {}),
      ...(patch.watched !== undefined ? { watched: patch.watched } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    } : r));
  }, []);

  const applyDrill = (d: Drill) => {
    setView('sessions');
    setSelectedId(null);
    if (d.kind === 'stage') { setSegment(d.value as Segment); setDevice(''); setSource(''); setDrill(null); return; }
    if (d.kind === 'device_source') {
      setDevice(['mobile', 'tablet', 'desktop'].includes(d.device) ? d.device : '');
      setSource(d.source === 'ads' ? 'ads' : 'organic');
      setDrill(null);
      return;
    }
    // İçgörüler tüm cihaz/kaynakları kapsar; süzgeç sonucu aynı sayıyı göstersin
    setSegment('all');
    setDevice('');
    setSource('');
    setDrill(d);
  };

  const deleteOne = async (sessionId: string) => {
    const r = await fetch(`${API_BASE}/admin/recordings/${sessionId}`, { method: 'DELETE', headers: auth });
    if (r.ok) {
      setConfirmDelete(null);
      if (selectedId === sessionId) setSelectedId(null);
      setRecordings(prev => prev.filter(x => x.session_id !== sessionId));
      setTotal(t => Math.max(0, t - 1));
      loadOverview();
    }
  };

  const deleteBulk = async (body: any) => {
    const r = await fetch(`${API_BASE}/admin/recordings/bulk`, {
      method: 'DELETE',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) { setConfirmDelete(null); setSelectedId(null); refreshAll(); }
  };

  // Dönüşüm sayaçları: 'session' kesin eşleşme, 'visitor' aynı cihazdan olası eşleşme
  const f = dropoff?.funnel;
  const hasFilters = segment !== 'all' || !!q || !!device || !!source || !!drill;

  const player = selected && (
    <ReplayPlayer
      key={selected.session_id}
      row={selected}
      token={token}
      indexLabel={`${selIndex + 1} / ${total}`}
      onPrev={selIndex > 0 ? () => select(recordings[selIndex - 1].session_id) : undefined}
      onNext={selIndex < recordings.length - 1 ? () => select(recordings[selIndex + 1].session_id) : undefined}
      onMark={onMark}
      onClose={() => setSelectedId(null)}
      initialSeekMs={pendingSeek}
      wide={wide}
      onToggleWide={isLg ? () => setWide(w => !w) : undefined}
    />
  );

  return (
    <div className="space-y-4">
      {/* Başlık + KPI */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-600 text-white shadow-lg">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative p-5 lg:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2.5"><span className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center"><Play size={18} fill="currentColor" /></span> Session Replay</h2>
              <p className="text-sm text-white/80 mt-1.5 max-w-2xl">
                Müşterilerin sitede neler yaptığını film gibi izle — neden rezervasyon yapmadıklarını gör.
                Şifre ve kart alanları maskelenir; diğer form alanları kayda girer.
              </p>
            </div>
            <button onClick={refreshAll} className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0">
              <RefreshCw size={14} className={listLoading ? 'animate-spin' : ''} /> Yenile
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
            <Kpi label="Kayıt" value={(stats?.range_sessions ?? 0).toLocaleString('de-DE')}
              sub={`${fmtBytes(Number(stats?.total_bytes) || 0)} disk · ${(stats?.sessions || 0).toLocaleString('de-DE')} toplam`} />
            <Kpi label="Web dönüşümü" value={f ? pct(f.booked, f.visited) : '—'}
              sub={f ? `${f.booked} rezervasyon / ${f.visited.toLocaleString('de-DE')} ziyaret` : ''}
              onClick={() => applyDrill({ kind: 'stage', value: 'booked', label: '' })} />
            <Kpi label="Formda terk" value={f ? Math.max(0, f.opened_form - f.booked).toLocaleString('de-DE') : '—'}
              sub="formu açıp rezervasyon yapmayan" accent
              onClick={() => applyDrill({ kind: 'stage', value: 'form', label: '' })} />
            <Kpi label="Telefona dönen" value={f ? f.called.toLocaleString('de-DE') : '—'}
              sub="arama / WhatsApp tıklaması"
              onClick={() => applyDrill({ kind: 'stage', value: 'called', label: '' })} />
          </div>
        </div>
      </div>

      {/* Görünüm sekmeleri + dönem */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl bg-white ring-1 ring-slate-200 p-1 shadow-sm max-w-full overflow-x-auto">
          {([
            ['sessions', 'Oturumlar', <Play key="i" size={14} />, total],
            ['insights', 'İçgörüler', <BarChart3 key="i" size={14} />, null],
            ['drafts', 'Yarım kalanlar', <RotateCcw key="i" size={14} />, drafts.length],
            ['settings', 'Ayarlar', <Settings2 key="i" size={14} />, null],
          ] as [View, string, React.ReactNode, number | null][]).map(([id, label, icon, n]) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${view === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {icon} {label}
              {n != null && <span className={`text-[11px] tabular-nums px-1.5 rounded-full ${view === id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{n.toLocaleString('de-DE')}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center rounded-xl bg-white ring-1 ring-slate-200 p-1 shadow-sm text-sm">
          {(['1d', '7d', '30d', 'all'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg font-medium ${period === p ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {p === '1d' ? 'Bugün' : p === '7d' ? '7 gün' : p === '30d' ? '30 gün' : 'Hepsi'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm">{error}</div>}

      {view === 'insights' && <InsightsPanel data={dropoff} onDrill={applyDrill} />}
      {view === 'drafts' && <DraftsPanel rows={drafts} onWatch={(sid) => { setView('sessions'); setSegment('all'); setDrill(null); setMinDuration(0); setQInput(sid); setQ(sid); deepLinkRef.current = sid; }} />}
      {view === 'settings' && (
        <SettingsPanel
          token={token}
          stats={stats}
          onDeleteOlder={(d) => setConfirmDelete({ kind: 'older', value: d })}
          onDeleteAll={() => setConfirmDelete({ kind: 'all' })}
        />
      )}

      {view === 'sessions' && (
        <>
          {/* Filtreler */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={qInput}
                  onChange={(e) => setQInput(e.target.value)}
                  placeholder="Adres, şehir, kampanya, rezervasyon no… ( / )"
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-violet-400 focus:bg-white outline-none"
                />
                {qInput && (
                  <button onClick={() => { setQInput(''); setQ(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                )}
              </div>
              <Select value={device} onChange={setDevice} options={[['', 'Tüm cihazlar'], ['mobile', 'Mobil'], ['desktop', 'Masaüstü'], ['tablet', 'Tablet']]} />
              <Select value={source} onChange={setSource} options={[['', 'Tüm kaynaklar'], ['ads', 'Google Ads'], ['organic', 'Organik / direkt']]} />
              <Select value={String(minDuration)} onChange={(v) => setMinDuration(Number(v))}
                options={[['0', 'Her süre'], ['10', '10 sn+'], ['30', '30 sn+'], ['60', '1 dk+'], ['180', '3 dk+']]} />
              <Select value={sort} onChange={(v) => setSort(v as Sort)}
                options={[['recent', 'En yeni'], ['intent', 'Yüksek niyet + terk'], ['frustration', 'En çok sorun'], ['longest', 'En uzun']]} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter size={14} className="text-slate-400 mr-1" />
              {SEGMENTS.map(s => (
                <button key={s.id} onClick={() => setSegment(s.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${segment === s.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {s.label}
                </button>
              ))}
              {drill && (drill.kind === 'error_target' || drill.kind === 'last_field') && (
                <span className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-rose-200 max-w-[360px]">
                  <span className="truncate">{drill.kind === 'error_target' ? `Hata: ${drill.label}` : drill.label}</span>
                  <button onClick={() => setDrill(null)} className="p-0.5 rounded-full hover:bg-rose-100"><X size={12} /></button>
                </span>
              )}
              {hasFilters && (
                <button onClick={() => { setSegment('all'); setQInput(''); setQ(''); setDevice(''); setSource(''); setDrill(null); }}
                  className="text-xs text-slate-500 hover:text-slate-800 ml-1 underline-offset-2 hover:underline">
                  Filtreleri temizle
                </button>
              )}
            </div>
          </div>

          {/* Liste + oynatıcı */}
          <div className={`grid gap-4 items-start ${wide && selected ? '' : 'lg:grid-cols-[minmax(320px,380px)_1fr]'}`}>
            <div className={`bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden lg:sticky lg:top-4 ${wide && selected && isLg ? 'hidden' : ''}`}>
              <div className="px-4 py-2.5 border-b border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                <span><strong className="text-slate-800">{total.toLocaleString('de-DE')}</strong> kayıt</span>
                {listLoading && <Loader2 size={13} className="animate-spin text-violet-500" />}
              </div>
              <div ref={listRef} className="max-h-[calc(100vh-150px)] overflow-y-auto relative">
                {!listLoading && recordings.length === 0 && (
                  <div className="px-6 py-14 text-center">
                    <Play size={36} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">{hasFilters ? 'Bu filtrelere uyan kayıt yok.' : 'Henüz kayıt yok.'}</p>
                  </div>
                )}
                {recordings.map((r) => (
                  <SessionRow
                    key={r.session_id}
                    row={r}
                    selected={r.session_id === selectedId}
                    onSelect={() => select(r.session_id)}
                    onDelete={() => setConfirmDelete({ kind: 'one', value: r.session_id })}
                  />
                ))}
                {recordings.length < total && recordings.length > 0 && (
                  <div className="p-3">
                    <button onClick={loadMore} disabled={moreLoading}
                      className="w-full py-2 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center gap-2">
                      {moreLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                      Daha fazla yükle ({(total - recordings.length).toLocaleString('de-DE')} kaldı)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isLg && (
              <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4 min-w-0 lg:sticky lg:top-4">
                {player || (
                  <div className="h-[min(68vh,620px)] grid place-items-center text-center">
                    <div>
                      <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 grid place-items-center mx-auto mb-4"><Eye size={28} /></div>
                      <p className="text-slate-700 font-medium">İzlemek için soldan bir oturum seç</p>
                      <p className="text-slate-400 text-sm mt-1">
                        İpucu: <span className="font-medium text-slate-500">Yüksek niyet + terk</span> sıralaması izlemeye en değer kayıtları öne alır.
                      </p>
                      <p className="text-slate-400 text-xs mt-3">
                        <kbd className="font-mono bg-slate-100 px-1 rounded">Boşluk</kbd> oynat ·{' '}
                        <kbd className="font-mono bg-slate-100 px-1 rounded">N</kbd>/<kbd className="font-mono bg-slate-100 px-1 rounded">P</kbd> sonraki/önceki ·{' '}
                        <kbd className="font-mono bg-slate-100 px-1 rounded">E</kbd> sonraki önemli an
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Telefon/tablet: oynatıcı tam ekran katman */}
          {!isLg && selected && (
            <div className="fixed inset-0 z-50 bg-white overflow-y-auto p-3">{player}</div>
          )}
        </>
      )}

      {/* Silme onayı */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-rose-600">
              <AlertTriangle size={20} />
              <h3 className="font-semibold">Silme Onayı</h3>
            </div>
            <p className="text-sm text-slate-700 mb-4">
              {confirmDelete.kind === 'one' && 'Bu kaydı kalıcı olarak silmek istediğine emin misin?'}
              {confirmDelete.kind === 'older' && `${confirmDelete.value} günden eski tüm kayıtları silmek istediğine emin misin? Yıldızlı kayıtlar korunur.`}
              {confirmDelete.kind === 'all' && (
                <><strong>Tüm session replay kayıtları</strong> (yıldızlılar dahil) kalıcı olarak silinecek. Bu işlem geri alınamaz!</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">İptal</button>
              <button
                onClick={() => {
                  if (confirmDelete.kind === 'one') deleteOne(confirmDelete.value);
                  else if (confirmDelete.kind === 'older') deleteBulk({ older_than_days: confirmDelete.value });
                  else deleteBulk({ all: true });
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
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

// ---------------------------------------------------------------------------
function Kpi({ label, value, sub, onClick, accent }: { label: string; value: string; sub?: string; onClick?: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left rounded-xl px-4 py-3 backdrop-blur-sm ring-1 transition-colors ${accent ? 'bg-white/20 ring-white/30' : 'bg-white/10 ring-white/15'} ${onClick ? 'hover:bg-white/25 cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/70">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-white/70 truncate">{sub}</div>}
    </button>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-sm rounded-xl px-2.5 py-2 ring-1 outline-none focus:ring-2 focus:ring-violet-400 ${value && value !== '0' && value !== 'recent' ? 'bg-violet-50 ring-violet-200 text-violet-800' : 'bg-slate-50 ring-slate-200 text-slate-700'}`}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// Giriş → Fiyat → Form → Rezervasyon: oturumun hangi adıma kadar geldiği
function Journey({ r }: { r: RecordingRow }) {
  const reached = r.booking_match !== 'none' ? 4 : r.opened_form ? 3 : r.saw_prices ? 2 : 1;
  const booked = r.booking_match !== 'none';
  return (
    <span className="flex items-center gap-0.5" title={['', 'Giriş', 'Fiyat gördü', 'Form açtı', 'Rezervasyon'][reached]}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className={`h-1.5 w-4 rounded-full ${i <= reached ? (booked ? 'bg-emerald-500' : i === reached && reached > 1 ? 'bg-orange-400' : 'bg-violet-400') : 'bg-slate-200'}`} />
      ))}
      {r.call_clicks > 0 && <Phone size={11} className="ml-1 text-sky-600" />}
    </span>
  );
}

function SessionRow({ row: r, selected, onSelect, onDelete }: { row: RecordingRow; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const route = parseRouteFromPages(r.pages);
  const stage = EXIT_STAGE[r.exit_stage] || EXIT_STAGE.landing;
  const reason = DROP_REASON[r.drop_reason];
  const src = sourceLabel(r);
  const price = r.booked_price != null ? Number(r.booked_price) : route?.price ?? shownPrice(r.price_shown);
  const title = route
    ? `${shortAddr(route.pickup)} → ${shortAddr(route.dropoff)}`
    : r.landing_page ? `Giriş: ${prettyPath(r.landing_page)}` : 'Giriş sayfası';

  return (
    <div
      data-sid={r.session_id}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={`group relative px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors outline-none ${
        selected ? 'bg-violet-50/80 shadow-[inset_3px_0_0_#7c3aed]' : 'hover:bg-slate-50 focus-visible:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2">
        {!r.watched && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" title="İzlenmedi" />}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${stage.tone}`}>
          {r.booking_match === 'visitor' ? 'Olası rezervasyon' : stage.short}
          {r.booking_match === 'session' && r.booked_number ? ` · ${r.booked_number}` : ''}
        </span>
        {reason && <span className={`text-[11px] font-medium ${reason.tone}`}>{reason.text}</span>}
        <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{fmtAgo(r.recorded_from)}</span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-[13px] leading-snug min-w-0 ${route ? 'text-slate-800 font-medium' : 'text-slate-500'} line-clamp-2`}>{title}</span>
        {price != null && <span className="ml-auto text-[13px] font-semibold tabular-nums text-slate-900 shrink-0">{price.toFixed(0)} €</span>}
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
        <Journey r={r} />
        <span className="flex items-center gap-1">{devIcon(r.ua_device, 11)} {r.ua_browser || '—'}</span>
        {(r.city || r.country) && <span>{countryFlag(r.country)} {r.city || r.country}</span>}
        <span className={src.ads ? 'text-amber-700 font-medium' : ''}>{src.text}</span>
        <span className="flex items-center gap-0.5"><Clock size={10} /> {fmtDuration(recSeconds(r))}</span>
      </div>

      {(r.field_errors > 0 || r.tech_errors > 0 || (r.last_field && r.booking_match === 'none')) && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {r.last_field && r.booking_match === 'none' && (
            <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">✏️ {r.last_field}</span>
          )}
          {r.field_errors > 0 && <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">{r.field_errors} form hatası</span>}
          {r.tech_errors > 0 && <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">{r.tech_errors} teknik hata</span>}
        </div>
      )}
      {r.note && <div className="mt-1.5 text-[11px] text-violet-700 italic truncate">📝 {r.note}</div>}

      <div className="absolute right-2 bottom-2 flex items-center gap-1">
        {r.starred && <Star size={13} className="text-amber-500" fill="currentColor" />}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 transition-opacity"
          title="Bu kaydı sil"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
