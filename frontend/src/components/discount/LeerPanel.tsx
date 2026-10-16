'use client';

// Rabatte-Tab: "Leerfahrt indirimi" — ana şalter ve önümüzdeki 3 günde boşa dönecek araçlar:
// planlı bir fahrt'ın bittiği yer ve saat, oradan alış yapan yeni müşteriye indirim penceresi.
// Hesap backend'de: services/leerfahrt.ts → vacanciesAround / leerMatch, routes/auto-discounts.ts → /admin/leer.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { autoDiscountsApi, adminApi, LeerOverview } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDiscountValue } from '@/components/discount/format';

const WD = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const weekday = (d: string) => WD[new Date(`${d}T12:00:00Z`).getUTCDay()];
const time = (w: string) => w.slice(11, 16);
const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
// Adresse kurz: Straße + Ort ohne Land
const short = (a: string) => (a || '—').replace(/,\s*(Deutschland|Germany)$/i, '').slice(0, 48);

export default function LeerPanel({
  onTemplate, refreshKey, disabled,
}: {
  onTemplate: () => void;
  refreshKey: number;
  disabled?: boolean;
}) {
  const [data, setData] = useState<LeerOverview | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await autoDiscountsApi.leer());
      setErr('');
    } catch {
      setErr('Leerfahrt listesi yüklenemedi');
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggle = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await adminApi.updateSettings({ leer_discount_enabled: data.enabled ? '0' : '1' });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Kaydedilemedi');
    }
    setSaving(false);
  };

  const enabled = !!data?.enabled;
  const open = data?.items.filter(i => !i.usedBy).length ?? 0;

  return (
    <div className={cn('border rounded-2xl overflow-hidden bg-white', enabled ? 'border-violet-200' : 'border-gray-200')}>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
            enabled ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200')}>
            <Repeat size={18} className={enabled ? 'text-violet-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Leerfahrt indirimi (boş dönüşü doldur)</p>
            <p className="text-sm text-gray-500 max-w-xl">
              Ana şalter — açıkken bir araç planlı fahrt'ı bitirip boşaldığında, o yere yakın ve kısa süre sonra
              alış isteyen yeni müşteri indirim görür. Kapalıyken hepsi durur, diğer indirimler etkilenmez.
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
            <p className="text-sm font-bold text-gray-900">
              Boşa dönecek araçlar — önümüzdeki 3 gün
              <span className="ml-2 font-normal text-gray-500">{open} açık · {data.items.length - open} dolu</span>
            </p>
            <p className="text-xs text-gray-500">
              {data.area === 'muenchen' ? `Havalimanı → München (+${data.endKm} km çevresi${data.excludePlz.length ? `, hariç ${data.excludePlz.join(', ')}` : ''}), yeni alış München'den` : 'Her yer'}
              {' · '}{data.radiusKm} km · varıştan {data.afterMin}–{data.beforeMin} dk sonra
              {data.rule ? <> · <span className="font-semibold text-violet-700">{formatDiscountValue(data.rule.type, data.rule.value, 'de')} {data.rule.name}</span></> : ' · aktif kural yok'}
            </p>
          </div>

          {data.items.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">Önümüzdeki günlerde eşleşebilecek fahrt yok.</p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
              {data.items.map((it, i) => (
                <div key={i} className="px-3 py-2.5 flex items-start gap-3 text-sm">
                  <div className="w-16 flex-shrink-0 text-gray-700">
                    <span className="font-semibold">{weekday(it.freeAt)}</span> {dm(it.freeAt)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate">
                      <span className="font-semibold tabular-nums">{time(it.start)}</span> {short(it.from)} → {short(it.to)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {it.label} · araç ~{time(it.freeAt)} boş
                      {it.usedBy && <> · <span className="text-gray-700">dolu: {time(it.usedBy.start)} {short(it.usedBy.from)} ({it.usedBy.label})</span></>}
                    </p>
                  </div>
                  <span className={cn('flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full tabular-nums',
                    it.usedBy ? 'bg-gray-100 text-gray-500' : enabled && data.rule ? 'bg-violet-100 text-violet-700' : 'bg-amber-50 text-amber-700')}>
                    {it.usedBy ? 'dolu' : `${time(it.windowFrom)}–${time(it.windowTo)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400">
            Mor saat aralığı = o araç boşaldığı yerin yakınından bu saatlerde alış isteyen yeni müşteriye indirim
            gösterilir. Bir sipariş gelince araç „dolu“ olur ve indirim kalkar. Varış saati web rezervasyonlarında
            kayıtlı süreden, takvim fahrt'larında mesafeden tahmin edilir. Adresi koordinata çevrilemeyen fahrt'lar
            listede yok.
            {!enabled && <strong className="text-gray-500"> Ana şalter kapalı: indirim uygulanmıyor.</strong>}
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
              className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 border border-violet-300 hover:bg-violet-50 px-3 py-1.5 rounded-lg">
              <Plus size={15} /> %10 Leerfahrt şablonu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
