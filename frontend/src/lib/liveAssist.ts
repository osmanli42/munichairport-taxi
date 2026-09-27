'use client';

import { useEffect, useState } from 'react';
import type { WhatsAppContext } from '@/lib/utils';
import { liveRef } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

export interface LiveAssistConfig {
  enabled: boolean;
  auto_enabled: boolean;
  auto_delay_sec: number;
  wa_prefill_enabled: boolean;
  agent_name: string;
  agent_online?: boolean;
}

const OFF: LiveAssistConfig = { enabled: false, auto_enabled: false, auto_delay_sec: 40, wa_prefill_enabled: false, agent_name: '' };

// Einmal pro Seitenaufruf laden — LiveAssist und WhatsAppButton teilen sich das Ergebnis.
let configPromise: Promise<LiveAssistConfig> | null = null;
export function loadLiveAssistConfig(): Promise<LiveAssistConfig> {
  if (!configPromise) {
    configPromise = fetch(`${API_BASE}/live-assist/config`)
      .then((r) => (r.ok ? r.json() : OFF))
      .catch(() => OFF);
  }
  return configPromise;
}

export function useLiveAssistConfig(): LiveAssistConfig | null {
  const [cfg, setCfg] = useState<LiveAssistConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadLiveAssistConfig().then((c) => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}

export function getSessionId(): string | null {
  try { return sessionStorage.getItem('mt_session_id'); } catch { return null; }
}

export const isPricePage = (p: string) => /\/ergebnisse(\/|$)/.test(p);
export const isBookingPage = (p: string) => /\/buchen(\/|$)/.test(p);

/**
 * Strecke/Preis, die der Besucher gerade vor sich hat — für WhatsApp-Text und Sprechblase.
 * Preis auf /ergebnisse direkt aus den Karten (data-price), damit keine Preislogik doppelt läuft.
 */
export function readTripContext(pathname: string): WhatsAppContext {
  const ref = liveRef(getSessionId());
  try {
    if (isPricePage(pathname) || isBookingPage(pathname)) {
      const qs = new URLSearchParams(window.location.search);
      const ctx: WhatsAppContext = {
        pickup: qs.get('pickup'),
        dropoff: qs.get('dropoff'),
        date: qs.get('date'),
        time: qs.get('time'),
        passengers: qs.get('passengers'),
        vehicle: qs.get('vehicle'),
        price: Number(qs.get('price')) || null,
        ref,
      };
      if (isPricePage(pathname)) {
        const cards = (Array.from(document.querySelectorAll('[data-price][data-vehicle]')) as HTMLElement[])
          .map((c) => ({ price: Number(c.getAttribute('data-price')), vehicle: c.getAttribute('data-vehicle') }))
          .filter((c) => Number.isFinite(c.price) && c.price > 0)
          .sort((a, b) => a.price - b.price);
        if (cards[0]) { ctx.price = cards[0].price; ctx.vehicle = cards[0].vehicle; }
      }
      return ctx;
    }
    const raw = localStorage.getItem('mt_booking_draft');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Date.now() - Number(d.savedAt) < 7 * 24 * 60 * 60 * 1000) {
        return { pickup: d.pickup, dropoff: d.dropoff, price: d.price ?? null, ref };
      }
    }
  } catch { /* ohne Kontext weiter */ }
  return { ref };
}

/** Buchungslink aus dem Entwurf (für "Jetzt buchen" außerhalb der Preisseite). */
export function draftPath(): string | null {
  try {
    const d = JSON.parse(localStorage.getItem('mt_booking_draft') || 'null');
    return d && typeof d.path === 'string' && Date.now() - Number(d.savedAt) < 7 * 24 * 60 * 60 * 1000 ? d.path : null;
  } catch {
    return null;
  }
}

export function ackLiveAssist(event: string, id?: number | null): Promise<number | null> {
  const session_id = getSessionId();
  if (!session_id) return Promise.resolve(null);
  return fetch(`${API_BASE}/live-assist/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, id: id ?? undefined, event }),
    keepalive: true,
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j.id === 'number' ? j.id : null))
    .catch(() => null);
}

export const LIVE_PROMO_KEY = 'mt_live_promo';

// Chat-Status für andere Komponenten (WhatsApp-Button blendet sich aus, solange wir im Chat erreichbar sind)
export const LA_ONLINE_EVENT = 'la:online';
export const LA_PROMO_EVENT = 'la:promo';

/**
 * Bild vor dem Hochladen verkleinern (max. 1600 px, JPEG) — Handyfotos haben sonst 5–10 MB.
 * GIFs bleiben unverändert (Animation).
 */
export function imageToDataUrl(file: File, maxSide = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { reject(new Error('type')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === 'image/gif') { resolve(src); return; }
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
