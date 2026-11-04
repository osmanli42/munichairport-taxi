'use client';

// System → E-posta Uyarıları → "Takvime eklenmemiş fahrt": settings and the current list
// (backend services/calendarMissingAlert.ts). Loading the list sends nothing.

import { useCallback, useEffect, useState } from 'react';
import { BellOff, Clock, Mail, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const QUIET_OPTIONS: [string, string][] = [
  ['off', 'Yok, gece de gönder'],
  ['22:00-07:00', '22:00–07:00 arası gönderme'],
  ['23:00-07:00', '23:00–07:00 arası gönderme'],
  ['00:00-06:00', '00:00–06:00 arası gönderme'],
];

interface Leg {
  booking_id: number;
  booking_number: string;
  name: string;
  leg: 'outbound' | 'return';
  roundtrip: boolean;
  time: string;
  from: string | null;
  to: string | null;
  ignored: boolean;
}

const when = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)} ${t.slice(11, 16)}`;

export default function CalendarMissingPanel({ token, emails, quiet, dashboard, saving, onSave, onPreview }: {
  token: string | null;
  emails: string;
  quiet: string;
  dashboard: boolean;
  saving: boolean;
  onSave: (patch: { calendar_missing_emails?: string; calendar_missing_quiet?: string; calendar_missing_dashboard?: boolean }) => void;
  onPreview: () => void;
}) {
  const [legs, setLegs] = useState<Leg[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(emails);

  useEffect(() => { setDraft(emails); }, [emails]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats/calendar-missing`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Liste alınamadı');
      setLegs(d.legs);
      setError('');
    } catch (e: any) {
      setLegs(null);
      setError(e?.message || 'Liste alınamadı');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleIgnore = async (l: Leg) => {
    await fetch(`${API_BASE}/admin/system-stats/calendar-missing/ignore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: l.booking_id, time: l.time, ignored: !l.ignored }),
    }).catch(() => {});
    load();
  };

  const open = legs?.filter((l) => !l.ignored).length ?? 0;

  return (
    <div className="mt-1.5 space-y-2 text-xs text-gray-700">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <label className="inline-flex items-center gap-2">
          <Mail size={13} className="text-blue-500" /> Partner
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (draft.trim() !== emails) onSave({ calendar_missing_emails: draft }); }}
            placeholder="boş = sadece admin"
            className="w-56 border border-gray-300 rounded-lg px-2 py-0.5 text-xs bg-white focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </label>
        <label className="inline-flex items-center gap-2">
          <Clock size={13} className="text-blue-500" /> Sessiz saatler
          <select
            value={quiet}
            onChange={(e) => onSave({ calendar_missing_quiet: e.target.value })}
            disabled={saving}
            className="border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-400 outline-none"
          >
            {QUIET_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={dashboard}
            onChange={(e) => onSave({ calendar_missing_dashboard: e.target.checked })}
            disabled={saving}
          />
          Handlungsbedarf’ta göster
        </label>
        <button onClick={onPreview} className="font-semibold text-blue-600 hover:underline">E-postayı önizle</button>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-800">
            {error ? 'Liste okunamadı' : legs === null ? 'Kontrol ediliyor…' : open ? `Şu an takvimde olmayan: ${open} fahrt` : 'Şu an eksik fahrt yok'}
          </span>
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800" aria-label="Yenile">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yenile
          </button>
        </div>
        {error && <div className="mt-1 text-red-600">{error}. E-posta da gitmez, çünkü takvim okunamadan hiçbir fahrt “eksik” sayılmaz.</div>}
        {legs && legs.length > 0 && (
          <ul className="mt-1.5 divide-y divide-gray-200">
            {legs.map((l) => (
              <li key={`${l.booking_id}-${l.time}`} className={`flex items-start justify-between gap-2 py-1.5 ${l.ignored ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <div className="font-medium text-gray-800">
                    {when(l.time)} · {l.name}
                    {l.roundtrip && <span className="ml-1 text-amber-700">({l.leg === 'return' ? 'Rückfahrt' : 'Hinfahrt'})</span>}
                  </div>
                  <div className="text-gray-500 break-words">{l.from || '?'} → {l.to || '?'}</div>
                  <div className="font-mono text-gray-400">{l.booking_number}</div>
                </div>
                <button onClick={() => toggleIgnore(l)} className="shrink-0 inline-flex items-center gap-1 font-semibold text-gray-500 hover:text-gray-800">
                  <BellOff size={12} /> {l.ignored ? 'Geri al' : 'Uyarma'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
