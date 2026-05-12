'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Flame, RefreshCw, Smartphone, Monitor, Tablet,
  MousePointerClick, ArrowDown, ExternalLink, Lightbulb, TrendingDown, AlertCircle,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface HeatmapPage { path: string; clicks: number; visitors: number; }
interface ClickPoint { x_pct: number; y_pct: number; target: string | null; viewport_w: number; viewport_h: number; device: string; }
interface HeatmapData {
  path: string; range: string; device: string;
  clicks: ClickPoint[];
  topTargets: Array<{ target: string; clicks: number }>;
  scrollBuckets: Array<{ bucket: number; sessions: number }>;
}

const VIEWPORT_PRESETS = {
  mobile: { w: 390, h: 844, label: 'Mobil (390px)' },
  tablet: { w: 768, h: 1024, label: 'Tablet (768px)' },
  desktop: { w: 1280, h: 800, label: 'Masaüstü (1280px)' },
};

// Translate raw CSS target strings to human-readable Turkish labels
// Raw format examples: 'button.shrink-0.flex "Suchen"', 'input.flex-1.bg-transparent ""'
function labelTarget(raw: string): string {
  if (!raw) return '—';
  const r = raw.toLowerCase();
  // Extract quoted label text first (most reliable signal)
  const quotedLabel = raw.match(/"([^"]{1,60})"/)?.[1]?.trim() || '';
  const ql = quotedLabel.toLowerCase();

  // Match by quoted label content (most specific)
  if (ql === 'suchen' || ql.includes('suchen')) return '🔍 Arama butonu';
  if (ql.includes('alle akzeptieren')) return '✅ Cookie kabul et';
  if (ql.includes('nur notwendige')) return '❌ Cookie sadece zorunlu';
  if (ql.includes('dieses fahrzeug buchen')) return '🚗 Araç rezervasyon butonu';
  if (ql.includes('rückfahrt hinzufügen')) return '↩️ Dönüş ekle';
  if (ql.includes('adressen tauschen')) return '🔄 Adresleri değiştir';
  if (ql.includes('jetzt preis berechnen')) return '💶 Fiyat hesapla';
  if (ql.includes('flughafen') && ql.includes('terminal')) return '✈️ Terminal seç';
  if (ql.match(/^(hinfahrt|rückfahrt)/) || ql.includes('10:00') || ql.match(/\d{2}\.\d{2}\.\d{4}/)) return '📅 Tarih / saat seçici';
  if (ql === '+' || ql === '➕') return '➕ Yolcu artır';
  if (ql === '-' || ql === '–' || ql === '−' || ql === '➖') return '➖ Yolcu azalt';
  if (ql === '▼' || ql === '▲') return '🔽 Açılır menü oku';
  if (ql === '›' || ql === '‹' || ql === '<' || ql === '>') return '◀▶ Tarih kaydır';
  if (ql.match(/^\d{1,2}$/) && r.includes('w-10')) return '📆 Takvim gün butonu';
  if (ql.match(/^\d{1,2}:\d{2}$/)) return '🕐 Saat seçeneği ' + quotedLabel;
  if (ql.includes('whatsapp')) return '💬 WhatsApp butonu';
  if (ql.includes('anrufen') || ql.includes('telefon')) return '📞 Telefon butonu';

  // Match by CSS class / element type
  if (r.includes('flex-1.bg-transparent') || (r.startsWith('input') && r.includes('flex'))) return '📍 Adres giriş alanı';
  if (r.startsWith('input') && r.includes('border')) return '📝 Form input';
  if (r.includes('terminal') || r.includes('flughafen')) return '✈️ Terminal seçimi';
  if (r.startsWith('li ') || r.startsWith('li.')) return quotedLabel ? `📋 ${quotedLabel}` : '📋 Liste öğesi';
  if (r.startsWith('a.') || r.startsWith('a ')) return quotedLabel ? `🔗 ${quotedLabel}` : '🔗 Link';
  if (r.startsWith('button') || r.startsWith('div') || r.startsWith('span')) {
    return quotedLabel ? `🔘 ${quotedLabel}` : '🔘 Buton';
  }
  return quotedLabel || raw.slice(0, 50);
}

function renderHeatmap(
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
  radius: number,
  scrollLines: Array<{ yPct: number; label: string; color: string }>,
  canvasH: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  ctx.clearRect(0, 0, w, canvasH);

  if (points.length > 0) {
    const off = document.createElement('canvas');
    off.width = w; off.height = canvasH;
    const octx = off.getContext('2d');
    if (octx) {
      for (const p of points) {
        const g = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        g.addColorStop(0, 'rgba(0,0,0,0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = g;
        octx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
      const img = octx.getImageData(0, 0, w, canvasH);
      const data = img.data;
      const palette = buildPalette();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const idx = Math.min(255, a) * 4;
        data[i] = palette[idx]; data[i + 1] = palette[idx + 1]; data[i + 2] = palette[idx + 2];
        data[i + 3] = Math.min(210, a + 50);
      }
      ctx.putImageData(img, 0, 0);
    }
  }

  // Draw scroll depth lines
  for (const line of scrollLines) {
    const y = Math.round((line.yPct / 100) * canvasH);
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = line.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(line.label, 6, y - 4);
    ctx.restore();
  }
}

function buildPalette(): Uint8ClampedArray {
  const p = new Uint8ClampedArray(256 * 4);
  const stops = [
    { at: 0, c: [0, 0, 255] }, { at: 0.25, c: [0, 255, 255] },
    { at: 0.5, c: [0, 255, 0] }, { at: 0.75, c: [255, 255, 0] }, { at: 1, c: [255, 0, 0] },
  ];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0], b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].at && t <= stops[s + 1].at) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const k = (t - a.at) / Math.max(0.0001, b.at - a.at);
    p[i * 4] = Math.round(a.c[0] + (b.c[0] - a.c[0]) * k);
    p[i * 4 + 1] = Math.round(a.c[1] + (b.c[1] - a.c[1]) * k);
    p[i * 4 + 2] = Math.round(a.c[2] + (b.c[2] - a.c[2]) * k);
    p[i * 4 + 3] = 255;
  }
  return p;
}

// Generate auto-insights from data
function generateInsights(data: HeatmapData): string[] {
  const insights: string[] = [];
  const clicks = data.clicks;
  if (!clicks.length) return [];

  // Top section analysis
  const topThird = clicks.filter(c => Number(c.y_pct) < 33).length;
  const midThird = clicks.filter(c => Number(c.y_pct) >= 33 && Number(c.y_pct) < 66).length;
  const botThird = clicks.filter(c => Number(c.y_pct) >= 66).length;
  const total = clicks.length;

  const topPct = Math.round(topThird / total * 100);
  if (topPct > 60) {
    insights.push(`📍 Tıkların %${topPct}'i sayfanın üst bölümünde — müşteriler rezervasyon formuna odaklanıyor`);
  } else if (topPct < 30) {
    insights.push(`📍 Tıkların sadece %${topPct}'i üst bölümde — orta ve alt içerik de ilgi görüyor`);
  }

  // Scroll depth insight
  const buckets = data.scrollBuckets;
  const base = buckets.find(b => Number(b.bucket) === 25)?.sessions || 0;
  const half = buckets.find(b => Number(b.bucket) === 50)?.sessions || 0;
  const full = buckets.find(b => Number(b.bucket) === 100)?.sessions || 0;
  if (base > 0) {
    const halfPct = Math.round(half / base * 100);
    const fullPct = Math.round(full / base * 100);
    if (fullPct < 10) {
      insights.push(`⚠️ Ziyaretçilerin yalnızca %${fullPct}'i sayfayı sonuna kadar kaydırıyor — sayfa çok uzun olabilir`);
    }
    if (halfPct < 50) {
      insights.push(`📉 Ziyaretçilerin %${100 - halfPct}'i yarıya gelmeden ayrılıyor — önemli bilgileri üste taşıyın`);
    }
  }

  // Booking button
  const bookingClicks = data.topTargets.find(t =>
    t.target?.toLowerCase().includes('buchen') || t.target?.toLowerCase().includes('fahrzeug')
  );
  if (bookingClicks) {
    const pct = Math.round(bookingClicks.clicks / total * 100);
    insights.push(`🚗 Rezervasyon butonuna ${bookingClicks.clicks} tık (toplam tıkların %${pct}'i) — dönüşüm noktası aktif`);
  }

  // Cookie banner
  const cookieAccept = data.topTargets.find(t => t.target?.includes('Alle akzeptieren'));
  const cookieReject = data.topTargets.find(t => t.target?.includes('Nur notwendige'));
  if (cookieAccept && cookieReject) {
    const acceptRate = Math.round(cookieAccept.clicks / (cookieAccept.clicks + cookieReject.clicks) * 100);
    insights.push(`🍪 Cookie kabul oranı: %${acceptRate} kabul ediyor`);
  }

  // Address input (most common)
  const addrInput = data.topTargets.find(t => t.target?.includes('flex-1.bg-transparent') || (t.target?.includes('input') && t.target?.includes('flex')));
  if (addrInput && addrInput.clicks > 50) {
    insights.push(`📍 Adres alanına ${addrInput.clicks} tık — en yoğun etkileşim noktası`);
  }

  return insights.slice(0, 4);
}

export default function HeatmapTab({ token }: { token: string }) {
  const [pages, setPages] = useState<HeatmapPage[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [device, setDevice] = useState<'all' | 'mobile' | 'tablet' | 'desktop'>('all');
  const [viewport, setViewport] = useState<keyof typeof VIEWPORT_PRESETS>('desktop');
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadPages = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/heatmap-pages?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setPages(d.pages || []);
      if (!selectedPath && d.pages?.length > 0) setSelectedPath(d.pages[0].path);
    } catch { setError('Sayfalar yüklenemedi'); }
  }, [token, range, selectedPath]);

  const loadHeatmap = useCallback(async () => {
    if (!selectedPath) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/admin/heatmap?path=${encodeURIComponent(selectedPath)}&range=${range}&device=${device}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) throw new Error('failed');
      setData(await r.json());
      setError('');
    } catch { setError('Heatmap yüklenemedi'); }
    finally { setLoading(false); }
  }, [token, selectedPath, range, device]);

  useEffect(() => { loadPages(); }, [loadPages]);
  useEffect(() => { loadHeatmap(); }, [loadHeatmap]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const preset = VIEWPORT_PRESETS[viewport];
    const canvasH = preset.h * 5;
    canvasRef.current.width = preset.w;
    canvasRef.current.height = canvasH;

    const points = data.clicks.map((c) => ({
      x: (Number(c.x_pct) / 100) * preset.w,
      y: (Number(c.y_pct) / 100) * canvasH,
    }));

    // Calculate scroll depth lines from bucket data
    const buckets = data.scrollBuckets;
    const base = buckets.find(b => Number(b.bucket) === 25)?.sessions || 0;
    const scrollLines: Array<{ yPct: number; label: string; color: string }> = [];
    if (base > 0) {
      const b50 = buckets.find(b => Number(b.bucket) === 50)?.sessions || 0;
      const b75 = buckets.find(b => Number(b.bucket) === 75)?.sessions || 0;
      const b100 = buckets.find(b => Number(b.bucket) === 100)?.sessions || 0;
      const pct50 = Math.round(b50 / base * 100);
      const pct75 = Math.round(b75 / base * 100);
      const pct100 = Math.round(b100 / base * 100);
      scrollLines.push({ yPct: 50, label: `← %${pct50} buraya kadar kaydırdı`, color: 'rgba(59,130,246,0.9)' });
      scrollLines.push({ yPct: 75, label: `← %${pct75} buraya kadar`, color: 'rgba(245,158,11,0.9)' });
      if (pct100 > 0) scrollLines.push({ yPct: 100, label: `← %${pct100} sona kadar`, color: 'rgba(239,68,68,0.9)' });
    }

    renderHeatmap(canvasRef.current, points, 28, scrollLines, canvasH);
  }, [data, viewport]);

  const preset = VIEWPORT_PRESETS[viewport];
  const totalClicks = data?.clicks?.length || 0;

  // Click distribution by page section (top/mid/bottom)
  const sections = data ? [
    { label: '↑ Üst (0–33%)', pct: Math.round(data.clicks.filter(c => Number(c.y_pct) < 33).length / Math.max(1, totalClicks) * 100), color: 'bg-red-400' },
    { label: '↔ Orta (33–66%)', pct: Math.round(data.clicks.filter(c => Number(c.y_pct) >= 33 && Number(c.y_pct) < 66).length / Math.max(1, totalClicks) * 100), color: 'bg-orange-400' },
    { label: '↓ Alt (66–100%)', pct: Math.round(data.clicks.filter(c => Number(c.y_pct) >= 66).length / Math.max(1, totalClicks) * 100), color: 'bg-blue-400' },
  ] : [];

  // Scroll funnel
  const sb = data?.scrollBuckets || [];
  const sbBase = Math.max(1, sb.find(b => Number(b.bucket) === 25)?.sessions || 1);
  const scrollFunnel = [25, 50, 75, 100].map(ms => ({
    ms,
    count: sb.find(b => Number(b.bucket) === ms)?.sessions || 0,
    pct: Math.round((sb.find(b => Number(b.bucket) === ms)?.sessions || 0) / sbBase * 100),
    color: ms === 25 ? 'bg-green-400' : ms === 50 ? 'bg-yellow-400' : ms === 75 ? 'bg-orange-400' : 'bg-red-500',
  }));

  const insights = data ? generateInsights(data) : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-1">
          <Flame size={26} />
          <h2 className="text-2xl font-bold">Click Heatmap</h2>
        </div>
        <p className="opacity-90 text-sm">Müşterilerin sayfada nereye tıkladığını ve ne kadar aşağı kaydırdığını gör.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-gray-600 block mb-1">Sayfa</label>
          <select value={selectedPath} onChange={(e) => setSelectedPath(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full">
            {pages.length === 0 && <option value="">Veri yok</option>}
            {pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path} ({p.clicks} tık, {p.visitors} ziyaretçi)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Zaman</label>
          <div className="flex gap-1">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-2 text-sm rounded-lg ${range === r ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {r === 'today' ? 'Bugün' : r === '7d' ? '7 Gün' : '30 Gün'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Cihaz</label>
          <div className="flex gap-1">
            {([['all', 'Hepsi'], ['mobile', 'Mobil'], ['desktop', 'PC']] as const).map(([d, lbl]) => (
              <button key={d} onClick={() => setDevice(d as any)}
                className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${device === d ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {d === 'mobile' && <Smartphone size={13} />}
                {d === 'desktop' && <Monitor size={13} />}
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Önizleme</label>
          <div className="flex gap-1">
            {(Object.keys(VIEWPORT_PRESETS) as Array<keyof typeof VIEWPORT_PRESETS>).map((vp) => (
              <button key={vp} onClick={() => setViewport(vp)}
                className={`px-2 py-2 text-xs rounded-lg ${viewport === vp ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {vp === 'mobile' ? <Smartphone size={14} /> : vp === 'tablet' ? <Tablet size={14} /> : <Monitor size={14} />}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { loadPages(); loadHeatmap(); }}
          className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {/* Insights panel */}
      {insights.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 text-amber-800 font-semibold text-sm">
            <Lightbulb size={16} /> Otomatik İçgörüler
          </div>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><MousePointerClick size={13} /> Toplam Tık</div>
          <div className="text-3xl font-bold text-red-600">{totalClicks}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 flex items-center gap-1"><ArrowDown size={13} /> Sona Kadar</div>
          <div className="text-3xl font-bold text-blue-600">
            %{scrollFunnel.find(s => s.ms === 100)?.pct ?? 0}
          </div>
          <div className="text-xs text-gray-400">kaydırdı</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1">Tık Dağılımı</div>
          <div className="space-y-1">
            {sections.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${s.pct}%`, minWidth: 4 }} />
                <span className="text-xs text-gray-600 whitespace-nowrap">%{s.pct} {s.label.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1">Rezervasyon Tıkları</div>
          <div className="text-2xl font-bold text-green-600">
            {data?.topTargets.find(t => t.target?.includes('buchen') || t.target?.includes('Fahrzeug'))?.clicks ?? 0}
          </div>
          <div className="text-xs text-gray-400">"Araç rezervasyon" butonu</div>
        </div>
      </div>

      {/* Main heatmap */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Heatmap — {preset.label}</h3>
          {selectedPath && (
            <a href={selectedPath} target="_blank" rel="noreferrer"
              className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              Sayfayı aç <ExternalLink size={11} />
            </a>
          )}
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Yükleniyor…</div>
        ) : totalClicks === 0 ? (
          <div className="text-center py-12 text-gray-400">Bu sayfa için tık verisi yok.</div>
        ) : (
          <div className="relative mx-auto border bg-gray-100 overflow-auto rounded-xl"
            style={{ width: Math.min(preset.w, 900), maxHeight: 650 }}>
            <iframe
              src={selectedPath.split('?')[0]}
              style={{ width: preset.w, height: preset.h * 5, border: 0, display: 'block', pointerEvents: 'none',
                transform: preset.w > 900 ? `scale(${900 / preset.w})` : undefined,
                transformOrigin: 'top left',
              }}
              title="Heatmap sayfa önizlemesi"
            />
            <canvas ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0,
                width: preset.w > 900 ? 900 : preset.w,
                height: preset.h * 5 * (preset.w > 900 ? 900 / preset.w : 1),
                mixBlendMode: 'multiply', pointerEvents: 'none',
              }}
            />
          </div>
        )}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span>🔵 Az tık</span>
          <span>🟢 Orta</span>
          <span>🟡 Yüksek</span>
          <span>🔴 Çok yüksek</span>
          <span className="ml-2">— — Kesik çizgi = kaçının o noktaya kadar kaydırdığı</span>
        </div>
      </div>

      {/* Bottom panels: top elements + scroll funnel */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Top clicked elements */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <MousePointerClick size={16} className="text-red-500" /> En Çok Tıklanan Elemanlar
          </h3>
          {(data?.topTargets || []).length === 0 ? (
            <div className="text-sm text-gray-400">Veri yok</div>
          ) : (
            <div className="space-y-2">
              {data!.topTargets.slice(0, 10).map((t, i) => {
                const maxClicks = data!.topTargets[0].clicks;
                const pct = Math.round(t.clicks / maxClicks * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-gray-800">{labelTarget(t.target || '')}</span>
                      <span className="text-xs font-bold text-red-600 ml-2 shrink-0">{t.clicks}×</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Scroll depth funnel */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <ArrowDown size={16} className="text-blue-500" /> Kaç Kişi Ne Kadar Kaydırdı?
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            (Kaydırma 25%'e ulaşanlar = 100% baz alındı)
          </p>
          {scrollFunnel.every(s => s.count === 0) ? (
            <div className="text-sm text-gray-400">Scroll verisi yok</div>
          ) : (
            <div className="space-y-4">
              {scrollFunnel.map(({ ms, count, pct, color }) => (
                <div key={ms}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">
                      {ms === 25 ? '⬆ Üst çeyrek (%25)' : ms === 50 ? '↔ Yarı (%50)' : ms === 75 ? '↙ Alt (%75)' : '⬇ Sona kadar (%100)'}
                    </span>
                    <span className="text-gray-600">{count} kişi · <strong>%{pct}</strong></span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    <span className="absolute right-2 top-0 text-xs text-white leading-4 font-bold drop-shadow">
                      {pct > 15 ? `%${pct}` : ''}
                    </span>
                  </div>
                </div>
              ))}
              {scrollFunnel[3].pct < 15 && (
                <div className="flex items-start gap-2 bg-orange-50 text-orange-800 text-xs p-3 rounded-xl">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>Ziyaretçilerin çoğu sayfanın altını görmüyor. Önemli bilgileri (fiyatlar, avantajlar) daha yukarı taşıyın.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
