'use client';

// Today's visitors who looked at prices or started the booking form but did not book,
// plus open callback requests (with phone number). Visitors still on the site can be
// written to from the Live tab (Canlı Asistan).

import { Phone, UserMinus } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { Card, hhmm } from './shared';
import type { Callback, MissedDraft } from './types';

const short = (a?: string | null) => (a || '').split(',')[0].replace(/Flughafen München.*/i, 'Flughafen').slice(0, 32);

export default function MissedCustomers({ data, onGoLive }: {
  data: { drafts: MissedDraft[]; callbacks: Callback[] } | null; onGoLive: () => void;
}) {
  const drafts = data?.drafts || [];
  const callbacks = data?.callbacks || [];
  const online = drafts.filter((d) => d.online).length;
  const potential = drafts.reduce((s, d) => s + (d.price || 0), 0);
  return (
    <Card
      title="Verpasste Kunden heute"
      icon={UserMinus}
      right={online > 0 ? (
        <button onClick={onGoLive} className="text-xs font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2.5 py-1 animate-pulse">
          {online} jetzt online → Live
        </button>
      ) : undefined}
    >
      {!data ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Lädt…</p>
      ) : drafts.length === 0 && callbacks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 text-center">Heute niemand abgesprungen ✓</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {callbacks.length > 0 && (
            <div className="px-5 py-3">
              <div className="text-xs font-semibold text-gray-700 mb-1.5">Rückruf gewünscht ({callbacks.length})</div>
              <ul className="space-y-1">
                {callbacks.map((c) => (
                  <li key={c.id}>
                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 rounded-lg bg-amber-50 hover:bg-amber-100 px-3 py-2 text-xs">
                      <Phone size={13} className="text-amber-700 shrink-0" />
                      <span className="font-semibold text-gray-900">{c.phone}</span>
                      <span className="truncate text-gray-600">{c.name || ''} {short(c.pickup)} → {short(c.dropoff)}</span>
                      {c.price != null && <span className="ml-auto shrink-0 font-semibold">{formatPrice(c.price)}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {drafts.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-700">Preis gesehen, nicht gebucht ({drafts.length})</span>
                {potential > 0 && <span className="text-gray-500">≈ {formatPrice(potential)} offen</span>}
              </div>
              <ul className="space-y-1 max-h-72 overflow-y-auto">
                {drafts.map((d) => (
                  <li key={d.session_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', d.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300')} title={d.online ? 'jetzt online' : 'offline'} />
                    <span className="font-mono text-gray-400 shrink-0">{hhmm(d.updated_at)}</span>
                    <span className="truncate text-gray-800">{short(d.pickup)} → {short(d.dropoff)}</span>
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', d.last_stage === 'form' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700')}>
                      {d.last_stage === 'form' ? 'Formular' : 'Preise'}
                    </span>
                    {d.gclid && <span className="shrink-0 text-[10px] text-sky-700" title="über Google Ads">Ads</span>}
                    <span className="ml-auto shrink-0 font-semibold text-gray-700">{d.price ? formatPrice(d.price) : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
