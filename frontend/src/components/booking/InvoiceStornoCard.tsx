'use client';

// Booking modal: Stornorechnungen for this booking's invoices + "Rechnung stornieren".

import { useCallback, useEffect, useState } from 'react';
import { FileX, Send, AlertTriangle } from 'lucide-react';
import { adminApi, StornoInfo } from '@/lib/api';
import StornoDialog from './StornoDialog';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const eur = (v: number | string) => `${(-Number(v)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('de-DE') : '');

export default function InvoiceStornoCard({ booking, onChanged }: {
  booking: { id: number; rechnung_number?: string | null; email?: string | null; price?: number | string };
  onChanged?: () => void;
}) {
  const [stornos, setStornos] = useState<StornoInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setStornos(await adminApi.getBookingStornos(booking.id)); } catch { /* ignore */ }
  }, [booking.id]);
  useEffect(() => { load(); }, [load, booking.rechnung_number]);

  const current = booking.rechnung_number ? stornos.find((s) => s.original_number === booking.rechnung_number) : undefined;
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  if (!booking.rechnung_number && !stornos.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {stornos.map((s) => (
        <div key={s.id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-red-700">
              Storniert: {s.original_number} → {s.storno_number}
            </span>
            <span className="text-red-700 font-semibold whitespace-nowrap">{eur(s.amount)}</span>
          </div>
          <div className="text-xs text-red-800/80 mt-0.5">
            {dt(s.created_at)}{s.reason ? ` · ${s.reason}` : ''}
            {s.sent_at ? ` · an ${s.sent_to} gesendet` : s.send_error ? '' : ' · nicht per E-Mail gesendet'}
          </div>
          {s.send_error && (
            <div className="flex items-start gap-1.5 text-xs text-red-700 mt-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> E-Mail fehlgeschlagen: {s.send_error}
            </div>
          )}
          <div className="flex gap-3 mt-1.5 text-xs font-semibold">
            <a href={`${API}/admin/stornos/${s.id}/pdf?token=${token}`} target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
              Stornorechnung ansehen
            </a>
            {booking.email && (
              <button
                onClick={async () => {
                  setMsg(null);
                  try { await adminApi.resendStorno(s.id); setMsg({ ok: true, text: `An ${booking.email} gesendet.` }); load(); }
                  catch (e: any) { setMsg({ ok: false, text: e?.response?.data?.error || 'Senden fehlgeschlagen' }); }
                }}
                className="text-red-700 hover:underline inline-flex items-center gap-1"
              >
                <Send size={11} /> {s.sent_at ? 'Erneut senden' : 'Per E-Mail senden'}
              </button>
            )}
          </div>
        </div>
      ))}

      {booking.rechnung_number && !current && (
        <button
          onClick={() => { setMsg(null); setOpen(true); }}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <FileX size={15} /> Rechnung stornieren ({booking.rechnung_number})
        </button>
      )}

      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {open && booking.rechnung_number && (
        <StornoDialog
          invoiceNumber={booking.rechnung_number}
          defaultEmail={booking.email || undefined}
          onClose={() => setOpen(false)}
          onConfirm={async (p) => {
            try {
              const r = await adminApi.stornoBookingInvoice(booking.id, { reason_key: p.reason_key, reason: p.reason, send: p.send });
              setOpen(false);
              setMsg(r.email_error
                ? { ok: false, text: `${r.storno.storno_number} erstellt, aber E-Mail fehlgeschlagen: ${r.email_error}` }
                : { ok: true, text: `Stornorechnung ${r.storno.storno_number} erstellt${p.send ? ' und gesendet' : ''}.` });
              await load();
              onChanged?.();
            } catch (e: any) {
              setMsg({ ok: false, text: e?.response?.data?.error || 'Storno fehlgeschlagen' });
              setOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
