'use client';

// Kaufwahrscheinlichkeit in der Live-Ansicht — Backend: services/conversionModel.ts
import { useCallback, useEffect, useState } from 'react';
import { Brain, ChevronDown, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

export interface LivePrediction {
  p: number;
  factors: { label: string; impact: number }[];
  price: number | null;
}

export function heat(p: number): { label: string; ring: string; text: string; bg: string } {
  if (p >= 0.4) return { label: 'Sıcak', ring: '#f97316', text: 'text-orange-700', bg: 'bg-orange-50' };
  if (p >= 0.12) return { label: 'Ilık', ring: '#eab308', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { label: 'Soğuk', ring: '#94a3b8', text: 'text-slate-500', bg: 'bg-slate-50' };
}

export function fmtPct(p: number): string {
  const v = p * 100;
  if (v < 1) return '<1';
  if (v > 99) return '>99';
  return v < 10 ? v.toFixed(1).replace('.', ',') : String(Math.round(v));
}

/** Kreisanzeige der Wahrscheinlichkeit, mit Trend gegenüber der letzten Aktualisierung. */
export function ProbabilityRing({ p, delta, booked }: { p: number | null; delta?: number; booked?: boolean }) {
  const size = 64, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  if (booked) {
    return (
      <div className="w-16 h-16 rounded-full bg-emerald-500 text-white grid place-items-center shadow-sm shadow-emerald-200 shrink-0" title="Bu ziyarette rezervasyon yaptı">
        <span className="text-[11px] font-bold leading-tight text-center">Rezer-<br />vasyon ✓</span>
      </div>
    );
  }
  if (p == null) {
    return (
      <div className="w-16 h-16 rounded-full border-[6px] border-slate-100 grid place-items-center shrink-0" title="Model henüz yok">
        <span className="text-xs text-slate-300">—</span>
      </div>
    );
  }
  const h = heat(p);
  return (
    <div className="relative w-16 h-16 shrink-0" title={`Tahmini sipariş ihtimali: %${fmtPct(p)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={h.ring} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, Math.min(1, p)))}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div className={`text-[15px] font-black tabular-nums ${h.text}`}>%{fmtPct(p)}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">{h.label}</div>
        </div>
      </div>
      {delta != null && Math.abs(delta) >= 0.03 && (
        <span className={`absolute -right-1 -top-1 rounded-full px-1 py-0.5 text-[9px] font-bold text-white shadow ${delta > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        </span>
      )}
    </div>
  );
}

/** Die stärksten Gründe für die Prognose (+ grün, − rot). */
export function FactorChips({ factors }: { factors: LivePrediction['factors'] }) {
  if (!factors?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {factors.map((f, i) => (
        <span
          key={i}
          className={`text-[10.5px] px-1.5 py-0.5 rounded-md font-medium ${f.impact > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
          title={`Etki: ${f.impact > 0 ? '+' : ''}${f.impact}`}
        >
          {f.impact > 0 ? '▲' : '▼'} {f.label}
        </span>
      ))}
    </div>
  );
}

interface ModelInfo {
  trained_at: string; days: number; n: number; positives: number; base_rate: number;
  auc: number | null; auc_engaged: number | null; test_n: number;
  calibration: { bucket: string; n: number; predicted: number; actual: number }[];
  weights: { key: string; weight: number }[];
}

const FEATURE_TR: Record<string, string> = {
  saw_prices: 'Fiyatları gördü', opened_form: 'Formu açtı', form_fields: 'Doldurduğu alan sayısı', card_fields: 'Kart alanına girdi',
  search_used: 'Adres aradı', pageviews: 'Sayfa sayısı', minutes: 'Süre', clicks: 'Tıklama sayısı', max_scroll: 'Kaydırma',
  ads: 'Google Ads', organic: 'Google arama', mobile: 'Telefon', returning: 'Tekrar gelen', past_customer: 'Eski müşteri',
  foreign: 'Yurt dışı', price_high: 'Fiyat 120 €+', price_low: 'Fiyat ≤60 €', km_long: '60 km+', same_day: 'Aynı gün',
  next_day: 'Ertesi gün', far_date: '14+ gün sonra', roundtrip: 'Gidiş-dönüş', call_click: 'Telefon tıklaması',
  errors: 'Hata', compare: 'Karşılaştırma',
};

/** Modell-Info: Güte (AUC, Kalibrierung), wichtigste Signale, „jetzt neu trainieren“. */
export function ModelInfoCard({ token, apiBase }: { token: string; apiBase: string }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<ModelInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/admin/conversion-model`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setM(d.model || null);
    } catch { /* ignore */ }
  }, [apiBase, token]);
  useEffect(() => { load(); }, [load]);

  const train = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${apiBase}/admin/conversion-model/train`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.detail || 'Hata');
      setM(d.model);
    } catch (e: any) {
      setErr(e.message || 'Eğitim başarısız');
    } finally { setBusy(false); }
  };

  const maxW = Math.max(0.01, ...(m?.weights || []).map(w => Math.abs(w.weight)));
  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-slate-50">
        <Brain size={16} className="text-violet-600" />
        <span className="font-semibold text-sm">Tahmin modeli</span>
        {m ? (
          <span className="text-xs text-slate-500">
            · {m.n.toLocaleString('de-DE')} ziyaret · {m.positives} rezervasyon · isabet (AUC) {m.auc_engaged != null ? `%${Math.round(m.auc_engaged * 100)}` : '—'}
            · {new Date(m.trained_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        ) : <span className="text-xs text-amber-600">· henüz eğitilmedi (gece otomatik, ya da şimdi başlat)</span>}
        <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Her gece son {m?.days ?? 120} günün ziyaretlerinden öğrenir: hangi davranış rezervasyonla bitti, hangisi bitmedi.
              Canlıdaki her ziyaretçiye o ana kadarki davranışına göre bir yüzde verir. Rezervasyon yapanların sadece
              <b> rezervasyondan önceki</b> davranışları sayılır.
            </p>
            {m && (
              <>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-xl bg-slate-50 py-2"><div className="text-lg font-bold tabular-nums">%{(m.base_rate * 100).toFixed(1).replace('.', ',')}</div><div className="text-[10px] text-slate-500">ortalama dönüşüm</div></div>
                  <div className="rounded-xl bg-slate-50 py-2"><div className="text-lg font-bold tabular-nums">{m.auc != null ? `%${Math.round(m.auc * 100)}` : '—'}</div><div className="text-[10px] text-slate-500">isabet · tüm ziyaretler</div></div>
                  <div className="rounded-xl bg-slate-50 py-2"><div className="text-lg font-bold tabular-nums">{m.auc_engaged != null ? `%${Math.round(m.auc_engaged * 100)}` : '—'}</div><div className="text-[10px] text-slate-500">isabet · fiyat görenler</div></div>
                </div>
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">Kalibrasyon (görmediği dönemde)</div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-400 text-left"><th className="font-medium py-0.5">Tahmin aralığı</th><th className="font-medium text-right">Ziyaret</th><th className="font-medium text-right">Ort. tahmin</th><th className="font-medium text-right">Gerçek</th></tr></thead>
                    <tbody>
                      {m.calibration.filter(c => c.n > 0).map(c => (
                        <tr key={c.bucket} className="border-t border-slate-100">
                          <td className="py-1">{c.bucket}</td>
                          <td className="text-right tabular-nums">{c.n}</td>
                          <td className="text-right tabular-nums">%{(c.predicted * 100).toFixed(1).replace('.', ',')}</td>
                          <td className="text-right tabular-nums font-semibold">%{(c.actual * 100).toFixed(1).replace('.', ',')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <button onClick={train} disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Şimdi yeniden eğit
            </button>
            {err && <div className="text-xs text-rose-600 mt-1">{err}</div>}
          </div>
          {m && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase mb-2">En etkili sinyaller</div>
              <div className="space-y-1">
                {m.weights.slice(0, 14).map(w => (
                  <div key={w.key} className="grid grid-cols-[130px_1fr_40px] items-center gap-2 text-xs">
                    <span className="text-slate-600 truncate">{FEATURE_TR[w.key] || w.key}</span>
                    <span className="relative h-2 bg-slate-100 rounded-full">
                      <span className={`absolute top-0 h-2 rounded-full ${w.weight >= 0 ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-rose-400'}`}
                        style={{ width: `${(Math.abs(w.weight) / maxW) * 50}%` }} />
                      <span className="absolute left-1/2 top-[-2px] w-px h-3 bg-slate-300" />
                    </span>
                    <span className={`text-right tabular-nums ${w.weight >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{w.weight > 0 ? '+' : ''}{w.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
