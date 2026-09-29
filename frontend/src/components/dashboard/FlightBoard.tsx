'use client';

// Today's and tomorrow's airport pickups with live flight status (AeroDataBox). Only
// flights between an hour ago and 8 h ahead are looked up; the rest show "geplant".

import { ExternalLink, PlaneLanding } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Switch, dayLabel, hhmm } from './shared';
import type { FlightRow, Flights } from './types';

function statusView(f: FlightRow): { label: string; cls: string } {
  const s = f.status;
  if (!f.live) return { label: 'geplant', cls: 'bg-gray-100 text-gray-500' };
  if (!s) return { label: 'keine Daten', cls: 'bg-gray-100 text-gray-500' };
  const st = (s.status || '').toLowerCase();
  if (st.includes('cancel')) return { label: 'Annulliert', cls: 'bg-red-100 text-red-700' };
  if (st.includes('divert')) return { label: 'Umgeleitet', cls: 'bg-red-100 text-red-700' };
  if (s.actual || st.includes('arrived') || st.includes('landed')) return { label: `Gelandet ${s.actual || ''}`.trim(), cls: 'bg-emerald-100 text-emerald-700' };
  const d = s.delay_minutes ?? 0;
  if (d >= 15) return { label: `+${d} Min`, cls: d >= 45 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700' };
  if (d <= -10) return { label: `${d} Min früher`, cls: 'bg-sky-100 text-sky-700' };
  if (st.includes('enroute') || st.includes('departed')) return { label: 'in der Luft', cls: 'bg-sky-50 text-sky-700' };
  return { label: 'pünktlich', cls: 'bg-emerald-50 text-emerald-700' };
}

export default function FlightBoard({ data, today, onOpen, onToggle }: {
  data: Flights | null; today: string; onOpen: (id: number) => void; onToggle: (on: boolean) => void;
}) {
  const rows = data?.flights || [];
  const problems = rows.filter((f) => {
    const st = (f.status?.status || '').toLowerCase();
    return f.live && (st.includes('cancel') || st.includes('divert') || (f.status?.delay_minutes ?? 0) >= 45);
  }).length;
  return (
    <Card
      title="Flugstatus"
      icon={PlaneLanding}
      right={(
        <div className="flex items-center gap-2">
          {problems > 0 && <span className="text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{problems}</span>}
          {data && <Switch on={data.enabled} onChange={() => onToggle(!data.enabled)} label="Live" />}
        </div>
      )}
    >
      {!data ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Lädt…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Heute und morgen keine Abholungen mit Flugnummer</p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {rows.map((f) => {
            const v = statusView(f);
            const s = f.status;
            const click = () => (f.booking_id ? onOpen(f.booking_id) : f.html_link && window.open(f.html_link, '_blank', 'noopener'));
            return (
              <li key={`${f.flight}-${f.time}`}>
                <button onClick={click} className="w-full text-left px-5 py-2.5 hover:bg-gray-50 flex items-center gap-3">
                  <div className="w-12 shrink-0">
                    <div className="font-bold tabular-nums text-primary-700">{hhmm(f.time)}</div>
                    {f.time.slice(0, 10) !== today && <div className="text-[10px] text-gray-400">{dayLabel(f.time.slice(0, 10), { weekday: 'short' })}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{f.flight}</span>
                      {s?.origin && <span className="truncate text-xs text-gray-400">aus {s.origin}</span>}
                      {f.source === 'calendar' && <ExternalLink size={11} className="shrink-0 text-teal-600" />}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {f.name || '—'}
                      {s?.terminal && <> · T{s.terminal}</>}
                      {s?.scheduled && <> · Plan {s.scheduled}{s.expected && s.expected !== s.scheduled && !s.actual ? ` → ${s.expected}` : ''}</>}
                    </div>
                  </div>
                  <span className={cn('shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', v.cls)}>{v.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {data && (
        <footer className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          {data.enabled
            ? `Live-Abfrage ab 1 Std vorher bis 8 Std voraus · heute ${data.budget.used}/${data.budget.cap} Abfragen`
            : 'Live-Abfrage aus — keine API-Kosten'}
        </footer>
      )}
    </Card>
  );
}
