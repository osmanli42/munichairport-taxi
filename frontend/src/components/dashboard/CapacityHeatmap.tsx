'use client';

// Rides per 2-hour slot over the next 7 days, from the same items as the Fahrplan
// (bookings incl. Rückfahrten, plus calendar-only rides when shown). Bus = Van/Großraum.

import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, addDays, dayLabel } from './shared';

export type CapacityEntry = { time: string; bus: boolean; label: string };

const SLOTS = Array.from({ length: 12 }, (_, i) => i * 2); // 0,2,…,22

function tone(n: number, max: number) {
  if (!n) return 'bg-gray-50 text-gray-300';
  const r = n / Math.max(max, 1);
  if (r > 0.75) return 'bg-primary-700 text-white';
  if (r > 0.5) return 'bg-primary-500 text-white';
  if (r > 0.25) return 'bg-primary-300 text-primary-900';
  return 'bg-primary-100 text-primary-800';
}

export default function CapacityHeatmap({ entries, today }: { entries: CapacityEntry[]; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const grid = useMemo(() => {
    const m = new Map<string, CapacityEntry[]>();
    for (const e of entries) {
      const k = `${e.time.slice(0, 10)}|${Math.floor(+e.time.slice(11, 13) / 2) * 2}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [entries]);
  const max = Math.max(1, ...Array.from(grid.values()).map((l) => l.length));
  const peak = Array.from(grid.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  const perDay = (d: string) => entries.filter((e) => e.time.startsWith(d));

  return (
    <Card
      title="Auslastung — nächste 7 Tage"
      icon={Gauge}
      right={peak && peak[1].length > 1 ? (
        <span className="text-xs text-gray-500">
          Spitze: {dayLabel(peak[0].split('|')[0], { weekday: 'short', day: '2-digit', month: '2-digit' })} {String(peak[0].split('|')[1]).padStart(2, '0')}–{String(+peak[0].split('|')[1] + 2).padStart(2, '0')} Uhr · {peak[1].length} Fahrten
        </span>
      ) : undefined}
    >
      <div className="p-4 sm:p-5 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center min-w-[640px]">
          <thead>
            <tr>
              <th className="w-24" />
              {SLOTS.map((h) => <th key={h} className="text-[10px] font-medium text-gray-400">{String(h).padStart(2, '0')}</th>)}
              <th className="text-[10px] font-medium text-gray-500 w-16">Σ / Bus</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const all = perDay(d);
              return (
                <tr key={d}>
                  <td className={cn('text-left text-xs pr-2 whitespace-nowrap', d === today ? 'font-bold text-primary-700' : 'text-gray-600')}>
                    {d === today ? 'Heute' : dayLabel(d, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  {SLOTS.map((h) => {
                    const list = grid.get(`${d}|${h}`) || [];
                    const bus = list.filter((e) => e.bus).length;
                    return (
                      <td
                        key={h}
                        title={list.length ? list.map((e) => `${e.time.slice(11, 16)} ${e.label}${e.bus ? ' (Bus)' : ''}`).join('\n') : undefined}
                        className={cn('h-9 rounded-md text-xs font-semibold tabular-nums relative', tone(list.length, max))}
                      >
                        {list.length || ''}
                        {bus > 0 && <span className="absolute top-0.5 right-1 text-[9px] font-bold opacity-80">B{bus}</span>}
                      </td>
                    );
                  })}
                  <td className="text-xs tabular-nums text-gray-700 font-semibold">{all.length}<span className="text-gray-400 font-normal"> / {all.filter((e) => e.bus).length}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-gray-400">Zahl = Fahrten im 2-Stunden-Fenster · B = davon Van/Bus · Zelle antippen/überfahren zeigt die Fahrten.</p>
      </div>
    </Card>
  );
}
