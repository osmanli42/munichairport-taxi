'use client';

// Fixed prices by pick-up area, in three tabs (Stadt München, Landkreis München, Umland und Fernziele)
// with a small search field. Prices arrive already computed by the booking price engine (server side).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PriceRowData = { key: string; name: string; href?: string; km: number; min: number; kombi: number; van: number };
export type PriceTab = { id: string; label: string; hint: string; rows: PriceRowData[] };

const money = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[-/,]/g, ' ');

function Labels() {
  return (
    <div className="flex gap-3 pr-1 font-semibold uppercase tracking-wide">
      <span className="w-[5.25rem] text-right">Kombi</span>
      <span className="w-[5.25rem] text-right">Van</span>
    </div>
  );
}

export default function PriceTabs({ tabs, searchLabel, emptyText }: { tabs: PriceTab[]; searchLabel: string; emptyText: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [q, setQ] = useState('');
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  const rows = useMemo(() => {
    const words = norm(q).split(' ').filter(Boolean);
    if (!words.length) return tab.rows;
    return tab.rows.filter((r) => words.every((w) => norm(r.name).includes(w)));
  }, [q, tab]);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-primary-800 px-4 py-3">
        <div role="tablist" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => setActive(t.id)}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm',
                t.id === tab.id ? 'bg-gold-400 text-primary-900 shadow-sm' : 'bg-white/10 text-white hover:bg-white/20',
              )}
            >
              {t.label} <span className={cn('ml-1 font-semibold', t.id === tab.id ? 'text-primary-800' : 'text-white/70')}>{t.rows.length}</span>
            </button>
          ))}
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">{searchLabel}</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchLabel}
            className="w-full rounded-lg border border-transparent bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gold-400 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid border-b border-gray-100 bg-gray-50 text-xs text-gray-500 md:grid-cols-2">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          <span>{tab.hint}</span>
          <Labels />
        </div>
        <div className="hidden items-center justify-end px-4 py-2 md:flex"><Labels /></div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="md:columns-2 md:[column-rule:1px_solid_rgb(243_244_246)]">
          {rows.map((r) => (
            <li key={r.key} className="flex break-inside-avoid items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
              <div className="min-w-0">
                {r.href ? (
                  <Link href={r.href} className="font-semibold text-gray-900 hover:text-primary-700 hover:underline">{r.name}</Link>
                ) : (
                  <span className="font-semibold text-gray-900">{r.name}</span>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap"><MapPin size={12} /> {Math.round(r.km)} km</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap"><CalendarClock size={12} /> ca. {r.min} Min.</span>
                </p>
              </div>
              <div className="flex gap-3 tabular-nums">
                <span className="w-[5.25rem] whitespace-nowrap text-right text-base font-extrabold text-primary-800">{money(r.kombi)}</span>
                <span className="w-[5.25rem] whitespace-nowrap text-right text-base font-bold text-gray-700">{money(r.van)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
