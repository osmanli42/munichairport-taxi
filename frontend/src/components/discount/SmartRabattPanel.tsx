'use client';

// Rabatte-Tab: „Smart Rabatt" — tüm otomatik indirimler tek kartta. Algoritma her ziyaretçi için karar verir:
// takvim (sakin gün, boş saat) + müşterinin hareketleri (geri dönme, bekleme, çıkış…) puan toplar, puan
// sürgüdeki eşiği geçerse indirim çıkar. Hangi yüzdenin işe yaradığını kendisi öğrenir (Thompson sampling).
// Backend: services/rabattAutopilot.ts, /auto-discounts/admin/autopilot.

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import { autoDiscountsApi, AutopilotReport, AutopilotSettings } from '@/lib/api';
import { SMART_SIGNAL_LABELS, minutesToHHMM, hhmmToMinutes } from '@/components/discount/format';
import { cn } from '@/lib/utils';

const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dec2 = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rate = (g: { n: number; booked: number }) => (g.n ? `%${((g.booked / g.n) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}` : '—');
const errOf = (e: any, fb: string) => e?.response?.data?.error || e?.message || fb;

const MIN = 0.2, MAX = 0.8;
const pos = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;
const YELLOW_FROM = 0.4, RED_FROM = 0.6;
const zoneOf = (v: number) => {
  if (v >= RED_FROM) return { name: 'Kırmızı · katı', cls: 'text-red-700 bg-red-50 border-red-200', text: 'Sadece güçlü sinyalde indirim. Az kişi görür, yüzdeler düşük kalır.' };
  if (v >= YELLOW_FROM) return { name: 'Sarı · orta', cls: 'text-amber-800 bg-amber-50 border-amber-200', text: 'Boş saat ya da çok sakin gün tek başına yeter; normal saatte müşteri de kararsız görünmeli.' };
  return { name: 'Yeşil · gevşek', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', text: 'Zayıf sinyal bile yeter. Çok kişi indirim görür, yüzdeler yüksek olur, daha çok indirim boşa gidebilir.' };
};

const VEHICLE_OPTS = [{ v: 'kombi', l: 'Kombi' }, { v: 'van', l: 'Van' }, { v: 'grossraumtaxi', l: 'Großraumtaxi' }];
const DAY_OPTS = [{ v: 1, l: 'Pt' }, { v: 2, l: 'Sa' }, { v: 3, l: 'Ça' }, { v: 4, l: 'Pe' }, { v: 5, l: 'Cu' }, { v: 6, l: 'Ct' }, { v: 7, l: 'Pz' }];
const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

export default function SmartRabattPanel({ onChanged, masterEnabled }: { onChanged?: () => void; masterEnabled?: boolean }) {
  const [s, setS] = useState<AutopilotSettings | null>(null);
  const [form, setForm] = useState<AutopilotSettings | null>(null);
  const [rep, setRep] = useState<AutopilotReport | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await autoDiscountsApi.autopilot(days);
      setS(d.settings); setForm(d.settings); setRep(d.report); setErr('');
    } catch (e) { setErr(errOf(e, 'Smart Rabatt yüklenemedi')); }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<AutopilotSettings>) => {
    if (!form) return;
    setBusy(true); setErr('');
    try {
      await autoDiscountsApi.saveAutopilot({ ...form, ...patch });
      await load(); onChanged?.();
      setMsg('Kaydedildi'); setTimeout(() => setMsg(''), 2500);
    } catch (e) { setErr(errOf(e, 'Kaydedilemedi')); }
    setBusy(false);
  };

  if (!form || !s) return err ? <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">{err}</div> : null;
  const on = s.enabled;
  const dirty = JSON.stringify(form) !== JSON.stringify(s);
  const input = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white';
  const label = 'text-xs text-gray-500';
  const zone = zoneOf(form.minScore);

  // Bu eşikte ziyaretçilerin yüzde kaçı indirim hakkı kazanırdı (yeni puanlı kayıtlardan)
  const hist = rep?.scoreHist || [];
  const total = hist.reduce((a, n) => a + n, 0);
  const passing = hist.reduce((a, n, i) => a + (i >= Math.round(form.minScore * 20) ? n : 0), 0);
  const share = total >= 20 ? Math.round((passing / total) * 100) : null;

  const { vehicles, weekdays } = form;
  const audienceInvalid = (!form.zoneInside && !form.zoneOutside) || vehicles.length === 0 || weekdays.length === 0 || (form.tripFrom == null) !== (form.tripTo == null);
  const numOrNull = (v: string) => (v === '' ? null : Number(v));
  const chip = (on: boolean) => cn('text-sm font-semibold px-3 py-1.5 rounded-lg border', on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200');
  const who: string[] = [];
  if (form.excludeBusiness) who.push('firma hariç');
  if (form.excludeStamm) who.push(form.stammFrom === 1 ? 'sadece yeni müşteri' : `${form.stammFrom}+ sipariş hariç`);
  if (!form.zoneInside) who.push('Pflichtgebiet dışı');
  if (!form.zoneOutside) who.push('Pflichtgebiet içi');
  const extraCount = [form.visitorScope !== 'alle', form.source !== 'all', form.direction !== 'all', vehicles.length < 3, weekdays.length < 7,
    form.tripFrom != null, form.maxKm != null, form.maxDaysAhead != null, form.maxPerTripDate != null, form.allowFixedRoutes].filter(Boolean).length;
  if (extraCount) who.push(`${extraCount} ek koşul`);

  // Durum kontrolü: sistemin ayırt edip etmediğini ve ölçümün sağlam olup olmadığını kendisi söyler
  const health: Array<{ bad: boolean; text: string }> = [];
  if (rep) {
    const decidedN = rep.offered.n + rep.noOffer.n;
    const allN = decidedN + rep.holdout.n;
    if (on && rep.decisions24h === 0) health.push({ bad: true, text: 'Son 24 saatte hiç karar yok. Şalter açık ama sistem çalışmıyor olabilir, ya da hiç fiyat bakan olmadı.' });
    if (decidedN >= 30 && rep.offered.n / decidedN > 0.8) health.push({ bad: true, text: `Kararların %${Math.round((rep.offered.n / decidedN) * 100)}'inde indirim çıktı: neredeyse herkese veriyor, ayırt etmiyor. Sürgüyü kırmızıya doğru çek.` });
    if (decidedN >= 30 && rep.offered.n / decidedN < 0.1) health.push({ bad: false, text: `Kararların sadece %${Math.round((rep.offered.n / decidedN) * 100)}'inde indirim çıktı: çok az. Sürgüyü yeşile doğru çekebilirsin.` });
    if (allN >= 30) for (const g of rep.signals) if (g.n / allN > 0.8) health.push({ bad: true, text: `„${SMART_SIGNAL_LABELS[g.key] || g.key}" sinyali kararların %${Math.round((g.n / allN) * 100)}'inde var: herkeste olan sinyal müşteri ayırt etmez.` });
    if (rep.unlinked > 0) health.push({ bad: true, text: `${rep.unlinked} indirimli rezervasyon bir karara bağlanamadı: net kazanç eksik hesaplanıyor olabilir.` });
    if (s.weeklyBudget > 0 && rep.weekSpent >= s.weeklyBudget * 0.8) health.push({ bad: false, text: `Haftalık bütçenin %${Math.round((rep.weekSpent / s.weeklyBudget) * 100)}'i kullanıldı. Bütçe dolunca yeni indirim çıkmaz.` });
    if (s.maxDaysAhead == null) health.push({ bad: false, text: 'Uzak tarihlere gün sınırı yok. „Daha fazla koşul" içinden en fazla kaç gün sonrası verilebilir.' });
  }

  const net = rep?.net;
  const netBad = !!net && net.gain != null && net.gain < 0 && (rep?.offered.n ?? 0) >= 50 && (rep?.holdout.n ?? 0) >= 20;
  const confText = net?.confidence === 'reliable' ? 'güvenilir' : net?.confidence === 'uncertain' ? 'henüz kesin değil' : 'veri az';

  const signalToggles: Array<{ key: 'signalBehavior' | 'signalQuietDay' | 'signalGap' | 'leerEnabled'; title: string; desc: string }> = [
    { key: 'signalBehavior', title: 'Müşteri hareketi', desc: 'Geri dönme, bekleme, çıkış, tekrar gelme' },
    { key: 'signalQuietDay', title: 'Sakin gün', desc: 'Gün normalden az doluysa' },
    { key: 'signalGap', title: 'Boş saat', desc: '±2 saatte fahrt yok ya da az' },
    { key: 'leerEnabled', title: 'Leerfahrt', desc: 'Boş dönen araca yakın: sabit %10, sürgüden bağımsız' },
  ];

  return (
    <div className={cn('border rounded-2xl bg-white', on ? 'border-emerald-300' : 'border-gray-200')}>
      {/* Üst: açık mı + net kazanç */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0', on ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
            <Sparkles size={18} className={on ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900">Smart Rabatt</p>
            <p className="text-sm text-gray-500 max-w-2xl">
              Takvime ve müşterinin hareketlerine göre puan verir. Puan aşağıdaki eşiği geçerse %3–{form.maxPercent} indirim çıkar. Gösterilen indirim düşmez, sadece artabilir; araçlar dolarsa sayfa yenilenince kalkar.
              {!on && <b className="text-gray-700"> Kapalıyken eski Sakin gün ve Boş saat kuralları kendi şalterleriyle çalışır.</b>}
            </p>
          </div>
        </div>
        <button aria-label="Smart Rabatt aç/kapat" onClick={() => save({ enabled: !on })} disabled={busy}
          className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', on ? 'bg-green-500' : 'bg-gray-300', busy && 'opacity-50')}>
          <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', on ? 'translate-x-7' : 'translate-x-0.5')} />
        </button>
      </div>
      {err && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
      {masterEnabled === false && (
        <p className="mx-5 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />
          „Otomatik indirimler" ana şalteri kapalı (Diğer ayarlar). Şu an hiçbir otomatik indirim uygulanmıyor.</p>
      )}
      {netBad && (
        <p className="mx-5 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />
          Net kazanç eksi: indirim şu an getirdiğinden fazlasına mal oluyor. Sürgüyü kırmızıya doğru çekmeyi düşün. Sistem ayarı kendi değiştirmez.</p>
      )}

      {health.length > 0 && (
        <div className="mx-5 mb-3 space-y-1.5">
          {health.map((w, i) => (
            <p key={i} className={cn('text-sm rounded-lg px-3 py-2 flex gap-2 border', w.bad ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-gray-600 bg-gray-50 border-gray-200')}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />{w.text}</p>
          ))}
        </div>
      )}

      {/* Sürgü */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-gray-900">İndirim eşiği</p>
          <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border tabular-nums', zone.cls)}>{zone.name} · {dec2(form.minScore)}</span>
        </div>
        <input type="range" aria-label="İndirim eşiği" min={MIN} max={MAX} step={0.05} value={form.minScore}
          onChange={e => setForm({ ...form, minScore: Number(e.target.value) })}
          className="smart-slider w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #34d399 0%, #34d399 ${pos(YELLOW_FROM)}%, #fbbf24 ${pos(YELLOW_FROM)}%, #fbbf24 ${pos(RED_FROM)}%, #f87171 ${pos(RED_FROM)}%, #f87171 100%)` }} />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Gevşek: çok kişi</span><span>Orta</span><span>Katı: az kişi</span>
        </div>
        <p className="text-sm text-gray-700">{zone.text}</p>
        <p className="text-sm text-gray-500">
          {share != null
            ? <>Bu eşikte son {rep?.days} günde ziyaretçilerin <b className="text-gray-900">%{share}</b>'i indirim hakkı kazanırdı.</>
            : <>Kaç kişinin indirim göreceği için veri az: en az 20 yeni karar gerekli (şu an {total}).</>}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => save({})} disabled={busy || !dirty || audienceInvalid}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Kaydet</button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>
      </div>

      {/* Sonuç özeti */}
      {rep && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">Para kazandırıyor mu?</p>
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)} className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', days === d ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600')}>Son {d} gün</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Box title="Net kazanç" value={net?.gain == null ? 'veri az' : `${net.gain >= 0 ? '+' : ''}${eur(net.gain)}`}
              sub={net?.gain == null ? 'her grupta en az 20 kişi ve 1 indirimli rezervasyon gerekli' : `${confText} · ${net.extraBookings?.toLocaleString('de-DE')} ek rezervasyon − ${eur(net.discount)} indirim`}
              tone={net?.gain == null ? undefined : net.gain >= 0 ? 'good' : 'bad'} />
            <Box title="İndirim gösterilen" value={`${rep.offered.n}`} sub={`${rep.offered.booked} rezervasyon · ${rate(rep.offered)}`} />
            <Box title="Kontrol grubu (aynı puan)" value={`${rep.holdout.n}`} sub={`${rep.holdout.booked} rezervasyon · ${rate(rep.holdout)}`} />
            <Box title="Verilen indirim" value={eur(rep.discount)} sub={`${rep.bookings} rezervasyon · bu hafta ${eur(rep.weekSpent)}${s.weeklyBudget ? ` / ${eur(s.weeklyBudget)}` : ''}`} />
          </div>
          <p className="text-xs text-gray-500">
            Sadece yeni sistemin kararları sayılır. İndirim gösterilmeyen {rep.noOffer.n} kişi · araçlar dolu {rep.capacityBlocked} karar.
            {rep.offered.n + rep.noOffer.n > 0 && <> Kararların %{Math.round((rep.offered.n / (rep.offered.n + rep.noOffer.n)) * 100)}'inde indirim çıktı.</>}
          </p>
        </div>
      )}

      {/* Kimler görsün */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-gray-900">Kimler görsün</p>
          <span className="text-xs text-gray-500">{who.length ? who.join(' · ') : 'Herkes'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { on: !form.excludeBusiness, set: (v: boolean) => setForm({ ...form, excludeBusiness: !v }), title: 'Firma müşterisi', desc: 'B2B, Rechnung, daha önce firmayla rezervasyon yapan' },
            { on: !form.excludeStamm, set: (v: boolean) => setForm({ ...form, excludeStamm: !v }), title: 'Stammkunde', desc: `${form.stammFrom}+ siparişi olan müşteri` },
            { on: form.zoneInside, set: (v: boolean) => setForm({ ...form, zoneInside: v }), title: 'Pflichtgebiet içi', desc: 'Fahrt zorunlu tarife bölgesinde' },
            { on: form.zoneOutside, set: (v: boolean) => setForm({ ...form, zoneOutside: v }), title: 'Pflichtgebiet dışı', desc: 'Fahrt zorunlu tarife bölgesi dışında' },
          ].map(t => (
            <label key={t.title} className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2 cursor-pointer', t.on ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200')}>
              <input type="checkbox" className="mt-0.5" checked={t.on} onChange={e => t.set(e.target.checked)} />
              <span><span className="block text-sm font-semibold text-gray-900">{t.title}</span><span className="block text-xs text-gray-500">{t.desc}</span></span>
            </label>
          ))}
        </div>
        {!form.zoneInside && !form.zoneOutside && <p className="text-xs text-red-600">En az bir bölge seçili olmalı.</p>}
        {!form.excludeStamm ? null : (
          <div className="max-w-xs"><label className={label}>Stammkunde sayılma: kaç sipariş ve üstü (1 = sadece yeni müşteri görür)</label>
            <input type="number" min={1} max={50} className={input} value={form.stammFrom} onChange={e => setForm({ ...form, stammFrom: Number(e.target.value) })} /></div>
        )}
        <details className="group rounded-xl border border-gray-200">
          <summary className="px-3 py-2 cursor-pointer list-none flex items-center justify-between gap-3">
            <span className="min-w-0"><span className="block text-sm font-semibold text-gray-900">Daha fazla koşul</span>
              <span className="block text-xs text-gray-500">Ziyaretçi konumu, kaynak, yön, araç, gün ve saat, gün sınırı</span></span>
            <ChevronDown size={16} className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={label}>Ziyaretçi konumu (IP)</label>
                <select className={input} value={form.visitorScope} onChange={e => setForm({ ...form, visitorScope: e.target.value as AutopilotSettings['visitorScope'] })}>
                  <option value="alle">Herkes</option><option value="fern">Sadece uzak ziyaretçi</option><option value="nah">Sadece yakın ziyaretçi</option>
                </select></div>
              <div><label className={label}>Geldiği yer</label>
                <select className={input} value={form.source} onChange={e => setForm({ ...form, source: e.target.value as AutopilotSettings['source'] })}>
                  <option value="all">Hepsi</option><option value="ads">Sadece Google Ads</option><option value="other">Google Ads hariç</option>
                </select></div>
              <div><label className={label}>Yön</label>
                <select className={input} value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as AutopilotSettings['direction'] })}>
                  <option value="all">Hepsi</option><option value="to_airport">Sadece havalimanına</option><option value="from_airport">Sadece havalimanından</option>
                </select></div>
            </div>
            <div><p className={label}>Araç tipi</p>
              <div className="flex flex-wrap gap-1.5 mt-1">{VEHICLE_OPTS.map(o => (
                <button type="button" key={o.v} className={chip(vehicles.includes(o.v))} onClick={() => setForm({ ...form, vehicles: toggleIn(vehicles, o.v) })}>{o.l}</button>
              ))}</div></div>
            <div><p className={label}>Fahrt günü</p>
              <div className="flex flex-wrap gap-1.5 mt-1">{DAY_OPTS.map(o => (
                <button type="button" key={o.v} className={chip(weekdays.includes(o.v))} onClick={() => setForm({ ...form, weekdays: toggleIn(weekdays, o.v) })}>{o.l}</button>
              ))}</div></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div><label className={label}>Alış saati, başlangıç</label>
                <input type="time" className={input} value={minutesToHHMM(form.tripFrom)} onChange={e => setForm({ ...form, tripFrom: hhmmToMinutes(e.target.value) })} /></div>
              <div><label className={label}>Alış saati, bitiş</label>
                <input type="time" className={input} value={minutesToHHMM(form.tripTo)} onChange={e => setForm({ ...form, tripTo: hhmmToMinutes(e.target.value) })} /></div>
              <div><label className={label}>En fazla km</label>
                <input type="number" min={1} className={input} placeholder="sınır yok" value={form.maxKm ?? ''} onChange={e => setForm({ ...form, maxKm: numOrNull(e.target.value) })} /></div>
              <div><label className={label}>En fazla kaç gün sonrası</label>
                <input type="number" min={0} className={input} placeholder="sınır yok" value={form.maxDaysAhead ?? ''} onChange={e => setForm({ ...form, maxDaysAhead: numOrNull(e.target.value) })} /></div>
              <div><label className={label}>Fahrt gününe en fazla indirim</label>
                <input type="number" min={1} className={input} placeholder="sınır yok" value={form.maxPerTripDate ?? ''} onChange={e => setForm({ ...form, maxPerTripDate: numOrNull(e.target.value) })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowFixedRoutes} onChange={e => setForm({ ...form, allowFixedRoutes: e.target.checked })} /> Sabit fiyatlı rotalarda da indirim olsun</label>
            {form.visitorScope !== 'alle' && (
              <p className="text-xs text-gray-500">{form.visitorScope === 'nah' ? 'Sadece yakın ziyaretçi seçilince Pflicht-Tarif tabanı bu ziyaretçilerde uygulanmaz.' : 'Sadece uzak ziyaretçi seçilince Pflicht-Tarif tabanı korunur.'} Mesafe sınırı Pflichtfahrgebiet sekmesindeki IP-Bypass ayarından gelir.</p>
            )}
          </div>
        </details>
        <p className="text-xs text-gray-500">Leerfahrt %10 kendi kuralındaki koşullarla çalışır, buradaki seçimler ona uygulanmaz.</p>
        {(vehicles.length === 0 || weekdays.length === 0) && <p className="text-xs text-red-600">En az bir araç tipi ve bir gün seçili olmalı.</p>}
        {(form.tripFrom == null) !== (form.tripTo == null) && <p className="text-xs text-red-600">Alış saatinin başlangıç ve bitişini birlikte girin.</p>}
        <button onClick={() => save({})} disabled={busy || !dirty || audienceInvalid}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Kaydet</button>
      </div>

      {/* Sinyaller */}
      <div className="border-t border-gray-100 px-5 py-4 space-y-2">
        <p className="text-sm font-bold text-gray-900">Neye baksın</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {signalToggles.map(t => (
            <label key={t.key} className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2 cursor-pointer', form[t.key] ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200')}>
              <input type="checkbox" className="mt-0.5" checked={form[t.key]} onChange={e => setForm({ ...form, [t.key]: e.target.checked })} />
              <span><span className="block text-sm font-semibold text-gray-900">{t.title}</span><span className="block text-xs text-gray-500">{t.desc}</span></span>
            </label>
          ))}
        </div>
      </div>

      {/* Sınırlar */}
      <Fold title="Sınırlar ve kurallar" hint={`En fazla %${form.maxPercent} · ${form.minKm} km üstü · ${form.capacityEnabled ? `${form.capacityVehicles} araç ±${form.capacityWindow} dk` : 'doluluk kontrolü kapalı'}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={label}>En fazla indirim %</label>
            <input type="number" min={1} max={15} className={input} value={form.maxPercent} onChange={e => setForm({ ...form, maxPercent: Number(e.target.value) })} /></div>
          <div><label className={label}>En az fahrt km</label>
            <input type="number" min={0} className={input} value={form.minKm} onChange={e => setForm({ ...form, minKm: Number(e.target.value) })} /></div>
          <div><label className={label}>Haftalık bütçe € (0 = sınırsız)</label>
            <input type="number" min={0} className={input} value={form.weeklyBudget} onChange={e => setForm({ ...form, weeklyBudget: Number(e.target.value) })} /></div>
          <div><label className={label}>Kontrol grubu % (indirim görmez)</label>
            <input type="number" min={0} max={50} className={input} value={form.holdoutPct} onChange={e => setForm({ ...form, holdoutPct: Number(e.target.value) })} /></div>
          <div><label className={label}>Gidiş-dönüşte ek % (0 = çift indirim yok)</label>
            <input type="number" min={0} max={form.maxPercent} className={input} value={form.roundtripPercent} onChange={e => setForm({ ...form, roundtripPercent: Number(e.target.value) })} /></div>
          <div><label className={label}>Araç sayısı</label>
            <input type="number" min={1} max={50} className={input} value={form.capacityVehicles} onChange={e => setForm({ ...form, capacityVehicles: Number(e.target.value) })} /></div>
          <div><label className={label}>Doluluk aralığı ± dakika</label>
            <input type="number" min={5} max={240} step={5} className={input} value={form.capacityWindow} onChange={e => setForm({ ...form, capacityWindow: Number(e.target.value) })} /></div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.capacityEnabled} onChange={e => setForm({ ...form, capacityEnabled: e.target.checked })} /> Araçlar doluysa hiçbir otomatik indirim gösterme (Leerfahrt dahil)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.ignorePgFloor} onChange={e => setForm({ ...form, ignorePgFloor: e.target.checked })} /> Pflicht-Tarif altına inebilir</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.priceNotice} onChange={e => setForm({ ...form, priceNotice: e.target.checked })} /> Müşteriye „kişiselleştirilmiş fiyat" açıklamasını göster (EGBGB Art. 246a)</label>
        </div>
        {rep?.globalIgnorePgFloor && !form.ignorePgFloor && (
          <p className="text-xs text-gray-500">Not: Diğer ayarlardaki „Pflichtfahrgebiet içinde tarife tabanı" kartında taban şu an devre dışı — o kart açılmadıkça bu kutu kapalı olsa da taban uygulanmaz.</p>
        )}
        {form.ignorePgFloor && (
          <p className="text-xs text-amber-700 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Pflichtfahrgebiet içinde tarifenin altında fiyat §51 PBefG / Tarifordnung açısından risklidir; karar işletmeye aittir. İndirim yine de liste fiyatının en fazla %{form.maxPercent}'si olur.</span></p>
        )}
        {!form.priceNotice && (
          <p className="text-xs text-amber-700 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Bu açıklamayı kapatmadan önce avukata danış: otomatik kişiselleştirilmiş fiyatın müşteriye bildirilmesi gerekebilir.</span></p>
        )}
        <button onClick={() => save({})} disabled={busy || !dirty || audienceInvalid}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Kaydet</button>
      </Fold>

      {/* Son kararlar */}
      {rep && (
        <Fold title="Son kararlar" hint="Her kararın puanı, sinyalleri ve sonucu">
          {rep.recent.length === 0 ? <p className="text-sm text-gray-400">Henüz karar yok.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead><tr className="text-xs text-gray-400 text-left">
                  <th className="py-1 font-semibold">Zaman</th><th className="py-1 font-semibold">Fahrt</th><th className="py-1 font-semibold text-right">km</th><th className="py-1 font-semibold text-right">Puan</th><th className="py-1 font-semibold">Sonuç</th><th className="py-1 font-semibold">Sinyaller</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {rep.recent.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-gray-600 tabular-nums">{new Date(r.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap text-gray-600 tabular-nums">{r.tripDate ? `${r.tripDate.slice(8, 10)}.${r.tripDate.slice(5, 7)}.` : '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.km ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.score != null ? dec2(r.score) : '—'}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap font-semibold text-gray-900">
                        {r.blocked === 'capacity' ? 'Araçlar dolu' : r.holdout ? 'Kontrol' : r.percent > 0 ? `%${r.percent}` : 'Yok'}
                        {r.booking && <span className="block text-xs font-normal text-emerald-700">{r.booking}</span>}
                      </td>
                      <td className="py-1.5 text-xs text-gray-500">{r.signals.map(k => SMART_SIGNAL_LABELS[k] || k).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Fold>
      )}

      {/* Sinyal performansı */}
      {rep && (
        <Fold title="Hangi sinyal işe yarıyor" hint="Sinyal başına kişi, rezervasyon ve verilen indirim">
          {rep.signals.length === 0 ? <p className="text-sm text-gray-400">Henüz veri yok.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead><tr className="text-xs text-gray-400 text-left">
                  <th className="py-1 font-semibold">Sinyal</th><th className="py-1 font-semibold text-right">Kişi</th><th className="py-1 font-semibold text-right">Rezervasyon</th><th className="py-1 font-semibold text-right">Oran</th><th className="py-1 font-semibold text-right">İndirim</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {rep.signals.map(r => (
                    <tr key={r.key}>
                      <td className="py-1.5 text-gray-800">{SMART_SIGNAL_LABELS[r.key] || r.key}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.n}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.booked}</td>
                      <td className="py-1.5 text-right tabular-nums">{rate(r)}</td>
                      <td className="py-1.5 text-right tabular-nums">{eur(r.discount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rounded-xl border border-gray-100 p-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Yüzdeye göre (algoritma iyi olanı daha sık seçer)</p>
            {rep.levels.map(l => (
              <div key={l.percent} className="flex items-center gap-2 text-sm py-0.5">
                <span className="w-10 font-bold text-gray-900">%{l.percent}</span>
                <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${rep.offered.n ? (l.n / rep.offered.n) * 100 : 0}%` }} /></div>
                <span className="w-40 text-right text-gray-600 tabular-nums">{l.n} gösterim · {l.booked} rez. · {rate(l)}</span>
              </div>
            ))}
          </div>
        </Fold>
      )}
    </div>
  );
}

function Fold({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-gray-100">
      <summary className="px-5 py-3 cursor-pointer list-none flex items-center justify-between gap-3">
        <span className="min-w-0"><span className="block text-sm font-bold text-gray-900">{title}</span><span className="block text-xs text-gray-500">{hint}</span></span>
        <ChevronDown size={16} className="text-gray-400 flex-shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-4 space-y-3">{children}</div>
    </details>
  );
}

function Box({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 min-w-0">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900')}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}
