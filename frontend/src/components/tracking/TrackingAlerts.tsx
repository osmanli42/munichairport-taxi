'use client';

// Admin-wide tracking alerts: polls the event feed while the admin panel is open, plays the
// sound chosen per event in Fahrer → Ayarlar, and shows a toast that opens the booking.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { adminTracking, AlertKind, TrackingEvent } from '@/lib/tracking';

export const ALERT_LABEL: Record<AlertKind, string> = {
  enroute: '🚕 Şoför yola çıktı',
  arrived: '📍 Şoför alış noktasında',
  onboard: '🧳 Yolcu bindi',
  completed: '🏁 Yolculuk bitti',
  gps_lost: '⚠️ GPS sinyali kayboldu',
};

const TONES: Record<AlertKind, [number, number][]> = {
  enroute: [[660, 0], [880, 0.14]],
  arrived: [[784, 0], [988, 0.12], [1175, 0.24]],
  onboard: [[523, 0], [659, 0.14]],
  completed: [[880, 0], [660, 0.16]],
  gps_lost: [[440, 0], [440, 0.25], [440, 0.5]],
};

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    audioCtx = new C();
  }
  return audioCtx;
}

export function playTrackingTone(kind: AlertKind) {
  const c = ctx();
  if (!c) return;
  c.resume().catch(() => {});
  const now = c.currentTime;
  for (const [freq, at] of TONES[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = kind === 'gps_lost' ? 'square' : 'sine';
    osc.frequency.value = freq;
    const vol = kind === 'gps_lost' ? 0.08 : 0.2;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(vol, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.3);
    osc.connect(gain).connect(c.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.35);
  }
}

export default function TrackingAlerts({ onOpenBooking }: { onOpenBooking?: (bookingId: number) => void }) {
  const [toasts, setToasts] = useState<TrackingEvent[]>([]);
  const lastId = useRef<number | null>(null);

  // Browsers only allow sound after a user gesture; any click in the admin unlocks it.
  useEffect(() => {
    const unlock = () => { ctx()?.resume().catch(() => {}); };
    document.addEventListener('pointerdown', unlock);
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await adminTracking.events(lastId.current);
      if (lastId.current == null) {
        lastId.current = r.last_id; // start from "now" — no replay of old events on load
        return;
      }
      if (r.events.length) {
        lastId.current = r.events[r.events.length - 1].id;
        const fresh = r.events;
        setToasts((t) => [...t, ...fresh].slice(-5));
        const kinds = Array.from(new Set(fresh.map((e) => e.kind)));
        kinds.forEach((k, i) => { if (r.sound[k]) setTimeout(() => playTrackingTone(k), i * 700); });
        fresh.forEach((e) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== e.id)), 12_000));
      } else {
        lastId.current = Math.max(lastId.current, r.last_id);
      }
    } catch { /* offline or logged out — try again next tick */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [poll]);

  if (!toasts.length) return null;
  return (
    <div className="fixed top-3 right-3 z-[60] w-[min(92vw,340px)] space-y-2">
      {toasts.map((e) => (
        <div
          key={e.id}
          className={`rounded-xl shadow-lg border bg-white p-3 flex gap-2 items-start ${e.kind === 'gps_lost' ? 'border-rose-300' : 'border-gray-200'}`}
        >
          <button className="flex-1 text-left" onClick={() => { onOpenBooking?.(e.booking_id); setToasts((t) => t.filter((x) => x.id !== e.id)); }}>
            <div className="text-sm font-semibold text-gray-900">{ALERT_LABEL[e.kind]}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {e.booking_number}{e.driver_name ? ` · ${e.driver_name}` : ''}{e.detail ? ` · ${e.detail}` : ''}
            </div>
          </button>
          <button onClick={() => setToasts((t) => t.filter((x) => x.id !== e.id))} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
