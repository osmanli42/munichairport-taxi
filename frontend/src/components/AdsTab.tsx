'use client';

// Google Ads tab — "Ads coach": cockpit, campaigns, keywords & search terms, audience & timing,
// prioritised to-dos with change log, report uploads and the offline conversion file
// (backend: routes/ads-v2.ts, services/ads/*). Nothing here changes the Google Ads account.

import { useCallback, useEffect, useState } from 'react';
import { Clock, Database, Gauge, KeyRound, ListChecks, Megaphone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adsApi } from './ads/common';
import Cockpit from './ads/Cockpit';
import Campaigns from './ads/Campaigns';
import Keywords from './ads/Keywords';
import Audience from './ads/Audience';
import Coach from './ads/Coach';
import DataTab from './ads/DataTab';

type Tab = 'cockpit' | 'campaigns' | 'keywords' | 'audience' | 'coach' | 'data';
const TABS: Array<[Tab, string, typeof Gauge]> = [
  ['cockpit', 'Kokpit', Gauge],
  ['campaigns', 'Kampanyalar', Megaphone],
  ['keywords', 'Kelimeler & Aramalar', KeyRound],
  ['audience', 'Kitle & Zamanlama', Clock],
  ['coach', 'Koç', ListChecks],
  ['data', 'Veri & Bağlantı', Database],
];

export default function AdsTab({ onRemindersChange }: { token?: string; onRemindersChange?: () => void }) {
  const [tab, setTab] = useState<Tab>('cockpit');
  const [days, setDays] = useState(30);
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const [reportsDue, setReportsDue] = useState(false);

  const refreshBadges = useCallback(() => {
    adsApi(`/coach?days=${days}`).then((j) => setOpenTasks(j.tasks.filter((t: any) => t.status === 'open').length)).catch(() => {});
    adsApi('/reminders').then((j) => setReportsDue(!!j.reports?.due)).catch(() => {});
  }, [days]);
  useEffect(() => { refreshBadges(); }, [refreshBadges]);
  const changed = useCallback(() => { refreshBadges(); onRemindersChange?.(); }, [refreshBadges, onRemindersChange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="text-primary-500" size={22} /> Google Ads</h2>
          <p className="text-sm text-gray-500">Gerçek rezervasyon + Google Ads raporları → somut aksiyonlar. Panel hesabında hiçbir şeyi kendisi değiştirmez.</p>
        </div>
        {tab !== 'data' && tab !== 'coach' && (
          <div className="flex rounded-xl bg-white ring-1 ring-gray-200 p-1 text-sm">
            {[7, 14, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cn('px-3 py-1 rounded-lg font-medium', days === d ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>{d} gün</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white rounded-2xl p-1.5 ring-1 ring-gray-100 shadow-sm">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors', tab === id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
            <Icon size={15} /> {label}
            {id === 'coach' && openTasks ? <span className={cn('text-[11px] rounded-full px-1.5', tab === id ? 'bg-white/25' : 'bg-red-500 text-white')}>{openTasks}</span> : null}
            {id === 'data' && reportsDue ? <span className={cn('text-[11px] rounded-full px-1.5', tab === id ? 'bg-white/25' : 'bg-red-500 text-white')}>1</span> : null}
          </button>
        ))}
      </div>

      {tab === 'cockpit' && <Cockpit days={days} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'campaigns' && <Campaigns days={days} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'keywords' && <Keywords days={days} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'audience' && <Audience days={days} />}
      {tab === 'coach' && <Coach days={days} onChanged={changed} />}
      {tab === 'data' && <DataTab onChanged={changed} />}
    </div>
  );
}
