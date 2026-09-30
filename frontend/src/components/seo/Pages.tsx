'use client';

import { useEffect, useState } from 'react';
import { FileText, TrendingDown } from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { seoApi, nf, pct, eur, Delta, PosBadge, Empty } from './common';

export default function Pages({ days }: { days: number }) {
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => { setD(null); seoApi(`/pages?days=${days}`).then(setD).catch(() => setD({ pages: [], decay: [] })); }, [days]);
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  const list = d.pages.filter((p: any) => !q || p.path.includes(q));
  return (
    <div className="space-y-6">
      {d.decay.length > 0 && (
        <Card title="Tıklama kaybeden sayfalar" icon={TrendingDown}>
          <ul className="divide-y divide-gray-100">
            {d.decay.map((p: any) => (
              <li key={p.path} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <span className="flex-1 truncate font-medium">{p.path}</span>
                <span className="text-xs text-gray-500">{p.prev_clicks} → {p.clicks} tıklama</span>
                <span className="text-xs font-semibold text-red-600">{Math.round(p.change * 100)} %</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card
        title={`Sayfalar (${list.length})`}
        icon={FileText}
        right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="/blog…" className="border border-gray-200 rounded-lg px-2.5 py-1 text-sm w-40" />}
      >
        {list.length === 0 ? <Empty>Veri yok</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Sayfa</th>
                  <th className="text-right font-medium px-3 py-2">Tıklama</th>
                  <th className="text-right font-medium px-3 py-2">Gösterim</th>
                  <th className="text-right font-medium px-3 py-2">CTR</th>
                  <th className="text-right font-medium px-3 py-2">Pozisyon</th>
                  <th className="text-right font-medium px-3 py-2 border-l border-gray-200">Organik ziyaret</th>
                  <th className="text-right font-medium px-3 py-2">Rezervasyon</th>
                  <th className="text-right font-medium px-3 py-2">Ciro</th>
                  <th className="text-right font-medium px-3 py-2 border-l border-gray-200">Sorun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map((p: any) => (
                  <tr key={p.path} className="hover:bg-gray-50">
                    <td className="px-4 py-2 max-w-[18rem] truncate">
                      <a href={`https://flughafen-muenchen.taxi${p.path === '/' ? '' : p.path}`} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-primary-600">{p.path}</a>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.gsc ? <>{p.gsc.clicks} <Delta cur={p.gsc.clicks} prev={p.prev?.clicks} /></> : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.gsc ? nf(p.gsc.impressions) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.gsc ? pct(p.gsc.ctr) : '—'}</td>
                    <td className="px-3 py-2 text-right">{p.gsc ? <PosBadge pos={p.gsc.position} /> : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums border-l border-gray-100">{p.organic?.sessions ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{p.organic?.bookings || ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.organic?.revenue ? eur(p.organic.revenue) : ''}</td>
                    <td className="px-3 py-2 text-right border-l border-gray-100">
                      {p.issues ? <span className={p.issues.errors ? 'text-red-600 font-semibold' : 'text-amber-600'}>{p.issues.total}</span> : <span className="text-gray-300">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">Tıklama/gösterim: Search Console. Organik ziyaret, rezervasyon, ciro: sitenin kendi verisi (Google/Bing'den gelen, aynı ziyarette rezervasyon).</p>
      </Card>
    </div>
  );
}
