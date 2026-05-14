'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Search, BarChart3, FileText, Zap, Globe } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface PageScore { url: string; status?: number; ms?: number; }
interface RankEntry { position: number | null; url?: string; error?: string; }
interface ScorePoint { ts: string; score: number; }
interface RankPoint { ts: string; position: number | null; }

interface SeoData {
  latest: {
    ts: string;
    siteScore: number;
    avgPage: number;
    rankBonus: number;
    ranks: Record<string, RankEntry>;
    pages: PageScore[];
  } | null;
  scoreSeries: ScorePoint[];
  rankSeries: Record<string, RankPoint[]>;
  pageScores: PageScore[];
  ranks: Record<string, RankEntry>;
  autopilot: string;
  rankOneSummary: string;
  alertsLog: string[];
  dataDir: string;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'İyi' : score >= 60 ? 'Orta' : 'Zayıf';
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${2 * Math.PI * 40}`}
          strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)" />
        <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="11" fill="#6b7280">{label}</text>
      </svg>
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-gray-400 text-xs">—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const w = 80, h = 24;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const trend = prev != null ? (last > prev ? 'up' : last < prev ? 'down' : 'flat') : 'flat';
  const color = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280';
  return (
    <span className="inline-flex items-center gap-1">
      <svg width={w} height={h}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      <span style={{ color }} className="text-xs font-mono">{last}</span>
    </span>
  );
}

function RankBadge({ pos }: { pos: number | null }) {
  if (!pos) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">&gt;100</span>;
  const bg = pos === 1 ? 'bg-yellow-100 text-yellow-700' : pos <= 3 ? 'bg-green-100 text-green-700' : pos <= 10 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600';
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${bg}`}>#{pos}</span>;
}

export default function SeoTab({ token }: { token: string }) {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'pages' | 'ranks' | 'proposals' | 'alerts'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/seo/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
      <span className="ml-2 text-gray-500">SEO verileri yükleniyor…</span>
    </div>
  );

  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-lg">
      <AlertTriangle className="inline w-5 h-5 mr-2" />Hata: {error}
    </div>
  );

  const { latest, scoreSeries, rankSeries, ranks, autopilot, rankOneSummary, alertsLog, pageScores } = data!;
  const score = latest?.siteScore ?? 0;
  const prevScore = scoreSeries.length >= 2 ? scoreSeries[scoreSeries.length - 2].score : null;
  const scoreDelta = prevScore != null ? score - prevScore : null;

  const sections = [
    { key: 'overview', label: 'Genel Bakış', icon: BarChart3 },
    { key: 'pages', label: 'Sayfalar', icon: Globe },
    { key: 'ranks', label: 'Sıralamalar', icon: Search },
    { key: 'proposals', label: 'Öneriler', icon: Zap },
    { key: 'alerts', label: 'Alertler', icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" /> SEO Dashboard
        </h2>
        <div className="flex items-center gap-3">
          {latest && <span className="text-xs text-gray-400">Son güncelleme: {new Date(latest.ts).toLocaleString('tr-TR')}</span>}
          <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Yenile
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSection === s.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <s.icon className="w-4 h-4" />{s.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Score cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4">
              <ScoreRing score={score} />
              <div>
                <div className="text-sm text-gray-500">Site Skoru</div>
                <div className="flex items-center gap-1 mt-1">
                  {scoreDelta != null && (
                    scoreDelta > 0
                      ? <span className="text-green-600 text-sm font-medium flex items-center"><TrendingUp className="w-4 h-4 mr-0.5" />+{scoreDelta}</span>
                      : scoreDelta < 0
                        ? <span className="text-red-500 text-sm font-medium flex items-center"><TrendingDown className="w-4 h-4 mr-0.5" />{scoreDelta}</span>
                        : <span className="text-gray-400 text-sm">Değişim yok</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">Sayfa ort: {latest?.avgPage ?? '—'}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <div className="text-sm text-gray-500 mb-2">Skor Trendi (son 30 gün)</div>
              <MiniSparkline values={scoreSeries.map(s => s.score)} />
              <div className="text-xs text-gray-400 mt-2">{scoreSeries.length} veri noktası</div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <div className="text-sm text-gray-500 mb-3">Keyword Özeti</div>
              <div className="space-y-1">
                {Object.entries(ranks).slice(0, 4).map(([kw, v]) => (
                  <div key={kw} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate max-w-[160px]">{kw}</span>
                    <RankBadge pos={v.position} />
                  </div>
                ))}
                {!Object.keys(ranks).length && <div className="text-xs text-gray-400">SerpAPI key gerekli</div>}
              </div>
            </div>
          </div>

          {/* Score trend chart */}
          {scoreSeries.length > 1 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <div className="text-sm font-medium text-gray-700 mb-3">Site Skoru Geçmişi</div>
              <svg width="100%" height="80" viewBox="0 0 400 80" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const vals = scoreSeries.map(s => s.score);
                  const max = Math.max(...vals, 100);
                  const pts = vals.map((v, i) => {
                    const x = (i / Math.max(vals.length - 1, 1)) * 400;
                    const y = 80 - (v / max) * 70;
                    return `${x},${y}`;
                  }).join(' ');
                  const areaClose = `${400},80 0,80`;
                  return (
                    <>
                      <polygon points={`${pts} ${areaClose}`} fill="url(#scoreGrad)" />
                      <polyline points={pts} fill="none" stroke="#3b82f6" strokeWidth="2" />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* PAGES */}
      {activeSection === 'pages' && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-700 flex items-center gap-2"><Globe className="w-4 h-4" /> Sayfa Skorları</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">URL</th>
                  <th className="text-center px-4 py-2 text-gray-500 font-medium">Status</th>
                  <th className="text-center px-4 py-2 text-gray-500 font-medium">Hız</th>
                  <th className="text-center px-4 py-2 text-gray-500 font-medium">Title</th>
                  <th className="text-center px-4 py-2 text-gray-500 font-medium">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(pageScores.length ? pageScores : latest?.pages || []).map((p: any) => (
                  <tr key={p.url} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700 truncate max-w-xs">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">{p.url.replace('https://flughafen-muenchen.taxi', '')}</a>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{p.status || '—'}</span>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-500 text-xs">{p.ms ? `${p.ms}ms` : '—'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 text-xs">{p.titleLen ?? '—'}</td>
                    <td className="px-4 py-2 text-center text-gray-500 text-xs">{p.metaLen ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pageScores.length && !latest?.pages?.length && (
              <div className="p-8 text-center text-gray-400">Henüz veri yok — <code>node index.js audit</code> çalıştır</div>
            )}
          </div>
        </div>
      )}

      {/* RANKS */}
      {activeSection === 'ranks' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-medium text-gray-700 flex items-center gap-2"><Search className="w-4 h-4" /> Google Sıralamalar</h3>
            </div>
            {!Object.keys(ranks).length ? (
              <div className="p-8 text-center text-gray-400">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Rank verisi yok</p>
                <p className="text-xs mt-1">SerpAPI key ekleyince otomatik dolar</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Keyword</th>
                    <th className="text-center px-4 py-2 text-gray-500 font-medium">Pozisyon</th>
                    <th className="text-left px-4 py-2 text-gray-500 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(ranks).map(([kw, v]) => {
                    const series = rankSeries[kw] || [];
                    const positions = series.map(s => s.position ? 101 - s.position : 0);
                    return (
                      <tr key={kw} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{kw}</td>
                        <td className="px-4 py-3 text-center"><RankBadge pos={v.position} /></td>
                        <td className="px-4 py-3"><MiniSparkline values={positions} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {rankOneSummary && (
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> #1 Olma Stratejisi</h3>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg overflow-auto max-h-64">{rankOneSummary}</pre>
            </div>
          )}
        </div>
      )}

      {/* PROPOSALS */}
      {activeSection === 'proposals' && (
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Autopilot Önerileri</h3>
          {autopilot ? (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-[500px]">{autopilot}</pre>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-300" />
              <p>Henüz öneri yok — harika!</p>
              <p className="text-xs mt-1">Bir kötüleşme tespit edilince burada görünecek</p>
            </div>
          )}
        </div>
      )}

      {/* ALERTS */}
      {activeSection === 'alerts' && (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Son Alertler</h3>
          </div>
          {alertsLog.length ? (
            <div className="divide-y">
              {alertsLog.map((line, i) => {
                const isGood = line.includes('gain') || line.includes('#1') || line.includes('✅');
                const isBad = line.includes('drop') || line.includes('fell') || line.includes('regression') || line.includes('📉');
                return (
                  <div key={i} className={`px-4 py-2.5 flex items-start gap-2 text-sm ${isGood ? 'bg-green-50' : isBad ? 'bg-red-50' : ''}`}>
                    {isGood ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      : isBad ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        : <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
                    <span className={`font-mono ${isGood ? 'text-green-700' : isBad ? 'text-red-700' : 'text-gray-600'}`}>{line}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Henüz alert yok</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
