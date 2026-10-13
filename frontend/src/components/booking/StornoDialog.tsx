'use client';

// Admin: cancel an issued invoice with a Stornorechnung (GoBD). The invoice itself is never
// deleted; a separate ST-YYYY-NNNN document with negative amounts is created. Preset reasons
// are printed as "Grund" on the PDF (texts in backend/src/services/cancelReasons.ts).

import { useState } from 'react';
import { X, FileX } from 'lucide-react';

export const STORNO_REASON_OPTIONS: { key: string; label: string }[] = [
  { key: 'customer_request', label: 'Auf Wunsch des Kunden' },
  { key: 'ride_not_done', label: 'Fahrt wurde nicht durchgeführt' },
  { key: 'fully_booked', label: 'Fahrt wegen Ausbuchung storniert' },
  { key: 'wrong_invoice', label: 'Rechnung fehlerhaft (Empfänger, Betrag, Steuersatz)' },
  { key: 'duplicate', label: 'Doppelt berechnet' },
  { key: '', label: 'Anderer Grund (nur Freitext)' },
];

export interface StornoPayload { reason_key: string; reason: string; send: boolean; email?: string }

export default function StornoDialog({ invoiceNumber, amountLabel, defaultEmail, askEmail, onClose, onConfirm }: {
  invoiceNumber: string;
  amountLabel?: string;
  defaultEmail?: string;
  /** Sammelrechnung: the recipient address can be edited. */
  askEmail?: boolean;
  onClose: () => void;
  onConfirm: (p: StornoPayload) => Promise<void> | void;
}) {
  const [reasonKey, setReasonKey] = useState('customer_request');
  const [reason, setReason] = useState('');
  const [send, setSend] = useState(!!defaultEmail || !!askEmail);
  const [email, setEmail] = useState(defaultEmail || '');
  const [busy, setBusy] = useState(false);
  const needsText = !reasonKey && !reason.trim();

  async function submit() {
    setBusy(true);
    try { await onConfirm({ reason_key: reasonKey, reason: reason.trim(), send, ...(askEmail ? { email: email.trim() } : {}) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileX size={18} className="text-red-600" />
            <div>
              <h3 className="font-bold text-gray-900">Rechnung stornieren</h3>
              <p className="text-xs text-gray-500">{invoiceNumber}{amountLabel ? ` · ${amountLabel}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Schließen"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <p className="text-gray-600">
            Es wird eine <b>Stornorechnung</b> mit eigener Nummer (ST-…) und negativen Beträgen erstellt.
            Die Rechnung {invoiceNumber} bleibt gespeichert und gilt danach als storniert.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Grund</label>
            <select value={reasonKey} onChange={(e) => setReasonKey(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2">
              {STORNO_REASON_OPTIONS.map((o) => <option key={o.key || 'other'} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Ergänzung {reasonKey ? '(optional)' : '(erforderlich)'}
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="erscheint auf der Stornorechnung"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={send} disabled={!askEmail && !defaultEmail} onChange={(e) => setSend(e.target.checked)} />
            <span>Stornorechnung per E-Mail senden{!askEmail && defaultEmail ? <span className="text-gray-400"> ({defaultEmail})</span> : ''}</span>
          </label>
          {askEmail && send && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rechnung@firma.de"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Abbrechen</button>
          <button
            onClick={submit}
            disabled={busy || needsText || (askEmail && send && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))}
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Wird erstellt…' : 'Stornorechnung erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
