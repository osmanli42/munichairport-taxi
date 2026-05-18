'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  Users, CalendarCheck, Percent, Euro, Target, MousePointerClick,
  Wallet, TrendingUp as RoasIcon, Coins, Clock, MapPin, CalendarDays,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface Kpi { value: number; prev: number; change: number | null }
interface DailyPoint { date: string; visitors: number; bookings: number; revenue: number }
interface Campaign { name: string; visitors: number; bookings: number; revenue: number; cvr: number }
interface DeviceRow { name: string; visitors: number; bookings: number; cvr: number }
interface GeoRow { name: string; visitors: number; bookings: number; cvr: number }
interface Alert { severity: 'high' | 'medium' | 'low'; title: string; detail: string }
interface Recommendation { priority: 'high' | 'medium' | 'low'; title: string; detail: string }
interface ScorePart { key: string; weight: number; points: number }
interface HourPoint { hour: number; visitors: number; bookings: number }
interface WeekdayPoint { weekday: number; label: string; visitors: number; bookings: number }

interface AdsData {
  generatedAt: string;
  preset: string | null;
  days: number;
  isHourly: boolean;
  hasData: boolean;
  score: number | null;
  scoreBreakdown: ScorePart[];
  kpis: {
    visitors: Kpi; bookings: Kpi; cvr: Kpi; revenue: Kpi; avgValue: Kpi; bounceRate: Kpi;
  };
  cost: {
    hasSpend: boolean;
    spend: Kpi;
    cpa: { value: number | null; prev: number | null };
    roas: { value: number | null; prev: number | null };
    profit: Kpi;
  };
  adShare: number;
  totalBookings: number;
  daily: DailyPoint[];
  campaigns: Campaign[];
  devices: DeviceRow[];
  geo: { countries: GeoRow[]; cities: GeoRow[] };
  dayparting: { byHour: HourPoint[]; byWeekday: WeekdayPoint[] };
  comparison: {
    ad: { visitors: number; bookings: number; cvr: number };
    organic: { visitors: number; bookings: number; cvr: number };
  };
  conversionLag: { sampleSize: number; avgHours: number | null; buckets: { label: string; count: number }[] };
  alerts: Alert[];
  recommendations: Recommendation[];
}

type Preset = 'today' | 'yesterday' | '7' | '30' | '90';
const PRESET_LABELS: Record<Preset, string> = {
  today: 'Bugün', yesterday: 'Dün', '7': '7 gün', '30': '30 gün', '90': '90 gün',
};

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  if (p === 'today') return { from: localDateStr(now), to: localDateStr(now) };
  if (p === 'yesterday') {
    const y = new Date(now.getTime() - 86400000);
    return { from: localDateStr(y), to: localDateStr(y) };
  }
  const n = parseInt(p, 10);
  return { from: localDateStr(new Date(now.getTime() - (n - 1) * 86400000)), to: localDateStr(now) };
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Sağlıklı' : score >= 50 ? 'Dikkat' : 'Zayıf';
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${2 * Math.PI * 40}`}
          strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
          strokeLinecap="round" transform="rotate(-90 50 50)" />
        <text x="50" y="47" textAnchor="middle" fontSize="24" fontWeight="bold" fill={color}>{score}</text>
        <text x="50" y="63" textAnchor="middle" fontSize="10" fill="#6b7280">{label}</text>
      </svg>
    </div>
  );
}

function Delta({ change, goodWhenUp = true }: { change: number | null; goodWhenUp?: boolean }) {
  if (change === null || change === undefined) return <span className="text-xs text-gray-400">— yeni</span>;
  if (change === 0) return <span className="text-xs text-gray-400">±0%</span>;
  const up = change > 0;
  const good = goodWhenUp ? up : !up;
  const color = good ? 'text-green-600' : 'text-red-600';
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${color}`}>
      <Icon size={12} />{up ? '+' : ''}{change}%
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, suffix, kpi, goodWhenUp = true, accent,
}: {
  icon: any; label: string; value: string; suffix?: string; kpi?: Kpi; goodWhenUp?: boolean; accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>
        {value}<span className="text-base font-medium text-gray-400">{suffix}</span>
      </div>
      {kpi && <div className="mt-1"><Delta change={kpi.change} goodWhenUp={goodWhenUp} /></div>}
    </div>
  );
}

function TrendChart({ daily, isHourly }: { daily: DailyPoint[]; isHourly?: boolean }) {
  if (!daily.length) return <div className="text-sm text-gray-400">Veri yok</div>;
  const w = 760, h = 180, padL = 8, padB = 22;
  const maxV = Math.max(...daily.map((d) => d.visitors), 1);
  const maxB = Math.max(...daily.map((d) => d.bookings), 1);
  const barW = (w - padL * 2) / daily.length;
  const innerH = h - padB;
  const labelEvery = Math.ceil(daily.length / (isHourly ? 6 : 10));
  const xLabel = (d: DailyPoint) => isHourly ? d.date : d.date.slice(5);
  const linePts = daily.map((d, i) => {
    const x = padL + i * barW + barW / 2;
    return `${x},${innerH - (d.bookings / maxB) * (innerH - 10)}`;
  }).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" className="block" style={{ height: 'auto' }}>
        {daily.map((d, i) => {
          const bh = (d.visitors / maxV) * (innerH - 10);
          return (
            <rect key={d.date} x={padL + i * barW + 1} y={innerH - bh}
              width={Math.max(barW - 2, 1)} height={bh} fill="#bfdbfe" rx="1">
              <title>{d.date}: {d.visitors} ziyaretçi, {d.bookings} rezervasyon, {d.revenue}€</title>
            </rect>
          );
        })}
        <polyline points={linePts} fill="none" stroke="#16a34a" strokeWidth="2" />
        {daily.map((d, i) => (
          <circle key={d.date} cx={padL + i * barW + barW / 2}
            cy={innerH - (d.bookings / maxB) * (innerH - 10)} r="2.5" fill="#16a34a" />
        ))}
        {daily.map((d, i) => (
          i % labelEvery === 0 ? (
            <text key={d.date} x={padL + i * barW + barW / 2} y={h - 6}
              textAnchor="middle" fontSize="9" fill="#9ca3af">{xLabel(d)}</text>
          ) : null
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-gray-500 mt-1">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-blue-200 inline-block rounded-sm" /> Reklam ziyaretçisi</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-0.5 bg-green-600 inline-block" /> Rezervasyon</span>
      </div>
    </div>
  );
}

// Compact vertical bar chart for dayparting (hours / weekdays).
function DaypartChart({ data }: { data: { label: string; visitors: number; bookings: number }[] }) {
  const maxV = Math.max(...data.map((d) => d.visitors), 1);
  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d, i) => {
        const hPct = (d.visitors / maxV) * 100;
        const converted = d.bookings > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.visitors} ziyaretçi, ${d.bookings} rezervasyon`}>
            <div className="w-full rounded-sm" style={{
              height: `${Math.max(hPct, d.visitors > 0 ? 4 : 0)}%`,
              background: converted ? '#16a34a' : '#bfdbfe',
            }} />
            <span className="text-[8px] text-gray-400 mt-0.5 leading-none">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const SEV_STYLE: Record<string, string> = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
};

function MiniTable({ title, rows, firstCol }: {
  title: string; firstCol: string; rows: { name: string; visitors: number; bookings: number; cvr: number }[];
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-sm font-semibold text-gray-700 mb-2">{title}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 text-left">
            <th className="py-1">{firstCol}</th>
            <th className="text-right">Ziy.</th>
            <th className="text-right">Rez.</th>
            <th className="text-right">Dönüşüm</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-2">Veri yok</td></tr>}
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-gray-100">
              <td className="py-1.5 text-gray-700 truncate max-w-[140px]" title={r.name}>{r.name}</td>
              <td className="text-right">{r.visitors}</td>
              <td className="text-right">{r.bookings}</td>
              <td className="text-right">%{r.cvr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdsTab({ token }: { token: string }) {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState<Preset>('30');

  // Spend form state
  const [spendOpen, setSpendOpen] = useState(false);
  const [spendFrom, setSpendFrom] = useState('');
  const [spendTo, setSpendTo] = useState('');
  const [spendTotal, setSpendTotal] = useState('');
  const [spendSaving, setSpendSaving] = useState(false);
  const [spendMsg, setSpendMsg] = useState('');

  // CSV import state
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMsg, setCsvMsg] = useState('');

  const load = useCallback(async (p: Preset) => {
    setLoading(true);
    setError('');
    try {
      const isDay = p === 'today' || p === 'yesterday';
      const url = isDay
        ? `${API_BASE}/admin/ads/overview?preset=${p}`
        : `${API_BASE}/admin/ads/overview?days=${p}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(`Sunucu hatası (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(preset); }, [load, preset]);

  // Default spend form range to the selected period.
  useEffect(() => {
    const r = presetRange(preset);
    setSpendFrom(r.from);
    setSpendTo(r.to);
  }, [preset]);

  async function saveSpend() {
    setSpendSaving(true);
    setSpendMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/ads/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from: spendFrom, to: spendTo, total: parseFloat(spendTotal) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Kaydedilemedi');
      setSpendMsg(`✓ ${j.days} güne dağıtıldı (günlük ${j.perDay}€)`);
      setSpendTotal('');
      await load(preset);
    } catch (e: any) {
      setSpendMsg(`✕ ${e.message}`);
    } finally {
      setSpendSaving(false);
    }
  }

  const cost = data?.cost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MousePointerClick size={20} /> Google Ads Performansı
          </h2>
          <p className="text-xs text-gray-500">
            gclid / UTM ile etiketlenmiş reklam trafiği — birinci taraf veriden hesaplanır
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['today', 'yesterday', '7', '30', '90'] as Preset[]).map((p) => (
            <button key={p} onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${preset === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
              {PRESET_LABELS[p]}
            </button>
          ))}
          <button onClick={() => load(preset)} disabled={loading}
            className="p-2 rounded-lg bg-white shadow-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Spend entry */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Wallet size={16} className="text-primary-600" />
            <span className="font-semibold">Reklam Harcaması</span>
            {cost && (
              <span className="text-gray-500">
                — bu dönem: <strong>{cost.spend.value.toFixed(2)}€</strong>
                {!cost.hasSpend && <span className="text-amber-600"> (girilmedi)</span>}
              </span>
            )}
          </div>
          <button onClick={() => setSpendOpen((v) => !v)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100">
            {spendOpen ? 'Kapat' : 'Harcama gir / düzenle'}
          </button>
        </div>
        {spendOpen && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500">
              Başlangıç
              <input type="date" value={spendFrom} onChange={(e) => setSpendFrom(e.target.value)}
                className="block mt-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </label>
            <label className="text-xs text-gray-500">
              Bitiş
              <input type="date" value={spendTo} onChange={(e) => setSpendTo(e.target.value)}
                className="block mt-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            </label>
            <label className="text-xs text-gray-500">
              Toplam harcama (€)
              <input type="number" min="0" step="0.01" value={spendTotal}
                onChange={(e) => setSpendTotal(e.target.value)} placeholder="örn. 450"
                className="block mt-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm w-32" />
            </label>
            <button onClick={saveSpend} disabled={spendSaving || !spendTotal}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50">
              {spendSaving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {spendMsg && <span className={`text-xs ${spendMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{spendMsg}</span>}
            <p className="text-[11px] text-gray-400 w-full">
              Girilen toplam, seçilen tarih aralığındaki günlere eşit dağıtılır. Var olan günler güncellenir.
            </p>
          </div>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500">Yükleniyor…</div>}

      {data && !data.hasData && (
        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Seçilen dönemde reklam (gclid / UTM cpc) trafiği bulunamadı. Google Ads kampanyaları aktifse
          hesapta <strong>otomatik etiketleme (auto-tagging)</strong> açık olmalı.
        </div>
      )}

      {data && data.hasData && (
        <>
          {/* Score */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-wrap items-center gap-6">
            {data.score !== null && <ScoreRing score={data.score} />}
            <div className="flex-1 min-w-[260px]">
              <div className="text-sm font-semibold text-gray-700 mb-2">Sağlık Skoru bileşenleri</div>
              <div className="space-y-1.5">
                {data.scoreBreakdown.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    <span className="w-40 text-gray-600">{p.key}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${p.points}%`,
                        background: p.points >= 75 ? '#22c55e' : p.points >= 50 ? '#f59e0b' : '#ef4444',
                      }} />
                    </div>
                    <span className="w-16 text-right text-gray-500">{p.points}/100</span>
                    <span className="w-10 text-right text-gray-400">%{Math.round(p.weight * 100)}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Reklamdan gelen rezervasyonlar toplam rezervasyonların <strong>%{data.adShare}</strong>'ini oluşturuyor.
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users} label="Reklam ziyaretçisi" value={String(data.kpis.visitors.value)} kpi={data.kpis.visitors} />
            <KpiCard icon={CalendarCheck} label="Rezervasyon" value={String(data.kpis.bookings.value)} kpi={data.kpis.bookings} />
            <KpiCard icon={Percent} label="Dönüşüm oranı" value={String(data.kpis.cvr.value)} suffix="%" kpi={data.kpis.cvr} />
            <KpiCard icon={Euro} label="Reklam cirosu" value={data.kpis.revenue.value.toFixed(0)} suffix="€" kpi={data.kpis.revenue} />
            <KpiCard icon={Target} label="Ort. rezervasyon" value={data.kpis.avgValue.value.toFixed(0)} suffix="€" kpi={data.kpis.avgValue} />
            <KpiCard icon={TrendingDown} label="Tek-sayfa çıkış" value={String(data.kpis.bounceRate.value)} suffix="%" kpi={data.kpis.bounceRate} goodWhenUp={false} />
          </div>

          {/* Cost KPIs */}
          {cost && cost.hasSpend ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={Wallet} label="Harcama" value={cost.spend.value.toFixed(0)} suffix="€" kpi={cost.spend} goodWhenUp={false} />
              <KpiCard icon={RoasIcon} label="ROAS" value={cost.roas.value !== null ? cost.roas.value.toFixed(2) : '—'} suffix="×"
                accent={cost.roas.value !== null && cost.roas.value < 1 ? 'text-red-600' : cost.roas.value !== null && cost.roas.value >= 3 ? 'text-green-600' : 'text-gray-900'} />
              <KpiCard icon={Target} label="Rezervasyon maliyeti (CPA)" value={cost.cpa.value !== null ? cost.cpa.value.toFixed(2) : '—'} suffix={cost.cpa.value !== null ? '€' : ''} />
              <KpiCard icon={Coins} label="Net kâr" value={cost.profit.value.toFixed(0)} suffix="€" kpi={cost.profit}
                accent={cost.profit.value < 0 ? 'text-red-600' : 'text-green-600'} />
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
              <Wallet size={16} />
              <span>Bu dönem için reklam harcaması girilmedi — ROAS, CPA ve net kâr hesaplanamıyor.
                Yukarıdaki <strong>“Harcama gir”</strong> alanından girebilirsiniz.</span>
            </div>
          )}

          {/* Trend chart */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              {data.isHourly ? `Saatlik trend (${PRESET_LABELS[data.preset as Preset] || data.preset})` : `Günlük trend (${data.days} gün)`}
            </div>
            <TrendChart daily={data.daily} isHourly={data.isHourly} />
          </div>

          {/* Ad vs organic + conversion lag */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-3">Reklam vs Organik dönüşüm</div>
              <div className="grid grid-cols-2 gap-3">
                {([['Reklam', data.comparison.ad, 'bg-blue-50'], ['Organik', data.comparison.organic, 'bg-gray-50']] as const).map(
                  ([label, c, bg]) => (
                    <div key={label} className={`rounded-lg p-3 ${bg}`}>
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-2xl font-bold text-gray-900">%{c.cvr}</div>
                      <div className="text-xs text-gray-500 mt-1">{c.visitors} ziyaretçi · {c.bookings} rezervasyon</div>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Clock size={15} /> Dönüşüm gecikmesi
              </div>
              {data.conversionLag.sampleSize > 0 ? (
                <>
                  <div className="text-sm text-gray-700 mb-2">
                    Ortalama: <strong>{data.conversionLag.avgHours}</strong> saat
                    <span className="text-gray-400"> ({data.conversionLag.sampleSize} rezervasyon)</span>
                  </div>
                  <div className="space-y-1">
                    {data.conversionLag.buckets.map((b) => {
                      const max = Math.max(...data.conversionLag.buckets.map((x) => x.count), 1);
                      return (
                        <div key={b.label} className="flex items-center gap-2 text-xs">
                          <span className="w-20 text-gray-500">{b.label}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded">
                            <div className="h-full bg-primary-400 rounded" style={{ width: `${(b.count / max) * 100}%` }} />
                          </div>
                          <span className="w-6 text-right text-gray-600">{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Reklamdan eşleşen rezervasyon yok.</div>
              )}
            </div>
          </div>

          {/* Dayparting */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Clock size={15} /> Saate göre reklam trafiği
              </div>
              <DaypartChart data={data.dayparting.byHour.map((h) => ({
                label: String(h.hour).padStart(2, '0'), visitors: h.visitors, bookings: h.bookings,
              }))} />
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <CalendarDays size={15} /> Güne göre reklam trafiği
              </div>
              <DaypartChart data={data.dayparting.byWeekday.map((d) => ({
                label: d.label, visitors: d.visitors, bookings: d.bookings,
              }))} />
            </div>
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-amber-500" /> Uyarılar ({data.alerts.length})
              </div>
              {data.alerts.map((a, i) => (
                <div key={i} className={`p-3 rounded-lg border text-sm ${SEV_STYLE[a.severity]}`}>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs mt-0.5 opacity-90">{a.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Lightbulb size={16} className="text-yellow-500" /> Öneriler ({data.recommendations.length})
              </div>
              {data.recommendations.map((r, i) => (
                <div key={i} className="p-3 rounded-lg border border-gray-200 bg-white text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      r.priority === 'high' ? 'bg-red-100 text-red-700'
                        : r.priority === 'medium' ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {r.priority === 'high' ? 'ÖNCELİKLİ' : r.priority === 'medium' ? 'ORTA' : 'BİLGİ'}
                    </span>
                    <span className="font-semibold text-gray-800">{r.title}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{r.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Campaign + device */}
          <div className="grid md:grid-cols-2 gap-4">
            <MiniTable title="Kampanya kırılımı" firstCol="Kampanya" rows={data.campaigns} />
            <MiniTable title="Cihaz kırılımı" firstCol="Cihaz" rows={data.devices} />
          </div>

          {/* Geo */}
          <div className="grid md:grid-cols-2 gap-4">
            <MiniTable title="Ülke kırılımı" firstCol="Ülke" rows={data.geo.countries} />
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <MapPin size={15} /> Şehir kırılımı
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="py-1">Şehir</th>
                    <th className="text-right">Ziy.</th>
                    <th className="text-right">Rez.</th>
                    <th className="text-right">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.geo.cities.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-2">Veri yok</td></tr>}
                  {data.geo.cities.map((r) => (
                    <tr key={r.name} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700 truncate max-w-[140px]" title={r.name}>{r.name}</td>
                      <td className="text-right">{r.visitors}</td>
                      <td className="text-right">{r.bookings}</td>
                      <td className="text-right">%{r.cvr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            Son güncelleme: {new Date(data.generatedAt).toLocaleString('de-DE')}
          </div>
        </>
      )}
    </div>
  );
}
