// Session Replay — ortak tipler, biçimlendiriciler ve olay zaman çizelgesi motoru.
// Backend sözleşmesi: backend/src/routes/recording.ts

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

export interface RecordingRow {
  session_id: string;
  visitor_id: string;
  total_events: number;
  total_bytes: number;
  first_ts: number | null;
  last_ts: number | null;
  recorded_from: string;
  recorded_to: string;
  chunk_count: number;
  ua_browser: string | null;
  ua_os: string | null;
  ua_device: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  country: string | null;
  city: string | null;
  landing_page: string | null;
  first_seen: string | null;
  last_seen: string | null;
  pageview_count: number;
  session_seconds: number;
  pages: string | null;
  // Rezervasyon eşleştirmesi (backend'de türetilir — recording.ts):
  //  'session' = bu oturumdan yaratılmış rezervasyon (kesin)
  //  'visitor' = aynı cihazdan oturum penceresi içinde rezervasyon (olası)
  //  'none'    = rezervasyon yok
  booking_match: 'session' | 'visitor' | 'none';
  booked_id: number | null;
  booked_number: string | null;
  booked_price: number | null;
  visitor_booking_count: number;
  saw_prices: boolean;
  opened_form: boolean;
  exit_stage: 'booked' | 'called' | 'form' | 'prices' | 'landing';
  // Vazgeçme sinyalleri (BookingFunnelTracker → visitor_events)
  drop_reason: 'booked' | 'called' | 'tech_error' | 'field_error' | 'slow' | 'compare' | 'unknown';
  last_field: string | null;
  price_shown: string | null;      // "89.00|42.3|kombi"
  fields_touched: number;
  call_clicks: number;
  field_errors: number;
  tech_errors: number;
  compare_signals: number;
  max_load_time_ms: number | null;
  frustration: number;
  intent: number;
  // Admin işaretleri (session_recording_marks)
  starred: boolean;
  watched: boolean;
  note: string | null;
}

export interface DraftRow {
  session_id: string;
  path: string;
  pickup: string;
  dropoff: string;
  price: number | null;
  distance_km: number | null;
  vehicle: string | null;
  last_stage: string | null;
  saved_at: string;
  updated_at: string;
  minutes_ago: number;
  ua_device: string | null;
  city: string | null;
  gclid: string | null;
  utm_campaign: string | null;
}

export interface Dropoff {
  days: number;
  funnel: { visited: number; saw_prices: number; opened_form: number; booked: number; called: number };
  last_fields: { field: string; n: number }[];
  errors: { type: string; target: string; n: number }[];
  price_bands: { band: string; sessions: number; booked: number }[];
  breakdown: { device: string; source: string; sessions: number; booked: number; called: number }[];
  variants: { variant: string; sessions: number; opened_form: number; booked: number }[];
}

export interface Stats {
  sessions: number;
  chunks: number;
  events: number;
  total_bytes: number;
  oldest: string;
  newest: string;
  range_days?: number;
  range_sessions?: number;
  range_bytes?: number;
  starred?: number;
  watched?: number;
  daily?: { day: string; sessions: number; bytes: number }[];
}

export interface RecSettings {
  enabled: number;
  sample_pct: number;
  retention_days: number;
  keep_starred: number;
  keep_booked: number;
}

export interface Signal { type: string; target: string | null; path: string | null; ts: number }
export interface Pageview { path: string; title: string; viewed_at: string; ts: number; load_time_ms: number | null }

export interface RecordingDetail {
  session_id: string;
  meta: any;
  pageviews: Pageview[];
  signals: Signal[];
  mark: { starred: boolean; watched: boolean; note: string | null };
  events: any[];
  event_count: number;
}

// ---------------------------------------------------------------------------
// Biçimlendiriciler
// ---------------------------------------------------------------------------
export function fmtBytes(b: number): string {
  if (!b || b < 1024) return `${b || 0} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fmtDuration(s: number): string {
  s = Math.round(s || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  return `${Math.floor(m / 60)}sa ${m % 60}m`;
}

// Kaydın gerçek uzunluğu (ilk–son rrweb olayı). visitor_sessions süresi geri dönen
// ziyaretçide günlerce görünebiliyor; ona yalnızca rrweb zamanı yoksa düşülür.
export function recSeconds(r: Pick<RecordingRow, 'first_ts' | 'last_ts' | 'session_seconds'>): number {
  const a = Number(r.first_ts), b = Number(r.last_ts);
  if (a > 0 && b >= a) return Math.round((b - a) / 1000);
  return Number(r.session_seconds) || 0;
}

// Oynatıcı saati: 03:07
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtAgo(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk önce`;
  if (min < 1440) return `${Math.round(min / 60)} sa önce`;
  if (min < 1440 * 7) return `${Math.round(min / 1440)} gün önce`;
  return d.toLocaleDateString('de-DE');
}

export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🌍';
  const upper = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 - 65 + upper.charCodeAt(0), 0x1F1E6 - 65 + upper.charCodeAt(1));
}

export function pct(a: number, b: number): string {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

export function sourceLabel(row: Pick<RecordingRow, 'gclid' | 'utm_source' | 'referrer'>): { text: string; ads: boolean } {
  if (row.gclid) return { text: 'Google Ads', ads: true };
  if (row.utm_source) return { text: row.utm_source, ads: false };
  if (row.referrer) {
    try {
      const host = new URL(row.referrer).hostname.replace(/^www\./, '');
      // Sitenin kendi sayfaları arası geçiş dış kaynak değildir
      if (!/(^|\.)flughafen-muenchen\.taxi$|^localhost$/.test(host)) return { text: host, ads: false };
    } catch {}
  }
  return { text: 'Direkt', ads: false };
}

// `pages` is a GROUP_CONCAT of every path (with query string) the visitor hit,
// joined by ' → ' (see recording.ts). Find the first /ergebnisse or /buchen leg and
// parse its pickup/dropoff params with URLSearchParams so the address decodes
// correctly (handles both %XX escapes and '+' as space) instead of showing the raw,
// truncated query string.
// `/buchen` linki fiyat, mesafe ve araç tipini de query'de taşıyor (ergebnisse/page.tsx
// handleBook) — bu yüzden müşterinin gördüğü fiyat ayrı bir tabloya ihtiyaç olmadan
// buradan okunabiliyor.
export interface ParsedTrip { pickup: string; dropoff: string; price?: number; km?: number; vehicle?: string }

export function parseTripFromUrl(leg: string): ParsedTrip | null {
  if (!/\/(ergebnisse|buchen)(\/|\?|$)/.test(leg)) return null;
  const qIndex = leg.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(leg.slice(qIndex + 1));
  const pickup = params.get('pickup') || params.get('from');
  const dropoff = params.get('dropoff') || params.get('to');
  if (!pickup || !dropoff) return null;
  const price = Number(params.get('price'));
  const km = Number(params.get('distance_km'));
  return {
    pickup, dropoff,
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    km: Number.isFinite(km) && km > 0 ? km : undefined,
    vehicle: params.get('vehicle') || undefined,
  };
}

export function parseRouteFromPages(pages: string | null): ParsedTrip | null {
  if (!pages) return null;
  let best: ParsedTrip | null = null;
  for (const leg of pages.split(' → ')) {
    const trip = parseTripFromUrl(leg);
    if (!trip) continue;
    // Fiyatı taşıyan /buchen bacağı, fiyatsız /ergebnisse bacağına tercih edilir
    if (!best || (trip.price && !best.price)) best = trip;
    if (best.price) break;
  }
  return best;
}

// "Schönstraße 6, 81543 München-Untergiesing, Deutschland" → "Schönstraße 6, München-Untergiesing"
export function shortAddr(a: string): string {
  const parts = a.split(',').map(p => p.trim()).filter(p => p && p !== 'Deutschland' && p !== 'Germany');
  if (parts.length <= 1) return parts[0] || a;
  const city = parts[parts.length - 1].replace(/^\d{5}\s*/, '');
  return `${parts[0]}, ${city}`;
}

// price_shown "89.00|42.3|kombi" → 89
export function shownPrice(v: string | null): number | null {
  if (!v) return null;
  const p = Number(v.split('|')[0]);
  return Number.isFinite(p) && p > 0 ? p : null;
}

export function prettyPath(href: string): string {
  try {
    const u = new URL(href, 'https://x.invalid');
    return decodeURIComponent(u.pathname) || '/';
  } catch {
    return href.split('?')[0] || '/';
  }
}

// ---------------------------------------------------------------------------
// Etiketler
// ---------------------------------------------------------------------------
export const EXIT_STAGE: Record<RecordingRow['exit_stage'], { text: string; short: string; tone: string; dot: string }> = {
  booked:  { text: 'Rezervasyon tamamlandı', short: 'Rezervasyon', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  called:  { text: 'Telefonla iletişime geçti', short: 'Telefon', tone: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  form:    { text: 'Form ekranında bıraktı', short: 'Formda terk', tone: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  prices:  { text: 'Fiyat ekranında bıraktı', short: 'Fiyatta terk', tone: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  landing: { text: 'Fiyata bakmadan çıktı', short: 'Girişte çıktı', tone: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
};

// Vazgeçme sebebi — hangi sinyal baskınsa backend onu seçer (recording.ts drop_reason)
export const DROP_REASON: Record<RecordingRow['drop_reason'], { text: string; tone: string } | null> = {
  booked: null,
  called: null,
  tech_error:  { text: 'Teknik hata', tone: 'text-red-600' },
  field_error: { text: 'Form hatası', tone: 'text-orange-600' },
  slow:        { text: 'Yavaş sayfa', tone: 'text-yellow-700' },
  compare:     { text: 'Fiyat karşılaştırdı', tone: 'text-indigo-600' },
  unknown: null,
};

// ---------------------------------------------------------------------------
// Olay zaman çizelgesi
// ---------------------------------------------------------------------------
export type TKind = 'page' | 'click' | 'rage' | 'focus' | 'field_error' | 'tech_error' | 'call' | 'price' | 'away' | 'copy';

export interface TItem {
  at: number;          // kaydın başından itibaren ms
  kind: TKind;
  label: string;
  detail?: string;
}

export const KIND_STYLE: Record<TKind, { color: string; chip: string; name: string }> = {
  page:        { color: '#64748b', chip: 'bg-slate-100 text-slate-700', name: 'Sayfa' },
  click:       { color: '#a78bfa', chip: 'bg-violet-50 text-violet-700', name: 'Tıklama' },
  rage:        { color: '#f97316', chip: 'bg-orange-100 text-orange-700', name: 'Sinirli tıklama' },
  focus:       { color: '#8b5cf6', chip: 'bg-purple-50 text-purple-700', name: 'Form alanı' },
  field_error: { color: '#f59e0b', chip: 'bg-amber-100 text-amber-800', name: 'Form hatası' },
  tech_error:  { color: '#ef4444', chip: 'bg-red-100 text-red-700', name: 'Teknik hata' },
  call:        { color: '#0ea5e9', chip: 'bg-sky-100 text-sky-700', name: 'Telefon / WhatsApp' },
  price:       { color: '#10b981', chip: 'bg-emerald-100 text-emerald-700', name: 'Fiyat gördü' },
  away:        { color: '#6366f1', chip: 'bg-indigo-100 text-indigo-700', name: 'Sekmeden çıktı' },
  copy:        { color: '#6366f1', chip: 'bg-indigo-100 text-indigo-700', name: 'Fiyat kopyaladı' },
};

// rrweb sabitleri (EventType / IncrementalSource / MouseInteractions)
const EV_INCREMENTAL = 3;
const EV_META = 4;
const SRC_MUTATION = 0;
const SRC_MOUSE_INTERACTION = 2;
const SRC_INPUT = 5;
const MI_CLICK = 2;

// Sinirli tıklama: ~700 ms içinde aynı bölgeye (≤ 60 px) 3+ tıklama.
// Eski sürüm konuma bakmıyordu; sayfanın farklı yerlerine hızlı tıklamalar da sayılıyordu.
export function findRageClicks(clicks: { ts: number; x: number; y: number }[]): number[] {
  const out: number[] = [];
  for (let i = 2; i < clicks.length; i++) {
    const a = clicks[i - 2], b = clicks[i - 1], c = clicks[i];
    if (c.ts - a.ts > 1200 || c.ts - b.ts > 700) continue;
    const near = (p: typeof a, q: typeof a) => Math.hypot(p.x - q.x, p.y - q.y) <= 60;
    if (near(a, b) && near(b, c)) {
      if (!out.length || c.ts - out[out.length - 1] > 3000) out.push(c.ts);
    }
  }
  return out;
}

const SIGNAL_KIND: Record<string, TKind> = {
  field_focus: 'focus',
  field_error: 'field_error',
  js_error: 'tech_error',
  api_error: 'tech_error',
  call_click: 'call',
  price_shown: 'price',
  tab_away: 'away',
  price_copy: 'copy',
};

export interface Timeline {
  items: TItem[];
  inactive: { start: number; end: number }[];
  total: number;
  rageCount: number;
  clickCount: number;
}

export function buildTimeline(events: any[], signals: Signal[]): Timeline {
  if (!events?.length) return { items: [], inactive: [], total: 0, rageCount: 0, clickCount: 0 };
  const t0 = events[0].timestamp;
  const total = Math.max(0, events[events.length - 1].timestamp - t0);
  const items: TItem[] = [];

  // Sayfa geçişleri (rrweb Meta) — /ergebnisse?pickup=… ise güzergâhı detay olarak göster
  let lastHref = '';
  for (const e of events) {
    if (e?.type !== EV_META || !e?.data?.href) continue;
    const href = String(e.data.href);
    if (href === lastHref) continue;
    lastHref = href;
    const trip = parseTripFromUrl(href);
    items.push({
      at: e.timestamp - t0,
      kind: 'page',
      label: prettyPath(href),
      detail: trip ? `${shortAddr(trip.pickup)} → ${shortAddr(trip.dropoff)}${trip.price ? ` · ${trip.price.toFixed(0)} €` : ''}` : undefined,
    });
  }

  // Tıklamalar. Etiket (buton metni) heatmap'in visitor_events 'click' kaydından gelir;
  // rrweb tıklaması yalnızca düğüm id'si taşır.
  const clickSignals = signals.filter(s => s.type === 'click');
  const clicks: { ts: number; x: number; y: number }[] = [];
  for (const e of events) {
    if (e?.type === EV_INCREMENTAL && e?.data?.source === SRC_MOUSE_INTERACTION && e?.data?.type === MI_CLICK) {
      clicks.push({ ts: e.timestamp, x: e.data.x || 0, y: e.data.y || 0 });
    }
  }
  const usedSignal = new Set<number>();
  for (const c of clicks) {
    let label = 'Tıklama';
    let best = -1, bestGap = 2500;
    clickSignals.forEach((s, i) => {
      const gap = Math.abs(s.ts - c.ts);
      if (!usedSignal.has(i) && gap < bestGap) { best = i; bestGap = gap; }
    });
    if (best >= 0) {
      usedSignal.add(best);
      if (clickSignals[best].target) label = String(clickSignals[best].target).slice(0, 60);
    }
    items.push({ at: c.ts - t0, kind: 'click', label });
  }

  const rage = findRageClicks(clicks);
  for (const ts of rage) items.push({ at: ts - t0, kind: 'rage', label: 'Aynı yere art arda tıkladı' });

  // BookingFunnelTracker sinyalleri
  let lastFocus = '';
  for (const s of signals) {
    const kind = SIGNAL_KIND[s.type];
    if (!kind) continue;
    const at = s.ts - t0;
    // Kayıt dışında kalan sinyaller (kayıt başlamadan / bittikten sonra) çizgiyi bozmasın
    if (at < -5000 || at > total + 5000) continue;
    const target = (s.target || '').trim();
    let label = target;
    if (kind === 'focus') {
      if (target === lastFocus) continue; // aynı alana tekrar odak gürültüsü
      lastFocus = target;
    }
    if (kind === 'price') {
      const p = shownPrice(target);
      const [, km, veh] = target.split('|');
      label = p ? `${p.toFixed(0)} €${km ? ` · ${Number(km).toFixed(0)} km` : ''}${veh ? ` · ${veh}` : ''}` : target;
    }
    if (kind === 'away') label = `Sekmeden ${target} uzaktaydı`;
    if (kind === 'copy') label = `Kopyaladı: ${target}`;
    if (kind === 'call') label = target.startsWith('tel') ? `Aradı (${target.replace(/^tel\s*/, '')})` : 'WhatsApp\'a tıkladı';
    items.push({ at: Math.min(Math.max(at, 0), total), kind, label: label || KIND_STYLE[kind].name });
  }

  items.sort((a, b) => a.at - b.at);

  // Hareketsiz dönemler (rrweb-player'ın skipInactive mantığıyla aynı: 10 sn+ kullanıcı
  // etkileşimi yoksa). Zaman çizelgesinde taralı gösterilir.
  const inactive: { start: number; end: number }[] = [];
  let lastActive = 0;
  for (const e of events) {
    const isUser = e?.type === EV_INCREMENTAL && e?.data?.source > SRC_MUTATION && e?.data?.source <= SRC_INPUT;
    if (!isUser) continue;
    const at = e.timestamp - t0;
    if (at - lastActive > 10_000) inactive.push({ start: lastActive + 1000, end: at - 500 });
    lastActive = at;
  }
  if (total - lastActive > 10_000) inactive.push({ start: lastActive + 1000, end: total });

  return { items, inactive, total, rageCount: rage.length, clickCount: clicks.length };
}

// Kayıt sırasında kullanılan görüntü alanı (Meta olayı width/height taşır)
export function recordedViewport(events: any[]): { width: number; height: number } | null {
  for (const e of events) {
    if (e?.type === EV_META && e?.data?.width && e?.data?.height) {
      return { width: e.data.width, height: e.data.height };
    }
  }
  return null;
}

// Kural tabanlı oturum özeti — "ne oldu" sorusuna tek paragraf cevap.
export function narrate(row: RecordingRow, tl: Timeline): string {
  const parts: string[] = [];
  const src = sourceLabel(row);
  const dev = row.ua_device === 'mobile' ? 'Telefondan' : row.ua_device === 'tablet' ? 'Tabletten' : 'Bilgisayardan';
  const via = src.ads ? `Google Ads${row.utm_campaign ? ` (${row.utm_campaign})` : ''} üzerinden`
    : src.text === 'Direkt' ? 'doğrudan' : `${src.text} üzerinden`;
  parts.push(`${dev} ${via} geldi${row.city ? ` (${row.city})` : ''}`);

  const firstPrice = tl.items.find(i => i.kind === 'price');
  const route = parseRouteFromPages(row.pages);
  if (route) {
    parts.push(`${shortAddr(route.pickup)} → ${shortAddr(route.dropoff)} için fiyat baktı${firstPrice ? ` (${fmtDuration(firstPrice.at / 1000)} sonra, ${firstPrice.label})` : ''}`);
  }
  if (row.fields_touched > 0) parts.push(`formda ${row.fields_touched} alan doldurdu`);
  if (row.field_errors > 0) parts.push(`${row.field_errors} form hatası aldı`);
  if (row.tech_errors > 0) parts.push(`${row.tech_errors} teknik hata yaşadı`);
  if (tl.rageCount > 0) parts.push(`${tl.rageCount} kez sinirli tıkladı`);
  if (row.compare_signals > 0) parts.push(`${row.compare_signals} kez sekme değiştirdi/fiyat kopyaladı`);

  if (row.booking_match === 'session') parts.push(`ve rezervasyon yaptı${row.booked_price != null ? ` (${Number(row.booked_price).toFixed(0)} €)` : ''}`);
  else if (row.booking_match === 'visitor') parts.push('aynı cihazdan bir rezervasyon görünüyor');
  else if (row.call_clicks > 0) parts.push('ve telefona/WhatsApp\'a geçti');
  else if (row.exit_stage === 'form') parts.push(`ve${row.last_field ? ` "${row.last_field}" alanında` : ''} formu bıraktı`);
  else if (row.exit_stage === 'prices') parts.push('ve fiyat ekranında ayrıldı');
  else parts.push('ve fiyata bakmadan ayrıldı');

  return parts.join(', ').replace(/^./, c => c.toUpperCase()) + '.';
}
