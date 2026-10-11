'use client';

// rrweb'in kendi Replayer'ı + React kontrolleri. Eski rrweb-player (Svelte) sabit 900×500
// kutuda oynatıyordu: mobil kayıtlarda ekranın 2/3'ü boş kalıyordu, olaylar zaman
// çizelgesinde görünmüyordu. Burada sahne kayıt ekranının oranına göre ölçeklenir,
// telefon/tarayıcı çerçevesi çizilir ve tüm sinyaller tek bir zaman çizelgesinde birleşir.
import 'rrweb/dist/rrweb.min.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronLeft, ChevronRight, Copy, FastForward, Gauge, Link2, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen,
  Pause, Play, RefreshCw, RotateCcw, RotateCw, SkipForward, Star, StickyNote, X,
} from 'lucide-react';
import {
  API_BASE, KIND_STYLE, RecordingDetail, RecordingRow, TItem, TKind, Timeline,
  buildTimeline, fmtClock, fmtDuration, narrate, recSeconds, recordedViewport,
} from './lib';

const SPEEDS = [1, 2, 4, 8, 16];
const MAJOR: TKind[] = ['page', 'rage', 'field_error', 'tech_error', 'call', 'price', 'away', 'copy'];

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch { return fallback; }
}
function writePref(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export interface MarkPatch { starred?: boolean; watched?: boolean; note?: string | null }

export default function ReplayPlayer({
  row, token, onPrev, onNext, indexLabel, onMark, onClose, initialSeekMs, wide, onToggleWide,
}: {
  row: RecordingRow;
  token: string;
  onPrev?: () => void;
  onNext?: () => void;
  indexLabel: string;
  onMark: (sessionId: string, patch: MarkPatch) => void;
  onClose?: () => void;
  initialSeekMs?: number;
  wide?: boolean;
  onToggleWide?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const finishedRef = useRef(false);

  const [detail, setDetail] = useState<RecordingDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const [vp, setVp] = useState<{ width: number; height: number }>({ width: 1280, height: 720 });
  const [avail, setAvail] = useState<{ w: number; h: number }>({ w: 800, h: 500 });
  const [isFs, setIsFs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speed, setSpeed] = useState<number>(() => readPref('replay.speed', 2));
  const [skipInactive, setSkipInactive] = useState<boolean>(() => readPref('replay.skip', true));
  const [autoNext, setAutoNext] = useState<boolean>(() => readPref('replay.autonext', false));
  const [showClicks, setShowClicks] = useState<boolean>(() => readPref('replay.clicks', true));
  const [note, setNote] = useState(row.note || '');
  const [noteOpen, setNoteOpen] = useState(!!row.note);

  // Olay işleyicilerinde güncel değerleri okumak için
  const autoNextRef = useRef(autoNext);
  const onNextRef = useRef(onNext);
  useEffect(() => { autoNextRef.current = autoNext; }, [autoNext]);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  useEffect(() => { setNote(row.note || ''); setNoteOpen(!!row.note); }, [row.session_id, row.note]);

  const tl: Timeline = useMemo(
    () => (detail ? buildTimeline(detail.events, detail.signals || []) : { items: [], inactive: [], total: 0, rageCount: 0, clickCount: 0 }),
    [detail]
  );
  const total = tl.total;

  // ---------------------------------------------------------------------------
  // Kaydı yükle + Replayer kur
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError('');
    setDetail(null);
    setPlaying(false);
    setTime(0);
    finishedRef.current = false;

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/recordings/${row.session_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) throw new Error('Kayıt bulunamadı');
        const d: RecordingDetail = await r.json();
        if (cancelled) return;
        if (!d.events || d.events.length < 2) throw new Error('Bu kayıtta oynatılabilir veri yok (çok az event)');

        setDetail(d);
        const v = recordedViewport(d.events);
        if (v) setVp(v);

        // İzlendi olarak işaretle (listeye de yansır)
        if (!row.watched) {
          fetch(`${API_BASE}/admin/recordings/${row.session_id}/mark`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ watched: true }),
          }).then(() => onMark(row.session_id, { watched: true })).catch(() => {});
        }

        const mod: any = await import('rrweb');
        const Replayer = mod.Replayer || mod.default?.Replayer;
        if (cancelled || !mountRef.current) return;
        mountRef.current.innerHTML = '';

        const rep = new Replayer(d.events, {
          root: mountRef.current,
          speed,
          skipInactive,
          showWarning: false,
          triggerFocus: true,
          mouseTail: { duration: 700, lineCap: 'round', lineWidth: 3, strokeStyle: 'rgba(168,85,247,0.55)' },
        });
        replayerRef.current = rep;

        rep.on('resize', (dim: any) => {
          if (dim?.width && dim?.height) setVp({ width: dim.width, height: dim.height });
        });
        rep.on('skip-start', () => setSkipping(true));
        rep.on('skip-end', () => setSkipping(false));
        rep.on('finish', () => {
          finishedRef.current = true;
          setPlaying(false);
          setSkipping(false);
          if (autoNextRef.current && onNextRef.current) {
            const go = onNextRef.current;
            setTimeout(() => go(), 1200);
          }
        });

        const start = Math.max(0, Math.min(initialSeekMs || 0, rep.getMetaData().totalTime));
        setStatus('ready');
        rep.play(start);
        setTime(start);
        setPlaying(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Oynatıcı yüklenemedi');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      const rep = replayerRef.current;
      replayerRef.current = null;
      if (rep) {
        try { rep.pause(); } catch {}
        try { rep.destroy?.(); } catch {}
      }
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
    // speed/skipInactive kasıtlı olarak bağımlılık değil — setConfig ile canlı güncellenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.session_id, token, reloadKey]);

  // Oynarken saati ~8 fps güncelle (her karede setState tüm paneli yeniden çizerdi)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const rep = replayerRef.current;
      if (rep) setTime(rep.getCurrentTime());
    }, 120);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => { replayerRef.current?.setConfig?.({ speed }); writePref('replay.speed', speed); }, [speed]);
  useEffect(() => { replayerRef.current?.setConfig?.({ skipInactive }); writePref('replay.skip', skipInactive); }, [skipInactive]);
  useEffect(() => { writePref('replay.autonext', autoNext); }, [autoNext]);
  useEffect(() => { writePref('replay.clicks', showClicks); }, [showClicks]);

  // ---------------------------------------------------------------------------
  // Ölçekleme: sahne alanını gözle, kayıt ekranını en-boy oranını koruyarak sığdır
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setAvail({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const isPhone = row.ua_device === 'mobile' || vp.width < 600;
  const chromeH = isPhone ? 20 : 34;   // çerçeve kenarları / tarayıcı çubuğu
  const chromeW = isPhone ? 20 : 2;
  // Sahne yüksekliği kaydın en-boy oranına göre: masaüstü kayıtta altta boş siyah alan
  // kalmasın, telefon kaydında dikey alan tam kullanılsın.
  const maxStageH = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.72, 680) : 620;
  const stageH = isPhone
    ? maxStageH
    : Math.max(260, Math.min(maxStageH, ((avail.w - chromeW - 8) * vp.height) / vp.width + chromeH + 16));
  const scale = Math.max(0.1, Math.min(
    (avail.w - chromeW - 8) / vp.width,
    (avail.h - chromeH - 8) / vp.height,
    1,
  ));

  // ---------------------------------------------------------------------------
  // Kontroller
  // ---------------------------------------------------------------------------
  const seek = useCallback((ms: number) => {
    const rep = replayerRef.current;
    if (!rep) return;
    const t = Math.max(0, Math.min(ms, total));
    finishedRef.current = false;
    if (playing) rep.play(t); else rep.pause(t);
    setTime(t);
  }, [playing, total]);

  const togglePlay = useCallback(() => {
    const rep = replayerRef.current;
    if (!rep) return;
    if (playing) {
      rep.pause();
      setTime(rep.getCurrentTime());
      setPlaying(false);
    } else {
      const from = finishedRef.current || time >= total - 150 ? 0 : rep.getCurrentTime();
      finishedRef.current = false;
      rep.play(from);
      setPlaying(true);
    }
  }, [playing, time, total]);

  const nextMoment = useCallback(() => {
    const nxt = tl.items.find(i => MAJOR.includes(i.kind) && i.at > time + 1500);
    if (nxt) seek(Math.max(0, nxt.at - 1000));
  }, [tl.items, time, seek]);

  const toggleFs = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const saveMark = useCallback(async (patch: MarkPatch) => {
    onMark(row.session_id, patch);
    try {
      await fetch(`${API_BASE}/admin/recordings/${row.session_id}/mark`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {}
  }, [onMark, row.session_id, token]);

  const copyLink = useCallback(() => {
    const u = new URL(window.location.href);
    u.search = '';
    u.searchParams.set('tab', 'replay');
    u.searchParams.set('replay', row.session_id);
    u.searchParams.set('t', String(Math.floor(time / 1000)));
    navigator.clipboard?.writeText(u.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [row.session_id, time]);

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === ' ') { e.preventDefault(); togglePlay(); }
      else if (k === 'ArrowLeft') { e.preventDefault(); seek(time - (e.shiftKey ? 30_000 : 5_000)); }
      else if (k === 'ArrowRight') { e.preventDefault(); seek(time + (e.shiftKey ? 30_000 : 5_000)); }
      else if (k === 'n' || k === 'N') onNext?.();
      else if (k === 'p' || k === 'P') onPrev?.();
      else if (k === 'e' || k === 'E') nextMoment();
      else if (k === 'f' || k === 'F') toggleFs();
      else if (k === 's' || k === 'S') saveMark({ starred: !row.starred });
      else if (k === 'Escape' && onClose && !document.fullscreenElement) onClose();
      else if (/^[1-5]$/.test(k)) setSpeed(SPEEDS[Number(k) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seek, time, onNext, onPrev, nextMoment, toggleFs, saveMark, row.starred, onClose]);

  const currentPage = useMemo(() => {
    let p: TItem | null = null;
    for (const i of tl.items) { if (i.kind !== 'page') continue; if (i.at <= time + 50) p = i; else break; }
    return p;
  }, [tl.items, time]);

  const logItems = useMemo(
    () => tl.items.filter(i => showClicks || i.kind !== 'click'),
    [tl.items, showClicks]
  );

  return (
    <div
      ref={rootRef}
      className={`flex flex-col gap-3 min-w-0 w-full ${isFs ? 'bg-slate-950 p-4 h-screen' : ''}`}
    >
      {/* Üst çubuk */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
          <button onClick={onPrev} disabled={!onPrev} title="Önceki (P)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronLeft size={16} />
          </button>
          <span className="px-2 text-xs tabular-nums text-slate-500">{indexLabel}</span>
          <button onClick={onNext} disabled={!onNext} title="Sonraki (N)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className={`text-xs ${isFs ? 'text-slate-300' : 'text-slate-500'} flex items-center gap-1.5 min-w-0`}>
          <span className="tabular-nums">{new Date(row.recorded_from).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span>·</span>
          <span>{fmtDuration(recSeconds(row))}</span>
          {detail && <><span>·</span><span>{detail.event_count.toLocaleString('de-DE')} event</span></>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => saveMark({ starred: !row.starred })}
            title="Yıldızla (S) — yıldızlı kayıtlar otomatik silinmez"
            className={`p-2 rounded-lg transition-colors ${row.starred ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'}`}
          >
            <Star size={16} fill={row.starred ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => setNoteOpen(v => !v)} title="Not ekle"
            className={`p-2 rounded-lg transition-colors ${note ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-violet-600 hover:bg-slate-100'}`}>
            <StickyNote size={16} />
          </button>
          <button onClick={copyLink} title="Bu ana bağlantı kopyala"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 relative">
            {copied ? <Copy size={16} className="text-emerald-600" /> : <Link2 size={16} />}
          </button>
          <button onClick={() => setReloadKey(k => k + 1)} title="Kaydı yeniden yükle"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <RefreshCw size={16} />
          </button>
          {onToggleWide && (
            <button onClick={onToggleWide} title={wide ? 'Listeyi göster' : 'Geniş görünüm (listeyi gizle)'}
              className={`p-2 rounded-lg transition-colors ${wide ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
              {wide ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} title="Kapat (Esc)" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Özet + not */}
      {!isFs && detail && (
        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-50/60 ring-1 ring-violet-100 px-4 py-3">
          <p className="text-[13px] leading-relaxed text-slate-700">{narrate(row, tl)}</p>
          {noteOpen && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if ((row.note || '') !== note.trim()) saveMark({ note: note.trim() || null }); }}
              placeholder="Not: ör. 'adres önerisi telefonda açılmadı' — kaydedilir, listede görünür"
              rows={2}
              maxLength={500}
              className="mt-2 w-full text-sm rounded-lg border border-violet-200 bg-white/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          )}
        </div>
      )}

      <div className={`grid gap-3 ${isFs ? 'flex-1 min-h-0 grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-[minmax(0,1fr)]'}`}>
        {/* Sahne + kontroller */}
        <div className="flex flex-col min-w-0 rounded-2xl bg-slate-950 overflow-hidden">
          <div
            ref={stageRef}
            className={`relative flex items-center justify-center ${isFs ? 'flex-1 min-h-0' : ''}`}
            style={{ ...(isFs ? {} : { height: stageH }), backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.12) 1px, transparent 0)', backgroundSize: '18px 18px' }}
          >
            {/* Cihaz çerçevesi */}
            <div
              className={isPhone
                ? 'rounded-[1.6rem] bg-black p-[10px] shadow-2xl ring-1 ring-white/10'
                : 'rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-800'}
              style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
            >
              {!isPhone && (
                <div className="h-8 flex items-center gap-2 px-3 bg-slate-800 border-b border-white/5">
                  <span className="flex gap-1.5">
                    <i className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <i className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <i className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[11px] text-slate-300 bg-slate-900/70 rounded-md px-2 py-0.5 text-center">
                    flughafen-muenchen.taxi{currentPage?.label && currentPage.label !== '/' ? currentPage.label : ''}
                  </span>
                </div>
              )}
              <div
                className={`overflow-hidden bg-white ${isPhone ? 'rounded-[1.1rem]' : ''}`}
                style={{ width: vp.width * scale, height: vp.height * scale }}
              >
                <div
                  ref={mountRef}
                  className="[&_.replayer-wrapper]:!m-0 [&_iframe]:border-0 [&_iframe]:block"
                  style={{ width: vp.width, height: vp.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                />
              </div>
            </div>

            {/* Sahneye tıklayınca oynat/durdur */}
            {status === 'ready' && (
              <button
                aria-label={playing ? 'Durdur' : 'Oynat'}
                onClick={togglePlay}
                className="absolute inset-0 group cursor-pointer"
              >
                {!playing && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/90 text-violet-700 shadow-xl grid place-items-center group-hover:scale-105 transition-transform">
                    <Play size={28} className="ml-1" fill="currentColor" />
                  </span>
                )}
              </button>
            )}

            {skipping && (
              <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-medium bg-black/70 text-white px-3 py-1 rounded-full flex items-center gap-1.5">
                <FastForward size={12} /> Hareketsiz kısım atlanıyor
              </span>
            )}

            {status === 'loading' && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="w-9 h-9 border-2 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Kayıt yükleniyor…</p>
                  <p className="text-slate-600 text-xs mt-1">{(Number(row.total_bytes) / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute inset-0 grid place-items-center p-6">
                <div className="text-center max-w-sm">
                  <AlertTriangle className="mx-auto text-amber-400 mb-2" />
                  <p className="text-slate-200 text-sm">{error}</p>
                  <button onClick={() => setReloadKey(k => k + 1)} className="mt-3 text-xs text-violet-300 hover:text-white underline">Tekrar dene</button>
                </div>
              </div>
            )}
          </div>

          {/* Zaman çizelgesi + kontroller */}
          <div className="px-4 pt-2 pb-3 bg-slate-900 border-t border-white/5">
            <Scrubber total={total} time={time} items={tl.items} inactive={tl.inactive} onSeek={seek} />
            <div className="flex items-center gap-1.5 mt-1 text-slate-300 flex-wrap">
              <button onClick={togglePlay} disabled={status !== 'ready'} title="Oynat / durdur (Boşluk)"
                className="w-9 h-9 grid place-items-center rounded-full bg-white text-slate-900 hover:bg-violet-100 disabled:opacity-40">
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} className="ml-0.5" fill="currentColor" />}
              </button>
              <button onClick={() => seek(time - 10_000)} title="10 sn geri (←)" className="p-2 rounded-lg hover:bg-white/10"><RotateCcw size={15} /></button>
              <button onClick={() => seek(time + 10_000)} title="10 sn ileri (→)" className="p-2 rounded-lg hover:bg-white/10"><RotateCw size={15} /></button>
              <button onClick={nextMoment} title="Sonraki önemli an (E)" className="px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs flex items-center gap-1">
                <SkipForward size={14} /> Sonraki an
              </button>
              <span className="text-xs tabular-nums text-slate-400 ml-1">{fmtClock(time)} / {fmtClock(total)}</span>

              <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
                <div className="flex items-center rounded-lg bg-white/5 p-0.5" title="Hız (1–5)">
                  <Gauge size={13} className="mx-1.5 text-slate-500 hidden sm:block" />
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-1.5 py-0.5 rounded-md text-[11px] tabular-nums ${s === 16 ? 'hidden sm:inline' : ''} ${speed === s ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {s}×
                    </button>
                  ))}
                </div>
                <Toggle on={skipInactive} onChange={setSkipInactive} label="Boşlukları atla" />
                <Toggle on={autoNext} onChange={setAutoNext} label="Oto. sonraki" />
                <button onClick={toggleFs} title="Tam ekran (F)" className="p-2 rounded-lg hover:bg-white/10">
                  {isFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Olay akışı */}
        <EventLog
          items={logItems}
          time={time}
          onSeek={(ms) => seek(Math.max(0, ms - 1000))}
          showClicks={showClicks}
          onToggleClicks={() => setShowClicks(v => !v)}
          clickCount={tl.clickCount}
          dark={isFs}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/10 text-[11px]">
      <span className={`relative w-7 h-4 rounded-full transition-colors ${on ? 'bg-violet-500' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// İşaretli zaman çizelgesi: sayfa geçişleri, hatalar, fiyat, telefon, sinirli tıklamalar
// çubuğun üstünde; hareketsiz dönemler taralı. Sürükleyerek / tıklayarak atlanır.
// ---------------------------------------------------------------------------
function Scrubber({
  total, time, items, inactive, onSeek,
}: {
  total: number; time: number; items: TItem[]; inactive: { start: number; end: number }[]; onSeek: (ms: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number; item: TItem | null } | null>(null);
  const dragging = useRef(false);
  const p = (ms: number) => (total ? Math.min(100, Math.max(0, (ms / total) * 100)) : 0);

  const msAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * total;
  };
  const nearest = (ms: number): TItem | null => {
    const tol = total * 0.015;
    let best: TItem | null = null;
    for (const i of items) {
      if (i.kind === 'click') continue;
      if (Math.abs(i.at - ms) <= tol && (!best || Math.abs(i.at - ms) < Math.abs(best.at - ms))) best = i;
    }
    return best;
  };

  const majors = items.filter(i => MAJOR.includes(i.kind));
  const minors = items.filter(i => i.kind === 'click' || i.kind === 'focus');

  return (
    <div
      ref={barRef}
      className="relative h-9 cursor-pointer select-none touch-none"
      onPointerDown={(e) => {
        if (!total) return;
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onSeek(msAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!total) return;
        const ms = msAt(e.clientX);
        const r = barRef.current!.getBoundingClientRect();
        setHover({ x: e.clientX - r.left, ms, item: nearest(ms) });
        if (dragging.current) onSeek(ms);
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerLeave={() => { setHover(null); }}
    >
      {/* Önemli işaretler (üst sıra) */}
      {majors.map((m, i) => (
        <span
          key={`m${i}`}
          className={`absolute top-0 -translate-x-1/2 ${m.kind === 'page' ? 'w-[2px] h-3 rounded-sm' : 'w-2 h-2 rounded-full ring-2 ring-slate-900'}`}
          style={{ left: `${p(m.at)}%`, background: KIND_STYLE[m.kind].color, top: m.kind === 'page' ? 2 : 3 }}
        />
      ))}
      {/* İz çubuğu */}
      <div className="absolute left-0 right-0 top-[18px] h-1.5 rounded-full bg-white/10 overflow-hidden">
        {inactive.map((s, i) => (
          <span key={i} className="absolute top-0 h-full"
            style={{
              left: `${p(s.start)}%`, width: `${Math.max(0.3, p(s.end) - p(s.start))}%`,
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 5px)',
            }} />
        ))}
        <span className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${p(time)}%` }} />
      </div>
      {/* Tıklama / form odakları (alt sıra, ince) */}
      {minors.map((m, i) => (
        <span key={`n${i}`} className="absolute top-[27px] w-px h-1.5 -translate-x-1/2"
          style={{ left: `${p(m.at)}%`, background: KIND_STYLE[m.kind].color, opacity: 0.7 }} />
      ))}
      {/* Oynatma başı */}
      <span className="absolute top-[14px] w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-white shadow ring-2 ring-violet-500 pointer-events-none"
        style={{ left: `${p(time)}%` }} />
      {/* Hover ipucu */}
      {hover && (
        <div
          className="absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-1 text-[11px] text-white pointer-events-none z-10"
          style={{ left: Math.min(Math.max(hover.x, 60), (barRef.current?.clientWidth || 0) - 60) }}
        >
          <span className="tabular-nums text-slate-300">{fmtClock(hover.ms)}</span>
          {hover.item && (
            <span className="ml-1.5">
              <i className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: KIND_STYLE[hover.item.kind].color }} />
              {hover.item.label.slice(0, 50)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Oynatmayla senkron olay akışı — o an vurgulanır, tıklanınca 1 sn öncesine atlar
// ---------------------------------------------------------------------------
function EventLog({
  items, time, onSeek, showClicks, onToggleClicks, clickCount, dark,
}: {
  items: TItem[]; time: number; onSeek: (ms: number) => void;
  showClicks: boolean; onToggleClicks: () => void; clickCount: number; dark: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  let current = -1;
  for (let i = 0; i < items.length; i++) { if (items[i].at <= time + 200) current = i; else break; }

  useEffect(() => {
    const list = listRef.current;
    if (!list || hovering.current || current < 0) return;
    const el = list.children[current] as HTMLElement | undefined;
    if (!el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - list.clientHeight / 3), behavior: 'smooth' });
    }
  }, [current]);

  return (
    <div className={`flex flex-col min-h-0 rounded-2xl ring-1 ${dark ? 'bg-slate-900 ring-white/10' : 'bg-white ring-slate-200'} overflow-hidden ${dark ? '' : 'max-h-72'}`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${dark ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
        <span className="text-xs font-semibold">Olay akışı <span className="font-normal opacity-60">· {items.length}</span></span>
        <button onClick={onToggleClicks} className="text-[11px] text-violet-500 hover:text-violet-700">
          {showClicks ? 'Tıklamaları gizle' : `Tıklamaları göster (${clickCount})`}
        </button>
      </div>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-1"
        onMouseEnter={() => { hovering.current = true; }}
        onMouseLeave={() => { hovering.current = false; }}
      >
        {items.length === 0 && <p className="px-3 py-6 text-xs text-slate-400 text-center">Bu kayıtta işaretlenecek olay yok.</p>}
        {items.map((it, i) => {
          const st = KIND_STYLE[it.kind];
          const active = i === current;
          const past = i < current;
          return (
            <button
              key={i}
              onClick={() => onSeek(it.at)}
              className={`w-full text-left px-3 py-1.5 flex gap-2 items-start transition-colors border-l-2 ${
                active
                  ? (dark ? 'bg-violet-500/15 border-violet-400' : 'bg-violet-50 border-violet-500')
                  : `border-transparent ${dark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`
              } ${past && !active ? 'opacity-60' : ''}`}
            >
              <span className={`text-[10px] tabular-nums mt-0.5 w-9 shrink-0 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtClock(it.at)}</span>
              <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: st.color }} />
              <span className="min-w-0">
                <span className={`block text-xs leading-snug break-words ${dark ? 'text-slate-200' : 'text-slate-700'} ${it.kind === 'page' ? 'font-medium' : ''}`}>
                  {it.kind === 'click' && it.label !== 'Tıklama' ? <span className="opacity-60">Tıkladı: </span> : it.kind === 'focus' ? <span className="opacity-60">Alan: </span> : null}
                  {it.label}
                </span>
                {it.detail && <span className={`block text-[11px] leading-snug ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{it.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
