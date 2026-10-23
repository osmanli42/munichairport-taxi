'use client';

// Buchungsdetail: die „Neue Buchung“-Mail noch einmal an die Admin-Adresse senden
// (z. B. wenn sie beim Buchen nicht zugestellt wurde). Zwei Klicks: erst bestätigen.

import { useState } from 'react';
import { MailPlus, Loader2, Check } from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function ResendAdminMailButton({ bookingId }: { bookingId: number }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const send = async () => {
    setState('busy');
    try {
      const r = await adminApi.resendAdminNotification(bookingId);
      setState('done'); setMsg(r.to);
    } catch (e: any) {
      setState('error'); setMsg(e?.response?.data?.error || e?.message || 'Fehler');
    }
  };

  if (state === 'done') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><Check size={14} /> Admin-Mail an {msg} gesendet</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {state === 'error' && <span className="text-xs text-red-600">{msg}</span>}
      {state === 'confirm' ? (
        <>
          <button onClick={send} className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-2.5 py-1.5 rounded-lg">Ja, senden</button>
          <button onClick={() => setState('idle')} className="text-xs text-gray-500 px-1">×</button>
        </>
      ) : (
        <button onClick={() => setState('confirm')} disabled={state === 'busy'} title="„Neue Buchung“-Mail noch einmal an die Admin-Adresse senden"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
          {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <MailPlus size={14} />} Admin-Mail erneut
        </button>
      )}
    </span>
  );
}
