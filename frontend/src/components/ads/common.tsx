'use client';

// Shared bits for the Google Ads coach tab (backend: routes/ads-v2.ts, services/ads/*).

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export const API_BASE = API;

export function token() {
  try { return localStorage.getItem('admin_token') || ''; } catch { return ''; }
}

export async function adsApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/admin/ads/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j as T;
}

export const eur2 = (n: number | null | undefined) => (n == null || !isFinite(n) ? '—' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const eur0 = (n: number | null | undefined) => (n == null || !isFinite(n) ? '—' : n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
export const pct1 = (n: number | null | undefined) => (n == null || !isFinite(n) ? '—' : `%${(n * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}`);
export const num = (n: number | null | undefined, d = 0) => (n == null || !isFinite(n) ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }));

export const PRIORITY: Record<string, [string, string]> = {
  high: ['Yüksek', 'bg-red-100 text-red-700'],
  medium: ['Orta', 'bg-amber-100 text-amber-800'],
  low: ['Düşük', 'bg-gray-100 text-gray-600'],
};

export const CATEGORY: Record<string, string> = {
  tracking: 'Tracking', data: 'Veri', negatives: 'Negatif kelime', keywords: 'Kelimeler', budget: 'Bütçe',
  bidding: 'Teklif', landing: 'Açılış sayfası', quality: 'Kalite', conversions: 'Conversion',
};

export const VERDICT: Record<string, [string, string, string]> = {
  scale: ['Büyüt', 'bg-emerald-100 text-emerald-700', 'CPA hedefin altında, bütçe yüzünden gösterim kaçıyor'],
  watch: ['İzle', 'bg-sky-100 text-sky-700', 'Hedefe yakın, değişiklik gerekmiyor'],
  optimize: ['İyileştir', 'bg-amber-100 text-amber-800', 'CPA hedefin üstünde — kelime/arama terimi temizliği'],
  pause: ['Durdur?', 'bg-red-100 text-red-700', 'Harcıyor ama hiç rezervasyon/conversion yok'],
  nodata: ['Veri yok', 'bg-gray-100 text-gray-500', 'Kampanya raporu yüklenmedi'],
};

export function Chip({ className, children, title }: { className: string; children: ReactNode; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', className)}>{children}</span>;
}

/** Read an uploaded CSV as text: Google Ads „Excel CSV“ is UTF-16 with BOM. */
export async function readCsvFile(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  return new TextDecoder('utf-8').decode(buf);
}

export function CopyBox({ text, label = 'Kopyala' }: { text: string; label?: string }) {
  return (
    <div className="mt-2 rounded-lg bg-gray-50 ring-1 ring-gray-200">
      <pre className="max-h-44 overflow-auto px-3 py-2 text-xs text-gray-800 whitespace-pre-wrap break-all">{text}</pre>
      <div className="border-t border-gray-200 px-3 py-1.5 text-right">
        <button
          onClick={(e) => {
            navigator.clipboard?.writeText(text).catch(() => {});
            const b = e.currentTarget;
            b.textContent = '✓ Kopyalandı';
            setTimeout(() => { b.textContent = label; }, 1500);
          }}
          className="text-xs font-semibold text-primary-600 hover:underline"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
