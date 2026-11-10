'use client';

// System → E-posta Uyarıları → "Rückruf anfordern": who gets the customer's callback request
// (backend routes/callbacks.ts). Not an alert — the master switch does not affect it.

import { useEffect, useState } from 'react';
import { Mail, Phone } from 'lucide-react';

export default function CallbackMailPanel({ adminEmail, toAdmin, toPartner, partnerEmails, saving, onSave }: {
  adminEmail: string;
  toAdmin: boolean;
  toPartner: boolean;
  partnerEmails: string;
  saving: boolean;
  onSave: (patch: { callback_to_admin?: boolean; callback_to_partner?: boolean; callback_partner_emails?: string }) => void;
}) {
  const [draft, setDraft] = useState(partnerEmails);
  useEffect(() => { setDraft(partnerEmails); }, [partnerEmails]);
  const none = !toAdmin && !(toPartner && partnerEmails.trim());

  return (
    <div className="mt-4 rounded-xl border border-gray-100 px-3 py-2.5">
      <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5"><Phone size={14} className="text-green-600" /> Rückruf anfordern</div>
      <div className="text-xs text-gray-500 mt-0.5">
        Müşteri sitede „Rückruf anfordern“ ile numarasını bırakınca fahrt bilgileriyle e-posta gider. Yukarıdaki ana şalterden etkilenmez; WhatsApp bildirimi ayrıca gelir.
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-700">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={toAdmin} disabled={saving} onChange={(e) => onSave({ callback_to_admin: e.target.checked })} className="h-4 w-4 accent-green-600" />
          Admin <span className="text-gray-400">({adminEmail})</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={toPartner} disabled={saving} onChange={(e) => onSave({ callback_to_partner: e.target.checked })} className="h-4 w-4 accent-green-600" />
          Partner
        </label>
        <label className="inline-flex items-center gap-2">
          <Mail size={13} className="text-blue-500" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (draft.trim() !== partnerEmails) onSave({ callback_partner_emails: draft }); }}
            disabled={!toPartner}
            placeholder="partner@ornek.de"
            className="w-56 border border-gray-300 rounded-lg px-2 py-0.5 text-xs bg-white focus:ring-2 focus:ring-blue-400 outline-none disabled:opacity-50"
          />
        </label>
      </div>
      {none && <div className="mt-1.5 text-xs font-semibold text-red-600">Hiç alıcı yok — Rückruf e-postası gitmez (sadece WhatsApp).</div>}
    </div>
  );
}
