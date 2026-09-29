'use client';

// One row of the things done most often from the dashboard.

import { useEffect, useState } from 'react';
import { CalendarDays, FileText, MessageCircle, Plus, Radio, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const auth = () => {
  try { return { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }; } catch { return {} as Record<string, string>; }
};

export default function QuickActions({ onNewBooking, onGoTab, onSynced }: {
  onNewBooking: () => void; onGoTab: (tab: string) => void; onSynced: () => void;
}) {
  const [assist, setAssist] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/admin/live-assist/settings`, { headers: auth() })
      .then((r) => r.json())
      .then((j) => setAssist(j?.settings?.enabled === '1' || j?.settings?.enabled === 1 || j?.settings?.enabled === true))
      .catch(() => setAssist(null));
  }, []);

  async function toggleAssist() {
    if (assist === null) return;
    setBusy('assist');
    try {
      const r = await fetch(`${API}/admin/live-assist/settings`, {
        method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: assist ? '0' : '1' }),
      });
      if (r.ok) setAssist(!assist);
    } finally {
      setBusy(null);
    }
  }

  async function syncCalendar() {
    setBusy('sync');
    setMsg(null);
    try {
      const r = await adminApi.syncCalendarRides();
      setMsg(`Kalender: ${r.events} Termine gelesen`);
      onSynced();
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Synchronisierung fehlgeschlagen');
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors disabled:opacity-50';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onNewBooking} className={cn(btn, 'bg-primary-600 text-white ring-primary-600 hover:bg-primary-700')}>
        <Plus size={15} /> Neue Buchung
      </button>
      <button onClick={() => onGoTab('rechnung')} className={cn(btn, 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50')}>
        <FileText size={15} /> Rechnung
      </button>
      <button onClick={() => onGoTab('kalender')} className={cn(btn, 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50')}>
        <CalendarDays size={15} /> Kalender-Rechnungen
      </button>
      <button onClick={syncCalendar} disabled={busy === 'sync'} className={cn(btn, 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50')}>
        <RefreshCw size={15} className={busy === 'sync' ? 'animate-spin' : ''} /> Kalender synchronisieren
      </button>
      <button onClick={() => onGoTab('live')} className={cn(btn, 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50')}>
        <Radio size={15} /> Live
      </button>
      {assist !== null && (
        <button
          onClick={toggleAssist}
          disabled={busy === 'assist'}
          className={cn(btn, assist ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100' : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50')}
          title="Canlı Asistan (Live-Chat) ein-/ausschalten"
        >
          <MessageCircle size={15} /> Live-Chat {assist ? 'an' : 'aus'}
        </button>
      )}
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
