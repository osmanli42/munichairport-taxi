'use client';

// Who drives what today and tomorrow — read from the driver name the operator writes into
// the calendar's "Ort" field. Flags rides that follow too closely for one driver, and rides
// in the next 36 h without a driver (or not in the calendar at all).

import { useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarX, UserX, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, dayLabel, hhmm } from './shared';
import type { DriverPlan as Plan, PlanEntry } from './types';

export default function DriverPlan({ plan, now, onOpen }: { plan: Plan | null; now: string; onOpen: (id: number) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = now.slice(0, 10);
  if (!plan) {
    return (
      <Card title="Fahrer-Einsatzplan" icon={Users}>
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Kalender nicht verbunden</p>
      </Card>
    );
  }
  const open = (e: PlanEntry) => (e.booking_id ? onOpen(e.booking_id) : e.html_link && window.open(e.html_link, '_blank', 'noopener'));
  const when = (t: string) => `${t.slice(0, 10) === today ? '' : `${dayLabel(t.slice(0, 10), { weekday: 'short' })} `}${hhmm(t)}`;
  const list = selected ? plan.entries.filter((e) => e.drivers.includes(selected)) : [];
  const warnings = plan.conflicts.length + plan.unassigned.length;

  return (
    <Card
      title="Fahrer-Einsatzplan"
      icon={Users}
      right={warnings > 0 ? <span className="text-xs font-bold bg-amber-500 text-white rounded-full px-2 py-0.5">{warnings}</span> : undefined}
    >
      <div className="p-5 space-y-4">
        {/* Drivers */}
        <div className="flex flex-wrap gap-2">
          {plan.drivers.length === 0 && <p className="text-sm text-gray-400">Heute und morgen keine Fahrer im Kalender eingetragen.</p>}
          {plan.drivers.map((d) => (
            <button
              key={d.driver}
              onClick={() => setSelected(selected === d.driver ? null : d.driver)}
              className={cn('text-left rounded-xl px-3 py-2 ring-1 ring-inset transition-colors min-w-[8.5rem]',
                selected === d.driver ? 'bg-primary-600 text-white ring-primary-600' : 'bg-gray-50 ring-gray-200 hover:bg-gray-100')}
            >
              <div className="font-semibold text-sm">{d.driver}</div>
              <div className={cn('text-[11px]', selected === d.driver ? 'text-primary-100' : 'text-gray-500')}>
                Heute {d.today} · Morgen {d.tomorrow}
              </div>
              {d.next && (
                <div className={cn('text-[11px] truncate max-w-[10rem]', selected === d.driver ? 'text-white' : 'text-gray-700')}>
                  nächste {when(d.next.time)}
                </div>
              )}
            </button>
          ))}
        </div>

        {selected && (
          <ul className="rounded-xl ring-1 ring-gray-100 divide-y divide-gray-100">
            {list.map((e) => (
              <li key={`${e.time}-${e.title}`}>
                <button onClick={() => open(e)} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                  <span className={cn('font-mono shrink-0', e.time < now ? 'text-gray-400' : 'text-primary-700 font-semibold')}>{when(e.time)}</span>
                  <span className="font-medium text-gray-800 truncate max-w-[10rem]">{e.title}</span>
                  <span className="truncate text-gray-500">{e.from} <ArrowRight size={10} className="inline" /> {e.to}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Conflicts */}
        {plan.conflicts.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600"><AlertTriangle size={14} /> Zeitlich knapp ({plan.conflicts.length})</div>
            <ul className="mt-1.5 space-y-1">
              {plan.conflicts.map((c) => (
                <li key={`${c.driver}-${c.second.time}`} className="text-xs rounded-lg bg-red-50 px-3 py-2">
                  <span className="font-semibold text-gray-900">{c.driver}</span>: {when(c.first.time)} {c.first.title}
                  {' → '}{when(c.second.time)} {c.second.title}
                  <span className="text-red-600"> · nur {c.gap} Min Abstand (≈ {c.need} nötig)</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Without driver */}
        {plan.unassigned.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700"><UserX size={14} /> Ohne Fahrer (nächste 36 Std · {plan.unassigned.length})</div>
            <ul className="mt-1.5 space-y-1">
              {plan.unassigned.map((e) => (
                <li key={`${e.time}-${e.title}`}>
                  <button onClick={() => open(e)} className="w-full text-left text-xs rounded-lg bg-amber-50 hover:bg-amber-100 px-3 py-2 flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-700 shrink-0">{when(e.time)}</span>
                    <span className="font-medium text-gray-900 truncate">{e.title}</span>
                    {e.source === 'booking_only'
                      ? <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-red-600"><CalendarX size={11} /> nicht im Kalender</span>
                      : <span className="ml-auto shrink-0 text-amber-700">kein Fahrer im Termin</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warnings === 0 && plan.drivers.length > 0 && (
          <p className="text-xs text-emerald-600">✓ Alle Fahrten der nächsten 36 Stunden haben einen Fahrer, keine Überschneidungen.</p>
        )}
        <p className="text-[11px] text-gray-400">Fahrer werden aus dem Ort-Feld des Kalenders gelesen („✅ Kk ödendi Saban“). Abstand: Fahrtdauer + 20 Min.</p>
      </div>
    </Card>
  );
}
