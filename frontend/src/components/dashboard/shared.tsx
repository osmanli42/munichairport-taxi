'use client';

// Helpers shared by the dashboard and its widgets. Times are Berlin wall-clock strings
// ('YYYY-MM-DDTHH:mm'); they are cut and compared as strings, never passed through
// new Date() in the browser's time zone.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------------------
// Berlin wall-clock helpers

const BERLIN = 'Europe/Berlin';

/** Current Berlin time as 'YYYY-MM-DDTHH:mm'. */
export function berlinNowWall(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: BERLIN, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

export const wall = (s?: string | null) => String(s || '').replace(' ', 'T').slice(0, 16);
export const hhmm = (s?: string | null) => wall(s).slice(11, 16) || '—';

/** Minutes since epoch for a wall-clock string — only ever used for differences. */
export function wallMinutes(s: string): number {
  const [d, t = '00:00'] = wall(s).split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, h, mi) / 60000;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('de-DE', { timeZone: 'UTC', ...opts });
}

export function fmtDuration(min: number): string {
  if (min < 1) return 'jetzt';
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m && h < 3 ? `${h} Std ${m} Min` : `${h} Std`;
  const d = Math.round(h / 24);
  return `${d} Tag${d > 1 ? 'en' : ''}`;
}

export function fmtAgo(created: string, now: string): string {
  const diff = wallMinutes(now) - wallMinutes(created);
  if (diff < 1) return 'gerade eben';
  if (diff < 60) return `vor ${diff} Min`;
  if (created.slice(0, 10) === now.slice(0, 10)) return `heute ${hhmm(created)}`;
  if (created.slice(0, 10) === addDays(now.slice(0, 10), -1)) return `gestern ${hhmm(created)}`;
  return `${dayLabel(created.slice(0, 10), { day: '2-digit', month: '2-digit' })} ${hhmm(created)}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;


export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const isAirport = (a?: string | null) => /flughafen|airport|terminal|MUC\b/i.test(a || '');

export function Card({ title, icon: Icon, right, children, className }: {
  title: string; icon: LucideIcon; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Icon size={17} className="text-primary-500" />
          {title}
        </h3>
        {right}
      </header>
      {children}
    </section>
  );
}

/** Small on/off switch used in widget headers and settings. */
export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onChange} disabled={disabled} aria-pressed={on} className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 disabled:opacity-50">
      <span className={cn('relative w-9 h-5 rounded-full transition-colors', on ? 'bg-primary-600' : 'bg-gray-300')}>
        <span className={cn('absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      {label}
    </button>
  );
}
