'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { Empty } from '@/components/seo/common';
import { adsApi, eur0, eur2, num, pct1, Chip, VERDICT } from './common';

export default function Campaigns({ days, onGo }: { days: number; onGo: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setD(null); adsApi(`/campaigns?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);
  if (err) return <Empty>{err}</Empty>;
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const src = d.reportSource;
  return (
    <div className="space-y-6">
      <Card title="Kampanyalar" icon={Megaphone} right={
        <span className="text-xs text-gray-400">
          {src ? (src.type === 'daily' ? `Google Ads raporu: ${d.range.from} – ${d.range.to}` : `Son rapor dönemi: ${src.from || '?'} – ${src.to || '?'}`) : <button onClick={() => onGo('data')} className="text-primary-600 hover:underline">Kampanya raporu yükle →</button>}
        </span>
      }>
        {d.campaigns.length === 0 ? <Empty>Bu dönemde reklam tıklaması yok.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-2.5">Kampanya</th>
                  <th className="px-2 text-right">Harcama</th>
                  <th className="px-2 text-right">Tık</th>
                  <th className="px-2 text-right">CPC</th>
                  <th className="px-2 text-right" title="Anteil an möglichen Impressionen">Gösterim payı</th>
                  <th className="px-2 text-right" title="Budget / Rang nedeniyle kaçan gösterim">Kayıp (bütçe/sıra)</th>
                  <th className="px-2 text-right" title="Google'ın saydığı conversion">Google conv.</th>
                  <th className="px-2 text-right" title="Sitenin gerçek rezervasyonu (iptaller hariç)">Gerçek rez.</th>
                  <th className="px-2 text-right">Ciro</th>
                  <th className="px-2 text-right">CPA</th>
                  <th className="px-2 text-right">ROAS</th>
                  <th className="px-5">Karar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.campaigns.map((c: any) => {
                  const v = VERDICT[c.verdict] || VERDICT.nodata;
                  return (
                    <tr key={c.id || c.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{c.name}</div>
                        <div className="text-[11px] text-gray-400">{c.id && c.id !== c.name ? `ID ${c.id}` : ''}{c.status ? ` · ${c.status}` : ''}{c.budget ? ` · ${eur2(c.budget)}/Tag` : ''}</div>
                      </td>
                      <td className="px-2 text-right tabular-nums">{c.cost ? eur0(c.cost) : '—'}</td>
                      <td className="px-2 text-right tabular-nums">{c.reportClicks ? num(c.reportClicks) : num(c.clicks)}</td>
                      <td className="px-2 text-right tabular-nums">{eur2(c.cpc)}</td>
                      <td className="px-2 text-right tabular-nums">{c.impr_share != null ? `%${num(c.impr_share, 0)}` : '—'}</td>
                      <td className="px-2 text-right tabular-nums text-xs">
                        {c.lost_budget != null || c.lost_rank != null
                          ? <><span className={cn(c.lost_budget >= 10 && 'text-amber-700 font-semibold')}>%{num(c.lost_budget, 0)}</span> / %{num(c.lost_rank, 0)}</>
                          : '—'}
                      </td>
                      <td className="px-2 text-right tabular-nums">{c.googleConv ? num(c.googleConv, 1) : '—'}</td>
                      <td className="px-2 text-right tabular-nums font-semibold text-gray-900">{c.bookings}<span className="text-[11px] font-normal text-gray-400"> ({pct1(c.cvr)})</span></td>
                      <td className="px-2 text-right tabular-nums text-emerald-700">{eur0(c.revenue)}</td>
                      <td className={cn('px-2 text-right tabular-nums font-semibold', c.cpa == null ? 'text-gray-400' : c.cpa <= d.targetCpa ? 'text-emerald-700' : 'text-red-600')}>{eur2(c.cpa)}</td>
                      <td className="px-2 text-right tabular-nums">{c.roas != null ? `${num(c.roas, 1)}×` : '—'}</td>
                      <td className="px-5"><Chip className={v[1]} title={v[2]}>{v[0]}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
          „Gerçek rez.“ sitenin kendi verisi: reklam tıkından sonraki 30 gün içindeki, iptal edilmemiş rezervasyonlar (son tık). Kampanya adı yoksa Veri & Bağlantı'dan ID'ye ad verilebilir.
        </div>
      </Card>
    </div>
  );
}
