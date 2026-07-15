'use client';

import { useState, useEffect, useCallback } from 'react';
import PortalShell from '@/components/portal/PortalShell';
import { portalApi } from '@/lib/portalApi';
import { FileText, Download, CheckCircle2, AlertCircle } from 'lucide-react';

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
function fmtPrice(n: number) { return Number(n).toFixed(2).replace('.', ',') + ' €'; }
function fmtPeriod(period_month: string) {
  if (!period_month) return '—';
  const [y, m] = period_month.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const res = await portalApi.invoices();
    if (res.ok) setInvoices(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const isOverdue = (inv: any) => inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date();

  return (
    <PortalShell>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Rechnungen</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nr.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Zeitraum</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Betrag</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fällig bis</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => {
                  const overdue = isOverdue(inv);
                  const paid = inv.status === 'paid';
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3">{fmtPeriod(inv.period_month)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtPrice(inv.total)}</td>
                      <td className="px-4 py-3">
                        {inv.due_date ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            paid ? 'bg-gray-100 text-gray-500' : overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {!paid && overdue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                            {fmtDate(inv.due_date)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {paid ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                            <CheckCircle2 size={12} /> Bezahlt
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                            <AlertCircle size={12} /> Überfällig
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">Offen</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a href={portalApi.invoicePdfUrl(inv.id)} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 rounded-lg text-gray-600 text-xs font-medium">
                          <Download size={14} /> PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {!loading && invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                    Noch keine Sammelrechnungen vorhanden
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
