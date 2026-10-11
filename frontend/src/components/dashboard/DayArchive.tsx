'use client';

// Tagesarchiv: pick any date and see what that day brought in — web/system bookings plus the
// rides that only exist in the Google Calendar (GET /api/admin/dashboard/day).
//   Nach Buchungsdatum = taken that day (booking date / entered in the calendar)
//   Nach Fahrtdatum    = driven that day (pickup date)

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { Card, berlinNowWall, addDays, dayLabel } from './shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

type WebItem = {
  id: number; booking_number: string; name: string; from: string | null; to: string | null; pickup: string;
  trip_type: string | null; price: number; payment_method: string | null; company: string | null;
};
type CalItem = { ride_time: string; entered: string; summary: string; from: string | null; to: string | null; price: number | null };
type DayData = {
  date: string; mode: 'booked' | 'driven'; calendar_enabled: boolean;
  web: { count: number; revenue: number; items: WebItem[] };
  calendar: { count: number; revenue: number; unpriced: number; items: CalItem[] };
  total: { count: number; revenue: number };
};

const PAY: Record<string, [string, string]> = {
  cash: ['Bar', 'bg-emerald-50 text-emerald-700'], card: ['Karte', 'bg-blue-50 text-blue-700'],
  ueberweisung: ['Überweisung', 'bg-amber-50 text-amber-700'], transfer: ['Überweisung', 'bg-amber-50 text-amber-700'],
  rechnung: ['Rechnung', 'bg-violet-50 text-violet-700'], invoice: ['Rechnung', 'bg-violet-50 text-violet-700'],
};
const short = (a?: string | null) => String(a || '').split(',')[0].trim();
const dmy = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

function Tile({ label, count, revenue, hint, strong }: { label: string; count: number; revenue: number; hint?: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1', strong ? 'bg-primary-900 text-white ring-primary-900' : 'bg-gray-50 ring-gray-100')}>
      <div className={cn('text-xs font-medium', strong ? 'text-white/70' : 'text-gray-500')}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{formatPrice(revenue)}</div>
      <div className={cn('text-xs', strong ? 'text-white/70' : 'text-gray-500')}>
        {count} Fahrt{count === 1 ? '' : 'en'}{hint ? ` · ${hint}` : ''}
      </div>
    </div>
  );
}

export default function DayArchive() {
  const today = berlinNowWall().slice(0, 10);
  const [date, setDate] = useState(addDays(today, -1));
  const [mode, setMode] = useState<'booked' | 'driven'>('booked');
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setLoading(true); setError('');
    try {
      let token = '';
      try { token = localStorage.getItem('admin_token') || ''; } catch { /* ignore */ }
      const r = await fetch(`${API_URL}/admin/dashboard/day?date=${date}&mode=${mode}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch (e: any) {
      setError(e?.message === '401' ? 'Sitzung abgelaufen' : 'Konnte nicht geladen werden');
    } finally { setLoading(false); }
  }, [date, mode]);
  useEffect(() => { load(); }, [load]);

  const seg = (m: 'booked' | 'driven', label: string, title: string) => (
    <button
      onClick={() => setMode(m)} title={title}
      className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition', mode === m ? 'bg-primary-900 text-white' : 'text-gray-600 hover:bg-gray-100')}
    >{label}</button>
  );
  const quick = (label: string, d: string) => (
    <button key={label} onClick={() => setDate(d)} className={cn('px-2.5 py-1 text-xs rounded-lg ring-1', date === d ? 'bg-gray-900 text-white ring-gray-900' : 'text-gray-600 ring-gray-200 hover:bg-gray-50')}>{label}</button>
  );

  return (
    <Card title="Tagesarchiv" icon={CalendarDays} right={<span className="text-xs text-gray-400">Web + Kalender, beliebiger Tag</span>}>
      <div className="px-5 py-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setDate(addDays(date, -1))} className="p-1.5 rounded-lg ring-1 ring-gray-200 hover:bg-gray-50" aria-label="Vortag"><ChevronLeft size={16} /></button>
          <input
            type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button onClick={() => date < today && setDate(addDays(date, 1))} disabled={date >= today} className="p-1.5 rounded-lg ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-40" aria-label="Folgetag"><ChevronRight size={16} /></button>
          <div className="flex gap-1.5 ml-1">{quick('Heute', today)}{quick('Gestern', addDays(today, -1))}</div>
          <div className="ml-auto flex gap-1 rounded-xl bg-gray-100 p-1">
            {seg('booked', 'Nach Buchungsdatum', 'Alındığı güne göre: o gün gelen rezervasyonlar ve o gün takvime eklenenler')}
            {seg('driven', 'Nach Fahrtdatum', 'Yapıldığı güne göre: o gün yapılan fahrt’lar (Hin- und Rückfahrt: ganzer Betrag am Hinfahrt-Tag)')}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {data && (
          <div className={cn(loading && 'opacity-60 transition-opacity')}>
            <div className="text-xs text-gray-500 mb-2">
              {dayLabel(data.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}{data.mode === 'booked' ? 'an diesem Tag eingegangene Fahrten (Buchungsdatum)' : 'an diesem Tag gefahrene Fahrten (Fahrtdatum)'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Tile label="Web / System" count={data.web.count} revenue={data.web.revenue} />
              <Tile label="Kalender" count={data.calendar.count} revenue={data.calendar.revenue}
                hint={data.calendar.unpriced ? `${data.calendar.unpriced} ohne Preis` : undefined} />
              <Tile label="Gesamt" count={data.total.count} revenue={data.total.revenue} strong />
            </div>
            {!data.calendar_enabled && <p className="mt-2 text-xs text-amber-600">Kalender-Fahrten sind in den Statistiken ausgeschaltet und daher nicht enthalten.</p>}

            {(data.web.items.length > 0 || data.calendar.items.length > 0) && (
              <details className="mt-4 group">
                <summary className="cursor-pointer select-none text-sm font-semibold text-primary-700 list-none [&::-webkit-details-marker]:hidden">
                  Einzelne Fahrten anzeigen ({data.total.count}) <span className="inline-block transition-transform group-open:rotate-90">›</span>
                </summary>
                <ul className="mt-2 divide-y divide-gray-100 text-sm">
                  {data.web.items.map((b) => {
                    const p = PAY[b.payment_method || 'cash'] || [b.payment_method || '—', 'bg-gray-50 text-gray-600'];
                    return (
                      <li key={`w${b.id}`} className="py-2 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">{b.name}{b.company ? <span className="text-gray-400 font-normal"> · {b.company}</span> : null}</div>
                          <div className="text-xs text-gray-600 truncate">{short(b.from)} → {short(b.to)}</div>
                          <div className="text-[11px] text-gray-400">Fahrt {dmy(b.pickup)} {b.pickup.slice(11, 16)}{b.trip_type === 'roundtrip' ? ' · Hin & Rück' : ''} · {b.booking_number}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold tabular-nums">{formatPrice(b.price)}</div>
                          <span className={cn('inline-block mt-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full', p[1])}>{p[0]}</span>
                        </div>
                      </li>
                    );
                  })}
                  {data.calendar.items.map((c, i) => (
                    <li key={`c${i}`} className="py-2 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate"><span className="text-teal-700">Kalender</span> · {c.summary || 'Fahrt'}</div>
                        <div className="text-xs text-gray-600 truncate">{short(c.from) || '?'} → {short(c.to) || '?'}</div>
                        <div className="text-[11px] text-gray-400">Fahrt {dmy(c.ride_time)} {c.ride_time.slice(11, 16)}{data.mode === 'booked' ? ` · eingetragen ${c.entered.slice(11, 16)}` : ''}</div>
                      </div>
                      <div className="text-right shrink-0 font-semibold tabular-nums">
                        {c.price == null ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">ohne Preis</span> : formatPrice(c.price)}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
