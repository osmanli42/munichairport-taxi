'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BUFFER = 500;

/**
 * Records the user's session using rrweb and sends events to backend.
 *
 * Privacy / GDPR:
 * - All <input>, <textarea>, <select> values are masked by default
 * - Elements with class 'sensitive' / data-mask are masked
 * - Password fields fully blocked
 * - Skipped on /admin paths
 */
export default function SessionRecorder() {
  const pathname = usePathname();
  const stopFnRef = useRef<(() => void) | null>(null);
  const bufferRef = useRef<any[]>([]);
  const sessionIdRef = useRef<string>('');
  const visitorIdRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    if (pathname.startsWith('/admin')) return;

    // Use the same session/visitor IDs as VisitorTracker
    const sessionId = sessionStorage.getItem('mt_session_id');
    const visitorId = localStorage.getItem('mt_visitor_id');
    if (!sessionId) return; // VisitorTracker hasn't initialised yet — will run on next nav
    sessionIdRef.current = sessionId;
    visitorIdRef.current = visitorId || '';

    let stopped = false;

    // Dynamically import rrweb to keep initial bundle slim
    import('rrweb').then((rrwebMod) => {
      if (stopped) return;
      const record = (rrwebMod as any).record || (rrwebMod as any).default?.record;
      if (!record) return;

      const stopFn = record({
        emit(event: any) {
          bufferRef.current.push(event);
          if (bufferRef.current.length >= MAX_BUFFER) {
            flush();
          }
        },
        // Privacy options — mask everything by default
        maskAllInputs: true,
        maskInputOptions: {
          password: true,
          email: true,
          tel: true,
          text: true,
          number: true,
          search: true,
          url: true,
        },
        maskTextSelector: '.sensitive, [data-mask], input[name*=card], input[name*=email], input[name*=phone], input[name*=name]',
        blockClass: 'rr-block',
        ignoreClass: 'rr-ignore',
        // Sample mouse moves to keep size manageable
        sampling: {
          mousemove: 50,    // every 50ms
          scroll: 150,      // every 150ms
          input: 'last',    // only final value
        },
        // Skip media (videos, iframes)
        recordCanvas: false,
        // Inline styles for proper replay
        inlineStylesheet: true,
        collectFonts: false,
      });

      stopFnRef.current = stopFn;
    }).catch(() => {});

    const flush = () => {
      if (bufferRef.current.length === 0) return;
      const events = bufferRef.current.splice(0, bufferRef.current.length);
      const body = JSON.stringify({
        session_id: sessionIdRef.current,
        visitor_id: visitorIdRef.current,
        events,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(`${API_BASE}/track/recording`, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(`${API_BASE}/track/recording`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    const flushInterval = setInterval(flush, FLUSH_INTERVAL_MS);

    const onUnload = () => flush();
    window.addEventListener('pagehide', onUnload);

    return () => {
      stopped = true;
      clearInterval(flushInterval);
      window.removeEventListener('pagehide', onUnload);
      if (stopFnRef.current) {
        try { stopFnRef.current(); } catch {}
        stopFnRef.current = null;
      }
      // Final flush
      flush();
    };
  }, [pathname]);

  return null;
}
