'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, Link2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi, nf, pct, eur, Delta, Kpi, TrendChart, Empty } from './common';
import MetaCheck from './MetaCheck';
import { PositionDistribution, DeviceSplit } from './Visibility';

export default function Overview({ days, onGo }: { days: number; onGo: (tab: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    seoApi(`/overview?days=${days}`).then(setD).catch((e) => setErr(e.message));
  }, [days]);
  useEffect(() => { setD(null); load(); }, [load]);

  if (err) return <Empty>{err}</Empty>;
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const g = d.totals;
  const o = d.organic;
  const conv = (x: any) => (x.sessions ? x.bookings / x.sessions : 0);
  const audit = d.audit?.last;
  const scoreColor = (s: number) => (s >= 85 ? 'text-emerald-600' : s >= 65 ? 'text-amber-600' : 'text-red-600');

  return (
    <div className="space-y-6">
      {!d.gsc.connected && (
        <button onClick={() => onGo('connect')} className="w-full text-left flex items-center gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4 hover:bg-amber-100">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1">
            <div className="font-semibold text-amber-900">Google Search Console henüz bağlı değil</div>
            <div className="text-sm text-amber-800">Tıklama, gösterim ve gerçek Google pozisyonları için bağlantıyı kur (2 dakika).</div>
          </div>
          <ArrowRight size={18} className="text-amber-700" />
        </button>
      )}

      {/* Google Search */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700"><Search size={15} className="text-primary-500" /> Google Arama (Search Console · son {days} gün)</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Tıklama" value={g ? nf(g.current.clicks) : '—'} delta={g && <Delta cur={g.current.clicks} prev={g.previous.clicks} />} sub={g && 'önceki döneme göre'} />
          <Kpi label="Gösterim" value={g ? nf(g.current.impressions) : '—'} delta={g && <Delta cur={g.current.impressions} prev={g.previous.impressions} />} />
          <Kpi label="Tıklama oranı (CTR)" value={g ? pct(g.current.ctr) : '—'} delta={g && <Delta cur={g.current.ctr} prev={g.previous.ctr} />} />
          <Kpi label="Ort. pozisyon" value={g ? nf(g.current.position, 1) : '—'} delta={g && <Delta cur={g.current.position} prev={g.previous.position} invert abs />} sub={g && 'düşük = iyi'} />
        </div>
      </div>

      {/* Own tracking */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700"><Link2 size={15} className="text-primary-500" /> Organik ziyaretten rezervasyona (sitenin kendi verisi · son {days} gün)</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Organik ziyaret" value={nf(o.current.sessions)} delta={<Delta cur={o.current.sessions} prev={o.previous.sessions} />} />
          <Kpi label="Rezervasyon" value={nf(o.current.bookings)} delta={<Delta cur={o.current.bookings} prev={o.previous.bookings} />} tone="text-emerald-700" />
          <Kpi label="Dönüşüm oranı" value={pct(conv(o.current))} delta={<Delta cur={conv(o.current)} prev={conv(o.previous)} />} />
          <Kpi label="Organik ciro" value={eur(o.current.revenue)} delta={<Delta cur={o.current.revenue} prev={o.previous.revenue} />} tone="text-emerald-700" />
        </div>
      </div>

      {g && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2"><PositionDistribution data={d.positions} /></div>
          <DeviceSplit devices={g.devices} />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title={g ? 'Tıklama ve gösterim — 90 gün' : 'Organik ziyaret ve rezervasyon — 90 gün'} icon={Search} className="xl:col-span-2">
          <div className="p-5">
            {g
              ? <TrendChart data={g.series} a={{ key: 'clicks', label: 'Tıklama', color: '#2a66aa' }} b={{ key: 'impressions', label: 'Gösterim', color: '#94a3b8' }} />
              : <TrendChart data={o.series} a={{ key: 'sessions', label: 'Organik ziyaret', color: '#2a66aa' }} b={{ key: 'bookings', label: 'Rezervasyon', color: '#10b981' }} />}
            {o.engines?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {o.engines.map((e: any) => (
                  <span key={e.engine} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{e.engine}: <b>{e.sessions}</b> ziyaret · {e.bookings} rez.</span>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Site sağlığı" icon={Gauge} right={<button onClick={() => onGo('technical')} className="text-xs text-primary-600 hover:underline">Detay</button>}>
            <div className="p-5">
              {audit ? (
                <div className="flex items-center gap-4">
                  <div className={cn('text-4xl font-bold tabular-nums', scoreColor(audit.score))}>{audit.score}</div>
                  <div className="text-sm">
                    <div><b className="text-red-600">{audit.errors}</b> hata · <b className="text-amber-600">{audit.warnings}</b> uyarı · <b className="text-gray-600">{audit.notices}</b> not</div>
                    <div className="text-xs text-gray-500">{audit.pages} sayfa · {new Date(audit.finished_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                    {d.audit.previous && <Delta cur={audit.score} prev={d.audit.previous.score} abs suffix="önceki taramaya göre" />}
                  </div>
                </div>
              ) : <div className="text-sm text-gray-500">{d.audit?.running ? `Tarama sürüyor… ${d.audit.running.done}/${d.audit.running.total}` : 'Henüz tarama yok'}</div>}
              {d.vitals?.length > 0 && (
                <div className="mt-4 space-y-1">
                  <div className="text-xs font-semibold text-gray-500">Mobil hız (PageSpeed)</div>
                  {d.vitals.map((v: any) => (
                    <div key={v.url} className="flex items-center justify-between text-xs">
                      <span className="truncate text-gray-600">{new URL(v.url).pathname}</span>
                      <span className={cn('font-bold tabular-nums', v.score >= 90 ? 'text-emerald-600' : v.score >= 50 ? 'text-amber-600' : 'text-red-600')}>{v.score ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card title="Bu hafta yapılacaklar" icon={CheckCircle2} right={<button onClick={() => onGo('tasks')} className="text-xs text-primary-600 hover:underline">Tümü</button>}>
            {d.tasks.length === 0 ? <Empty>Açık görev yok ✓</Empty> : (
              <ul className="divide-y divide-gray-100">
                {d.tasks.map((t: any) => (
                  <li key={t.key} className="px-5 py-3">
                    <button onClick={() => onGo('tasks')} className="text-left w-full">
                      <div className="text-sm font-medium text-gray-900">{t.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">{t.detail}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <MetaCheck />
    </div>
  );
}
