'use client';

// Rechnung tab: register of all Stornorechnungen (single rides and Sammelrechnungen).

import { useEffect, useState } from 'react';
import { FileX, RefreshCw } from 'lucide-react';
import { adminApi, StornoInfo } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const eur = (v: number | string) => `${(-Number(v)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export default function StornoRegister() {
  const [rows, setRows] = useState<StornoInfo[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try { setRows(await adminApi.getStornos()); }
    catch { setError('Liste konnte nicht geladen werden.'); }
  }
  useEffect(() => { load(); }, []);

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
            <FileX size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Stornorechnungen</h3>
            <p className="text-xs text-gray-500">Gesendete Rechnungen werden nie gelöscht – sie werden mit einer Stornorechnung (ST-…) aufgehoben.</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600" title="Aktualisieren"><RefreshCw size={16} /></button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {rows && rows.length === 0 && <div className="text-sm text-gray-500">Noch keine Stornorechnungen.</div>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-3">Storno-Nr.</th>
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Zur Rechnung</th>
                <th className="py-2 pr-3">Kunde</th>
                <th className="py-2 pr-3">Grund</th>
                <th className="py-2 pr-3 text-right">Betrag</th>
                <th className="py-2 pr-3">E-Mail</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3 font-mono font-semibold text-red-700 whitespace-nowrap">{r.storno_number}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">{r.original_number}</td>
                  <td className="py-2 pr-3">{r.company_name || r.booking_name || '—'}{r.booking_number ? <span className="block text-xs text-gray-400">{r.booking_number}</span> : null}</td>
                  <td className="py-2 pr-3 text-gray-600 max-w-xs">{r.reason || '—'}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-red-700 whitespace-nowrap">{eur(r.amount)}</td>
                  <td className="py-2 pr-3 text-xs whitespace-nowrap">
                    {r.sent_at ? <span className="text-green-700">gesendet</span> : r.send_error ? <span className="text-red-600" title={r.send_error}>Fehler</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <a href={`${API}/admin/stornos/${r.id}/pdf?token=${token}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-600 hover:underline">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
