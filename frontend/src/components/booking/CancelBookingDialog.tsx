'use client';

// Admin: cancel a booking with a reason. The chosen reason replaces the generic intro of the
// customer's cancellation mail (texts in backend/src/services/cancelReasons.ts, DE/EN/TR);
// the optional note is shown to the customer as "Hinweis".

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export const CANCEL_REASON_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'customer_request', label: 'Auf Wunsch des Kunden', hint: '„Ihre Buchung wurde wie gewünscht storniert.“' },
  { key: 'fully_booked', label: 'Ausgebucht (fully booked)', hint: '„Zu Ihrem Wunschtermin sind alle Fahrzeuge ausgebucht … Entschuldigung.“' },
  { key: 'no_payment', label: 'Zahlung nicht eingegangen', hint: '„… da die Zahlung nicht rechtzeitig eingegangen ist.“' },
  { key: 'duplicate', label: 'Doppelte Buchung', hint: '„… doppelt eingegangen. Ihre andere Buchung bleibt bestehen.“' },
  { key: 'flight_changed', label: 'Flug geändert / annulliert', hint: '„… da Ihr Flug geändert bzw. annulliert wurde.“' },
  { key: 'unreachable', label: 'Kunde nicht erreichbar', hint: '„Wir konnten Sie zur Bestätigung nicht erreichen …“' },
  { key: 'other', label: 'Anderer Grund', hint: '„Ihre Buchung wurde storniert.“ + Ihr Hinweis' },
];

export interface CancelPayload { cancel_reason: string; cancel_note: string; notify: boolean }

export default function CancelBookingDialog({ booking, onClose, onConfirm }: {
  booking: { booking_number: string; name?: string; email?: string; language?: string };
  onClose: () => void;
  onConfirm: (p: CancelPayload) => Promise<void> | void;
}) {
  const [reason, setReason] = useState('customer_request');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(!!booking.email);
  const [busy, setBusy] = useState(false);
  const needsNote = reason === 'other' && notify;
  const lang = String(booking.language || 'de').toUpperCase();

  async function submit() {
    setBusy(true);
    try { await onConfirm({ cancel_reason: reason, cancel_note: note.trim(), notify }); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-900">Buchung stornieren</h3>
            <p className="text-xs text-gray-500">{booking.booking_number}{booking.name ? ` · ${booking.name}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Schließen"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Grund</div>
            <div className="space-y-1.5">
              {CANCEL_REASON_OPTIONS.map((o) => (
                <label key={o.key} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${reason === o.key ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="cancel_reason" className="mt-0.5" checked={reason === o.key} onChange={() => setReason(o.key)} />
                  <span>
                    <span className="font-medium text-gray-900">{o.label}</span>
                    <span className="block text-xs text-gray-500">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Hinweis an den Kunden {reason === 'other' ? '(erforderlich)' : '(optional)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="z. B. Gerne bieten wir Ihnen eine Abholung um 06:30 Uhr an – rufen Sie uns einfach an."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <p className="text-xs text-gray-400 mt-1">Erscheint in der E-Mail unter „Hinweis“ – in der Sprache, in der Sie ihn schreiben.</p>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notify} disabled={!booking.email} onChange={(e) => setNotify(e.target.checked)} />
            <span>Kunden per E-Mail informieren {booking.email ? <span className="text-gray-400">({booking.email} · {lang})</span> : <span className="text-gray-400">(keine E-Mail-Adresse)</span>}</span>
          </label>

          {needsNote && !note.trim() && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Bei „Anderer Grund“ bitte einen Hinweis für den Kunden eintragen.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Abbrechen</button>
          <button
            onClick={submit}
            disabled={busy || (needsNote && !note.trim())}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Wird storniert…' : notify ? 'Stornieren & E-Mail senden' : 'Stornieren ohne E-Mail'}
          </button>
        </div>
      </div>
    </div>
  );
}
