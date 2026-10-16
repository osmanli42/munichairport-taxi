'use client';

// Rabatte-Tab: "Boş saat indirimi" — ana şalter, önümüzdeki günlerin saat saat planı
// (web + takvim) ve boşluk kurallarının hangi saatlerde devreye gireceği.
// Hesap backend'de: services/demandPace.ts → ridesNear, routes/auto-discounts.ts → /admin/gaps.

import { useCallback, useEffect, useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { autoDiscountsApi, adminApi, GapOverview } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDiscountValue } from '@/components/discount/format';

const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const weekday = (d: string) => WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const hh = (h: number) => String(h).padStart(2, '0');

export default function GapPanel({
  onTemplate, refreshKey, disabled,
}: {
  onTemplate: () => void;
  refreshKey: number;
  disabled?: boolean;
}) {
  const [data, setData] = useState<GapOverview | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await autoDiscountsApi.gaps());
      setErr('');
    } catch {
      setErr('Takvim boşlukları yüklenemedi');
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggle = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await adminApi.updateSettings({ gap_discount_enabled: data.enabled ? '0' : '1' });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Kaydedilemedi');
    }
    setSaving(false);
  };

  const enabled = !!data?.enabled;

  return (
    <div className={cn('border rounded-2xl overflow-hidden bg-white', enabled ? 'border-emerald-200' : 'border-gray-200')}>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
            enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
            <Clock size={18} className={enabled ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Boş saat indirimi (Lücken-Rabatt)</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Ana şalter — açıkken „Sadece takvimde boş saatlerde“ koşulu olan kurallar, müşterinin seçtiği
              alış saatinin çevresinde takvim boşsa devreye girer. Kapalıyken hepsi durur, diğer indirimler etkilenmez.
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
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
            <p className="text-sm font-bold text-gray-900">Takvim — saat saat</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400" /> indirim çıkar</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300" /> fahrt var</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> boş</span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-1 pb-1">
            <table className="text-xs min-w-[720px] w-full border-separate" style={{ borderSpacing: '2px' }}>
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-semibold pr-2 w-20">Gün</th>
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} className="font-normal text-center">{h % 3 === 0 ? hh(h) : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map(d => (
                  <tr key={d.date}>
                    <td className="pr-2 whitespace-nowrap text-gray-700">
                      <span className="font-semibold">{weekday(d.date)}</span> {dm(d.date)}
                      <span className="text-gray-400"> · {d.rides}</span>
                    </td>
                    {d.hours.map((n, h) => {
                      // Stunde mit Rabatt, wenn eine der beiden Halbstunden greift
                      const rule = d.slots[h * 2] || d.slots[h * 2 + 1];
                      return (
                        <td key={h}
                          title={`${hh(h)}:00–${hh(h)}:59 · ${n} fahrt${rule ? ` · ${formatDiscountValue(rule.type, rule.value, 'de')} ${rule.name}` : ''}`}
                          className={cn('h-7 rounded text-center tabular-nums font-semibold',
                            rule ? 'bg-emerald-400 text-white' : n > 0 ? 'bg-slate-300 text-slate-700' : 'bg-gray-100 text-gray-300')}>
                          {n > 0 ? n : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Hücredeki sayı = o saatte başlayan fahrt sayısı (web + takvim, gidiş ve dönüş ayrı; takvim 15 dk'da bir
            güncellenir). Yeşil = o saatte alış seçen yeni müşteri boş saat indirimini görür (kuralın saat aralığı,
            gün sınırı ve boşluk penceresine göre; Stammkunde/firma gibi müşteri koşulları ayrıca kontrol edilir).
            {!enabled && <strong className="text-gray-500"> Ana şalter kapalı: yeşil hücre yok, indirim uygulanmıyor.</strong>}
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

          <div className="flex justify-end">
            <button onClick={onTemplate}
              className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 px-3 py-1.5 rounded-lg">
              <Plus size={15} /> %7 boş saat şablonu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
