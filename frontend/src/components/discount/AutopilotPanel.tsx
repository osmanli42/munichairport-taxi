'use client';

// Rabatte-Tab: „Rabatt-Autopilot" — algoritma her ziyaretçi için o an karar verir (%0/3/5/7):
// sakin gün/boş saat + kararsız ziyaretçi (sipariş ihtimali modeli, tekrar gelen, yarım bırakan) →
// indirim; „zaten alacak" ve kontrol grubu → yok. Hangi seviye daha çok rezervasyon getiriyor,
// kendisi öğrenir (Thompson sampling). Backend: services/rabattAutopilot.ts, /auto-discounts/admin/autopilot.

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, AlertTriangle } from 'lucide-react';
import { autoDiscountsApi, AutopilotReport, AutopilotSettings } from '@/lib/api';
import { cn } from '@/lib/utils';

const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const rate = (g: { n: number; booked: number }) => (g.n ? `%${((g.booked / g.n) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })}` : '—');
const errOf = (e: any, fb: string) => e?.response?.data?.error || e?.message || fb;

export default function AutopilotPanel({ onChanged }: { onChanged?: () => void }) {
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
    } catch (e) { setErr(errOf(e, 'Autopilot yüklenemedi')); }
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
  const lift = rep && rep.holdout.n >= 20 && rep.offered.n >= 20
    ? (rep.offered.booked / rep.offered.n) - (rep.holdout.booked / rep.holdout.n) : null;

  return (
    <div className={cn('border rounded-2xl overflow-hidden bg-white', on ? 'border-emerald-300' : 'border-gray-200')}>
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0', on ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
            <Bot size={18} className={on ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-bold text-gray-900">Rabatt-Autopilot</p>
            <p className="text-sm text-gray-500 max-w-2xl">
              Her ziyaretçi için o an karar verir: sakin gün, boş saat ve kararsız görünen müşteriye %3–{form.maxPercent}, zaten rezervasyon
              yapacak görünene indirim yok. Hangi yüzdenin daha çok rezervasyon getirdiğini kendisi öğrenir.
              {on && <b className="text-emerald-700"> Açıkken „Ruhiger Tag" ve „Boş Saat" kuralları devre dışı</b>}
            </p>
          </div>
        </div>
        <button onClick={() => save({ enabled: !on })} disabled={busy}
          className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', on ? 'bg-green-500' : 'bg-gray-300', busy && 'opacity-50')}>
          <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', on ? 'translate-x-7' : 'translate-x-0.5')} />
        </button>
      </div>
      {err && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}

      <div className="border-t border-gray-100 px-5 py-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div><label className={label}>En fazla indirim %</label>
            <input type="number" min={1} max={15} className={input} value={form.maxPercent} onChange={e => setForm({ ...form, maxPercent: Number(e.target.value) })} /></div>
          <div><label className={label}>En az fahrt km</label>
            <input type="number" min={0} className={input} value={form.minKm} onChange={e => setForm({ ...form, minKm: Number(e.target.value) })} /></div>
          <div><label className={label}>Gidiş-dönüşte ek % (0 = çift indirim yok)</label>
            <input type="number" min={0} max={form.maxPercent} className={input} value={form.roundtripPercent} onChange={e => setForm({ ...form, roundtripPercent: Number(e.target.value) })} /></div>
          <div><label className={label}>Haftalık bütçe € (0 = sınırsız)</label>
            <input type="number" min={0} className={input} value={form.weeklyBudget} onChange={e => setForm({ ...form, weeklyBudget: Number(e.target.value) })} /></div>
          <div><label className={label}>Kontrol grubu % (indirim görmez)</label>
            <input type="number" min={0} max={50} className={input} value={form.holdoutPct} onChange={e => setForm({ ...form, holdoutPct: Number(e.target.value) })} /></div>
          <div><label className={label}>İndirim eşiği (0–0,9)</label>
            <input type="number" min={0} max={0.9} step={0.05} className={input} value={form.minScore} onChange={e => setForm({ ...form, minScore: Number(e.target.value) })} /></div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.excludeStamm} onChange={e => setForm({ ...form, excludeStamm: e.target.checked })} /> Stammkunde (2+ sipariş) hariç</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.excludeBusiness} onChange={e => setForm({ ...form, excludeBusiness: e.target.checked })} /> Firma / Rechnung hariç</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.ignorePgFloor} onChange={e => setForm({ ...form, ignorePgFloor: e.target.checked })} /> Pflicht-Tarif altına inebilir</label>
        </div>
        {rep?.globalIgnorePgFloor && !form.ignorePgFloor && (
          <p className="text-xs text-gray-500">Not: Aşağıdaki „Pflichtfahrgebiet içinde tarife tabanı" kartında taban şu an devre dışı — o kart açılmadıkça bu kutu kapalı olsa da taban uygulanmaz.</p>
        )}
        {form.ignorePgFloor && (
          <p className="text-xs text-amber-700 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Pflichtfahrgebiet içinde tarifenin altında fiyat §51 PBefG / Tarifordnung açısından risklidir; karar işletmeye aittir. İndirim yine de liste fiyatının en fazla %{form.maxPercent}'si olur.</span></p>
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => save({})} disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Ayarları kaydet</button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
        </div>

        {rep && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900">Sonuçlar</p>
              <div className="flex gap-1">
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setDays(d)} className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', days === d ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600')}>Son {d} gün</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Box title="İndirim gösterilen" value={`${rep.offered.n}`} sub={`${rep.offered.booked} rezervasyon · ${rate(rep.offered)}`} />
              <Box title="Kontrol grubu (aynı ihtiyaç)" value={`${rep.holdout.n}`} sub={`${rep.holdout.booked} rezervasyon · ${rate(rep.holdout)}`} />
              <Box title="Fark (asıl etki)" value={lift == null ? 'veri az' : `${lift >= 0 ? '+' : ''}${(lift * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} puan`}
                sub={lift == null ? 'her grupta en az 20 kişi gerekli' : lift > 0 ? 'indirim rezervasyonu artırıyor' : 'şimdilik artış yok'} tone={lift == null ? undefined : lift > 0 ? 'good' : 'bad'} />
              <Box title="Verilen indirim" value={eur(rep.discount)} sub={`${rep.bookings} rezervasyon · ${eur(rep.revenue)} ciro · bu hafta ${eur(rep.weekSpent)}${s.weeklyBudget ? ` / ${eur(s.weeklyBudget)}` : ''}`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Seviyeye göre (algoritma iyi olanı daha sık seçer)</p>
                {rep.levels.map(l => (
                  <div key={l.percent} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="w-10 font-bold text-gray-900">%{l.percent}</span>
                    <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${rep.offered.n ? (l.n / rep.offered.n) * 100 : 0}%` }} /></div>
                    <span className="w-40 text-right text-gray-600 tabular-nums">{l.n} gösterim · {l.booked} rez. · {rate(l)}</span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-2">İndirim çıkmayan (ihtiyaç düşük / zaten alacak): {rep.noOffer.n} · {rep.noOffer.booked} rez. · {rate(rep.noOffer)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">En sık karar sebepleri</p>
                {rep.reasons.length === 0 ? <p className="text-sm text-gray-400">Henüz veri yok.</p> : rep.reasons.map(r => (
                  <div key={r.reason} className="flex justify-between text-sm py-0.5"><span className="text-gray-700">{r.reason}</span><span className="text-gray-500 tabular-nums">{r.n}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Box({ title, value, sub, tone }: { title: string; value: string; sub: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <p className="text-xs text-gray-500">{title}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900')}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}
