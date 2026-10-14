'use client';

// Live tab → "Canlı izle": follow one visitor's screen in near real time.
//
// Same rrweb recording as the Replay tab, but rrweb's Replayer runs in liveMode and new
// events are appended as they arrive (GET /admin/recordings/:id/live?after=<chunk id>).
// While this window polls, the server tells that visitor's recorder it is being watched,
// so it uploads every 1.5 s instead of every 10 s (SessionRecorder.tsx) → ~2–4 s behind.
import 'rrweb/dist/rrweb.min.css';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';
import { API_BASE, recordedViewport } from './lib';

const POLL_MS = 1_500;
// Replay this far behind the visitor's "now": enough for upload (≤1.5 s) + poll (≤1.5 s),
// so events play smoothly instead of in bursts.
const LIVE_LAG_MS = 3_000;
const ENDED_AFTER_SEC = 60;

export interface LiveWatchTarget {
  session_id: string;
  city?: string | null;
  ua_device?: string | null;
  current_path?: string | null;
  sourceLabel?: string;
}

type Status = 'loading' | 'waiting' | 'live' | 'not_recorded' | 'error';

export default function LivePlayer({ token, target, stillLive, onClose, onPrev, onNext }: {
  token: string;
  target: LiveWatchTarget;
  /** still in the Live list (last activity < 60 s) */
  stillLive: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [vp, setVp] = useState({ width: 1280, height: 800 });
  const [avail, setAvail] = useState({ w: 900, h: 600 });
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [chunkAge, setChunkAge] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Poll + feed the live replayer
  useEffect(() => {
    let cancelled = false;
    let after = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setStatus('loading');
    setLastEventAt(null);

    const destroy = () => {
      const rep = replayerRef.current;
      replayerRef.current = null;
      if (rep) { try { rep.pause(); } catch {} try { rep.destroy?.(); } catch {} }
      if (mountRef.current) mountRef.current.innerHTML = '';
    };

    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/recordings/${encodeURIComponent(target.session_id)}/live${after ? `?after=${after}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(String(r.status));
        const d: { events: any[]; last_id: number; recorded: boolean; waiting?: boolean; last_chunk_age_sec: number | null; visitor_skew_ms?: number; server_now?: number } = await r.json();
        const recvAt = Date.now();
        if (cancelled) return;
        setChunkAge(d.last_chunk_age_sec);

        if (!replayerRef.current) {
          if (!d.recorded) { setStatus('not_recorded'); return; }
          if (d.waiting || !d.events.some((e) => e?.type === 2)) { setStatus('waiting'); return; }
          const mod: any = await import('rrweb');
          const Replayer = mod.Replayer || mod.default?.Replayer;
          if (cancelled || !mountRef.current) return;
          mountRef.current.innerHTML = '';
          const v = recordedViewport(d.events);
          if (v) setVp(v);
          const rep = new Replayer([], {
            root: mountRef.current,
            liveMode: true,
            showWarning: false,
            triggerFocus: true,
            mouseTail: { duration: 700, lineCap: 'round', lineWidth: 3, strokeStyle: 'rgba(168,85,247,0.55)' },
          });
          rep.on('resize', (dim: any) => { if (dim?.width && dim?.height) setVp({ width: dim.width, height: dim.height }); });
          replayerRef.current = rep;
          // Baseline = the visitor's "now" (their device clock) minus a small lag. Everything
          // before it is applied at once; later events play at their own pace ~3 s behind.
          // Using the newest event instead would add the visitor's idle time as extra delay.
          const serverOffset = d.server_now ? d.server_now - recvAt : 0;
          const visitorNow = recvAt + serverOffset + (d.visitor_skew_ms || 0);
          rep.startLive(visitorNow - LIVE_LAG_MS);
          for (const e of d.events) rep.addEvent(e);
          setStatus('live');
        } else {
          for (const e of d.events) replayerRef.current.addEvent(e);
        }
        if (d.events.length) setLastEventAt(Date.now());
        after = d.last_id || after;
      } catch {
        if (!cancelled && !replayerRef.current) setStatus('error');
      } finally {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      destroy();
    };
  }, [target.session_id, token]);

  // Clock for "son olay x sn önce"
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Scale the recorded viewport into the available stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAvail({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Esc closes, ←/→ switch visitor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const isPhone = target.ua_device === 'mobile' || vp.width < 600;
  const pad = isPhone ? 20 : 2;
  const scale = Math.max(0.1, Math.min((avail.w - pad - 16) / vp.width, (avail.h - pad - 16) / vp.height, 1));
  const ended = !stillLive && (chunkAge == null || chunkAge > ENDED_AFTER_SEC);
  const sinceLast = lastEventAt ? Math.round((now - lastEventAt) / 1000) : null;
  const ref = target.session_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl bg-slate-950 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border-b border-white/10 text-sm text-slate-200">
          {ended
            ? <span className="flex items-center gap-1.5 font-semibold text-slate-400"><i className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Ziyaretçi ayrıldı</span>
            : <span className="flex items-center gap-1.5 font-semibold text-red-400"><i className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> CANLI</span>}
          <span className="truncate">
            {[target.city, target.sourceLabel, target.current_path].filter(Boolean).join(' · ')}
          </span>
          <span className="font-mono text-[11px] bg-white/10 px-1.5 py-0.5 rounded">Ref {ref}</span>
          {status === 'live' && sinceLast != null && !ended && (
            <span className="text-xs text-slate-400 whitespace-nowrap">son hareket {sinceLast} sn önce</span>
          )}
          <span className="flex-1" />
          <button onClick={onPrev} disabled={!onPrev} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Önceki ziyaretçi (←)"><ChevronLeft size={18} /></button>
          <button onClick={onNext} disabled={!onNext} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" title="Sonraki ziyaretçi (→)"><ChevronRight size={18} /></button>
          <a href={`/admin?tab=replay&replay=${encodeURIComponent(target.session_id)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-white/10" title="Baştan izle (Replay)">
            <ExternalLink size={14} /> Replay
          </a>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10" title="Kapat (Esc)"><X size={18} /></button>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className="relative flex-1 min-h-0 flex items-center justify-center"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.12) 1px, transparent 0)', backgroundSize: '18px 18px' }}
        >
          <div
            className={isPhone ? 'rounded-[1.6rem] bg-black p-[10px] shadow-2xl ring-1 ring-white/10' : 'rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-800'}
            style={{ visibility: status === 'live' ? 'visible' : 'hidden' }}
          >
            <div className={`overflow-hidden bg-white ${isPhone ? 'rounded-[1.1rem]' : ''}`} style={{ width: vp.width * scale, height: vp.height * scale }}>
              <div
                ref={mountRef}
                className="[&_.replayer-wrapper]:!m-0 [&_iframe]:border-0 [&_iframe]:block pointer-events-none"
                style={{ width: vp.width, height: vp.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              />
            </div>
          </div>

          {status !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 text-sm text-center px-6">
              {status === 'loading' && <><Loader2 className="animate-spin" size={22} /> Bağlanıyor…</>}
              {status === 'waiting' && <><Loader2 className="animate-spin" size={22} /> Ziyaretçinin ekranı bekleniyor… <span className="text-xs text-slate-500">(ilk görüntü en geç ~10 sn içinde gelir)</span></>}
              {status === 'not_recorded' && <>Bu oturum kaydedilmiyor (kayıt kapalı veya örnekleme dışında). <span className="text-xs text-slate-500">Replay → Ayarlar'dan kayıt oranını kontrol edin.</span></>}
              {status === 'error' && <>Bağlantı hatası — tekrar deneniyor…</>}
            </div>
          )}
          {ended && status === 'live' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-slate-200 text-sm px-4 py-2 rounded-xl ring-1 ring-white/10">
              Ziyaretçi siteden ayrıldı — son görüntü. Tamamı için <b>Replay</b>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
