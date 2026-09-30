'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, KeyRound, Scissors, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { Empty } from '@/components/seo/common';
import { adsApi, eur0, eur2, num, pct1, Chip, CopyBox } from './common';

const MT: Record<string, string> = { exact: 'Genau', phrase: 'Wortgruppe', broad: 'Weitgehend' };

export default function Keywords({ days, onGo }: { days: number; onGo: (t: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyWaste, setOnlyWaste] = useState(false);
  useEffect(() => { setD(null); adsApi(`/keywords?days=${days}`).then(setD).catch((e) => setErr(e.message)); }, [days]);

  const terms = useMemo(() => {
    const list = d?.searchTerms?.terms || [];
    return list.filter((t: any) => (!q || t.term.includes(q.toLowerCase())) && (!onlyWaste || (t.conversions === 0 && t.cost > 0)));
  }, [d, q, onlyWaste]);

  if (err) return <Empty>{err}</Empty>;
  if (!d) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;

  const st = d.searchTerms;
  const irrelevant = (st.terms || []).filter((t: any) => t.irrelevant && !/ausgeschlossen|excluded/i.test(t.added || ''));
  const zeroConvGrams = (st.ngrams || []).filter((g: any) => g.conversions === 0 && g.cost > 0).slice(0, 12);

  return (
    <div className="space-y-6">
      {d.trackedClicks === 0 && (
        <button onClick={() => onGo('data')} className="w-full text-left rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4 text-sm hover:bg-amber-100">
          <b className="text-amber-900">Kelime başına gerçek rezervasyon için Final-URL-Suffix gerekli.</b>
          <span className="text-amber-800"> Şu an {num(d.totalClicks)} reklam tıkının hiçbiri kelime bilgisi taşımıyor. Kurulum 1 dakika → Veri & Bağlantı</span>
        </button>
      )}

      <Card title="Anahtar kelimeler" icon={KeyRound} right={<span className="text-xs text-gray-400">{d.report ? `Keywords raporu: ${d.report.period_from || '?'} – ${d.report.period_to || '?'}` : 'Keywords raporu yüklenmedi'}</span>}>
        {d.keywords.length === 0 ? <Empty>Keywords raporu yüklenince ve/veya kelime takibi aktif olunca görünür.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-2.5">Kelime</th><th className="px-2">Eşleme</th>
                  <th className="px-2 text-right" title="Qualitätsfaktor">QF</th>
                  <th className="px-2 text-right">Harcama</th><th className="px-2 text-right">Tık</th><th className="px-2 text-right">CPC</th>
                  <th className="px-2 text-right">Gösterim payı</th><th className="px-2 text-right">Google conv.</th>
                  <th className="px-2 text-right" title="Suffix ile ölçülen gerçek rezervasyon">Gerçek rez.</th><th className="px-2 text-right">Ciro</th><th className="px-5 text-right">CPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.keywords.map((k: any) => (
                  <tr key={`${k.keyword}-${k.matchType}`} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 font-medium text-gray-900">{k.keyword}<div className="text-[11px] font-normal text-gray-400">{k.campaign || ''}{k.adGroup ? ` › ${k.adGroup}` : ''}</div></td>
                    <td className="px-2 text-xs text-gray-600">{MT[k.matchType] || k.matchType || '—'}</td>
                    <td className={cn('px-2 text-right tabular-nums font-semibold', k.quality == null ? 'text-gray-300' : k.quality >= 7 ? 'text-emerald-600' : k.quality >= 5 ? 'text-amber-600' : 'text-red-600')}>{k.quality ?? '—'}</td>
                    <td className="px-2 text-right tabular-nums">{k.cost ? eur0(k.cost) : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{k.reportClicks || k.clicks || '—'}</td>
                    <td className="px-2 text-right tabular-nums">{eur2(k.cpc)}</td>
                    <td className="px-2 text-right tabular-nums">{k.impr_share != null ? `%${num(k.impr_share, 0)}` : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{k.googleConv ? num(k.googleConv, 1) : '—'}</td>
                    <td className="px-2 text-right tabular-nums font-semibold">{k.clicks ? k.bookings : '—'}</td>
                    <td className="px-2 text-right tabular-nums text-emerald-700">{k.revenue ? eur0(k.revenue) : '—'}</td>
                    <td className="px-5 text-right tabular-nums">{eur2(k.cpa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d.matchTypes.length > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2 text-xs">
            {d.matchTypes.map((m: any) => (
              <span key={m.matchType} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                {MT[m.matchType] || m.matchType}: <b>{eur0(m.cost)}</b> · {num(m.googleConv, 1)} conv. · CPA {m.googleConv ? eur2(m.cost / m.googleConv) : '—'}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <Card title="Negatif kelime adayları" icon={Ban}>
          {!st.report ? <Empty>Suchbegriffe raporu yüklenince görünür.</Empty> : (
            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-500">Taksi rezervasyonuyla ilgisiz aramalar ({irrelevant.length})</div>
                {irrelevant.length === 0 ? <div className="text-sm text-gray-400 mt-1">Yok ✓</div> : (
                  <CopyBox text={irrelevant.map((t: any) => `[${t.term}]`).join('\n')} />
                )}
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">Para harcayıp hiç conversion getirmeyen kelime grupları</div>
                {zeroConvGrams.length === 0 ? <div className="text-sm text-gray-400 mt-1">Yok ✓</div> : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {zeroConvGrams.map((g: any) => (
                      <li key={g.gram} className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">„{g.gram}“ <span className="text-xs text-gray-400">{g.terms} arama</span></span>
                        <span className="text-xs tabular-nums text-red-600 font-semibold">{eur2(g.cost)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-[11px] text-gray-400">Google Ads → Keywords → Auszuschließende Keywords → + → yapıştır. Önce listeyi gözden geçir.</div>
            </div>
          )}
        </Card>

        <Card title="Kelime grupları (n-gram) — para nereye gidiyor" icon={Scissors}>
          {!st.ngrams?.length ? <Empty>Suchbegriffe raporu yüklenince görünür.</Empty> : (
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {st.ngrams.slice(0, 25).map((g: any) => (
                <li key={g.gram} className="px-5 py-2 flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate text-gray-800">{g.gram}</span>
                  <span className="text-xs text-gray-400">{g.terms} arama</span>
                  <span className="w-16 text-right tabular-nums text-xs">{eur0(g.cost)}</span>
                  <span className={cn('w-16 text-right tabular-nums text-xs font-semibold', g.conversions ? 'text-emerald-600' : 'text-red-500')}>{num(g.conversions, 1)} conv.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Arama terimleri" icon={Search} right={
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={onlyWaste} onChange={(e) => setOnlyWaste(e.target.checked)} /> sadece conversion'suz</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…" className="w-40 rounded-lg border border-gray-200 px-2.5 py-1 text-sm" />
        </div>
      }>
        {!st.report ? <Empty>Google Ads → Keywords → Suchbegriffe → Herunterladen (CSV) → Veri & Bağlantı'dan yükle.</Empty> : (
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-5 py-2.5">Arama terimi</th><th className="px-2">Kelime</th><th className="px-2 text-right">Tık</th>
                  <th className="px-2 text-right">Harcama</th><th className="px-2 text-right">Conv.</th><th className="px-2 text-right">CPA</th><th className="px-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {terms.slice(0, 300).map((t: any, i: number) => (
                  <tr key={`${t.term}-${i}`} className="hover:bg-gray-50">
                    <td className="px-5 py-2 text-gray-900">{t.term}</td>
                    <td className="px-2 text-xs text-gray-500">{t.keyword || '—'}{t.matchType ? ` · ${MT[t.matchType] || t.matchType}` : ''}</td>
                    <td className="px-2 text-right tabular-nums">{t.clicks}</td>
                    <td className="px-2 text-right tabular-nums">{eur2(t.cost)}</td>
                    <td className={cn('px-2 text-right tabular-nums font-semibold', t.conversions ? 'text-emerald-600' : 'text-gray-400')}>{num(t.conversions, 1)}</td>
                    <td className="px-2 text-right tabular-nums">{t.conversions ? eur2(t.cost / t.conversions) : '—'}</td>
                    <td className="px-5 text-right">
                      {/ausgeschlossen|excluded/i.test(t.added || '') ? <Chip className="bg-gray-100 text-gray-500">hariç</Chip>
                        : t.irrelevant ? <Chip className="bg-red-100 text-red-700" title={`„${t.irrelevant}“ içeriyor`}>negatif yap</Chip>
                        : t.conversions >= 1 && !/hinzugefügt|added/i.test(t.added || '') ? <Chip className="bg-emerald-100 text-emerald-700">kelime ekle</Chip>
                        : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2 text-[11px] text-gray-400">{terms.length} terim · {pct1(terms.length ? terms.filter((t: any) => !t.conversions).length / terms.length : 0)} conversion'suz</div>
          </div>
        )}
      </Card>
    </div>
  );
}
