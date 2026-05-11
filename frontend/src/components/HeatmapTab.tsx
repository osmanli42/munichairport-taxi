'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Flame, RefreshCw, Smartphone, Monitor, Tablet,
  MousePointerClick, ArrowDown, ExternalLink,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface HeatmapPage {
  path: string;
  clicks: number;
  visitors: number;
}

interface ClickPoint {
  x_pct: number;
  y_pct: number;
  target: string | null;
  viewport_w: number;
  viewport_h: number;
  device: string;
}

interface HeatmapData {
  path: string;
  range: string;
  device: string;
  clicks: ClickPoint[];
  topTargets: Array<{ target: string; clicks: number }>;
  scrollBuckets: Array<{ bucket: number; sessions: number }>;
}

const VIEWPORT_PRESETS = {
  mobile: { w: 390, h: 844, label: 'iPhone (390×844)' },
  tablet: { w: 768, h: 1024, label: 'iPad (768×1024)' },
  desktop: { w: 1280, h: 800, label: 'Desktop (1280×800)' },
};

function renderHeatmap(
  canvas: HTMLCanvasElement,
  points: Array<{ x: number; y: number }>,
  radius: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Step 1: build alpha map by stacking radial gradients
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return;

  for (const p of points) {
    const g = octx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  }

  // Step 2: read alpha and colorize using a heatmap palette
  const img = octx.getImageData(0, 0, w, h);
  const data = img.data;
  const palette = buildPalette();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const idx = Math.min(255, a) * 4;
    data[i] = palette[idx];
    data[i + 1] = palette[idx + 1];
    data[i + 2] = palette[idx + 2];
    data[i + 3] = Math.min(220, a + 40);
  }
  ctx.putImageData(img, 0, 0);
}

function buildPalette(): Uint8ClampedArray {
  // 256 colors blue → cyan → green → yellow → red
  const p = new Uint8ClampedArray(256 * 4);
  const stops = [
    { at: 0, c: [0, 0, 255] },
    { at: 0.25, c: [0, 255, 255] },
    { at: 0.5, c: [0, 255, 0] },
    { at: 0.75, c: [255, 255, 0] },
    { at: 1, c: [255, 0, 0] },
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const loadPages = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/heatmap-pages?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setPages(d.pages || []);
      if (!selectedPath && d.pages?.length > 0) setSelectedPath(d.pages[0].path);
    } catch {
      setError('Sayfalar yüklenemedi');
    }
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
      const d = await r.json();
      setData(d);
      setError('');
    } catch {
      setError('Heatmap yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, selectedPath, range, device]);

  useEffect(() => { loadPages(); }, [loadPages]);
  useEffect(() => { loadHeatmap(); }, [loadHeatmap]);

  // Render the canvas when data changes or viewport changes
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    const preset = VIEWPORT_PRESETS[viewport];
    // Render up to 5x viewport height to cover long pages
    const canvasH = preset.h * 5;
    canvasRef.current.width = preset.w;
    canvasRef.current.height = canvasH;
    const points = data.clicks.map((c) => ({
      x: (Number(c.x_pct) / 100) * preset.w,
      y: (Number(c.y_pct) / 100) * canvasH,
    }));
    renderHeatmap(canvasRef.current, points, 30);
  }, [data, viewport]);

  const preset = VIEWPORT_PRESETS[viewport];
  const totalClicks = data?.clicks?.length || 0;
  const iframeSrc = selectedPath || '/';
  // Drop query params for iframe — keep clean rendering
  const iframeUrlClean = iframeSrc.split('?')[0];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Flame size={28} />
          <h2 className="text-2xl font-bold">Click Heatmap</h2>
        </div>
        <p className="opacity-90 text-sm">
          Müşterilerin tıkladığı yerleri gör. Sıcak bölgeler = çok tıklanan yerler.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Sayfa</label>
          <select
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm min-w-[300px]"
          >
            {pages.length === 0 && <option value="">Veri yok</option>}
            {pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path} ({p.clicks} click, {p.visitors} ziyaretçi)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Zaman</label>
          <div className="flex gap-1">
            {(['today', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-2 text-sm rounded-lg ${
                  range === r ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {r === 'today' ? 'Bugün' : r === '7d' ? '7 Gün' : '30 Gün'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Cihaz filtresi</label>
          <div className="flex gap-1">
            {(['all', 'mobile', 'tablet', 'desktop'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${
                  device === d ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {d === 'mobile' && <Smartphone size={14} />}
                {d === 'tablet' && <Tablet size={14} />}
                {d === 'desktop' && <Monitor size={14} />}
                {d === 'all' ? 'Hepsi' : d === 'mobile' ? 'Mobil' : d === 'tablet' ? 'Tablet' : 'PC'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Görünüm</label>
          <div className="flex gap-1">
            {(Object.keys(VIEWPORT_PRESETS) as Array<keyof typeof VIEWPORT_PRESETS>).map((vp) => (
              <button
                key={vp}
                onClick={() => setViewport(vp)}
                className={`px-3 py-2 text-sm rounded-lg ${
                  viewport === vp ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {VIEWPORT_PRESETS[vp].label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => { loadPages(); loadHeatmap(); }}
          className="ml-auto bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</div>}

      {/* Stats summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-600 flex items-center gap-1"><MousePointerClick size={14} /> Toplam Click</div>
          <div className="text-3xl font-bold text-red-600">{totalClicks}</div>
          <div className="text-xs text-gray-500 mt-1">son {range === 'today' ? 'bugün' : range}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-600 flex items-center gap-1"><ArrowDown size={14} /> Scroll Tamamlandı</div>
          {(() => {
            const b = data?.scrollBuckets || [];
            const at100 = b.find((x) => Number(x.bucket) === 100)?.sessions || 0;
            const at0 = b.reduce((a, x) => a + Number(x.sessions), 0) || 1;
            return (
              <>
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round((Number(at100) / Number(at0)) * 100) || 0}%
                </div>
                <div className="text-xs text-gray-500 mt-1">sayfayı sonuna kadar gördü</div>
              </>
            );
          })()}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-xs text-gray-600">Görüntülenen sayfa</div>
          <div className="text-sm font-bold text-gray-900 break-all">{selectedPath || '—'}</div>
          {selectedPath && (
            <a
              href={selectedPath}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1"
            >
              Sayfayı aç <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Heatmap render area */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold mb-3">Heatmap Görüntüsü</h3>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Yükleniyor…</div>
        ) : totalClicks === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Bu sayfa için henüz click verisi yok.
          </div>
        ) : (
          <div
            className="relative mx-auto border bg-gray-50 overflow-auto"
            style={{ width: preset.w, maxHeight: 700 }}
          >
            <iframe
              ref={iframeRef}
              src={iframeUrlClean}
              style={{
                width: preset.w,
                height: preset.h * 5,
                border: 0,
                display: 'block',
                pointerEvents: 'none',
              }}
              title="Heatmap target page"
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: preset.w,
                height: preset.h * 5,
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* Top clicked elements + scroll depth */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold mb-3">En çok tıklananlar</h3>
          {(data?.topTargets || []).length === 0 ? (
            <div className="text-sm text-gray-400">Veri yok</div>
          ) : (
            <div className="space-y-1">
              {data!.topTargets.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-gray-700 font-mono text-xs">{t.target}</span>
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">{t.clicks}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold mb-3">Scroll Depth</h3>
          {(data?.scrollBuckets || []).length === 0 ? (
            <div className="text-sm text-gray-400">Veri yok</div>
          ) : (
            <div className="space-y-3">
              {[25, 50, 75, 100].map((ms) => {
                const total = (data?.scrollBuckets || []).reduce((a, b) => a + Number(b.sessions), 0) || 1;
                const cnt = (data?.scrollBuckets || []).find((b) => Number(b.bucket) === ms)?.sessions || 0;
                const pct = Math.round((Number(cnt) / total) * 100);
                return (
                  <div key={ms}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{ms}% scroll</span>
                      <span className="text-gray-500">{cnt} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
