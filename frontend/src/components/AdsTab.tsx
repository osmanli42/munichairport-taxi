'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Lightbulb,
  Users, CalendarCheck, Percent, Euro, Target, MousePointerClick,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface Kpi { value: number; prev: number; change: number | null }
interface DailyPoint { date: string; visitors: number; bookings: number; revenue: number }
interface Campaign { name: string; visitors: number; bookings: number; revenue: number; cvr: number }
interface DeviceRow { name: string; visitors: number; bookings: number; cvr: number }
interface Alert { severity: 'high' | 'medium' | 'low'; title: string; detail: string }
interface Recommendation { priority: 'high' | 'medium' | 'low'; title: string; detail: string }
interface ScorePart { key: string; weight: number; points: number }

interface AdsData {
  generatedAt: string;
  days: number;
  hasData: boolean;
  score: number | null;
  scoreBreakdown: ScorePart[];
  kpis: {
    visitors: Kpi; bookings: Kpi; cvr: Kpi; revenue: Kpi; avgValue: Kpi; bounceRate: Kpi;
  };
  adShare: number;
  totalBookings: number;
  daily: DailyPoint[];
  campaigns: Campaign[];
  devices: DeviceRow[];
  alerts: Alert[];
  recommendations: Recommendation[];
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
  if (change === null || change === undefined) {
    return <span className="text-xs text-gray-400">— yeni</span>;
  }
  const up = change > 0;
  const good = goodWhenUp ? up : !up;
  if (change === 0) return <span className="text-xs text-gray-400">±0%</span>;
  const color = good ? 'text-green-600' : 'text-red-600';
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${color}`}>
      <Icon size={12} />{up ? '+' : ''}{change}%
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, suffix, kpi, goodWhenUp = true,
}: {
  icon: any; label: string; value: string; suffix?: string; kpi: Kpi; goodWhenUp?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        <Icon size={15} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}<span className="text-base font-medium text-gray-400">{suffix}</span></div>
      <div className="mt-1"><Delta change={kpi.change} goodWhenUp={goodWhenUp} /></div>
    </div>
  );
}

function TrendChart({ daily }: { daily: DailyPoint[] }) {
  if (!daily.length) return <div className="text-sm text-gray-400">Veri yok</div>;
  const w = 760, h = 180, padL = 8, padB = 22;
  const maxV = Math.max(...daily.map((d) => d.visitors), 1);
  const maxB = Math.max(...daily.map((d) => d.bookings), 1);
  const barW = (w - padL * 2) / daily.length;
  const innerH = h - padB;

  const linePts = daily.map((d, i) => {
    const x = padL + i * barW + barW / 2;
    const y = innerH - (d.bookings / maxB) * (innerH - 10);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="min-w-full">
        {daily.map((d, i) => {
          const bh = (d.visitors / maxV) * (innerH - 10);
          const x = padL + i * barW;
          return (
            <g key={d.date}>
              <rect x={x + 1} y={innerH - bh} width={Math.max(barW - 2, 1)} height={bh}
                fill="#bfdbfe" rx="1">
                <title>{d.date}: {d.visitors} ziyaretçi, {d.bookings} rezervasyon, {d.revenue}€</title>
              </rect>
            </g>
          );
        })}
        <polyline points={linePts} fill="none" stroke="#16a34a" strokeWidth="2" />
        {daily.map((d, i) => {
          const x = padL + i * barW + barW / 2;
          const y = innerH - (d.bookings / maxB) * (innerH - 10);
          return <circle key={d.date} cx={x} cy={y} r="2.5" fill="#16a34a" />;
        })}
        {daily.map((d, i) => (
          i % Math.ceil(daily.length / 10) === 0 ? (
            <text key={d.date} x={padL + i * barW + barW / 2} y={h - 6}
              textAnchor="middle" fontSize="9" fill="#9ca3af">
              {d.date.slice(5)}
            </text>
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

const SEV_STYLE: Record<string, string> = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function AdsTab({ token }: { token: string }) {
  const [data, setData] = useState<AdsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/ads/overview?days=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Sunucu hatası (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(days); }, [load, days]);

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
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${days === d ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
              {d} gün
            </button>
          ))}
          <button onClick={() => load(days)} disabled={loading}
            className="p-2 rounded-lg bg-white shadow-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
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
          {/* Score + breakdown */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-wrap items-center gap-6">
            {data.score !== null && <ScoreRing score={data.score} />}
            <div className="flex-1 min-w-[260px]">
              <div className="text-sm font-semibold text-gray-700 mb-2">Sağlık Skoru bileşenleri</div>
              <div className="space-y-1.5">
                {data.scoreBreakdown.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    <span className="w-40 text-gray-600">{p.key}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
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

          {/* Trend chart */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-sm font-semibold text-gray-700 mb-3">Günlük trend ({data.days} gün)</div>
            <TrendChart daily={data.daily} />
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

          {/* Campaign + device tables */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-2">Kampanya kırılımı</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="py-1">Kampanya</th>
                    <th className="text-right">Ziy.</th>
                    <th className="text-right">Rez.</th>
                    <th className="text-right">Dön.</th>
                    <th className="text-right">Ciro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.length === 0 && (
                    <tr><td colSpan={5} className="text-gray-400 py-2">Veri yok</td></tr>
                  )}
                  {data.campaigns.map((c) => (
                    <tr key={c.name} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700 truncate max-w-[140px]" title={c.name}>{c.name}</td>
                      <td className="text-right">{c.visitors}</td>
                      <td className="text-right">{c.bookings}</td>
                      <td className="text-right">%{c.cvr}</td>
                      <td className="text-right">{c.revenue.toFixed(0)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm font-semibold text-gray-700 mb-2">Cihaz kırılımı</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="py-1">Cihaz</th>
                    <th className="text-right">Ziyaretçi</th>
                    <th className="text-right">Rezervasyon</th>
                    <th className="text-right">Dönüşüm</th>
                  </tr>
                </thead>
                <tbody>
                  {data.devices.length === 0 && (
                    <tr><td colSpan={4} className="text-gray-400 py-2">Veri yok</td></tr>
                  )}
                  {data.devices.map((d) => (
                    <tr key={d.name} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700 capitalize">{d.name}</td>
                      <td className="text-right">{d.visitors}</td>
                      <td className="text-right">{d.bookings}</td>
                      <td className="text-right">%{d.cvr}</td>
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
