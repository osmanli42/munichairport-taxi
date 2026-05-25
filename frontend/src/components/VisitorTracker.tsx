'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const HEARTBEAT_MS = 15_000;
const MAX_SESSION_MS = 2 * 60 * 60 * 1000; // 2 saat sonra heartbeat dur
const EVENT_FLUSH_MS = 5_000;

function uuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreate(storage: Storage, key: string): string {
  let v = storage.getItem(key);
  if (!v) {
    v = uuid();
    storage.setItem(key, v);
  }
  return v;
}

function send(path: string, body: any): void {
  const url = `${API_BASE}${path}`;
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // ignore — tracking should never break UX
  }
}

function describeTarget(el: HTMLElement | null): string {
  if (!el) return '';
  // Walk up max 3 levels to find a meaningful element
  let cur: HTMLElement | null = el;
  for (let i = 0; i < 3 && cur; i++) {
    const tag = cur.tagName.toLowerCase();
    if (tag === 'a' || tag === 'button' || tag === 'input') {
      const text = (cur.textContent || '').trim().slice(0, 40);
      const href = (cur as HTMLAnchorElement).href || '';
      const id = cur.id ? `#${cur.id}` : '';
      const cls = cur.className && typeof cur.className === 'string'
        ? '.' + cur.className.split(' ').filter(Boolean).slice(0, 2).join('.')
        : '';
      return `${tag}${id}${cls} "${text}"${href ? ` -> ${href.slice(0, 60)}` : ''}`.slice(0, 200);
    }
    cur = cur.parentElement;
  }
  // Fallback: just tag + text
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent || '').trim().slice(0, 40);
  return `${tag} "${text}"`.slice(0, 200);
}

function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastUrlRef = useRef<string>('');
  const eventQueueRef = useRef<any[]>([]);
  const maxScrollRef = useRef<number>(0);
  const scrollMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    if (pathname.startsWith('/admin')) return;

    const sessionId = getOrCreate(sessionStorage, 'mt_session_id');
    const visitorId = getOrCreate(localStorage, 'mt_visitor_id');

    const fullUrl = window.location.pathname + window.location.search;
    if (lastUrlRef.current === fullUrl) return;
    lastUrlRef.current = fullUrl;

    // Reset scroll milestones for new page
    maxScrollRef.current = 0;
    scrollMilestonesRef.current = new Set();

    const sp = new URLSearchParams(window.location.search);
    const gclid = sp.get('gclid') || '';
    const utm_source = sp.get('utm_source') || (sp.get('gad_source') ? 'google_ads' : '');
    const utm_medium = sp.get('utm_medium') || '';
    const utm_campaign = sp.get('utm_campaign') || sp.get('gad_campaignid') || '';

    // Page load time via Navigation Timing API
    let load_time_ms: number | null = null;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.loadEventEnd > 0) {
        load_time_ms = Math.round(nav.loadEventEnd - nav.startTime);
      }
    } catch {}

    send('/track/pageview', {
      session_id: sessionId,
      visitor_id: visitorId,
      path: fullUrl,
      title: document.title,
      referrer: document.referrer || '',
      utm_source,
      utm_medium,
      utm_campaign,
      gclid,
      screen_w: window.screen.width,
      screen_h: window.screen.height,
      lang: navigator.language || '',
      load_time_ms,
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        send('/track/heartbeat', { session_id: sessionId, path: fullUrl });
      }
    }, HEARTBEAT_MS);

    // Click tracking — capture page-wide
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Use page coordinates (includes scroll) for accurate heatmap on long pages
      const pageX = e.pageX;
      const pageY = e.pageY;
      const docW = document.documentElement.scrollWidth || window.innerWidth;
      const docH = document.documentElement.scrollHeight || window.innerHeight;
      const x_pct = Math.max(0, Math.min(100, (pageX / docW) * 100));
      const y_pct = Math.max(0, Math.min(100, (pageY / docH) * 100));
      eventQueueRef.current.push({
        type: 'click',
        x_pct: Number(x_pct.toFixed(2)),
        y_pct: Number(y_pct.toFixed(2)),
        target: describeTarget(target),
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        device: deviceType(),
      });
    };

    // Scroll depth — record at 25/50/75/100% milestones
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewH = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      const denom = Math.max(1, docH - viewH);
      const depth = Math.min(100, Math.round(((scrollTop + viewH) / docH) * 100));
      if (depth > maxScrollRef.current) maxScrollRef.current = depth;

      for (const ms of [25, 50, 75, 100]) {
        if (depth >= ms && !scrollMilestonesRef.current.has(ms)) {
          scrollMilestonesRef.current.add(ms);
          eventQueueRef.current.push({
            type: 'scroll',
            scroll_depth: ms,
            viewport_w: window.innerWidth,
            viewport_h: window.innerHeight,
            device: deviceType(),
          });
        }
      }
    };

    // Flush queued events
    const flush = () => {
      if (eventQueueRef.current.length === 0) return;
      const events = eventQueueRef.current.splice(0, eventQueueRef.current.length);
      send('/track/event', {
        session_id: sessionId,
        path: fullUrl,
        events,
      });
    };

    const flushTimer = setInterval(flush, EVENT_FLUSH_MS);

    // Form field focus tracking — field name only, never value
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
      const fieldName = (el as HTMLInputElement).name
        || (el as HTMLInputElement).id
        || (el as HTMLInputElement).placeholder?.slice(0, 40)
        || tag;
      // Skip sensitive fields
      if (/passw|credit|card|cvv|iban|pin/i.test(fieldName)) return;
      eventQueueRef.current.push({
        type: 'form_focus',
        target: fieldName,
        device: deviceType(),
      });
    };

    document.addEventListener('click', onClick, { capture: true, passive: true });
    document.addEventListener('focusin', onFocus, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    const onUnload = () => {
      send('/track/heartbeat', { session_id: sessionId, path: fullUrl });
      flush();
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      clearInterval(heartbeat);
      clearInterval(flushTimer);
      document.removeEventListener('click', onClick, { capture: true } as any);
      document.removeEventListener('focusin', onFocus, { capture: true } as any);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onUnload);
      // Flush remaining events on cleanup
      flush();
    };
  }, [pathname]);

  return null;
}
