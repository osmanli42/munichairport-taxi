'use client';

// Statistik tab: switch for counting Google-Calendar-only rides in the revenue, the sync
// state of the calendar mirror, and a per-year overview (bookings + calendar).

import { useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { adminApi, CalendarStats } from '@/lib/api';
import { formatPrice, cn } from '@/lib/utils';

export default function CalendarRevenuePanel({ stats, onChanged }: { stats: CalendarStats; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const years = new Map<string, { bCount: number; bRev: number; cCount: number; cPriced: number; cRev: number }>();
  const row = (y: string) => years.get(y) || years.set(y, { bCount: 0, bRev: 0, cCount: 0, cPriced: 0, cRev: 0 }).get(y)!;
  for (const b of stats.bookingYears) { const r = row(b.year); r.bCount += b.count; r.bRev += b.revenue; }
  for (const m of stats.monthly) { const r = row(m.month.slice(0, 4)); r.cCount += m.count; r.cPriced += m.priced; r.cRev += m.revenue; }
  const list = Array.from(years.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const total = list.reduce((t, [, r]) => ({
    bCount: t.bCount + r.bCount, bRev: t.bRev + r.bRev, cCount: t.cCount + r.cCount, cPriced: t.cPriced + r.cPriced, cRev: t.cRev + r.cRev,
  }), { bCount: 0, bRev: 0, cCount: 0, cPriced: 0, cRev: 0 });
  const on = stats.include;
  const synced = stats.sync.synced_at ? new Date(stats.sync.synced_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  async function toggle() {
    setSaving(true);
    try {
      await adminApi.updateSettings({ stats_include_calendar: on ? '0' : '1' });
      onChanged();
    } catch {
      setMsg('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await adminApi.syncCalendarRides();
      setMsg(`${r.events} Termine gelesen, ${r.rides} reine Kalender-Fahrten`);
      onChanged();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Synchronisierung fehlgeschlagen');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0"><CalendarDays size={18} /></span>
          <div className="min-w-0">
            <div className="font-bold text-gray-900">Google-Kalender-Fahrten im Umsatz</div>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
              Fahrten, die nur im Kalender stehen (Telefon, Get-e, Partner, alles vor der Website), werden nach Fahrtdatum mitgezählt.
              Kalender-Termine von Buchungen (MAT-Nummer oder gleiche Zeit + Adresse) und stornierte (❌/iptal) zählen nicht doppelt.
              Der Preis kommt aus Ort oder Beschreibung des Termins — Termine ohne Preis zählen als Fahrt, aber mit 0 €.
            </p>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {synced ? `Zuletzt synchronisiert ${synced}` : 'Noch nicht synchronisiert'}
              {' · '}{stats.sync.events} Termine: {stats.sync.rides} Kalender-Fahrten · {stats.sync.bookings} Buchungen · {stats.sync.duplicates} Doppelte · {stats.sync.cancelled} storniert
              {stats.sync.last?.error && <span className="text-red-600"> · Fehler: {stats.sync.last.error}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Liest Kalender…' : 'Jetzt synchronisieren'}
          </button>
          <button
            onClick={toggle}
            disabled={saving}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            aria-pressed={on}
          >
            <span className={cn('relative w-11 h-6 rounded-full transition-colors', on ? 'bg-teal-500' : 'bg-gray-300')}>
              <span className={cn('absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </span>
            {on ? 'Einbezogen' : 'Nicht einbezogen'}
          </button>
        </div>
      </div>
      {msg && <div className="px-5 py-2 text-xs text-gray-600 bg-gray-50 border-b border-gray-100">{msg}</div>}

      <div className="p-5">
        <h3 className="font-bold text-gray-900 mb-3">Jahresübersicht</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left font-medium py-2 pr-3">Jahr</th>
                <th className="text-right font-medium py-2 px-3">Buchungen</th>
                <th className="text-right font-medium py-2 px-3 text-teal-700">Kalender</th>
                <th className="text-right font-medium py-2 pl-3">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(([y, r]) => (
                <tr key={y}>
                  <td className="py-2.5 pr-3 font-semibold text-gray-900">{y}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <div className="font-medium">{formatPrice(r.bRev)}</div>
                    <div className="text-[11px] text-gray-400">{r.bCount} Fahrten</div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <div className="font-medium text-teal-700">{formatPrice(r.cRev)}</div>
                    <div className="text-[11px] text-gray-400">{r.cCount} Fahrten{r.cCount > r.cPriced ? ` · ${r.cCount - r.cPriced} ohne Preis` : ''}</div>
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">
                    <div className="font-bold text-gray-900">{formatPrice(r.bRev + (on ? r.cRev : 0))}</div>
                    <div className="text-[11px] text-gray-400">{r.bCount + (on ? r.cCount : 0)} Fahrten</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-2.5 pr-3 font-bold text-gray-900">Gesamt</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{formatPrice(total.bRev)}</td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-teal-700">{formatPrice(total.cRev)}</td>
                <td className="py-2.5 pl-3 text-right font-bold tabular-nums text-gray-900">{formatPrice(total.bRev + (on ? total.cRev : 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!on && <p className="mt-2 text-[11px] text-gray-400">Kalender nicht einbezogen — „Gesamt“ zeigt nur Buchungen.</p>}
      </div>
    </div>
  );
}
