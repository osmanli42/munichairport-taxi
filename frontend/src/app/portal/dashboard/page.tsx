'use client';

import { useState, useEffect, useCallback } from 'react';
import PortalShell from '@/components/portal/PortalShell';
import { portalApi } from '@/lib/portalApi';
import { TrendingUp, Calendar, Download, XCircle, Navigation, FileText } from 'lucide-react';

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
function fmtTime(d: string) { return d ? new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : ''; }
function fmtPrice(n: number) { return n.toFixed(2).replace('.', ',') + ' €'; }

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Neu', cls: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Bestätigt', cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Abgeschlossen', cls: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Storniert', cls: 'bg-red-100 text-red-700' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [csvFrom, setCsvFrom] = useState('');
  const [csvTo, setCsvTo] = useState('');

  const loadData = useCallback(async () => {
    const [sRes, bRes] = await Promise.all([portalApi.stats(), portalApi.bookings(scope)]);
    if (sRes.ok) setStats(await sRes.json());
    if (bRes.ok) setBookings(await bRes.json());
  }, [scope]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCancel = async (id: number) => {
    if (!confirm('Buchung wirklich stornieren?')) return;
    const res = await portalApi.cancelBooking(id);
    if (res.ok) loadData();
  };

  return (
    <PortalShell>
      <div className="space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Diesen Monat', value: stats.this_month.count, sub: fmtPrice(stats.this_month.total), icon: Calendar },
              { label: 'Letzter Monat', value: stats.last_month.count, sub: fmtPrice(stats.last_month.total), icon: TrendingUp },
            ].map(({ label, value, sub, icon: Icon }, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className="text-primary-500" />
                  <span className="text-xs font-medium text-gray-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Bookings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex gap-2">
              {(['upcoming', 'past'] as const).map(s => (
                <button key={s} onClick={() => setScope(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${scope === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s === 'upcoming' ? 'Anstehend' : 'Vergangene'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={csvFrom} onChange={e => setCsvFrom(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
              <span className="text-gray-400 text-xs">bis</span>
              <input type="date" value={csvTo} onChange={e => setCsvTo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
              <a href={portalApi.csvUrl(csvFrom, csvTo)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500" title="CSV Export">
                <Download size={16} />
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Datum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nr.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Gast</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Route</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">KSt.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Preis</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => {
                  const st = STATUS[b.status] || { label: b.status, cls: 'bg-gray-100 text-gray-600' };
                  const canCancel = scope === 'upcoming' && b.status !== 'cancelled';
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(b.pickup_datetime)} {fmtTime(b.pickup_datetime)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{b.booking_number}</td>
                      <td className="px-4 py-3">{b.name}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-600" title={`${b.pickup_address} → ${b.dropoff_address}`}>
                        {b.pickup_address?.substring(0, 25)} → {b.dropoff_address?.substring(0, 25)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{b.cost_center || ''}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtPrice(Math.ceil(Number(b.price) * 2) / 2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <a href={portalApi.rechnungPdfUrl(b.id)} target="_blank" rel="noreferrer"
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="Rechnung PDF">
                            <FileText size={14} />
                          </a>
                          {canCancel && (
                            <button onClick={() => handleCancel(b.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Stornieren">
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {bookings.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Keine Buchungen gefunden</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
