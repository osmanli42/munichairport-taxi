'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, MousePointerClick, Pencil, Search, Sparkles, Target, TrendingDown } from 'lucide-react';
import { Card } from '@/components/dashboard/shared';
import { seoApi, nf, pct, Delta, PosBadge, Spark, Empty, shortPath } from './common';

type Row = { query: string; clicks: number; impressions: number; ctr: number; position: number; prev: any; page: string | null };

export default function Keywords({ days, connected, onGo }: { days: number; connected: boolean; onGo: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [device, setDevice] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'clicks' | 'impressions' | 'position' | 'ctr'>('clicks');
  const [editing, setEditing] = useState(false);
  const [kwText, setKwText] = useState('');
  const load = useCallback(() => {
    seoApi(`/queries?days=${days}${device ? `&device=${device}` : ''}`).then(setD).catch(() => setD({ rows: [], tracked: [] }));
  }, [days, device]);
  useEffect(() => { setD(null); load(); }, [load]);

  const rows: Row[] = useMemo(() => {
    const list = (d?.rows || []).filter((r: Row) => !q || r.query.includes(q.toLowerCase()));
    const dir = sort === 'position' ? 1 : -1;
    return [...list].sort((a, b) => (a[sort] - b[sort]) * dir).slice(0, 300);
  }, [d, q, sort]);

  async function saveKeywords() {
    const keywords = kwText.split('\n').map((s) => s.trim()).filter(Boolean);
    await seoApi('/keywords', { method: 'PUT', body: JSON.stringify({ keywords }) });
    setEditing(false);
    load();
  }

  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  if (!connected) {
    return (
      <Card title="Anahtar kelimeler" icon={Search}>
        <Empty>Anahtar kelime verisi Google Search Console'dan gelir. <button onClick={() => onGo('connect')} className="text-primary-600 underline">Bağlantıyı kur</button></Empty>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tracked */}
      <Card
        title="Takip edilen hedef kelimeler"
        icon={Target}
        right={<button onClick={() => { setKwText(d.tracked.map((t: any) => t.keyword).join('\n')); setEditing(true); }} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><Pencil size={12} /> Düzenle</button>}
      >
        {editing ? (
          <div className="p-5 space-y-2">
            <textarea value={kwText} onChange={(e) => setKwText(e.target.value)} rows={6} className="w-full border border-gray-200 rounded-xl p-3 text-sm" placeholder="Her satıra bir kelime" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-600">Vazgeç</button>
              <button onClick={saveKeywords} className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg">Kaydet</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-px bg-gray-100">
            {d.tracked.map((t: any) => (
              <div key={t.keyword} className="bg-white p-4">
                <div className="text-sm font-medium text-gray-900 truncate">{t.keyword}</div>
                <div className="mt-2 flex items-center gap-2">
                  <PosBadge pos={t.position} />
                  <Delta cur={t.position} prev={t.prev_position} invert abs suffix="7 gün" />
                </div>
                <div className="mt-2"><Spark values={t.series.map((s: any) => s.position)} invert width={140} /></div>
                <div className="text-[11px] text-gray-500">{t.impressions} gösterim · {t.clicks} tıklama (7 gün)</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Card title="İlk sayfaya / ilk 3'e yakın" icon={Crosshair} right={<span className="text-xs text-gray-400">pozisyon 4–20</span>}>
          {d.striking.length === 0 ? <Empty>Yok</Empty> : (
            <ul className="divide-y divide-gray-100">
              {d.striking.slice(0, 12).map((r: Row) => (
                <li key={r.query} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <PosBadge pos={r.position} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{r.query}</div>
                    {r.page && <div className="truncate text-[11px] text-gray-400">{shortPath(r.page)}</div>}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{nf(r.impressions)} gösterim</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Tıklama oranı fırsatı" icon={MousePointerClick} right={<span className="text-xs text-gray-400">üst sıralarda ama az tıklanıyor</span>}>
          {d.ctrOpp.length === 0 ? <Empty>Yok ✓</Empty> : (
            <ul className="divide-y divide-gray-100">
              {d.ctrOpp.slice(0, 12).map((r: any) => (
                <li key={r.query} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <PosBadge pos={r.position} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-900">{r.query}</div>
                    <div className="text-[11px] text-gray-500">CTR {pct(r.ctr)} · beklenen {pct(r.expected, 0)} · ~{r.missed} tıklama kaçıyor</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Yeni sorgular" icon={Sparkles}>
          {d.newQueries.length === 0 ? <Empty>Yok</Empty> : (
            <ul className="divide-y divide-gray-100">{d.newQueries.slice(0, 10).map((r: Row) => (
              <li key={r.query} className="px-5 py-2 flex items-center gap-3 text-sm"><PosBadge pos={r.position} /><span className="truncate flex-1">{r.query}</span><span className="text-xs text-gray-500">{r.impressions} gösterim</span></li>
            ))}</ul>
          )}
        </Card>
        <Card title="Kaybedilen sorgular" icon={TrendingDown}>
          {d.lostQueries.length === 0 ? <Empty>Yok ✓</Empty> : (
            <ul className="divide-y divide-gray-100">{d.lostQueries.slice(0, 10).map((r: any) => (
              <li key={r.query} className="px-5 py-2 flex items-center gap-3 text-sm"><span className="truncate flex-1">{r.query}</span><span className="text-xs text-gray-500">önce {r.clicks} tıklama</span></li>
            ))}</ul>
          )}
        </Card>
      </div>

      {/* All queries */}
      <Card
        title={`Tüm sorgular (${d.rows.length})`}
        icon={Search}
        right={(
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" className="border border-gray-200 rounded-lg px-2.5 py-1 text-sm w-40" />
            <select value={device} onChange={(e) => setDevice(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
              <option value="">Tüm cihazlar</option><option value="MOBILE">Mobil</option><option value="DESKTOP">Masaüstü</option><option value="TABLET">Tablet</option>
            </select>
          </div>
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2">Sorgu</th>
                {([['clicks', 'Tıklama'], ['impressions', 'Gösterim'], ['ctr', 'CTR'], ['position', 'Pozisyon']] as const).map(([k, l]) => (
                  <th key={k} className="text-right font-medium px-3 py-2">
                    <button onClick={() => setSort(k)} className={sort === k ? 'text-primary-700 font-semibold' : ''}>{l}{sort === k ? ' ▾' : ''}</button>
                  </th>
                ))}
                <th className="text-left font-medium px-3 py-2">Sayfa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.query} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 max-w-[18rem] truncate">{r.query}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.clicks} <Delta cur={r.clicks} prev={r.prev?.clicks} abs /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{nf(r.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(r.ctr)}</td>
                  <td className="px-3 py-2 text-right"><PosBadge pos={r.position} /> {r.prev && <Delta cur={r.position} prev={r.prev.position} invert abs />}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-[14rem] truncate">{r.page ? shortPath(r.page) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
