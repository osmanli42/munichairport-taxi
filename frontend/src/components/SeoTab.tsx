'use client';

// SEO tab — Search Console, organic bookings, site audit, page speed, competitors and a
// ranked to-do list (backend: routes/admin-seo.ts, services/seo/*).

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileSearch, FileText, Link2, ListChecks, Network, Search, Swords, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { seoApi } from './seo/common';
import Overview from './seo/Overview';
import Keywords from './seo/Keywords';
import Pages from './seo/Pages';
import Technical from './seo/Technical';
import Backlinks from './seo/Backlinks';
import { Tasks, Competitors, Connect } from './seo/Extras';

type Tab = 'overview' | 'keywords' | 'pages' | 'technical' | 'backlinks' | 'competitors' | 'tasks' | 'connect';
const TABS: Array<[Tab, string, typeof Search]> = [
  ['overview', 'Genel Bakış', BarChart3],
  ['keywords', 'Anahtar Kelimeler', Search],
  ['pages', 'Sayfalar', FileText],
  ['technical', 'Teknik', FileSearch],
  ['backlinks', 'Backlinkler', Network],
  ['competitors', 'Rakipler', Swords],
  ['tasks', 'Görevler', ListChecks],
  ['connect', 'Bağlantı', Link2],
];

export default function SeoTab(_props: { token?: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState(28);
  const [status, setStatus] = useState<any>(null);
  const [openTasks, setOpenTasks] = useState<number | null>(null);
  const loadStatus = useCallback(() => {
    seoApi('/status').then(setStatus).catch(() => {});
    seoApi('/tasks').then((j) => setOpenTasks(j.tasks.filter((t: any) => t.status === 'open').length)).catch(() => {});
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  const connected = !!status?.gsc?.connected;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="text-primary-500" size={22} /> SEO</h2>
          <p className="text-sm text-gray-500">
            {connected ? <>Search Console bağlı · {status.gsc.site}</> : <>Search Console bağlı değil</>}
            {status?.audit?.last && <> · site sağlığı <b>{status.audit.last.score}</b></>}
          </p>
        </div>
        {['overview', 'keywords', 'pages'].includes(tab) && (
          <div className="flex rounded-xl bg-white ring-1 ring-gray-200 p-1 text-sm">
            {[7, 28, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cn('px-3 py-1 rounded-lg font-medium', days === d ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>{d} gün</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white rounded-2xl p-1.5 ring-1 ring-gray-100 shadow-sm">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              tab === id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}
          >
            <Icon size={15} /> {label}
            {id === 'tasks' && openTasks ? <span className={cn('text-[11px] rounded-full px-1.5', tab === id ? 'bg-white/25' : 'bg-red-500 text-white')}>{openTasks}</span> : null}
            {id === 'connect' && !connected && status && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview days={days} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'keywords' && <Keywords days={days} connected={connected} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'pages' && <Pages days={days} />}
      {tab === 'technical' && <Technical />}
      {tab === 'backlinks' && <Backlinks />}
      {tab === 'competitors' && <Competitors />}
      {tab === 'tasks' && <Tasks />}
      {tab === 'connect' && <Connect onConnected={loadStatus} />}
    </div>
  );
}
