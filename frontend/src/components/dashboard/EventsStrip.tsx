'use client';

// Upcoming days that change demand: Bavarian public holidays (computed) and the admin's own
// list (trade fairs, Oktoberfest, school holidays …), editable here.

import { useState } from 'react';
import { PartyPopper, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dayLabel } from './shared';
import type { DashEvent } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function range(e: DashEvent) {
  const f = (d: string) => dayLabel(d, { day: '2-digit', month: '2-digit' });
  return e.start === e.end ? `${dayLabel(e.start, { weekday: 'short' })} ${f(e.start)}` : `${f(e.start)}–${f(e.end)}`;
}

export default function EventsStrip({ events, custom, today, onSaved }: {
  events: DashEvent[]; custom: DashEvent[]; today: string; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DashEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openEditor() {
    setRows(custom.map((e) => ({ ...e })));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${API}/admin/dashboard-widgets/events`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: rows.filter((r) => r.name.trim()) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Speichern fehlgeschlagen'); return; }
      setEditing(false);
      onSaved();
    } catch {
      setError('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 shrink-0"><PartyPopper size={14} /> Demnächst:</span>
        {events.length === 0 && <span className="text-xs text-gray-400 shrink-0">keine Feiertage oder Events in den nächsten 45 Tagen</span>}
        {events.map((e) => {
          const running = e.start <= today && e.end >= today;
          return (
            <span
              key={e.id}
              title={e.note || undefined}
              className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                running ? 'bg-rose-50 text-rose-700 ring-rose-200 font-semibold'
                  : e.kind === 'holiday' ? 'bg-gray-50 text-gray-600 ring-gray-200' : 'bg-violet-50 text-violet-700 ring-violet-200')}
            >
              {running && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              {e.name} <span className="opacity-70">{range(e)}</span>
            </span>
          );
        })}
        <button onClick={openEditor} className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 px-2 py-1">
          <Pencil size={12} /> Events bearbeiten
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Events & Messen</h3>
                <p className="text-xs text-gray-500">Feiertage in Bayern kommen automatisch dazu.</p>
              </div>
              <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2">
              {rows.length === 0 && <p className="text-sm text-gray-400">Noch keine Einträge.</p>}
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={r.name}
                    onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="z. B. EXPO REAL"
                    className="col-span-12 sm:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={r.start}
                    onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, start: e.target.value, end: x.end < e.target.value ? e.target.value : x.end } : x)))}
                    className="col-span-5 sm:col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={r.end}
                    min={r.start}
                    onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                    className="col-span-5 sm:col-span-3 border border-gray-200 rounded-lg px-2 py-2 text-sm"
                  />
                  <button onClick={() => setRows((l) => l.filter((_, j) => j !== i))} className="col-span-2 sm:col-span-1 p-2 text-gray-400 hover:text-red-600 justify-self-center">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setRows((l) => [...l, { id: '', name: '', start: today, end: today, kind: 'custom' }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 mt-2"
              >
                <Plus size={15} /> Event hinzufügen
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Abbrechen</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
