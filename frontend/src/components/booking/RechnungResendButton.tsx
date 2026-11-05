'use client';

// Booking modal: mail the issued invoice again, unchanged (same number and date, no Storno).
// A correction is not a resend: that stays with "Rechnung senden", which cancels and re-issues.

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function RechnungResendButton({ booking, rechnungNumber, onResult }: {
  booking: { id: number; email?: string | null };
  rechnungNumber: string;
  onResult: (m: { ok: boolean; text: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await adminApi.resendRechnung(booking.id, email.trim());
      onResult({ ok: true, text: `Rechnung ${r.rechnungsnummer} erneut an ${r.sent_to} gesendet.` });
    } catch (e: any) {
      onResult({ ok: false, text: e?.response?.data?.error || 'Senden fehlgeschlagen' });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { onResult(null); setEmail(booking.email || ''); setOpen(true); }}
        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-sm font-medium transition-colors"
      >
        <Send size={15} /> Rechnung erneut senden ({rechnungNumber})
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => { if (!busy) setOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Send size={18} className="text-emerald-600" />
                <div>
                  <h3 className="font-bold text-gray-900">Rechnung erneut senden</h3>
                  <p className="text-xs text-gray-500">{rechnungNumber}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} disabled={busy} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Schließen"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                Die Rechnung wird <b>unverändert</b> noch einmal per E-Mail gesendet: gleiche Nummer, gleiches Datum, keine Stornorechnung.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Empfänger</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rechnung@firma.de"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Abbrechen</button>
              <button
                onClick={submit}
                disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Wird gesendet…' : 'Erneut senden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
