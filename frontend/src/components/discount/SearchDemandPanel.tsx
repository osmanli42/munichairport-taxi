'use client';

// Rabatte-Tab: "Arama talebi" — ziyaretçiler hangi gün ve saatler için arama yapıyor, bunların
// kaçı rezervasyona dönüyor. Kaynak: /ergebnisse sayfa görüntülemeleri (Replay ile aynı veri) +
// bookings.session_id. Seçilen dönem bir önceki eşit uzunluktaki dönemle yan yana gösterilir.

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { autoDiscountsApi, SearchStats, SearchBucket } from '@/lib/api';
import { cn } from '@/lib/utils';

const WD = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']; // 0 = Pazartesi
const WD_OF = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const weekday = (d: string) => WD_OF[new Date(`${d}T12:00:00Z`).getUTCDay()];

// Berlin "bugün" ve gün kaydırma — tarayıcı saatinden bağımsız
function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const conv = (b: SearchBucket) => (b.searches ? Math.round((b.booked / b.searches) * 1000) / 10 : null);
const pct = (v: number | null) => (v == null ? '—' : `%${v.toLocaleString('de-DE')}`);

function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return null;
  const d = Math.round(((now - prev) / prev) * 100);
  if (d === 0) return <span className="text-xs text-gray-400 ml-1">±0</span>;
  return <span className={cn('text-xs ml-1 font-semibold', d > 0 ? 'text-green-600' : 'text-red-600')}>{d > 0 ? '+' : ''}{d} %</span>;
}

export default function SearchDemandPanel({ refreshKey }: { refreshKey: number }) {
  const [days, setDays] = useState(7);
  const [cur, setCur] = useState<SearchStats | null>(null);
  const [prev, setPrev] = useState<SearchStats | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const to = berlinToday();
    const from = addDays(to, -(days - 1));
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        autoDiscountsApi.searchStats(from, to),
        autoDiscountsApi.searchStats(addDays(from, -days), addDays(from, -1)),
      ]);
      setCur(c);
      setPrev(p);
      setErr('');
    } catch {
      setErr('Arama istatistikleri yüklenemedi');
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const maxHour = cur ? Math.max(1, ...cur.byHour.map(h => h.searches)) : 1;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border bg-sky-50 border-sky-200 flex items-center justify-center flex-shrink-0">
            <Search size={18} className="text-sky-600" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Arama talebi — hangi gün ve saatler aranıyor?</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Ziyaretçilerin fiyat sayfasında seçtiği fahrt günü ve saati (Replay ile aynı veri) ve bunların kaçının
              rezervasyona döndüğü. İndirimlerin talep olan yerde mi işe yaradığını görmek için.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold border',
                days === d ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              Son {d} gün
            </button>
          ))}
        </div>
      </div>

      {err && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
      {loading && !cur && <div className="px-5 pb-5 text-sm text-gray-400">Yükleniyor…</div>}

      {cur && prev && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          <p className="text-xs text-gray-500">
            Bu dönem: <strong>{dm(cur.from)}–{dm(cur.to)}</strong> · karşılaştırma: {dm(prev.from)}–{dm(prev.to)} (önceki {days} gün)
          </p>

          {/* Özet */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Arama (gün × saat)', now: cur.totals.searches, before: prev.totals.searches },
              { label: 'Arayan ziyaretçi', now: cur.totals.sessions, before: prev.totals.sessions },
              { label: 'Rezervasyona dönen arama', now: cur.totals.booked, before: prev.totals.booked },
            ].map(k => (
              <div key={k.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{k.now}<Delta now={k.now} prev={k.before} /></p>
                <p className="text-xs text-gray-400 tabular-nums">önceki: {k.before}</p>
              </div>
            ))}
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">Dönüşüm</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{pct(conv(cur.totals))}</p>
              <p className="text-xs text-gray-400 tabular-nums">önceki: {pct(conv(prev.totals))}</p>
            </div>
          </div>

          {/* İndirim gören vs görmeyen */}
          <div className="rounded-xl border border-red-100 bg-red-50/40 px-3 py-2.5 text-sm">
            <p className="font-semibold text-gray-900 mb-1">İndirim gösterilen aramalar</p>
            <p className="text-gray-700">
              İndirim gördü: <strong>{cur.discount.shown.searches}</strong> arama → {cur.discount.shown.booked} rezervasyon
              ({pct(conv(cur.discount.shown))}) · indirim görmedi: <strong>{cur.discount.notShown.searches}</strong> →{' '}
              {cur.discount.notShown.booked} ({pct(conv(cur.discount.notShown))})
            </p>
            <p className="text-xs text-gray-400 mt-1">
              İndirim gösterimi 20.10.2026'dan itibaren kaydediliyor; daha önceki aramalar „görmedi“ tarafında sayılır.
            </p>
          </div>

          {/* Saat blokları */}
          <div>
            <p className="text-sm font-bold text-gray-900 mb-2">Alış saatine göre</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[460px]">
                <thead>
                  <tr className="text-xs text-gray-400 text-left">
                    <th className="py-1 font-semibold">Saat</th>
                    <th className="py-1 font-semibold text-right">Arama</th>
                    <th className="py-1 font-semibold text-right">Rezervasyon</th>
                    <th className="py-1 font-semibold text-right">Dönüşüm</th>
                    <th className="py-1 font-semibold text-right">Önceki dönem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cur.byBlock.map((b, i) => (
                    <tr key={b.key}>
                      <td className="py-1.5 font-semibold text-gray-700">{b.key}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.searches}<Delta now={b.searches} prev={prev.byBlock[i].searches} /></td>
                      <td className="py-1.5 text-right tabular-nums">{b.booked}</td>
                      <td className="py-1.5 text-right tabular-nums">{pct(conv(b))}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-400">{prev.byBlock[i].searches} / {prev.byBlock[i].booked} ({pct(conv(prev.byBlock[i]))})</td>
                    </tr>
                  ))}
                  <tr className="text-gray-500">
                    <td className="py-1.5">10:00 (varsayılan)</td>
                    <td className="py-1.5 text-right tabular-nums">{cur.defaultTime.searches}</td>
                    <td className="py-1.5 text-right tabular-nums">{cur.defaultTime.booked}</td>
                    <td className="py-1.5 text-right tabular-nums">{pct(conv(cur.defaultTime))}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-400">{prev.defaultTime.searches} / {prev.defaultTime.booked}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-end gap-0.5 h-24" aria-label="Saat saat aramalar">
              {cur.byHour.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${String(i).padStart(2, '0')}:00 · ${h.searches} arama · ${h.booked} rezervasyon`}>
                  <div className="w-full bg-sky-200 rounded-t relative" style={{ height: `${(h.searches / maxHour) * 100}%` }}>
                    {h.booked > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-sky-600 rounded-t"
                        style={{ height: `${(h.booked / Math.max(1, h.searches)) * 100}%` }} />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">{i % 3 === 0 ? String(i).padStart(2, '0') : ''}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Açık mavi = arama, koyu = rezervasyona dönen. Arama formunda saat varsayılan olarak 10:00; saati
              değiştirmeden bakanlar ayrı satırda, saat dağılımına katılmadı.
            </p>
          </div>

          {/* Ön süre + haftanın günü */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">Aramadan fahrt'a kaç gün</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {cur.byLead.map((b, i) => (
                    <tr key={b.key}>
                      <td className="py-1 text-gray-700">{b.key}</td>
                      <td className="py-1 text-right tabular-nums">{b.searches} / {b.booked}</td>
                      <td className="py-1 text-right tabular-nums w-16">{pct(conv(b))}</td>
                      <td className="py-1 text-right tabular-nums text-gray-400 w-20">{prev.byLead[i].searches} / {prev.byLead[i].booked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">Fahrt'ın haftanın günü</p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {cur.byWeekday.map((b, i) => (
                    <tr key={i}>
                      <td className="py-1 text-gray-700">{WD[i]}</td>
                      <td className="py-1 text-right tabular-nums">{b.searches} / {b.booked}</td>
                      <td className="py-1 text-right tabular-nums w-16">{pct(conv(b))}</td>
                      <td className="py-1 text-right tabular-nums text-gray-400 w-20">{prev.byWeekday[i].searches} / {prev.byWeekday[i].booked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-1">arama / rezervasyon · gri = önceki dönem</p>
            </div>
          </div>

          {/* Önümüzdeki günler için talep */}
          {cur.upcoming.length > 0 && (
            <div>
              <p className="text-sm font-bold text-gray-900 mb-2">Önümüzdeki 14 gün için yapılan aramalar (bu dönemde)</p>
              <div className="flex flex-wrap gap-1.5">
                {cur.upcoming.map(u => (
                  <span key={u.date} className="text-xs px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 tabular-nums">
                    <strong>{weekday(u.date)} {dm(u.date)}</strong> · {u.searches} arama · {u.booked} rez.
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Sakin gün tablosuyla birlikte oku: indirim verilen günler için gerçekten arayan var mı?
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
