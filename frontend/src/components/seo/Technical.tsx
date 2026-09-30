'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileSearch, Gauge, Map, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { seoApi, nf, Empty, shortPath } from './common';
import Structure from './Structure';
import SiteCheck from './SiteCheck';

const SEV: Record<string, [string, string]> = {
  error: ['Hata', 'bg-red-100 text-red-700'],
  warning: ['Uyarı', 'bg-amber-100 text-amber-700'],
  notice: ['Not', 'bg-gray-100 text-gray-600'],
};

function vitalTone(v: number | null, good: number, poor: number) {
  if (v == null) return 'text-gray-400';
  return v <= good ? 'text-emerald-600' : v <= poor ? 'text-amber-600' : 'text-red-600';
}

export default function Technical() {
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { seoApi('/technical').then(setD).catch(() => setD({ open: [], resolved: [], labels: {}, audit: {}, vitals: [] })); }, []);
  useEffect(() => { load(); }, [load]);
  // While a crawl runs, refresh every 5 s.
  useEffect(() => {
    if (!d?.audit?.running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [d?.audit?.running, load]);

  const groups = useMemo(() => {
    const m = new globalThis.Map<string, any[]>();
    for (const i of d?.open || []) m.set(i.type, [...(m.get(i.type) || []), i]);
    const order = { error: 0, warning: 1, notice: 2 } as Record<string, number>;
    return Array.from(m.entries()).sort((a, b) => order[a[1][0].severity] - order[b[1][0].severity] || b[1].length - a[1].length);
  }, [d]);

  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  const last = d.audit?.last;
  const running = d.audit?.running;

  async function act(what: 'audit' | 'vitals') {
    setBusy(what);
    try { await seoApi(`/${what}`, { method: 'POST' }); } finally { setBusy(null); load(); }
  }

  return (
    <div className="space-y-6">
      <SiteCheck />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card title="Site denetimi" icon={ShieldCheck} right={(
          <button onClick={() => act('audit')} disabled={!!running || busy === 'audit'} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 disabled:opacity-50">
            <RefreshCw size={12} className={running ? 'animate-spin' : ''} /> {running ? `Taranıyor ${running.done}/${running.total}` : 'Şimdi tara'}
          </button>
        )}>
          <div className="p-5">
            {last ? (
              <>
                <div className="flex items-end gap-3">
                  <div className={cn('text-5xl font-bold tabular-nums', last.score >= 85 ? 'text-emerald-600' : last.score >= 65 ? 'text-amber-600' : 'text-red-600')}>{last.score}</div>
                  <div className="text-sm text-gray-600 pb-1">/ 100 sağlık</div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-red-50 py-2"><div className="text-lg font-bold text-red-600">{last.errors}</div><div className="text-[11px] text-red-700">Hata</div></div>
                  <div className="rounded-xl bg-amber-50 py-2"><div className="text-lg font-bold text-amber-600">{last.warnings}</div><div className="text-[11px] text-amber-700">Uyarı</div></div>
                  <div className="rounded-xl bg-gray-50 py-2"><div className="text-lg font-bold text-gray-600">{last.notices}</div><div className="text-[11px] text-gray-600">Not</div></div>
                </div>
                <div className="mt-3 text-xs text-gray-500">{last.pages} sayfa · son tarama {new Date(last.finished_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · her pazar 05:00 otomatik</div>
                {d.audit.history?.length > 1 && (
                  <div className="mt-3 flex items-end gap-1 h-10">
                    {d.audit.history.map((r: any) => <div key={r.id} title={`${r.score}`} className="flex-1 bg-primary-200 rounded-t" style={{ height: `${Math.max(8, r.score)}%` }} />)}
                  </div>
                )}
              </>
            ) : <p className="text-sm text-gray-500">{running ? `İlk tarama sürüyor… ${running.done}/${running.total}` : 'Henüz tarama yapılmadı.'}</p>}
          </div>
        </Card>

        <Card title="Mobil hız (Core Web Vitals)" icon={Gauge} className="lg:col-span-2" right={(
          <button onClick={() => act('vitals')} disabled={busy === 'vitals'} className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 disabled:opacity-50">
            <Zap size={12} /> {busy === 'vitals' ? 'Ölçülüyor…' : 'Şimdi ölç'}
          </button>
        )}>
          {d.vitals_error && (
            <div className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Ölçüm yapılamadı: {d.vitals_error}
              {/pagespeedonline|has not been used|disabled/i.test(d.vitals_error) && (
                <> — <a className="underline font-semibold" target="_blank" rel="noopener noreferrer" href={`https://console.developers.google.com/apis/api/pagespeedonline.googleapis.com/overview${(d.vitals_error.match(/project (\d+)/) || [])[1] ? `?project=${d.vitals_error.match(/project (\d+)/)[1]}` : ''}`}>PageSpeed Insights API'yi etkinleştir</a></>
              )}
            </div>
          )}
          {!d.vitals?.length ? <Empty>Henüz ölçüm yok</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr><th className="text-left font-medium px-4 py-2">Sayfa</th><th className="px-3 py-2 font-medium">Skor</th><th className="px-3 py-2 font-medium">LCP</th><th className="px-3 py-2 font-medium">CLS</th><th className="px-3 py-2 font-medium">INP (gerçek)</th><th className="px-3 py-2 font-medium">Gerçek kullanıcı</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-center">
                  {d.vitals.map((v: any) => {
                    const lcp = v.field_lcp_ms ?? v.lcp_ms;
                    const cls = v.field_cls ?? v.cls;
                    return (
                      <tr key={v.url}>
                        <td className="text-left px-4 py-2 font-medium">{shortPath(v.url)}</td>
                        <td className={cn('px-3 py-2 font-bold', vitalTone(v.score == null ? null : 100 - v.score, 10, 50))}>{v.score ?? '—'}</td>
                        <td className={cn('px-3 py-2 tabular-nums', vitalTone(lcp, 2500, 4000))}>{lcp ? `${nf(lcp / 1000, 1)} sn` : '—'}</td>
                        <td className={cn('px-3 py-2 tabular-nums', vitalTone(cls, 0.1, 0.25))}>{cls != null ? nf(Number(cls), 2) : '—'}</td>
                        <td className={cn('px-3 py-2 tabular-nums', vitalTone(v.field_inp_ms, 200, 500))}>{v.field_inp_ms ? `${v.field_inp_ms} ms` : '—'}</td>
                        <td className="px-3 py-2 text-xs">{v.field_category === 'FAST' ? '✅ hızlı' : v.field_category === 'AVERAGE' ? '🟡 orta' : v.field_category === 'SLOW' ? '🔴 yavaş' : 'veri az'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-2 text-[11px] text-gray-400">İyi: LCP ≤ 2,5 sn · CLS ≤ 0,1 · INP ≤ 200 ms. "Gerçek kullanıcı" = Chrome kullanıcılarının son 28 günü (CrUX). Her pazartesi otomatik.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Issues */}
      <Card title={`Açık sorunlar (${d.open.length})`} icon={FileSearch}>
        {groups.length === 0 ? <Empty>{last ? 'Sorun yok ✓' : 'Önce bir tarama yap'}</Empty> : (
          <ul className="divide-y divide-gray-100">
            {groups.map(([type, list]) => {
              const [label, cls] = SEV[list[0].severity] || SEV.notice;
              const isOpen = open === type;
              return (
                <li key={type}>
                  <button onClick={() => setOpen(isOpen ? null : type)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50">
                    <span className={cn('text-[11px] font-semibold rounded px-1.5 py-0.5', cls)}>{label}</span>
                    <span className="flex-1 text-sm font-medium text-gray-900">{d.labels[type] || type}</span>
                    <span className="text-sm text-gray-500 tabular-nums">{list.length}</span>
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {isOpen && (
                    <ul className="px-5 pb-3 space-y-1">
                      {list.slice(0, 200).map((i: any) => (
                        <li key={`${i.url}-${i.detail}`} className="text-xs flex gap-2">
                          <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline shrink-0 max-w-[50%] truncate">{shortPath(i.url)}</a>
                          <span className="text-gray-500 truncate">{i.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card title="Sitemap ve indeks (Google)" icon={Map}>
          {!d.gsc_connected ? <Empty>Search Console bağlanınca görünür</Empty> : (
            <div className="p-5 space-y-4 text-sm">
              {(d.sitemaps || []).map((s: any) => (
                <div key={s.path} className="flex items-center justify-between gap-3">
                  <span className="truncate">{s.path}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{s.submitted} URL · {s.errors ? <b className="text-red-600">{s.errors} hata</b> : 'hata yok'} · {s.last_downloaded ? new Date(s.last_downloaded).toLocaleDateString('de-DE') : '—'}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                {(d.inspections || []).map((r: any) => (
                  <div key={r.url} className="flex items-center gap-2 text-xs">
                    <span className={r.verdict === 'PASS' ? 'text-emerald-600' : r.verdict === 'FAIL' ? 'text-red-600' : 'text-amber-600'}>{r.verdict === 'PASS' ? '●' : '○'}</span>
                    <span className="font-medium truncate w-28">{shortPath(r.url)}</span>
                    <span className="text-gray-500 truncate">{r.error || r.coverage || '—'}{r.last_crawl ? ` · taranma ${new Date(r.last_crawl).toLocaleDateString('de-DE')}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card title="Son 30 günde çözülenler" icon={CheckCircle2}>
          {d.resolved.length === 0 ? <Empty>—</Empty> : (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {d.resolved.map((r: any, i: number) => (
                <li key={i} className="px-5 py-2 text-xs flex gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span className="font-medium">{d.labels[r.type] || r.type}</span>
                  <span className="text-gray-500 truncate">{shortPath(r.url)}</span>
                  <span className="ml-auto text-gray-400">{new Date(r.resolved_at).toLocaleDateString('de-DE')}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Structure />
    </div>
  );
}
