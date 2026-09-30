// Website check (like IONOS „Website-Check“, plus what pro audit tools add): four areas —
// presence, findability, security, speed — each a list of pass / warn / fail checks with a fix hint.
// Runs daily and on demand; results are kept in seo_site_checks.

import tls from 'tls';
import zlib from 'zlib';
import * as cheerio from 'cheerio';
import { query, run } from '../../db';
import { latestVitals } from './vitals';

const HOST = 'flughafen-muenchen.taxi';
const SITE = `https://${HOST}`;
const ALT_DOMAINS = ['munichairport.taxi'];
const UA = 'Mozilla/5.0 (compatible; FMT-SiteCheck/1.0; +https://flughafen-muenchen.taxi)';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';
export type Check = { area: Area; key: string; label: string; status: CheckStatus; detail: string; fix?: string };
export type Area = 'presence' | 'findability' | 'security' | 'speed';
export const AREAS: Record<Area, string> = { presence: 'Görünürlük & marka', findability: 'Bulunabilirlik', security: 'Güvenlik', speed: 'Hız' };

async function get(url: string, opts: { manual?: boolean; encoding?: string; method?: string } = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: opts.method || 'GET',
    redirect: opts.manual ? 'manual' : 'follow',
    headers: { 'User-Agent': UA, 'Accept-Encoding': opts.encoding ?? 'identity' },
    signal: AbortSignal.timeout(20_000),
  });
  const ttfb = Date.now() - t0;
  const buf = opts.method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, buf, ttfb, total: Date.now() - t0, url: res.url };
}

function certDaysLeft(host: string): Promise<number | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c?.valid_to ? Math.floor((new Date(c.valid_to).getTime() - Date.now()) / 86400_000) : null);
    });
    s.on('error', () => resolve(null));
    s.on('timeout', () => { s.destroy(); resolve(null); });
  });
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

export async function runSiteCheck() {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // Home page, uncompressed (size) + compressed (encoding) + 3× TTFB.
  const home = await get(`${SITE}/`);
  const html = home.buf.toString('utf8');
  const $ = cheerio.load(html);
  const gz = await get(`${SITE}/`, { encoding: 'gzip, br' }).catch(() => null);
  const ttfbs = [home.ttfb];
  for (let i = 0; i < 2; i++) ttfbs.push((await get(`${SITE}/`, { method: 'HEAD' }).catch(() => ({ ttfb: home.ttfb }))).ttfb);
  const ttfb = ttfbs.sort((a, b) => a - b)[1];

  // ---- Presence -----------------------------------------------------------------------------
  const iconHref = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href');
  const fav = await get(`${SITE}/favicon.ico`, { method: 'GET' }).catch(() => null);
  const iconOk = !!fav && fav.status === 200 && /image|icon/.test(fav.headers.get('content-type') || '');
  add({ area: 'presence', key: 'favicon', label: 'Favicon', status: iconOk && iconHref ? 'pass' : iconOk || iconHref ? 'warn' : 'fail',
    detail: iconOk && iconHref ? `favicon.ico + <link rel="icon"> var` : !iconOk ? '/favicon.ico bulunamadı' : 'HTML\'de <link rel="icon"> yok',
    fix: 'Google arama sonuçlarında sitenin yanında bu ikon görünür; yoksa gri küre çıkar.' });
  const touch = $('link[rel="apple-touch-icon"]').first().attr('href');
  let touchOk = false;
  if (touch) touchOk = (await get(new URL(touch, SITE).href, { method: 'HEAD' }).catch(() => null))?.status === 200;
  add({ area: 'presence', key: 'touch_icon', label: 'Touch icon (iPhone ana ekran)', status: touchOk ? 'pass' : 'fail', detail: touchOk ? touch! : 'apple-touch-icon yok' });
  add({ area: 'presence', key: 'viewport', label: 'Mobil görünüm (viewport)', status: $('meta[name="viewport"]').length ? 'pass' : 'fail', detail: $('meta[name="viewport"]').attr('content') || 'yok' });
  const lang = $('html').attr('lang');
  add({ area: 'presence', key: 'lang', label: 'Sayfa dili (html lang)', status: lang ? 'pass' : 'warn', detail: lang || 'yok' });
  const og = $('meta[property="og:image"]').attr('content');
  add({ area: 'presence', key: 'og', label: 'Paylaşım görseli (Open Graph)', status: og && $('meta[property="og:title"]').length ? 'pass' : 'warn',
    detail: og ? 'WhatsApp/Facebook paylaşımında görsel çıkar' : 'og:image yok', fix: 'Link paylaşıldığında önizleme görseli.' });
  add({ area: 'presence', key: 'domain', label: 'Alan adı uzunluğu', status: 'info', detail: `${HOST} (${HOST.length} karakter) — kısa alternatif munichairport.taxi yönlendiriyor` });

  // ---- Findability --------------------------------------------------------------------------
  const title = $('head title').first().text().trim();
  add({ area: 'findability', key: 'title', label: 'Sayfa başlığı (title)', status: title.length >= 30 && title.length <= 60 ? 'pass' : title ? 'warn' : 'fail', detail: `${title.length} karakter: ${title}` });
  const meta = ($('meta[name="description"]').attr('content') || '').trim();
  add({ area: 'findability', key: 'meta', label: 'Meta açıklama', status: meta.length >= 70 && meta.length <= 160 ? 'pass' : meta ? 'warn' : 'fail', detail: `${meta.length} karakter` });
  const h1 = $('h1').length;
  const levels = $('h1, h2, h3, h4, h5, h6').toArray().map((el) => Number(el.tagName.slice(1)));
  let skipped = false;
  for (let i = 1; i < levels.length; i++) if (levels[i] > levels[i - 1] + 1) skipped = true;
  const count = (n: number) => levels.filter((l) => l === n).length;
  add({ area: 'findability', key: 'headings', label: 'Başlık yapısı (H1–H6)', status: h1 === 1 && !skipped ? 'pass' : 'warn',
    detail: `H1 ${h1} · H2 ${count(2)} · H3 ${count(3)} · H4 ${count(4)}${skipped ? ' · seviye atlanıyor' : ''}` });
  const $t = cheerio.load(html);
  $t('script, style, noscript, template').remove();
  const allWords = $t('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  $t('header, footer, nav').remove();
  const mainWords = $t('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  add({ area: 'findability', key: 'words', label: 'Ana sayfa içerik miktarı', status: allWords >= 500 ? 'pass' : allWords >= 300 ? 'warn' : 'fail',
    detail: `${allWords} kelime (menü/alt bilgi hariç ${mainWords})`, fix: 'Rakiplerle yarışan ana sayfada 500+ kelime önerilir.' });
  add({ area: 'findability', key: 'canonical', label: 'Canonical', status: $('link[rel="canonical"]').length ? 'pass' : 'warn', detail: $('link[rel="canonical"]').attr('href') || 'yok' });
  const schema = $('script[type="application/ld+json"]').length;
  add({ area: 'findability', key: 'schema', label: 'Yapılandırılmış veri (schema)', status: schema ? 'pass' : 'warn', detail: `${schema} blok` });
  const sm = await get(`${SITE}/sitemap.xml`).catch(() => null);
  const smUrls = sm ? (sm.buf.toString('utf8').match(/<loc>/g) || []).length : 0;
  add({ area: 'findability', key: 'sitemap', label: 'Sitemap', status: sm?.status === 200 && smUrls ? 'pass' : 'fail', detail: sm?.status === 200 ? `${smUrls} adres` : 'sitemap.xml yok' });
  const rb = await get(`${SITE}/robots.txt`).catch(() => null);
  const robots = rb?.status === 200 ? rb.buf.toString('utf8') : '';
  const blocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/im.test(robots);
  add({ area: 'findability', key: 'robots', label: 'robots.txt', status: robots && !blocksAll && /sitemap:/i.test(robots) ? 'pass' : robots ? 'warn' : 'fail',
    detail: !robots ? 'robots.txt yok' : blocksAll ? 'Tüm siteyi engelliyor!' : /sitemap:/i.test(robots) ? 'Sitemap bildirilmiş' : 'Sitemap satırı yok' });
  // Redirects: http → https, www → non-www, short domains.
  const redirect = async (from: string) => {
    const r = await get(from, { manual: true, method: 'HEAD' }).catch(() => null);
    return { status: r?.status ?? 0, location: r?.headers.get('location') || '' };
  };
  const http = await redirect(`http://${HOST}/test-pfad`);
  add({ area: 'findability', key: 'https_redirect', label: 'http → https yönlendirme', status: http.status === 301 || http.status === 308 ? 'pass' : http.status === 302 || http.status === 307 ? 'warn' : 'fail',
    detail: `${http.status || 'hata'} → ${http.location || '—'}` });
  const www = await redirect(`https://www.${HOST}/test-pfad`);
  add({ area: 'findability', key: 'www_redirect', label: 'www → www\'siz yönlendirme', status: (www.status === 301 || www.status === 308) && www.location.includes('/test-pfad') ? 'pass' : www.status ? 'warn' : 'fail',
    detail: `${www.status || 'hata'} → ${www.location || '—'}` });
  for (const d of ALT_DOMAINS) {
    const r = await redirect(`http://${d}/test-pfad`);
    const perm = r.status === 301 || r.status === 308;
    add({ area: 'findability', key: `alt_${d}`, label: `${d} yönlendirmesi`, status: perm && r.location.includes('/test-pfad') ? 'pass' : perm || r.status === 302 ? 'warn' : 'fail',
      detail: `${r.status || 'hata'} → ${r.location || '—'}`,
      fix: r.status === 302 ? 'Alan adı sağlayıcısında (IONOS → Domains → munichairport.taxi → Weiterleitung) tipi „HTTP 301 (dauerhaft)“ yap ve alt sayfa yolunu da aktarsın.' : undefined });
  }

  // ---- Security -----------------------------------------------------------------------------
  const days = await certDaysLeft(HOST);
  add({ area: 'security', key: 'ssl', label: 'SSL sertifikası', status: days == null ? 'fail' : days >= 21 ? 'pass' : days >= 7 ? 'warn' : 'fail', detail: days == null ? 'okunamadı' : `${days} gün geçerli` });
  const server = home.headers.get('server') || '';
  add({ area: 'security', key: 'server_version', label: 'Sunucu sürümü gizli', status: /\d/.test(server) ? 'fail' : 'pass', detail: server ? `Server: ${server}` : 'Server başlığı yok',
    fix: /\d/.test(server) ? 'nginx.conf → server_tokens off;' : undefined });
  const powered = home.headers.get('x-powered-by');
  add({ area: 'security', key: 'powered_by', label: 'Kullanılan teknoloji gizli', status: powered ? 'warn' : 'pass', detail: powered ? `X-Powered-By: ${powered}` : 'gizli' });
  const hsts = home.headers.get('strict-transport-security');
  add({ area: 'security', key: 'hsts', label: 'HSTS (sadece HTTPS)', status: hsts ? 'pass' : 'warn', detail: hsts || 'yok' });
  add({ area: 'security', key: 'frame', label: 'Clickjacking koruması', status: home.headers.get('x-frame-options') || /frame-ancestors/.test(home.headers.get('content-security-policy') || '') ? 'pass' : 'warn', detail: home.headers.get('x-frame-options') || 'yok' });
  add({ area: 'security', key: 'nosniff', label: 'X-Content-Type-Options', status: home.headers.get('x-content-type-options') === 'nosniff' ? 'pass' : 'warn', detail: home.headers.get('x-content-type-options') || 'yok' });
  add({ area: 'security', key: 'referrer', label: 'Referrer-Policy', status: home.headers.get('referrer-policy') ? 'pass' : 'warn', detail: home.headers.get('referrer-policy') || 'yok' });
  const mixed = $('img[src^="http://"], script[src^="http://"], link[href^="http://"][rel="stylesheet"], iframe[src^="http://"]').length;
  add({ area: 'security', key: 'mixed', label: 'Karışık içerik (http kaynak)', status: mixed ? 'fail' : 'pass', detail: mixed ? `${mixed} http kaynak` : 'yok' });

  // ---- Speed --------------------------------------------------------------------------------
  add({ area: 'speed', key: 'ttfb', label: 'Sunucu işlem süresi (TTFB)', status: ttfb < 400 ? 'pass' : ttfb < 800 ? 'warn' : 'fail', detail: `${ttfb} ms — sunucunun kendisinden ölçüldü; ziyaretçinin gördüğü süreye mesafe eklenir`,
    fix: ttfb >= 400 ? 'Sayfa oluşturma yavaş: veritabanı sorguları / sunucu yükü kontrol edilmeli.' : undefined });
  const enc = gz?.headers.get('content-encoding') || '';
  // fetch() decompresses the body, so the transferred size is estimated with gzip level 6 (nginx/Next default).
  const raw = home.buf.length;
  const gzLen = zlib.gzipSync(home.buf, { level: 6 }).length;
  add({ area: 'speed', key: 'compression', label: 'Sıkıştırma (gzip/brotli)', status: enc ? 'pass' : 'fail', detail: enc ? `${enc} · ~${kb(gzLen)} aktarılıyor` : 'yok' });
  add({ area: 'speed', key: 'html_size', label: 'HTML boyutu', status: raw <= 100 * 1024 ? 'pass' : raw <= 250 * 1024 ? 'warn' : 'fail',
    detail: `${kb(raw)} ham · ${kb(gzLen)} sıkıştırılmış aktarılıyor`, fix: raw > 100 * 1024 ? 'Next.js sayfa verisini HTML\'e gömüyor; ziyaretçiye giden sıkıştırılmış boyut belirleyici.' : undefined });
  const h = home.headers;
  const cdn = h.get('cf-ray') ? 'Cloudflare' : h.get('x-amz-cf-id') ? 'CloudFront' : /fastly|varnish|cloudfront|akamai/i.test(`${h.get('via') || ''} ${h.get('x-served-by') || ''} ${h.get('server') || ''}`) ? 'CDN' : '';
  add({ area: 'speed', key: 'cdn', label: 'CDN', status: cdn ? 'pass' : 'warn', detail: cdn || 'CDN yok — tüm istekler doğrudan sunucuya gidiyor',
    fix: cdn ? undefined : 'Cloudflare (ücretsiz plan) görselleri ve statik dosyaları Avrupa\'dan sunar.' });
  const img = await get(`${SITE}/images/logo-wide.webp`, { method: 'HEAD' }).catch(() => null);
  const cc = img?.headers.get('cache-control') || '';
  const maxAge = Number((cc.match(/max-age=(\d+)/) || [])[1] || 0);
  add({ area: 'speed', key: 'cache', label: 'Görsel önbelleği', status: maxAge >= 604800 ? 'pass' : maxAge > 0 ? 'warn' : 'fail', detail: cc || 'Cache-Control yok' });
  const vit = (await latestVitals()).find((v: any) => { try { return new URL(v.url).pathname === '/'; } catch { return false; } });
  if (vit) add({ area: 'speed', key: 'pagespeed', label: 'PageSpeed (mobil)', status: vit.score >= 90 ? 'pass' : vit.score >= 50 ? 'warn' : 'fail', detail: `${vit.score}/100 · LCP ${vit.lcp_ms ? `${(vit.lcp_ms / 1000).toFixed(1)} sn` : '—'} · CLS ${vit.cls ?? '—'}` });

  // Scores per area: pass 1, warn 0.5, fail 0; info not scored.
  const scores: Record<string, number> = {};
  for (const a of Object.keys(AREAS)) {
    const list = checks.filter((c) => c.area === a && c.status !== 'info');
    scores[a] = list.length ? Math.round((list.reduce((s, c) => s + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0) / list.length) * 100) : 100;
  }
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
  const result = { checked_at: new Date().toISOString(), overall, scores, checks };
  await run(`INSERT INTO seo_site_checks (created_at, overall, result) VALUES (NOW(), ?, ?)`, [overall, JSON.stringify(result)]);
  return result;
}

let running: Promise<any> | null = null;
export function siteCheckOnce() {
  if (!running) running = runSiteCheck().finally(() => { running = null; });
  return running;
}

export async function latestSiteCheck() {
  const rows = await query<any>(`SELECT overall, result FROM seo_site_checks ORDER BY id DESC LIMIT 2`);
  const parse = (r: any) => (r ? (typeof r.result === 'string' ? JSON.parse(r.result) : r.result) : null);
  return { latest: parse(rows[0]), previous: parse(rows[1]), running: !!running, areas: AREAS };
}
