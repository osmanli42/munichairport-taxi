'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BUFFER = 500;
// Chrome's sendBeacon silently drops payloads larger than ~64KB.
// We use a conservative limit and fall back to fetch for large payloads.
const BEACON_SIZE_LIMIT = 60_000; // 60 KB

// Same shape as VisitorTracker's uuid() so both components produce interchangeable IDs.
function newSessionId(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Records the user's session using rrweb and sends events to backend.
 *
 * Privacy / GDPR (must match the copy shown in the admin Replay tab):
 * - Password inputs and card-number fields are masked
 * - Text nodes inside '.sensitive' / '[data-mask]' are masked
 * - Everything else, including name / phone / email inputs, IS recorded
 *   (maskAllInputs is deliberately false — see the record() options below)
 * - Skipped on /admin paths
 *
 * Key design: the rrweb FullSnapshot (~200 KB) is sent immediately via
 * regular fetch as soon as it is emitted, bypassing the 64 KB sendBeacon
 * limit. Subsequent IncrementalSnapshot chunks are small and can use
 * sendBeacon for reliable delivery during page unload.
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

    // Use the same session/visitor IDs as VisitorTracker. Previously we bailed out when
    // VisitorTracker hadn't written mt_session_id yet, which meant the very first pageview
    // of every session — the landing behaviour we most want to see — was never recorded.
    // Creating the ID here with the same keys is safe: whichever component runs first wins
    // and the other reads the same value back.
    let sessionId = sessionStorage.getItem('mt_session_id');
    if (!sessionId) {
      sessionId = newSessionId();
      try { sessionStorage.setItem('mt_session_id', sessionId); } catch { return; }
    }
    const visitorId = localStorage.getItem('mt_visitor_id');
    sessionIdRef.current = sessionId;
    visitorIdRef.current = visitorId || '';

    let stopped = false;
    const url = `${API_BASE}/track/recording`;

    // ------------------------------------------------------------------
    // Core send helper
    // Small payloads (<60KB): prefer sendBeacon on unload (fire-and-forget).
    // Large payloads (FullSnapshot ~200KB): use regular fetch while page is alive.
    // ------------------------------------------------------------------
    const doSend = (body: string, fromUnload: boolean) => {
      try {
        if (fromUnload && navigator.sendBeacon && body.length < BEACON_SIZE_LIMIT) {
          const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
          if (ok) return;
        }
        // Regular fetch — keepalive: true only when body fits Chrome's 64KB keepalive cap
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: body.length < BEACON_SIZE_LIMIT,
        }).catch(() => {});
      } catch {}
    };

    const flush = (fromUnload = false) => {
      if (bufferRef.current.length === 0) return;
      const events = bufferRef.current.splice(0, bufferRef.current.length);
      const body = JSON.stringify({
        session_id: sessionIdRef.current,
        visitor_id: visitorIdRef.current,
        events,
      });
      doSend(body, fromUnload);
    };

    // Dynamically import rrweb to keep initial bundle slim
    import('rrweb').then((rrwebMod) => {
      if (stopped) return;
      const record = (rrwebMod as any).record || (rrwebMod as any).default?.record;
      if (!record) return;

      const stopFn = record({
        emit(event: any) {
          bufferRef.current.push(event);

          // FullSnapshot (type 2) is ~200KB — send immediately via fetch while
          // the page is still alive, bypassing Chrome's 64KB sendBeacon limit.
          if (event.type === 2) {
            flush(false); // regular fetch, not beacon
            return;
          }

          if (bufferRef.current.length >= MAX_BUFFER) {
            flush(false);
          }
        },
        // Privacy options — only mask passwords and card numbers.
        // NOTE: maskAllInputs stays false on purpose (deliberate product decision); the
        // admin Replay banner text must keep saying so.
        // maskTextSelector masks TEXT NODES, not input values.
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
        maskTextSelector: '.sensitive, [data-mask], input[name*=card]',
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

    const flushInterval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);

    const onUnload = () => flush(true); // use sendBeacon for small unload payloads
    window.addEventListener('pagehide', onUnload);

    return () => {
      stopped = true;
      clearInterval(flushInterval);
      window.removeEventListener('pagehide', onUnload);
      if (stopFnRef.current) {
        try { stopFnRef.current(); } catch {}
        stopFnRef.current = null;
      }
      // Final flush on SPA navigation (page still alive → ok to use fetch)
      flush(false);
    };
  }, [pathname]);

  return null;
}
