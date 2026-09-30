'use client';

// Shared bits for the SEO tab: API helper, number formatting, small charts.

import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function seoApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  let token = '';
  try { token = localStorage.getItem('admin_token') || ''; } catch { /* ignore */ }
  const res = await fetch(`${API}/admin/seo2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j as T;
}

export const nf = (n: number | null | undefined, d = 0) => (n == null || !isFinite(n) ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (n: number | null | undefined, d = 1) => (n == null ? '—' : `%${nf(n * 100, d)}`);
export const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const shortPath = (u: string) => {
  try { return decodeURIComponent(new URL(u).pathname) || '/'; } catch { return u; }
};

/** Change chip. For positions lower is better → invert. */
export function Delta({ cur, prev, invert, abs, suffix }: { cur: number | null | undefined; prev: number | null | undefined; invert?: boolean; abs?: boolean; suffix?: string }) {
  if (cur == null || prev == null || (!prev && !abs)) return <span className="text-xs text-gray-400">—</span>;
  const diff = abs ? cur - prev : (cur - prev) / Math.abs(prev);
  if (Math.abs(diff) < (abs ? 0.05 : 0.005)) return <span className="text-xs text-gray-400">±0</span>;
  const good = invert ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap', good ? 'text-emerald-600' : 'text-red-600')}>
      <Icon size={12} />
      {abs ? `${diff > 0 ? '+' : ''}${nf(diff, 1)}` : `${diff > 0 ? '+' : ''}${nf(diff * 100, 0)} %`}
      {suffix && <span className="font-normal text-gray-400 ml-1">{suffix}</span>}
    </span>
  );
}

export function Kpi({ label, value, sub, delta, tone = 'text-gray-900', icon }: { label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">{label}{icon}</div>
      <div className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">{delta}{sub}</div>
    </div>
  );
}

/** Line/area chart for one or two daily series (second on its own scale). */
export function TrendChart({ data, a, b, height = 160 }: {
  data: Array<Record<string, any>>; a: { key: string; label: string; color: string }; b?: { key: string; label: string; color: string }; height?: number;
}) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-sm text-gray-400">Henüz veri yok</div>;
  const w = 800;
  const h = height;
  const pts = (key: string) => {
    const vals = data.map((d) => Number(d[key]) || 0);
    const max = Math.max(1, ...vals);
    return vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * w, h - 8 - (v / max) * (h - 20)] as const);
  };
  const line = (p: ReadonlyArray<readonly [number, number]>) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const pa = pts(a.key);
  const pb = b ? pts(b.key) : null;
  const first = data[0]?.date;
  const last = data[data.length - 1]?.date;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <path d={`${line(pa)} L${w},${h} L0,${h} Z`} fill={a.color} opacity="0.08" />
        <path d={line(pa)} fill="none" stroke={a.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {pb && <path d={line(pb)} fill="none" stroke={b!.color} strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
        <span>{first}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: a.color }} /> {a.label}</span>
          {b && <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed" style={{ borderColor: b.color }} /> {b.label}</span>}
        </span>
        <span>{last}</span>
      </div>
    </div>
  );
}

export function Spark({ values, invert, width = 72 }: { values: number[]; invert?: boolean; width?: number }) {
  if (values.length < 2) return <span className="text-gray-300 text-xs">—</span>;
  const h = 20;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const p = values.map((v, i) => {
    const y = (v - min) / (max - min || 1);
    return `${((i / (values.length - 1)) * width).toFixed(1)},${(invert ? 2 + y * (h - 4) : h - 2 - y * (h - 4)).toFixed(1)}`;
  }).join(' ');
  return <svg width={width} height={h}><polyline points={p} fill="none" stroke="#2a66aa" strokeWidth="1.5" /></svg>;
}

export function PosBadge({ pos }: { pos: number | null | undefined }) {
  if (pos == null || pos === 0) return <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">—</span>;
  const cls = pos <= 3 ? 'bg-emerald-100 text-emerald-700' : pos <= 10 ? 'bg-sky-100 text-sky-700' : pos <= 20 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';
  return <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold tabular-nums', cls)}>{nf(pos, 1)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-gray-400">{children}</div>;
}
