'use client';

// Driver-side GPS: watches the device position while a ride is live and sends it to the
// server. What makes it reliable on a phone:
// - sends on movement (≥ 15 m) or every 8 s, whichever comes first, plus a fresh
//   getCurrentPosition every 20 s when the watch goes quiet (a waiting car often gets no
//   watch callbacks on iOS, which would otherwise look like "GPS lost");
// - keeps the newest unsent fix and retries it, so a tunnel/dead spot doesn't lose the
//   position that follows;
// - holds a screen wake lock and re-acquires it whenever the page becomes visible again
//   (the browser drops it on every tab switch).

import { useCallback, useEffect, useRef, useState } from 'react';
import { GeoFix, haversine } from '@/lib/tracking';

export type GeoState = 'idle' | 'starting' | 'ok' | 'weak' | 'denied' | 'unavailable' | 'error';

export interface GeoSenderState {
  state: GeoState;
  accuracy: number | null;
  lastFix: GeoFix | null;
  lastSentAt: number | null;
  wakeLock: boolean;
  wasHidden: boolean;
  retry: () => void;
}

const WEAK_ACCURACY_M = 60;

export function useGeoSender(active: boolean, send: (fix: GeoFix) => Promise<unknown>): GeoSenderState {
  const [state, setState] = useState<GeoState>('idle');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastFix, setLastFix] = useState<GeoFix | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [wakeLock, setWakeLock] = useState(false);
  const [wasHidden, setWasHidden] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const sendRef = useRef(send);
  sendRef.current = send;
  const watchId = useRef<number | null>(null);
  const lock = useRef<any>(null);
  const lastSent = useRef<{ fix: GeoFix; at: number } | null>(null);
  const pending = useRef<GeoFix | null>(null);
  const inFlight = useRef(false);
  const lastCallbackAt = useRef(0);

  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current) return;
    const fix = pending.current;
    inFlight.current = true;
    try {
      await sendRef.current(fix);
      if (pending.current === fix) pending.current = null;
      lastSent.current = { fix, at: Date.now() };
      setLastSentAt(Date.now());
    } catch {
      // keep `pending` — retried on the next fix or tick
    } finally {
      inFlight.current = false;
    }
  }, []);

  const onPosition = useCallback((pos: GeolocationPosition) => {
    lastCallbackAt.current = Date.now();
    const c = pos.coords;
    const fix: GeoFix = {
      lat: c.latitude,
      lng: c.longitude,
      accuracy: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
      heading: c.heading != null && Number.isFinite(c.heading) && (c.speed ?? 0) > 1 ? Math.round(c.heading) : null,
      speed: c.speed != null && Number.isFinite(c.speed) ? Math.round(c.speed * 10) / 10 : null,
      timestamp: pos.timestamp || Date.now(),
    };
    setLastFix(fix);
    setAccuracy(fix.accuracy);
    setState(fix.accuracy != null && fix.accuracy > WEAK_ACCURACY_M ? 'weak' : 'ok');

    const prev = lastSent.current;
    const due = !prev
      || haversine(prev.fix, fix) >= 15
      || Date.now() - prev.at >= 8000
      || (prev.fix.accuracy != null && fix.accuracy != null && fix.accuracy < prev.fix.accuracy * 0.5);
    if (due) {
      pending.current = fix;
      void flush();
    }
  }, [flush]);

  const onError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) setState('denied');
    else if (err.code === err.POSITION_UNAVAILABLE) setState('unavailable');
    else setState((s) => (s === 'ok' || s === 'weak' ? s : 'error'));
  }, []);

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as any;
      if (!nav.wakeLock || document.visibilityState !== 'visible') return;
      if (lock.current && !lock.current.released) return;
      lock.current = await nav.wakeLock.request('screen');
      setWakeLock(true);
      lock.current.addEventListener?.('release', () => setWakeLock(false));
    } catch {
      setWakeLock(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setState('idle');
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState('unavailable');
      return;
    }
    setState('starting');
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 20_000,
    });
    void acquireWakeLock();

    const tick = setInterval(() => {
      void flush();
      if (Date.now() - lastCallbackAt.current > 20_000) {
        navigator.geolocation.getCurrentPosition(onPosition, () => {}, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 });
      }
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquireWakeLock();
        navigator.geolocation.getCurrentPosition(onPosition, () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
      } else {
        setWasHidden(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      try { lock.current?.release?.(); } catch { /* ignore */ }
      lock.current = null;
      setWakeLock(false);
    };
  }, [active, attempt, onPosition, onError, acquireWakeLock, flush]);

  return {
    state, accuracy, lastFix, lastSentAt, wakeLock, wasHidden,
    retry: () => { setWasHidden(false); setAttempt((a) => a + 1); },
  };
}
