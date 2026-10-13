'use client';

// Rabatte-Tab: "Sakin gün indirimi" — ana şalter, önümüzdeki günlerin doluluğu ve
// son 30 günün bilançosu. Doluluk = o güne şu an kayıtlı fahrt'lar / son 8 aynı haftagününde
// aynı ön sürede kayıtlı olanların medyanı (backend services/demandPace.ts).

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { autoDiscountsApi, adminApi, DemandOverview } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDiscountValue } from '@/components/discount/format';

const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const weekday = (d: string) => WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function paceColor(pace: number | null): string {
  if (pace == null) return 'bg-gray-100 text-gray-400';
  if (pace < 0.5) return 'bg-red-100 text-red-700';
  if (pace < 0.75) return 'bg-amber-100 text-amber-800';
  return 'bg-green-100 text-green-700';
}

export default function DemandPanel({
  onTemplate, refreshKey, disabled,
}: {
  onTemplate: (tier: 7 | 4) => void;
  refreshKey: number;
  disabled?: boolean;
}) {
  const [data, setData] = useState<DemandOverview | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await autoDiscountsApi.demand());
      setErr('');
    } catch {
      setErr('Doluluk yüklenemedi');
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const saveSetting = async (key: string, value: string) => {
    setSaving(true);
    try {
      await adminApi.updateSettings({ [key]: value });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Kaydedilemedi');
    }
    setSaving(false);
  };

  const enabled = !!data?.settings.enabled;

  return (
    <div className={cn('border rounded-2xl overflow-hidden', enabled ? 'bg-white border-red-200' : 'bg-white border-gray-200')}>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
            enabled ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200')}>
            <CalendarClock size={18} className={enabled ? 'text-red-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Sakin gün indirimi (Ruhiger-Tag-Rabatt)</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Ana şalter — açıkken „Sakin gün“ koşulu olan kurallar, fahrt günü normalden az doluysa
              kendiliğinden devreye girer. Kapalıyken hepsi durur, diğer indirimler etkilenmez.
            </p>
          </div>
        </div>
        <button
          onClick={() => saveSetting('demand_discount_enabled', enabled ? '0' : '1')}
          disabled={saving || disabled || !data}
          className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', enabled ? 'bg-green-500' : 'bg-gray-300', (saving || disabled) && 'opacity-50 cursor-not-allowed')}
        >
          <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', enabled ? 'translate-x-7' : 'translate-x-0.5')} />
        </button>
      </div>

      {err && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

      {data && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-bold text-gray-900">Doluluk — önümüzdeki {data.settings.horizonDays} gün</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> &lt; %50</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> &lt; %75</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400" /> normal</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" /> sinyal yok</span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-xs text-gray-400 text-left">
                  <th className="px-1 py-1 font-semibold">Gün</th>
                  <th className="px-1 py-1 font-semibold text-right" title="Bu güne şu an sistemde ve takvimde kayıtlı fahrt sayısı">Şu an kayıtlı</th>
                  <th className="px-1 py-1 font-semibold text-right" title="Son 8 aynı haftagününde, bu kadar gün önceden kaç fahrt kayıtlıydı (ortanca)">Normalde bu zamana kadar</th>
                  <th className="px-1 py-1 font-semibold text-right">Doluluk</th>
                  <th className="px-1 py-1 font-semibold">Uygulanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.days.map(d => (
                  <tr key={d.date}>
                    <td className="px-1 py-1.5 text-gray-700 whitespace-nowrap">
                      <span className="font-semibold">{weekday(d.date)}</span> {dm(d.date)}
                    </td>
                    <td className="px-1 py-1.5 text-right tabular-nums font-semibold text-gray-900">{d.booked}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-gray-500"
                      title={`Son ${d.samples.length} aynı gün, aynı ön sürede: ${d.samples.join(', ')}`}>
                      {d.expected.toLocaleString('de-DE')}
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      <span className={cn('inline-block min-w-[3.5rem] text-center text-xs font-bold px-2 py-0.5 rounded-full tabular-nums', paceColor(d.pace))}>
                        {d.pace == null ? '—' : `%${Math.round(d.pace * 100)}`}
                      </span>
                    </td>
                    <td className="px-1 py-1.5 text-xs">
                      {d.rule
                        ? <span className="font-bold text-red-600">{formatDiscountValue(d.rule.type, d.rule.value, 'de')} · {d.rule.name}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            <strong className="text-gray-500">Şu an kayıtlı</strong> = o güne bugün itibarıyla kaç fahrt var (web + takvim,
            gidiş ve dönüş ayrı sayılır). <strong className="text-gray-500">Normalde bu zamana kadar</strong> = son 8 aynı
            haftagününe, bugünkü kadar gün önceden kaç fahrt kayıtlıydı (ortanca). Örnek: 4 gün sonraki Perşembe için,
            geçmiş Perşembelere 4 gün kala kaç fahrt vardı. Doluluk = ikisinin oranı. Normal değer {data.settings.minExpected}'den
            azsa sinyal yok sayılır ve indirim verilmez — uzak tarihler bu yüzden gri.
            {!enabled && <strong className="text-gray-500"> Ana şalter kapalı: tablo bilgi amaçlı, indirim uygulanmıyor.</strong>}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">Son 30 gün indirimli rezervasyon</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{data.stats.bookings}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">Verilen indirim</p>
              <p className="text-lg font-bold text-red-600 tabular-nums">{eur(data.stats.discount)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-500">Bu rezervasyonların cirosu</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{eur(data.stats.revenue)}</p>
            </div>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <label className="text-xs text-gray-500">
              Kaç gün ileriye bakılsın
              <input type="number" min={1} max={60} defaultValue={data.settings.horizonDays} key={`h${data.settings.horizonDays}`}
                onBlur={e => e.target.value !== String(data.settings.horizonDays) && saveSetting('demand_horizon_days', e.target.value)}
                className="mt-1 block w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-gray-500">
              Min. beklenen fahrt (sinyal eşiği)
              <input type="number" min={1} max={50} step={0.5} defaultValue={data.settings.minExpected} key={`m${data.settings.minExpected}`}
                onBlur={e => e.target.value !== String(data.settings.minExpected) && saveSetting('demand_min_expected', e.target.value)}
                className="mt-1 block w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
            </label>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button onClick={() => onTemplate(7)} title="Doluluk %50 altı · öncelik 20"
                className="flex items-center gap-1.5 text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                <Plus size={15} /> %7 şablon (çok sakin)
              </button>
              <button onClick={() => onTemplate(4)} title="Doluluk %75 altı · öncelik 10"
                className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 border border-amber-300 hover:bg-amber-50 px-3 py-1.5 rounded-lg">
                <Plus size={15} /> %4 şablon (sakin)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
