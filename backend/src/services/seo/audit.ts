// Site audit — our own crawler over the sitemap (like Screaming Frog / Semrush Site Audit,
// limited to what matters here). One request per second, weekly + on demand.
// Rules follow frontend/scripts/seo-tracker/lib/onPageAudit.js.

import crypto from 'crypto';
import * as cheerio from 'cheerio';
import { query, run } from '../../db';

const SITE = 'https://flughafen-muenchen.taxi';
const SITEMAP = `${SITE}/sitemap.xml`;
const UA = 'Mozilla/5.0 (compatible; FMT-SiteAudit/1.0; +https://flughafen-muenchen.taxi)';
const DELAY_MS = 1000;
const TIMEOUT_MS = 20_000;
const MAX_PAGES = 600;

export type Severity = 'error' | 'warning' | 'notice';
type Issue = { url: string; type: string; severity: Severity; detail: string };

export const ISSUE_LABELS: Record<string, string> = {
  http_error: 'Sayfa hata veriyor (4xx/5xx)',
  redirect: 'Sitemap\'teki adres yönlendiriyor',
  slow: 'Yavaş yanıt (>2,5 sn)',
  noindex: 'noindex — Google\'da görünmez',
  title_missing: 'Title yok',
  title_long: 'Title çok uzun (Google ~60 karakter gösterir)',
  title_short: 'Title çok kısa (<30)',
  title_duplicate: 'Aynı title başka sayfada da var',
  meta_missing: 'Meta açıklama yok',
  meta_long: 'Meta açıklama çok uzun (>160)',
  meta_short: 'Meta açıklama çok kısa (<70)',
  meta_duplicate: 'Aynı meta açıklama başka sayfada da var',
  h1_missing: 'H1 yok',
  h1_multiple: 'Birden fazla H1',
  canonical_missing: 'Canonical yok',
  canonical_other: 'Canonical başka adrese işaret ediyor',
  hreflang_missing: 'hreflang (de/en) yok',
  schema_missing: 'Yapılandırılmış veri (schema) yok',
  thin_content: 'İçerik az (<250 kelime)',
  img_alt: 'Resimlerin alt metni eksik',
  broken_link: 'Kırık iç link',
};

const hash = (...p: string[]) => crypto.createHash('sha1').update(p.join('\u0001')).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getOnce(url: string) {
  const start = Date.now();
  const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const html = res.status >= 200 && res.status < 300 ? await res.text() : '';
  return { status: res.status, ms: Date.now() - start, html, location: res.headers.get('location') };
}

// A deploy restarts the frontend and nginx answers 502 for a few seconds. Retry server errors and
// network failures before reporting them, so an audit that overlaps a deploy shows no false errors.
async function get(url: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await getOnce(url);
      if (r.status < 500 || attempt >= 4) return r;
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await sleep(20_000);
  }
}

export async function sitemapUrls(): Promise<string[]> {
  const xml = await (await fetch(SITEMAP, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) })).text();
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map((m) => m[1]);
  // Sitemap index → follow child sitemaps.
  if (/<sitemapindex/i.test(xml)) {
    const all: string[] = [];
    for (const sm of locs) {
      const child = await (await fetch(sm, { headers: { 'User-Agent': UA } })).text();
      all.push(...Array.from(child.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map((m) => m[1]));
    }
    return Array.from(new Set(all)).slice(0, MAX_PAGES);
  }
  return Array.from(new Set(locs)).slice(0, MAX_PAGES);
}

const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '') || u;

let running: Promise<any> | null = null;
let progress: { done: number; total: number; started_at: string } | null = null;
export const auditProgress = () => progress;

export function runAudit(): Promise<any> {
  if (running) return running;
  running = doAudit().finally(() => { running = null; progress = null; });
  return running;
}

async function doAudit() {
  const startedAt = new Date();
  const res = await run(`INSERT INTO seo_audit_runs (started_at) VALUES (NOW())`) as any;
  const runId = res.insertId;
  const urls = await sitemapUrls();
  progress = { done: 0, total: urls.length, started_at: startedAt.toISOString() };
  const issues: Issue[] = [];
  const titles = new Map<string, string[]>();
  const metas = new Map<string, string[]>();
  const internal = new Map<string, Set<string>>(); // link → pages linking to it
  const statusOf = new Map<string, number>();

  for (const url of urls) {
    try {
      const r = await get(url);
      statusOf.set(norm(url), r.status);
      if (r.status >= 300 && r.status < 400) issues.push({ url, type: 'redirect', severity: 'warning', detail: `${r.status} → ${r.location || '?'}` });
      else if (r.status >= 400) issues.push({ url, type: 'http_error', severity: 'error', detail: `HTTP ${r.status}` });
      if (r.ms > 2500) issues.push({ url, type: 'slow', severity: 'notice', detail: `${r.ms} ms` });
      if (!r.html) {
        await savePage(url, { status: r.status, ms: r.ms });
      } else {
        const $ = cheerio.load(r.html);
        const title = $('head title').first().text().trim();
        const meta = ($('head meta[name="description"]').attr('content') || '').trim();
        const canonical = $('head link[rel="canonical"]').attr('href') || '';
        const robots = ($('head meta[name="robots"]').attr('content') || '').toLowerCase();
        const h1 = $('h1').length;
        const hreflang = $('head link[rel="alternate"][hreflang]').length;
        const schema: string[] = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const j = JSON.parse($(el).html() || '');
            for (const x of Array.isArray(j) ? j : j['@graph'] || [j]) if (x?.['@type']) schema.push(String(x['@type']));
          } catch { /* ignore */ }
        });
        const imgs = $('img');
        // alt="" = bewusst dekorativ (WCAG) → ok; nur fehlendes alt-Attribut zählt
        const withAlt = imgs.filter((_, el) => $(el).attr('alt') !== undefined).length;
        // Visible main text only: scripts (JSON-LD, Next.js payload) and header/footer/nav would inflate the count.
        const $t = cheerio.load(r.html);
        $t('script, style, noscript, template, header, footer, nav').remove();
        const words = $t('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
        let links = 0;
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') || '';
          if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
          try {
            const u = new URL(href, url);
            if (u.host.replace(/^www\./, '') !== 'flughafen-muenchen.taxi') return;
            links++;
            const k = norm(`${u.origin}${u.pathname}`);
            if (!internal.has(k)) internal.set(k, new Set());
            internal.get(k)!.add(url);
          } catch { /* ignore */ }
        });
        const noindex = robots.includes('noindex');
        if (noindex) issues.push({ url, type: 'noindex', severity: 'error', detail: robots });
        if (!title) issues.push({ url, type: 'title_missing', severity: 'error', detail: '' });
        // Google shows ~60 characters; over 70 is cut off clearly (Semrush/Ahrefs threshold).
        else if (title.length > 70) issues.push({ url, type: 'title_long', severity: 'warning', detail: `${title.length} Zeichen: ${title}` });
        else if (title.length > 60) issues.push({ url, type: 'title_long', severity: 'notice', detail: `${title.length} Zeichen: ${title}` });
        else if (title.length < 30) issues.push({ url, type: 'title_short', severity: 'notice', detail: `${title.length} Zeichen: ${title}` });
        if (!meta) issues.push({ url, type: 'meta_missing', severity: 'warning', detail: '' });
        else if (meta.length > 160) issues.push({ url, type: 'meta_long', severity: 'notice', detail: `${meta.length} Zeichen` });
        else if (meta.length < 70) issues.push({ url, type: 'meta_short', severity: 'notice', detail: `${meta.length} Zeichen` });
        if (h1 === 0) issues.push({ url, type: 'h1_missing', severity: 'warning', detail: '' });
        else if (h1 > 1) issues.push({ url, type: 'h1_multiple', severity: 'notice', detail: `${h1} × H1` });
        if (!canonical) issues.push({ url, type: 'canonical_missing', severity: 'warning', detail: '' });
        else if (norm(new URL(canonical, url).href) !== norm(url)) issues.push({ url, type: 'canonical_other', severity: 'notice', detail: canonical });
        if (hreflang === 0) issues.push({ url, type: 'hreflang_missing', severity: 'notice', detail: '' });
        if (!schema.length) issues.push({ url, type: 'schema_missing', severity: 'notice', detail: '' });
        if (words < 250) issues.push({ url, type: 'thin_content', severity: 'notice', detail: `${words} Wörter` });
        if (imgs.length && withAlt / imgs.length < 0.8) issues.push({ url, type: 'img_alt', severity: 'notice', detail: `${imgs.length - withAlt} von ${imgs.length} ohne alt` });
        if (title && !noindex) titles.set(title, [...(titles.get(title) || []), url]);
        if (meta && !noindex) metas.set(meta, [...(metas.get(meta) || []), url]);
        await savePage(url, {
          status: r.status, ms: r.ms, title, meta, h1_count: h1, canonical, noindex: noindex ? 1 : 0,
          hreflang_count: hreflang, schema_types: Array.from(new Set(schema)).join(', '), word_count: words,
          alt_ratio: imgs.length ? withAlt / imgs.length : 1, internal_links: links,
        });
      }
    } catch (e: any) {
      issues.push({ url, type: 'http_error', severity: 'error', detail: `nicht erreichbar: ${e?.message || e}` });
    }
    progress = { ...progress!, done: progress!.done + 1 };
    await sleep(DELAY_MS);
  }

  for (const [t, list] of Array.from(titles.entries())) if (list.length > 1) for (const url of list) issues.push({ url, type: 'title_duplicate', severity: 'warning', detail: `${list.length} Seiten: „${t.slice(0, 80)}“` });
  for (const [m, list] of Array.from(metas.entries())) if (list.length > 1) for (const url of list) issues.push({ url, type: 'meta_duplicate', severity: 'notice', detail: `${list.length} Seiten: „${m.slice(0, 80)}“` });

  // Incoming links per sitemap page (links from other pages only; the same page linking itself does not count).
  for (const url of urls) {
    const from = internal.get(norm(url));
    const n = from ? Array.from(from).filter((f) => norm(f) !== norm(url)).length : 0;
    await run(`UPDATE seo_audit_pages SET inlinks = ? WHERE url_hash = ?`, [n, hash(url)]);
  }

  // Internal links to pages that are not in the sitemap: check them once (HEAD-ish GET).
  const checked = new Map<string, number>();
  for (const [link, from] of Array.from(internal.entries())) {
    let st = statusOf.get(link);
    if (st === undefined) {
      if (checked.size >= 150) continue;
      try { st = (await get(link)).status; } catch { st = 0; }
      checked.set(link, st);
      await sleep(300);
    }
    if (st === 404 || st === 410 || st === 0 || (st !== undefined && st >= 500)) {
      for (const page of Array.from(from).slice(0, 5)) issues.push({ url: page, type: 'broken_link', severity: 'error', detail: `${link} → ${st || 'nicht erreichbar'}` });
    }
  }

  // Persist: open issues stay (last_seen), new ones get first_seen, missing ones are resolved.
  const seen = new Set<string>();
  for (const i of issues) {
    const key = hash(i.url, i.type, i.type === 'broken_link' ? i.detail : '');
    if (seen.has(key)) continue;
    seen.add(key);
    await run(
      `INSERT INTO seo_audit_issues (issue_key, url, type, severity, detail, first_seen, last_seen, resolved_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NULL)
       ON DUPLICATE KEY UPDATE severity = VALUES(severity), detail = VALUES(detail), last_seen = NOW(),
         first_seen = IF(resolved_at IS NULL, first_seen, NOW()), resolved_at = NULL`,
      [key, i.url.slice(0, 700), i.type, i.severity, i.detail.slice(0, 1000)]);
  }
  await run(`UPDATE seo_audit_issues SET resolved_at = NOW() WHERE resolved_at IS NULL AND last_seen < ?`, [startedAt]);

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const notices = issues.filter((i) => i.severity === 'notice').length;
  const score = healthScore(urls.length, issues);
  await run(`UPDATE seo_audit_runs SET finished_at = NOW(), pages = ?, errors = ?, warnings = ?, notices = ?, score = ? WHERE id = ?`,
    [urls.length, errors, warnings, notices, score, runId]);
  return { pages: urls.length, errors, warnings, notices, score };
}

/** 100 minus weighted share of pages with problems (errors weigh most). */
export function healthScore(pages: number, issues: Array<{ url: string; severity: Severity }>): number {
  if (!pages) return 0;
  const worst = new Map<string, number>();
  const w = { error: 1, warning: 0.35, notice: 0.08 };
  for (const i of issues) worst.set(i.url, Math.max(worst.get(i.url) || 0, w[i.severity]));
  const penalty = Array.from(worst.values()).reduce((a, b) => a + b, 0) / pages;
  return Math.max(0, Math.round(100 - penalty * 100));
}

async function savePage(url: string, p: Record<string, any>) {
  await run(
    `INSERT INTO seo_audit_pages (url_hash, url, status, ms, title, meta, h1_count, canonical, noindex, hreflang_count, schema_types, word_count, alt_ratio, internal_links, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE status = VALUES(status), ms = VALUES(ms), title = VALUES(title), meta = VALUES(meta), h1_count = VALUES(h1_count),
       canonical = VALUES(canonical), noindex = VALUES(noindex), hreflang_count = VALUES(hreflang_count), schema_types = VALUES(schema_types),
       word_count = VALUES(word_count), alt_ratio = VALUES(alt_ratio), internal_links = VALUES(internal_links), checked_at = NOW()`,
    [hash(url), url.slice(0, 700), p.status ?? null, p.ms ?? null, (p.title ?? null)?.slice?.(0, 500) ?? null, (p.meta ?? null)?.slice?.(0, 1000) ?? null,
      p.h1_count ?? null, (p.canonical ?? null)?.slice?.(0, 700) ?? null, p.noindex ?? 0, p.hreflang_count ?? null, p.schema_types ?? null,
      p.word_count ?? null, p.alt_ratio ?? null, p.internal_links ?? null]);
}
