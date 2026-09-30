'use client';

// Website check (like IONOS „Website-Check“): presence, findability, security, speed —
// score bars per area and the individual checks with a fix hint (backend: services/seo/sitecheck.ts).

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi, Empty } from './common';

type Check = { area: string; key: string; label: string; status: 'pass' | 'warn' | 'fail' | 'info'; detail: string; fix?: string };
const ORDER = ['presence', 'findability', 'security', 'speed'];
const rank = { fail: 0, warn: 1, info: 2, pass: 3 } as const;
const tone = (s: number) => (s >= 85 ? 'bg-emerald-500' : s >= 60 ? 'bg-amber-400' : 'bg-red-500');
const text = (s: number) => (s >= 85 ? 'text-emerald-600' : s >= 60 ? 'text-amber-600' : 'text-red-600');

function Icon({ s }: { s: Check['status'] }) {
  if (s === 'pass') return <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />;
  if (s === 'warn') return <AlertTriangle size={17} className="text-amber-500 shrink-0" />;
  if (s === 'fail') return <XCircle size={17} className="text-red-600 shrink-0" />;
  return <Info size={17} className="text-gray-400 shrink-0" />;
}

export default function SiteCheck({ compact, onGo }: { compact?: boolean; onGo?: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(compact ? null : 'all');
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const load = useCallback(() => { seoApi('/site-check').then(setD).catch(() => setD({ latest: null, areas: {} })); }, []);
  useEffect(() => { load(); }, [load]);

  async function rerun() {
    setBusy(true);
    try { setD(await seoApi('/site-check', { method: 'POST' })); } finally { setBusy(false); }
  }

  if (!d) return <div className="h-40 bg-white rounded-2xl animate-pulse" />;
  const r = d.latest;
  const prev = d.previous;
  const button = (
    <button onClick={rerun} disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline disabled:text-gray-400">
      <RefreshCw size={13} className={cn(busy && 'animate-spin')} /> {busy ? 'Kontrol ediliyor…' : 'Şimdi kontrol et'}
    </button>
  );
  if (!r) return <Card title="Website-Check" icon={ShieldCheck} right={button}><Empty>Henüz kontrol yok — „Şimdi kontrol et“e bas (≈15 sn).</Empty></Card>;

  const checks: Check[] = r.checks;
  const issues = checks.filter((c) => c.status === 'fail' || c.status === 'warn').length;

  return (
    <Card title="Website-Check" icon={ShieldCheck} right={
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">{new Date(r.checked_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        {button}
      </div>
    }>
      <div className="p-5 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center">
        <div className="flex items-center gap-4">
          <div className={cn('text-5xl font-bold tabular-nums', text(r.overall))}>{r.overall}</div>
          <div className="text-sm text-gray-600">
            <div>genel skor</div>
            {prev && prev.overall !== r.overall && <div className={cn('text-xs font-semibold', r.overall > prev.overall ? 'text-emerald-600' : 'text-red-600')}>{r.overall > prev.overall ? '+' : ''}{r.overall - prev.overall} önceki kontrole göre</div>}
            <div className="text-xs text-gray-400">{issues ? `${issues} iyileştirme önerisi` : 'hepsi OK ✓'}</div>
          </div>
        </div>
        <div className="space-y-2.5">
          {ORDER.map((a) => (
            <button key={a} onClick={() => (compact ? onGo?.('technical') : setOpen(open === a ? 'all' : a))} className="w-full text-left">
              <div className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm text-gray-700">{d.areas[a]}</span>
                <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden relative">
                  <div className={cn('h-full rounded-full', tone(r.scores[a]))} style={{ width: `${Math.max(6, r.scores[a])}%` }} />
                  <span className="absolute left-2 top-0 text-[11px] font-bold leading-5 text-white drop-shadow">{r.scores[a]}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="border-t border-gray-100">
          {ORDER.filter((a) => open === 'all' || open === a).map((a) => {
            const list = checks.filter((c) => c.area === a).sort((x, y) => rank[x.status] - rank[y.status]);
            const bad = list.filter((c) => c.status !== 'pass');
            const good = list.filter((c) => c.status === 'pass');
            return (
              <div key={a} className="px-5 py-4 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-900">{d.areas[a]} <span className={cn('ml-1 text-sm', text(r.scores[a]))}>{r.scores[a]}</span></div>
                  {good.length > 0 && (
                    <button onClick={() => setShowPass({ ...showPass, [a]: !showPass[a] })} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline">
                      <CheckCircle2 size={13} className="text-emerald-600" /> {good.length} OK <ChevronDown size={13} className={cn('transition-transform', showPass[a] && 'rotate-180')} />
                    </button>
                  )}
                </div>
                <ul className="mt-2 space-y-2">
                  {[...bad, ...(showPass[a] ? good : [])].map((c) => (
                    <li key={c.key} className={cn('flex gap-2.5 rounded-xl px-3 py-2', c.status === 'fail' ? 'bg-red-50' : c.status === 'warn' ? 'bg-amber-50' : c.status === 'info' ? 'bg-gray-50' : '')}>
                      <Icon s={c.status} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{c.label}</div>
                        <div className="text-xs text-gray-600 break-words">{c.detail}</div>
                        {c.fix && c.status !== 'pass' && <div className="mt-0.5 text-xs text-gray-500">→ {c.fix}</div>}
                      </div>
                    </li>
                  ))}
                  {!bad.length && !showPass[a] && <li className="text-sm text-emerald-700">Hepsi OK ✓</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
