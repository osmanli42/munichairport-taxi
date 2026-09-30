'use client';

import { useEffect, useState } from 'react';
import { Clock, FileText, MapPin, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { Empty } from '@/components/seo/common';
import { adsApi, eur0, num, pct1 } from './common';

const WD = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function Adj({ v }: { v: number | null }) {
  if (v == null) return <span className="text-[11px] text-gray-300">az veri</span>;
  if (v === 0) return <span className="text-[11px] text-gray-400">±0 %</span>;
  return <span className={cn('text-xs font-bold tabular-nums', v > 0 ? 'text-emerald-600' : 'text-red-600')}>{v > 0 ? '+' : ''}{v} %</span>;
}

function Table({ rows, first, adjust = true }: { rows: any[]; first: string; adjust?: boolean }) {
  if (!rows.length) return <Empty>Veri yok</Empty>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100"><th className="px-5 py-2">{first}</th><th className="px-2 text-right">Tık</th><th className="px-2 text-right">Rez.</th><th className="px-2 text-right">Dönüşüm</th><th className="px-2 text-right">Ciro</th>{adjust && <th className="px-5 text-right" title="Hesap ortalamasına göre önerilen teklif ayarı">Teklif</th>}</tr></thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="px-5 py-2 text-gray-800 truncate max-w-[220px]">{r.name}</td>
            <td className="px-2 text-right tabular-nums">{num(r.clicks)}</td>
            <td className="px-2 text-right tabular-nums font-semibold">{r.bookings}</td>
            <td className="px-2 text-right tabular-nums">{pct1(r.cvr)}</td>
            <td className="px-2 text-right tabular-nums text-emerald-700">{eur0(r.revenue)}</td>
            {adjust && <td className="px-5 text-right"><Adj v={r.adjust ?? null} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Audience({ days }: { days: number }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setD(null); adsApi(`/audience?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);
  if (err) return <Empty>{err}</Empty>;
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const maxClicks = Math.max(1, ...d.heat.flat().map((c: any) => c.clicks));
  return (
    <div className="space-y-6">
      <Card title="Ne zaman tıklanıyor, ne zaman rezervasyon oluyor (Almanya saati)" icon={Clock} right={<span className="text-xs text-gray-400">ort. dönüşüm {pct1(d.baseCvr)}</span>}>
        <div className="p-5 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid" style={{ gridTemplateColumns: '40px repeat(24, minmax(0, 1fr))' }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-[10px] text-gray-400 text-center">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>)}
              {d.heat.map((row: any[], wd: number) => (
                <div key={wd} className="contents">
                  <div className="text-xs text-gray-500 pr-2 flex items-center">{WD[wd]}</div>
                  {row.map((c: any, h: number) => {
                    const a = c.clicks / maxClicks;
                    return (
                      <div key={h} className="m-[1px] h-7 rounded-sm relative flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: c.clicks ? `rgba(42,102,170,${0.12 + a * 0.88})` : '#f3f4f6' }}
                        title={`${WD[wd]} ${String(h).padStart(2, '0')}:00 — ${c.clicks} tık, ${c.bookings} rezervasyon`}>
                        {c.bookings > 0 && <span className="rounded-full bg-emerald-500 px-1 leading-4">{c.bookings}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-gray-400">Mavi yoğunluk = reklam tıkı · yeşil sayı = rezervasyon (tıklamanın saatine göre)</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 px-5 pb-5">
          {d.blocks.map((b: any) => (
            <div key={b.from} className="rounded-xl bg-gray-50 px-3 py-2 text-center">
              <div className="text-[11px] font-semibold text-gray-500">{String(b.from).padStart(2, '0')}–{String(b.to).padStart(2, '0')} Uhr</div>
              <div className="text-sm font-bold tabular-nums">{pct1(b.cvr)}</div>
              <div className="text-[11px] text-gray-400">{b.clicks} tık · {b.bookings} rez.</div>
              <Adj v={b.adjust} />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 grid grid-cols-7 gap-2">
          {d.weekdays.map((w: any) => (
            <div key={w.weekday} className="rounded-xl bg-gray-50 px-2 py-2 text-center">
              <div className="text-[11px] font-semibold text-gray-500">{WD[w.weekday]}</div>
              <div className="text-sm font-bold tabular-nums">{pct1(w.cvr)}</div>
              <Adj v={w.adjust} />
            </div>
          ))}
        </div>
        <div className="px-5 pb-4 text-[11px] text-gray-400">Teklif önerisi = segmentin dönüşüm oranı ÷ hesap ortalaması (±%50 ile sınırlı, yeterli tık varsa). Ziel-CPA kampanyalarında Google bu ayarları (−%100 hariç) kendisi yapar; manuel CPC ve reklam takvimi kararları için kullan.</div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Card title="Cihazlar" icon={Smartphone}><Table rows={d.devices} first="Cihaz" /></Card>
        <Card title="Açılış sayfaları" icon={FileText}><Table rows={d.landings} first="Sayfa" adjust={false} /></Card>
        <Card title="Şehirler (ziyaretçi konumu)" icon={MapPin}><Table rows={d.cities} first="Şehir" /></Card>
        <Card title="Ülkeler" icon={MapPin}><Table rows={d.countries} first="Ülke" adjust={false} /></Card>
      </div>
    </div>
  );
}
