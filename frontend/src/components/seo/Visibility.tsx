'use client';

// Overview cards like Semrush/Sistrix: keyword position distribution (now vs before + weekly)
// and the device split from Search Console.

import { Layers, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { nf, pct, PosBadge, Empty } from './common';

const COLORS: Record<string, string> = { top3: '#059669', top10: '#2a66aa', top20: '#f59e0b', top50: '#94a3b8', rest: '#e2e8f0' };
const KEYS = ['top3', 'top10', 'top20', 'top50', 'rest'] as const;

export function PositionDistribution({ data }: { data: any }) {
  if (!data) return null;
  const labels: Record<string, string> = Object.fromEntries(data.buckets.map((b: any) => [b.key, b.label]));
  const weeks: any[] = data.weekly || [];
  const max = Math.max(1, ...weeks.map((w) => KEYS.reduce((a, k) => a + (w[k] || 0), 0)));
  const top10 = data.current.top3 + data.current.top10;
  const prevTop10 = data.previous.top3 + data.previous.top10;
  return (
    <Card title="Görünürlük — anahtar kelime pozisyonları" icon={Layers} right={<span className="text-xs text-gray-400">Google'da görünen sorgular</span>}>
      <div className="p-5">
        <div className="grid grid-cols-5 gap-2">
          {KEYS.map((k) => {
            const diff = data.current[k] - data.previous[k];
            return (
              <div key={k} className="rounded-xl bg-gray-50 px-2 py-2.5 text-center">
                <div className="text-[11px] font-semibold text-gray-500">Poz. {labels[k]}</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: k === 'rest' ? '#64748b' : COLORS[k] }}>{nf(data.current[k])}</div>
                <div className={cn('text-[11px] font-semibold tabular-nums', diff === 0 ? 'text-gray-400' : (diff > 0) === (k !== 'rest' && k !== 'top50') ? 'text-emerald-600' : 'text-red-600')}>
                  {diff > 0 ? '+' : ''}{diff}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-sm text-gray-600">
          İlk sayfada (1–10): <b className="text-gray-900">{nf(top10)}</b> sorgu
          <span className={cn('ml-1 font-semibold', top10 >= prevTop10 ? 'text-emerald-600' : 'text-red-600')}>({top10 - prevTop10 >= 0 ? '+' : ''}{top10 - prevTop10} önceki döneme göre)</span>
        </div>

        {weeks.length > 1 ? (
          <div className="mt-4">
            <div className="flex items-end gap-1 h-32">
              {weeks.map((w) => (
                <div key={w.week} className="flex-1 flex flex-col-reverse rounded-t overflow-hidden" title={`${w.week}: ${KEYS.map((k) => `${labels[k]} ${w[k]}`).join(' · ')}`}
                  style={{ height: `${(KEYS.reduce((a, k) => a + (w[k] || 0), 0) / max) * 100}%` }}>
                  {KEYS.map((k) => <div key={k} style={{ flexGrow: w[k] || 0, background: COLORS[k] }} />)}
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-gray-400"><span>{weeks[0].week}</span><span>haftalık</span><span>{weeks[weeks.length - 1].week}</span></div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
              {KEYS.map((k) => <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[k] }} /> {labels[k]}</span>)}
            </div>
          </div>
        ) : <div className="mt-4 text-xs text-gray-400">Haftalık geçmiş Search Console verisi biriktikçe dolacak.</div>}
      </div>
    </Card>
  );
}

const DEVICE: Record<string, string> = { MOBILE: 'Mobil', DESKTOP: 'Masaüstü', TABLET: 'Tablet' };

export function DeviceSplit({ devices }: { devices: any[] | undefined }) {
  if (!devices) return null;
  const total = devices.reduce((a, d) => a + d.clicks, 0);
  const totalImp = devices.reduce((a, d) => a + d.impressions, 0);
  return (
    <Card title="Cihazlar" icon={Smartphone}>
      {devices.length === 0 ? <Empty>Henüz veri yok</Empty> : (
        <ul className="divide-y divide-gray-100">
          {devices.slice().sort((a, b) => b.impressions - a.impressions).map((d) => {
            const share = total ? d.clicks / total : totalImp ? d.impressions / totalImp : 0;
            return (
              <li key={d.device} className="px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{DEVICE[d.device] || d.device}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-500 tabular-nums">
                    <span><b className="text-gray-900">{nf(d.clicks)}</b> tık</span>
                    <span>CTR {pct(d.ctr)}</span>
                    <PosBadge pos={d.position} />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary-500" style={{ width: `${share * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
