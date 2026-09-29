'use client';

// Month forecast, today's sales funnel and open receivables.

import { Filter, Landmark, LineChart, TrendingDown, TrendingUp } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { Card, MONTHS } from './shared';
import type { Forecast, Funnel, Receivables } from './types';

function Pct({ cur, prev, label }: { cur: number; prev: number; label: string }) {
  if (!prev) return null;
  const p = Math.round(((cur - prev) / prev) * 100);
  const up = p >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span className="whitespace-nowrap">{up ? '+' : ''}{p} %</span>
      <span className="font-normal text-gray-400">{label}</span>
    </span>
  );
}

export function ForecastCard({ f }: { f: Forecast | null }) {
  if (!f) return <Card title="Monatsprognose" icon={LineChart}><p className="px-5 py-6 text-sm text-gray-400">Keine Daten</p></Card>;
  const name = MONTHS[+f.month.slice(5, 7) - 1];
  const realizedPct = f.forecast ? Math.min(100, (f.realized / f.forecast) * 100) : 0;
  const scheduledPct = f.forecast ? Math.min(100 - realizedPct, (f.scheduled / f.forecast) * 100) : 0;
  return (
    <Card title={`Prognose ${name}`} icon={LineChart}>
      <div className="p-5">
        <div className="text-3xl font-bold text-gray-900 tabular-nums">≈ {formatPrice(Math.round(f.forecast))}</div>
        <div className="mt-1 flex flex-col gap-0.5">
          <Pct cur={f.forecast} prev={f.prev_month} label={`vs. ${MONTHS[(+f.month.slice(5, 7) + 10) % 12]} (${formatPrice(Math.round(f.prev_month))})`} />
          {f.last_year > 0 && <Pct cur={f.forecast} prev={f.last_year} label={`vs. ${name} ${+f.month.slice(0, 4) - 1}`} />}
        </div>
        <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
          <div className="bg-primary-600" style={{ width: `${realizedPct}%` }} />
          <div className="bg-primary-300" style={{ width: `${scheduledPct}%` }} />
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="flex items-center gap-2 text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-primary-600" />Gefahren</dt><dd className="font-semibold tabular-nums">{formatPrice(Math.round(f.realized))}</dd></div>
          <div className="flex justify-between"><dt className="flex items-center gap-2 text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-primary-300" />Schon gebucht</dt><dd className="font-semibold tabular-nums">{formatPrice(Math.round(f.scheduled))}</dd></div>
          <div className="flex justify-between"><dt className="flex items-center gap-2 text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-gray-200" />Tempo (Ø 28 Tage)</dt><dd className="tabular-nums text-gray-700">{formatPrice(Math.round(f.per_day))} / Tag</dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-gray-400">
          Nach Fahrtdatum{f.include_calendar ? ', inkl. Kalender-Fahrten' : ''}. Rest des Monats ({f.remaining_days.toFixed(1)} Tage):
          das Größere aus schon Gebuchtem und Tempo × Tage.
        </p>
      </div>
    </Card>
  );
}

export function FunnelCard({ f }: { f: Funnel | null }) {
  if (!f) return <Card title="Heute auf der Website" icon={Filter}><p className="px-5 py-6 text-sm text-gray-400">Keine Daten</p></Card>;
  const t = f.today;
  const steps: Array<{ label: string; n: number; y: number }> = [
    { label: 'Besucher', n: t.visitors, y: f.yesterday.visitors },
    { label: 'Preise angesehen', n: t.prices, y: f.yesterday.prices },
    { label: 'Buchungsformular', n: t.form, y: f.yesterday.form },
    { label: 'Gebucht', n: t.bookings, y: f.yesterday.bookings },
  ];
  const max = Math.max(1, t.visitors);
  const conv = t.visitors ? (t.bookings / t.visitors) * 100 : 0;
  return (
    <Card title="Heute auf der Website" icon={Filter} right={<span className="text-xs text-gray-500">Conversion {conv.toFixed(1)} %</span>}>
      <div className="p-5 space-y-2.5">
        {steps.map((s, i) => (
          <div key={s.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-semibold text-gray-900">{s.n}</span>
                <span className="text-gray-400"> · gestern bis jetzt {s.y}</span>
                {i > 0 && steps[i - 1].n > 0 && <span className="text-gray-400"> · {Math.round((s.n / steps[i - 1].n) * 100)} %</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={cn('h-full rounded-full', i === 3 ? 'bg-emerald-500' : 'bg-primary-400')} style={{ width: `${(s.n / max) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Über Google Ads: <b className="text-gray-800">{t.ads}</b> Besucher</span>
          {t.revenue > 0 && <span>Buchungsumsatz: <b className="text-gray-800">{formatPrice(t.revenue)}</b></span>}
          {f.ads_spend_today != null && (
            <span>
              Ads-Kosten: <b className="text-gray-800">{formatPrice(f.ads_spend_today)}</b>
              {t.bookings > 0 && <> · {formatPrice(f.ads_spend_today / t.bookings)} pro Buchung</>}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ReceivablesCard({ r, onGoTab }: { r: Receivables | null; onGoTab: (tab: string) => void }) {
  if (!r) return <Card title="Offene Forderungen" icon={Landmark}><p className="px-5 py-6 text-sm text-gray-400">Keine Daten</p></Card>;
  const total = r.invoices_total + r.transfers.total + r.calendar_open.total;
  return (
    <Card title="Offene Forderungen" icon={Landmark}>
      <div className="p-5">
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{formatPrice(total)}</div>
        {r.overdue_total > 0 && <div className="text-xs font-semibold text-red-600 mt-0.5">davon überfällig {formatPrice(r.overdue_total)}</div>}
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <button onClick={() => onGoTab('b2b')} className="w-full flex justify-between hover:text-primary-700">
              <span className="text-gray-600">Sammelrechnungen offen ({r.invoices.length})</span>
              <span className="font-semibold tabular-nums">{formatPrice(r.invoices_total)}</span>
            </button>
            {r.invoices.length > 0 && (
              <ul className="mt-1 ml-2 space-y-0.5">
                {r.invoices.slice(0, 5).map((i) => (
                  <li key={i.id} className="flex justify-between text-xs">
                    <span className={cn('truncate', i.overdue ? 'text-red-600' : 'text-gray-500')}>
                      {i.company_name || '—'} · {i.invoice_number}{i.due_date ? ` · fällig ${i.due_date.split('-').reverse().join('.')}` : ''}{i.reminder_level ? ` · ${i.reminder_level}. Mahnung` : ''}
                    </span>
                    <span className="tabular-nums text-gray-700 ml-2">{formatPrice(i.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li>
            <button onClick={() => onGoTab('bookings')} className="w-full flex justify-between hover:text-primary-700">
              <span className="text-gray-600">Überweisung nach Fahrt offen ({r.transfers.count})</span>
              <span className="font-semibold tabular-nums">{formatPrice(r.transfers.total)}</span>
            </button>
          </li>
          <li>
            <button onClick={() => onGoTab('kalender')} className="w-full flex justify-between hover:text-primary-700">
              <span className="text-gray-600">Kalender: Rechnung noch nicht erstellt ({r.calendar_open.count})</span>
              <span className="font-semibold tabular-nums">{r.calendar_open.total ? formatPrice(r.calendar_open.total) : '—'}</span>
            </button>
          </li>
        </ul>
      </div>
    </Card>
  );
}
