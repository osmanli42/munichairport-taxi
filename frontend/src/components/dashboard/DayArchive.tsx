'use client';

// Tagesarchiv: pick any date and see what that day brought in — web/system bookings plus the
// rides that only exist in the Google Calendar (GET /api/admin/dashboard/day).
//   Nach Buchungsdatum = taken that day (booking date / entered in the calendar)
//   Nach Fahrtdatum    = driven that day (pickup date)
// 7/14/30 Tage or any Zeitraum (von–bis): same totals for the period, plus a bar per day,
// Ø pro Tag / Fahrt, best day and the change against the previous period of the same length.

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { Card, berlinNowWall, addDays, dayLabel } from './shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

type WebItem = {
  id: number; booking_number: string; name: string; from: string | null; to: string | null; pickup: string;
  trip_type: string | null; price: number; payment_method: string | null; company: string | null; day?: string;
};
type CalItem = { ride_time: string; entered: string; summary: string; from: string | null; to: string | null; price: number | null };
type Agg = { count: number; revenue: number };
type DayData = {
  date: string; from: string; to: string; mode: 'booked' | 'driven'; calendar_enabled: boolean;
  web: { count: number; revenue: number; items: WebItem[] };
  calendar: { count: number; revenue: number; unpriced: number; items: CalItem[] };
  total: Agg;
  days?: { date: string; web: Agg; calendar: Agg }[];
  prev?: { from: string; to: string; total: Agg };
};
type Preset = 'day' | 7 | 14 | 30 | 'custom';

const PAY: Record<string, [string, string]> = {
  cash: ['Bar', 'bg-emerald-50 text-emerald-700'], card: ['Karte', 'bg-blue-50 text-blue-700'],
  ueberweisung: ['Überweisung', 'bg-amber-50 text-amber-700'], transfer: ['Überweisung', 'bg-amber-50 text-amber-700'],
  rechnung: ['Rechnung', 'bg-violet-50 text-violet-700'], invoice: ['Rechnung', 'bg-violet-50 text-violet-700'],
};
const short = (a?: string | null) => String(a || '').split(',')[0].trim();
const dmy = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

const spanDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
const dmyFull = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

function Tile({ label, count, revenue, hint, strong }: { label: string; count: number; revenue: number; hint?: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1', strong ? 'bg-primary-900 text-white ring-primary-900' : 'bg-gray-50 ring-gray-100')}>
      <div className={cn('text-xs font-medium', strong ? 'text-white/70' : 'text-gray-500')}>{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{formatPrice(revenue)}</div>
      <div className={cn('text-xs', strong ? 'text-white/70' : 'text-gray-500')}>
        {count} Fahrt{count === 1 ? '' : 'en'}{hint ? <> · {hint}</> : null}
      </div>
    </div>
  );
}

export function useDayArchive() {
  const today = berlinNowWall().slice(0, 10);
  const [date, setDate] = useState(addDays(today, -1));
  // Period: from–to (inclusive); 'day' = single day from `date`
  const [preset, setPreset] = useState<Preset>('day');
  const [range, setRange] = useState({ from: addDays(today, -6), to: today });
  const [mode, setMode] = useState<'booked' | 'driven'>('booked');
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDay = preset === 'day';
  const from = isDay ? date : range.from;
  const to = isDay ? date : range.to;

  const load = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return;
    setLoading(true); setError('');
    try {
      let token = '';
      try { token = localStorage.getItem('admin_token') || ''; } catch { /* ignore */ }
      const q = from === to ? `date=${from}` : `from=${from}&to=${to}`;
      const r = await fetch(`${API_URL}/admin/dashboard/day?${q}&mode=${mode}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch (e: any) {
      setError(e?.message === '401' ? 'Sitzung abgelaufen' : 'Konnte nicht geladen werden');
    } finally { setLoading(false); }
  }, [from, to, mode]);
  useEffect(() => { load(); }, [load]);

  // Arrows move the day — or the whole period by its length
  const shift = (dir: -1 | 1) => {
    if (isDay) { setDate(addDays(date, dir)); return; }
    const n = spanDays(range.from, range.to);
    setRange({ from: addDays(range.from, dir * n), to: addDays(range.to, dir * n) });
    if (preset !== 'custom') setPreset('custom');
  };
  const atEnd = to >= today;
  return { today, date, setDate, preset, setPreset, range, setRange, mode, setMode, data, loading, error, isDay, from, to, shift, atEnd };
}

export type DayArchiveState = ReturnType<typeof useDayArchive>;

/** Datumsleiste: Tag/Zeitraum wählen (im Dashboard-Kopf) */
export function ArchiveControls({ a }: { a: DayArchiveState }) {
  const { today, date, setDate, preset, setPreset, range, setRange, isDay, shift, atEnd } = a;
  const pill = (active: boolean) => cn('h-10 px-3 text-[13px] font-medium rounded-xl ring-1 ring-inset transition-colors whitespace-nowrap', active ? 'bg-primary-800 text-white ring-primary-800' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50');
  const quick = (label: string, d: string) => (
    <button key={label} onClick={() => { setPreset('day'); setDate(d); }} className={pill(isDay && date === d)}>{label}</button>
  );
  const period = (n: 7 | 14 | 30) => (
    <button key={n} onClick={() => { setPreset(n); setRange({ from: addDays(today, -(n - 1)), to: today }); }} className={pill(preset === n)}>{n} Tage</button>
  );
  const dateCls = 'h-10 rounded-xl bg-white px-2.5 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-200 outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap" aria-label="Tagesarchiv: Tag oder Zeitraum">
      <div className="flex items-center gap-1.5">
        <button onClick={() => shift(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-inset ring-gray-200 hover:bg-gray-50" aria-label={isDay ? 'Vortag' : 'Vorheriger Zeitraum'}><ChevronLeft size={18} /></button>
        {isDay ? (
          <input type="date" value={date} max={today} aria-label="Tag" onChange={(e) => e.target.value && setDate(e.target.value)} className={dateCls} />
        ) : (
          <>
            <input type="date" value={range.from} max={range.to} aria-label="von" className={dateCls}
              onChange={(e) => { const v = e.target.value; if (v) { setPreset('custom'); setRange((r) => ({ from: v, to: v > r.to ? v : r.to })); } }} />
            <span className="text-sm text-gray-400">–</span>
            <input type="date" value={range.to} min={range.from} max={today} aria-label="bis" className={dateCls}
              onChange={(e) => { const v = e.target.value; if (v) { setPreset('custom'); setRange((r) => ({ from: v < r.from ? v : r.from, to: v })); } }} />
          </>
        )}
        <button onClick={() => !atEnd && shift(1)} disabled={atEnd} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-inset ring-gray-200 hover:bg-gray-50 disabled:opacity-40" aria-label={isDay ? 'Folgetag' : 'Nächster Zeitraum'}><ChevronRight size={18} /></button>
      </div>
      <div className="flex flex-wrap gap-1 xl:flex-nowrap">
        {quick('Heute', today)}{quick('Gestern', addDays(today, -1))}
        {period(7)}{period(14)}{period(30)}
        <button onClick={() => { if (isDay) setRange({ from: addDays(date, -6), to: date }); setPreset('custom'); }} className={pill(preset === 'custom')}>Zeitraum…</button>
      </div>
    </div>
  );
}

/** Ergebnis des gewählten Tags/Zeitraums (Web / Kalender / Gesamt, Einzelfahrten) */
export function ArchiveResults({ a, withControls }: { a: DayArchiveState; withControls?: boolean }) {
  const { mode, setMode, data, loading, error, setPreset, setDate } = a;
  const seg = (m: 'booked' | 'driven', label: string, title: string) => (
    <button
      onClick={() => setMode(m)} title={title}
      className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition', mode === m ? 'bg-primary-900 text-white' : 'text-gray-600 hover:bg-gray-100')}
    >{label}</button>
  );
  return (
    <Card
      title="Tagesarchiv"
      icon={CalendarDays}
      right={(
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {seg('booked', 'Nach Buchungsdatum', 'Alındığı güne göre: o gün gelen rezervasyonlar ve o gün takvime eklenenler')}
          {seg('driven', 'Nach Fahrtdatum', 'Yapıldığı güne göre: o gün yapılan fahrt’lar (Hin- und Rückfahrt: ganzer Betrag am Hinfahrt-Tag)')}
        </div>
      )}
    >
      <div className="px-5 py-4 space-y-4">
        {withControls && <ArchiveControls a={a} />}

        {error && <div className="text-sm text-red-600">{error}</div>}
        {data && (
          <div className={cn(loading && 'opacity-60 transition-opacity')}>
            <div className="text-xs text-gray-500 mb-2">
              {data.days
                ? <>{dmyFull(data.from)} – {dmyFull(data.to)} · {data.days.length} Tage</>
                : dayLabel(data.date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}{data.mode === 'booked'
                ? (data.days ? 'in diesem Zeitraum eingegangene Fahrten (Buchungsdatum)' : 'an diesem Tag eingegangene Fahrten (Buchungsdatum)')
                : (data.days ? 'in diesem Zeitraum gefahrene Fahrten (Fahrtdatum)' : 'an diesem Tag gefahrene Fahrten (Fahrtdatum)')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Tile label="Web / System" count={data.web.count} revenue={data.web.revenue} />
              <Tile label="Kalender" count={data.calendar.count} revenue={data.calendar.revenue}
                hint={data.calendar.unpriced ? `${data.calendar.unpriced} ohne Preis` : undefined} />
              <Tile label="Gesamt" count={data.total.count} revenue={data.total.revenue} strong
                hint={data.prev ? <PrevChange cur={data.total.revenue} prev={data.prev.total.revenue} /> : undefined} />
            </div>
            {data.days && <PeriodStats data={data} onDay={(d) => { setPreset('day'); setDate(d); }} />}
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
                          <div className="text-[11px] text-gray-400">{data.days && data.mode === 'booked' && b.day ? `Gebucht ${dmy(b.day)} · ` : ''}Fahrt {dmy(b.pickup)} {b.pickup.slice(11, 16)}{b.trip_type === 'roundtrip' ? ' · Hin & Rück' : ''} · {b.booking_number}</div>
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
                        <div className="text-[11px] text-gray-400">Fahrt {dmy(c.ride_time)} {c.ride_time.slice(11, 16)}{data.mode === 'booked' ? ` · eingetragen ${data.days ? `${dmy(c.entered)} ` : ''}${c.entered.slice(11, 16)}` : ''}</div>
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

export default function DayArchive() {
  const a = useDayArchive();
  return <ArchiveResults a={a} withControls />;
}

// "+12 % ggü. Vorzeitraum" in the Gesamt tile
function PrevChange({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <>Vorzeitraum: {formatPrice(0)}</>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return (
    <span title={`Vorzeitraum: ${formatPrice(prev)}`}>
      <span className={cn('font-semibold', pct >= 0 ? 'text-emerald-300' : 'text-red-300')}>{pct >= 0 ? '+' : ''}{pct} %</span> ggü. Vorzeitraum ({formatPrice(prev)})
    </span>
  );
}

// Period: Ø per day / ride, best day and one bar per day (web dark, calendar teal). A bar opens that day.
function PeriodStats({ data, onDay }: { data: DayData; onDay: (d: string) => void }) {
  const days = data.days || [];
  const totalOf = (d: { web: Agg; calendar: Agg }) => d.web.revenue + d.calendar.revenue;
  const max = Math.max(1, ...days.map(totalOf));
  const best = days.reduce((b, d) => (totalOf(d) > totalOf(b) ? d : b), days[0]);
  const active = days.filter((d) => d.web.count + d.calendar.count > 0).length;
  const priced = data.web.count + (data.calendar.count - data.calendar.unpriced);
  const n = Math.max(1, days.length);
  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl ring-1 ring-gray-100 px-3 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-bold tabular-nums text-gray-900">{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
  // Axis labels: every day up to 14 days, every 2nd up to 31, else every 7th
  const step = days.length <= 14 ? 1 : days.length <= 31 ? 2 : 7;
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stat('Ø pro Tag', formatPrice(data.total.revenue / n), `${(data.total.count / n).toFixed(1).replace('.', ',')} Fahrten/Tag`)}
        {stat('Ø pro Fahrt', formatPrice(priced ? data.total.revenue / priced : 0), data.calendar.unpriced ? 'ohne Fahrten ohne Preis' : undefined)}
        {stat('Bester Tag', best && totalOf(best) > 0 ? formatPrice(totalOf(best)) : '—', best && totalOf(best) > 0 ? dayLabel(best.date, { weekday: 'short', day: '2-digit', month: '2-digit' }) : undefined)}
        {stat('Tage mit Fahrten', `${active} von ${days.length}`)}
      </div>
      <div>
        <div className="flex items-end gap-[2px] h-28">
          {days.map((d) => {
            const t = totalOf(d);
            const h = (v: number) => `${(v / max) * 100}%`;
            return (
              <button
                key={d.date} onClick={() => onDay(d.date)}
                title={`${dayLabel(d.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${formatPrice(t)} · ${d.web.count + d.calendar.count} Fahrten${d.calendar.count ? ` (Kalender ${formatPrice(d.calendar.revenue)})` : ''}`}
                className="group flex-1 min-w-0 h-full flex flex-col justify-end rounded-sm hover:bg-gray-50"
              >
                <div className="w-full bg-teal-500/80 rounded-t-sm group-hover:bg-teal-500" style={{ height: h(d.calendar.revenue) }} />
                <div className={cn('w-full bg-primary-800 group-hover:bg-primary-900', !d.calendar.revenue && 'rounded-t-sm')} style={{ height: h(d.web.revenue) }} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-[2px] mt-1">
          {days.map((d, i) => (
            <div key={d.date} className="flex-1 min-w-0 text-center text-[10px] text-gray-400 tabular-nums overflow-visible whitespace-nowrap">
              {i % step === 0 ? (step === 7 ? dmy(d.date) : d.date.slice(8, 10)) : ''}
            </div>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary-800" />Web / System</span>
          {data.calendar_enabled && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-teal-500/80" />Kalender</span>}
          <span className="ml-auto">Balken antippen → Tag öffnen</span>
        </div>
      </div>
    </div>
  );
}
