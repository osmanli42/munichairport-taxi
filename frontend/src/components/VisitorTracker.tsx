'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const HEARTBEAT_MS = 15_000;

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

export default function VisitorTracker() {
  const pathname = usePathname();
  const lastUrlRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    if (pathname.startsWith('/admin')) return;

    const sessionId = getOrCreate(sessionStorage, 'mt_session_id');
    const visitorId = getOrCreate(localStorage, 'mt_visitor_id');

    const fullUrl = window.location.pathname + window.location.search;
    if (lastUrlRef.current === fullUrl) return;
    lastUrlRef.current = fullUrl;

    const sp = new URLSearchParams(window.location.search);
    const gclid = sp.get('gclid') || '';
    const utm_source = sp.get('utm_source') || (sp.get('gad_source') ? 'google_ads' : '');
    const utm_medium = sp.get('utm_medium') || '';
    const utm_campaign = sp.get('utm_campaign') || sp.get('gad_campaignid') || '';

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
    });

    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        send('/track/heartbeat', { session_id: sessionId, path: fullUrl });
      }
    }, HEARTBEAT_MS);

    const onUnload = () => {
      send('/track/heartbeat', { session_id: sessionId, path: fullUrl });
    };
    window.addEventListener('pagehide', onUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [pathname]);

  return null;
}
