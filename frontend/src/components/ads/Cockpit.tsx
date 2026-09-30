'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, GraduationCap, Radar, ShieldAlert, Target, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { Delta, Kpi, TrendChart, Empty } from '@/components/seo/common';
import { adsApi, API_BASE, token, eur0, eur2, num, pct1, Chip, PRIORITY, CATEGORY } from './common';

export default function Cockpit({ days, onGo }: { days: number; onGo: (tab: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [susp, setSusp] = useState<any>(null);
  const [showSusp, setShowSusp] = useState(false);

  useEffect(() => {
    setD(null);
    adsApi(`/cockpit?days=${days}`).then(setD).catch((e) => setErr(e.message));
    fetch(`${API_BASE}/admin/ads/suspicious-clicks?days=${days}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null)).then(setSusp).catch(() => {});
  }, [days]);

  if (err) return <Empty>{err}</Empty>;
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const c = d.current;
  const p = d.prev;
  const target = d.settings.targetCpa;
  const cpaTone = c.cpa == null ? 'text-gray-900' : c.cpa <= target ? 'text-emerald-700' : c.cpa <= target * 1.3 ? 'text-amber-600' : 'text-red-600';
  const pc = d.pacing;
  const tagged = d.tracking.tagged7d > 0;

  return (
    <div className="space-y-6">
      {d.guard && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-50 ring-1 ring-sky-200 px-5 py-4">
          <GraduationCap className="text-sky-600 shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-sky-900">
            <b>Öğrenme dönemi — {new Date(d.guard.until).toLocaleDateString('de-DE')}'a kadar teklif stratejisine ve bütçeye dokunma.</b>
            <div className="text-sky-800">{new Date(d.guard.day).toLocaleDateString('de-DE')} · {d.guard.campaign ? `${d.guard.campaign}: ` : ''}{d.guard.note}. Negatif kelime ve arama terimi temizliği serbest.</div>
          </div>
        </div>
      )}
      {!c.hasSpend && (
        <button onClick={() => onGo('data')} className="w-full text-left flex items-center gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4 hover:bg-amber-100">
          <Wallet className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-amber-900">Bu dönem için harcama yok — CPA, ROAS ve kâr hesaplanamıyor</div>
            <div className="text-amber-800">Google Ads'ten Kampagnen raporunu (Tag segmentli) CSV olarak yükle.</div>
          </div>
          <ArrowRight size={18} className="text-amber-700" />
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Harcama" value={c.hasSpend ? eur0(c.cost) : '—'} delta={c.hasSpend && p.hasSpend ? <Delta cur={c.cost} prev={p.cost} invert /> : undefined} sub={c.cpc ? `CPC ${eur2(c.cpc)}` : undefined} />
        <Kpi label="Reklam rezervasyonu" value={num(c.bookings)} delta={<Delta cur={c.bookings} prev={p.bookings} />} sub={`${num(c.clicks)} tık · ${pct1(c.cvr)}`} />
        <Kpi label="CPA (rezervasyon başı)" value={eur2(c.cpa)} tone={cpaTone} delta={c.cpa != null && p.cpa != null ? <Delta cur={c.cpa} prev={p.cpa} invert /> : undefined} sub={`hedef ${eur0(target)}`} />
        <Kpi label="ROAS" value={c.roas != null ? `${num(c.roas, 1)}×` : '—'} delta={c.roas != null && p.roas != null ? <Delta cur={c.roas} prev={p.roas} /> : undefined} sub="ciro ÷ harcama" />
        <Kpi label="Reklam cirosu" value={eur0(c.revenue)} delta={<Delta cur={c.revenue} prev={p.revenue} />} tone="text-emerald-700" />
        <Kpi label="Kâr (reklam sonrası)" value={c.hasSpend ? eur0(c.profit) : '—'} delta={c.hasSpend && p.hasSpend ? <Delta cur={c.profit} prev={p.profit} /> : undefined} sub={`marj %${d.settings.marginPct} varsayımı`} tone={c.profit >= 0 ? 'text-emerald-700' : 'text-red-600'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <Card title={`Son ${days} gün — ${c.hasSpend ? 'harcama ve rezervasyon' : 'reklam tıkı ve rezervasyon'}`} icon={Gauge} className="xl:col-span-2">
          <div className="p-5">
            {c.hasSpend
              ? <TrendChart data={d.series.map((s: any) => ({ ...s, cost: s.cost ?? 0 }))} a={{ key: 'cost', label: 'Harcama €', color: '#2a66aa' }} b={{ key: 'bookings', label: 'Rezervasyon', color: '#10b981' }} />
              : <TrendChart data={d.series} a={{ key: 'clicks', label: 'Reklam tıkı', color: '#2a66aa' }} b={{ key: 'bookings', label: 'Rezervasyon', color: '#10b981' }} />}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Hedef CPA" icon={Target} right={<button onClick={() => onGo('data')} className="text-xs text-primary-600 hover:underline">Değiştir</button>}>
            <div className="p-5">
              {c.cpa == null ? <div className="text-sm text-gray-500">Harcama ve rezervasyon olunca görünür.</div> : (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className={cn('text-3xl font-bold tabular-nums', cpaTone)}>{eur2(c.cpa)}</span>
                    <span className="text-sm text-gray-500">hedef {eur2(target)}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100 relative">
                    <div className={cn('h-full rounded-full', c.cpa <= target ? 'bg-emerald-500' : c.cpa <= target * 1.3 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${Math.min(100, (c.cpa / (target * 2)) * 100)}%` }} />
                    <div className="absolute top-[-3px] h-3.5 w-0.5 bg-gray-700" style={{ left: '50%' }} title="hedef" />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">{c.cpa <= target ? 'Hedefin altında ✓' : `Hedefin %${Math.round((c.cpa / target - 1) * 100)} üstünde`}</div>
                </>
              )}
            </div>
          </Card>

          <Card title={`Bütçe temposu — ${pc.month}`} icon={Wallet}>
            <div className="p-5 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums text-gray-900">{eur0(pc.spent)}</span>
                <span className="text-gray-500">{pc.budget ? `/ ${eur0(pc.budget)}` : 'aylık bütçe girilmedi'}</span>
              </div>
              {pc.budget ? (
                <>
                  <div className="mt-3 h-2 rounded-full bg-gray-100"><div className={cn('h-full rounded-full', (pc.projected ?? 0) > pc.budget * 1.1 ? 'bg-red-500' : 'bg-primary-500')} style={{ width: `${Math.min(100, (pc.spent / pc.budget) * 100)}%` }} /></div>
                  <div className="mt-2 text-xs text-gray-500">Ay sonu tahmini: <b className="text-gray-800">{eur0(pc.projected)}</b> · {pc.coveredDays}/{pc.daysInMonth} gün verisi</div>
                </>
              ) : <div className="mt-1 text-xs text-gray-500">Veri & Bağlantı → Ayarlar'dan aylık bütçe gir.</div>}
            </div>
          </Card>

          <Card title="Ölçüm sağlığı" icon={Radar}>
            <ul className="divide-y divide-gray-100 text-sm">
              <li className="px-5 py-3 flex items-center gap-2">
                {tagged ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-amber-500" />}
                <span className="flex-1">Kelime takibi (Final-URL-Suffix)</span>
                <span className="text-xs text-gray-500">{tagged ? `${d.tracking.tagged7d}/${d.tracking.clicks7d} tık` : 'kurulmadı'}</span>
              </li>
              <li className="px-5 py-3 flex items-center gap-2">
                {c.reportDays === 0 ? <AlertTriangle size={16} className="text-amber-500" />
                  : Math.abs(c.googleConv - c.bookings) / Math.max(1, c.googleConv, c.bookings) > 0.3 ? <ShieldAlert size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                <span className="flex-1">Google conversion ↔ gerçek rezervasyon</span>
                <span className="text-xs text-gray-500">{c.reportDays ? `${num(c.googleConv)} ↔ ${c.bookings}` : 'rapor yok'}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Top coach tasks */}
      <Card title="Bu hafta yapılacaklar" icon={CheckCircle2} right={<button onClick={() => onGo('coach')} className="text-xs text-primary-600 hover:underline">Tümü ({d.openTasks})</button>}>
        {d.tasks.length === 0 ? <Empty>Açık görev yok ✓</Empty> : (
          <ul className="divide-y divide-gray-100">
            {d.tasks.map((t: any) => (
              <li key={t.key}>
                <button onClick={() => onGo('coach')} className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-start gap-3">
                  <Chip className={PRIORITY[t.priority][1]}>{PRIORITY[t.priority][0]}</Chip>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-500">{CATEGORY[t.category]}{t.blockedByLearning ? ' · öğrenme dönemi bitince' : ''}</div>
                  </div>
                  {t.impact ? <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">~{eur0(t.impact)}/ay</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {susp && susp.groups?.length > 0 && (
        <Card title={`Şüpheli tıklama: ${susp.suspicious_sessions} oturum${susp.estimated_loss > 0 ? ` · ~${eur2(susp.estimated_loss)} kayıp` : ''}`} icon={ShieldAlert}
          right={<button onClick={() => setShowSusp((v) => !v)} className="text-xs text-primary-600 hover:underline">{showSusp ? 'Kapat' : 'Detay'}</button>}>
          {showSusp && (
            <div className="px-5 py-4">
              <p className="text-xs text-gray-500 mb-3">Aynı IP'den aynı gün {susp.criteria.min_sessions}+ kez, {susp.criteria.max_seconds} sn'den kısa, tek sayfalık reklam tıklaması (rezervasyona dönenler hariç). {susp.note}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Gün</th><th>Oturum</th><th>Ort. süre</th><th>Kampanya</th><th>Cihaz</th><th>Şehir</th><th>Tah. kayıp</th></tr></thead>
                  <tbody>
                    {susp.groups.slice(0, 30).map((g: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1.5 whitespace-nowrap">{g.day}</td><td>{g.sessions}</td><td>{g.avg_seconds} sn</td>
                        <td className="text-gray-600">{g.campaign || '—'}</td><td className="text-gray-600">{g.device || '—'}</td><td className="text-gray-600">{g.city || '—'}</td>
                        <td>{g.estimated_loss > 0 ? eur2(g.estimated_loss) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
