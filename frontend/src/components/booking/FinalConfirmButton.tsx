'use client';

// Booking modal: send the binding "Buchung verbindlich bestätigt" mail to the customer
// (same as the button in the admin's new-booking mail). Sent once; re-send asks first.
import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function FinalConfirmButton({ booking, onSent }: {
  booking: { id: number; status: string; email?: string | null; confirmed_email_sent_at?: string | null; mail_opened_at?: string | null; mail_open_client?: string | null; mail_open_count?: number | null; cancel_mail_opened_at?: string | null; cancel_mail_open_client?: string | null; mail_scan_count?: number | null; cancel_mail_scan_count?: number | null };
  onSent?: (sentAt: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(booking.confirmed_email_sent_at || null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fmt = (d: string) => new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  // Hits from mail security scanners (Google/Microsoft) — shown, but not an open
  const scans = (n?: number | null) => (n ? <span title="Automatische Sicherheitsprüfung des Mail-Anbieters (Google/Microsoft) – kein Öffnen durch den Kunden"> · 🛡 {n} Scan</span> : null);

  // Cancelled: only show whether the customer opened our Stornierung mail (open pixel)
  if (booking.status === 'cancelled') {
    return booking.cancel_mail_opened_at || booking.cancel_mail_scan_count ? (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        {booking.cancel_mail_opened_at
          ? <>📭 Stornierungsmail geöffnet · {fmt(booking.cancel_mail_opened_at)}{booking.cancel_mail_open_client ? ` · ${booking.cancel_mail_open_client}` : ''}</>
          : '📭 Stornierungsmail noch nicht geöffnet'}
        {scans(booking.cancel_mail_scan_count)}
      </div>
    ) : null;
  }
  if (!booking.email) return null;

  async function send(force: boolean) {
    if (force && !confirm('Die Bestätigung wurde schon gesendet. Wirklich noch einmal an den Kunden schicken?')) return;
    setBusy(true); setMsg(null);
    try {
      const r = await adminApi.sendFinalConfirmation(booking.id, force);
      setSentAt(r.sent_at);
      onSent?.(r.sent_at);
      setMsg({ ok: true, text: `Gesendet an ${r.to}.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.error || 'Senden fehlgeschlagen' });
      if (e?.response?.data?.sent_at) setSentAt(e.response.data.sent_at);
    } finally { setBusy(false); }
  }

  const when = sentAt ? fmt(sentAt) : '';

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
      {(booking.mail_opened_at || booking.mail_scan_count) ? (
        <div className="text-xs text-gray-600 mb-1.5">
          {booking.mail_opened_at ? <>
            📬 Buchungsmail geöffnet · {fmt(booking.mail_opened_at)}
            {booking.mail_open_client ? ` · ${booking.mail_open_client}` : ''}
            {booking.mail_open_count && booking.mail_open_count > 1 ? ` · ${booking.mail_open_count}×` : ''}
          </> : '📬 Buchungsmail noch nicht geöffnet'}
          {scans(booking.mail_scan_count)}
        </div>
      ) : null}
      {sentAt ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
            <CheckCircle2 size={16} /> Endgültige Bestätigung gesendet · {when}
          </span>
          <button onClick={() => send(true)} disabled={busy} className="text-xs text-emerald-700 hover:underline disabled:opacity-50">
            erneut senden
          </button>
        </div>
      ) : (
        <button onClick={() => send(false)} disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-60">
          <Send size={15} /> {busy ? 'Wird gesendet…' : 'Endgültige Bestätigung an Kunden senden'}
        </button>
      )}
      {msg && <div className={`mt-1.5 text-xs ${msg.ok ? 'text-emerald-800' : 'text-red-700'}`}>{msg.text}</div>}
    </div>
  );
}
