// Google index monitor (SEO → Indexierung): every sitemap URL is checked with the Search Console
// URL Inspection API (quota 2000/day per property, we use ≈350) and stored with its history, so a
// page that drops out of the index shows up as a red reminder. The sitemap is (re)submitted to
// Google after a deploy, at most once a day. Both can be switched off (setting seo_index_monitor).
//
// "Indexierung beantragen" itself has no API for normal pages (the Indexing API is only for job
// postings / livestreams) — the UI links to the page's inspection in Search Console instead.

import crypto from 'crypto';
import { query, run } from '../../db';
import { api, gscStatus } from './gsc';
import { sitemapUrls } from './audit';

const ENABLED_KEY = 'seo_index_monitor';
const SUBMITTED_KEY = 'seo_sitemap_submitted_at';
const SITEMAP_URL = 'https://flughafen-muenchen.taxi/sitemap.xml';
const RECHECK_HOURS = 20;
const GAP_MS = 250;
const PARALLEL = 5;
const DROP_DAYS = 14; // a dropped page stays a reminder this long (or until it is back)

const sha = (u: string) => crypto.createHash('sha1').update(u).digest('hex');
const sqlTime = (iso: string | null | undefined) => (iso ? iso.replace('T', ' ').replace(/\.\d+Z?$|Z$/, '').slice(0, 19) : null);

async function setting(key: string) {
  const [r] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [key]);
  return r?.setting_value ?? null;
}
async function saveSetting(key: string, value: string) {
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [key, value, value]);
}

export const indexMonitorEnabled = async () => (await setting(ENABLED_KEY)) !== '0';
export const setIndexMonitor = (on: boolean) => saveSetting(ENABLED_KEY, on ? '1' : '0');

// ---- What the coverage states mean (Search Console answers in German) ----------------------------

const REASONS: Array<{ re: RegExp; key: string; label: string; fix: string }> = [
  { re: /nicht bekannt|unknown to google/i, key: 'unknown', label: 'Google bu sayfayı henüz tanımıyor', fix: 'Sitemap gönderildi; birkaç gün içinde taranır. Önemliyse Search Console’da „Indexierung beantragen“.' },
  { re: /gefunden.*nicht indexiert|discovered/i, key: 'discovered', label: 'Bulundu, henüz taranmadı', fix: 'Google sırada bekletiyor. Sayfaya site içinden link ver (ör. ilgili şehir sayfalarından), sabırla bekle.' },
  { re: /gecrawlt.*nicht indexiert|crawled/i, key: 'crawled', label: 'Tarandı, indekse alınmadı', fix: 'Google içeriği yeterince değerli/benzersiz bulmadı. Metni genişlet, diğer sayfalardan farklılaştır, iç link ekle.' },
  { re: /alternative seite|alternate page/i, key: 'alternate', label: 'Google son taramada başka URL’yi kanonik gördü', fix: 'Sayfa son taramada kanonik olarak başka bir URL’yi (ör. Almanca sürümü) gösteriyordu. Sayfa bugün doğruysa („eski tarama“ etiketi) Google yeniden taradığında düzelir.' },
  { re: /duplikat|duplicate/i, key: 'duplicate', label: 'Kopya — Google başka sayfayı seçti', fix: 'Google kanoniği ile bizimki farklı. İçeriği farklılaştır veya kanonik etiketini kontrol et.' },
  { re: /weiterleitung|redirect/i, key: 'redirect', label: 'Yönlendirme', fix: 'Sitemap’te yönlendiren URL olmamalı — hedef URL’yi kullan.' },
  { re: /noindex/i, key: 'noindex', label: 'noindex ile hariç', fix: 'Sayfa bilerek mi hariç? Değilse noindex etiketini kaldır.' },
  { re: /404|nicht gefunden|not found/i, key: 'notfound', label: 'Sayfa bulunamadı (404)', fix: 'Sayfayı geri getir veya sitemap’ten çıkar / yönlendir.' },
  { re: /robots/i, key: 'robots', label: 'robots.txt engelliyor', fix: 'robots.txt kuralını kontrol et.' },
  { re: /serverfehler|5xx|server error/i, key: 'server', label: 'Sunucu hatası', fix: 'Sayfa Google taranırken hata verdi — sunucu loglarına bak.' },
];
export function reasonOf(coverage: string | null, verdict: string | null) {
  if (verdict === 'PASS') return { key: 'indexed', label: 'İndeksli', fix: '' };
  const r = REASONS.find((x) => coverage && x.re.test(coverage));
  return r ? { key: r.key, label: r.label, fix: r.fix } : { key: 'other', label: coverage || 'Bilinmiyor', fix: 'Search Console’da sayfayı aç ve ayrıntıya bak.' };
}

// ---- Sitemap list → table ------------------------------------------------------------------------

async function syncSitemapList(): Promise<number> {
  const urls = await sitemapUrls();
  if (!urls.length) return 0;
  for (let i = 0; i < urls.length; i += 100) {
    const part = urls.slice(i, i + 100);
    await run(`INSERT INTO seo_index_pages (url_hash, url, in_sitemap, first_seen) VALUES ${part.map(() => '(?, ?, 1, NOW())').join(', ')}
      ON DUPLICATE KEY UPDATE in_sitemap = 1`, part.flatMap((u) => [sha(u), u]));
  }
  const keep = new Set(urls.map(sha));
  const gone = (await query<{ url_hash: string }>(`SELECT url_hash FROM seo_index_pages WHERE in_sitemap = 1`)).filter((r) => !keep.has(r.url_hash));
  if (gone.length) await run(`UPDATE seo_index_pages SET in_sitemap = 0 WHERE url_hash IN (${gone.map(() => '?').join(', ')})`, gone.map((r) => r.url_hash));
  return urls.length;
}

// ---- One URL ---------------------------------------------------------------------------------------

const cut = (v: unknown, n = 40) => (v == null || v === '' ? null : String(v).slice(0, n));

export async function inspectAndStore(url: string, site: string, client?: Awaited<ReturnType<typeof api>>) {
  const sc = client || (await api());
  let r: any = null;
  let error: string | null = null;
  try {
    const res = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl: site, languageCode: 'de' } });
    r = res.data.inspectionResult?.indexStatusResult || null;
  } catch (e: any) {
    error = String(e?.errors?.[0]?.message || e?.message || e).slice(0, 250);
  }
  const [prev] = await query<any>(`SELECT verdict, indexed_since, dropped_at FROM seo_index_pages WHERE url_hash = ?`, [sha(url)]);
  if (error) {
    await run(`INSERT INTO seo_index_pages (url_hash, url, in_sitemap, first_seen, checked_at, error) VALUES (?, ?, 0, NOW(), NOW(), ?)
      ON DUPLICATE KEY UPDATE checked_at = NOW(), error = ?`, [sha(url), url, error, error]);
    return { url, error };
  }
  const verdict: string | null = r?.verdict || null;
  const wasIndexed = prev?.verdict === 'PASS';
  const isIndexed = verdict === 'PASS';
  // Dropped = was indexed at the last check, is not now. Cleared again once it is back.
  const dropped = wasIndexed && !isIndexed ? 'NOW()' : isIndexed ? 'NULL' : 'dropped_at';
  const since = isIndexed ? (wasIndexed && prev?.indexed_since ? 'indexed_since' : 'NOW()') : 'NULL';
  const vals = [cut(verdict), cut(r?.coverageState, 190), cut(r?.indexingState), cut(r?.pageFetchState), cut(r?.robotsTxtState),
    cut(r?.googleCanonical, 600), cut(r?.userCanonical, 600), sqlTime(r?.lastCrawlTime), cut(r?.crawledAs)];
  await run(`INSERT INTO seo_index_pages (url_hash, url, in_sitemap, first_seen, verdict, coverage, indexing_state, page_fetch, robots,
      google_canonical, user_canonical, last_crawl, crawled_as, checked_at, error, indexed_since, dropped_at)
    VALUES (?, ?, 0, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, ${isIndexed ? 'NOW()' : 'NULL'}, NULL)
    ON DUPLICATE KEY UPDATE verdict = ?, coverage = ?, indexing_state = ?, page_fetch = ?, robots = ?, google_canonical = ?, user_canonical = ?,
      last_crawl = ?, crawled_as = ?, checked_at = NOW(), error = NULL, indexed_since = ${since}, dropped_at = ${dropped}`,
  [sha(url), url, ...vals, ...vals]);
  return { url, verdict, coverage: r?.coverageState || null };
}

// ---- Full run ------------------------------------------------------------------------------------

let progress: { done: number; total: number; started_at: string } | null = null;
let running: Promise<any> | null = null;
export const indexProgress = () => progress;

/** Checks every sitemap URL not checked in the last 20 h (all when force). */
export function runIndexCheck(force = false): Promise<any> {
  if (running) return running;
  running = (async () => {
    const st = await gscStatus();
    if (!st.connected || !st.site) throw new Error(st.error || 'Search Console nicht verbunden');
    await syncSitemapList();
    const todo = await query<{ url: string }>(`SELECT url FROM seo_index_pages WHERE in_sitemap = 1
      ${force ? '' : `AND (checked_at IS NULL OR checked_at < NOW() - INTERVAL ${RECHECK_HOURS} HOUR)`}
      ORDER BY checked_at IS NOT NULL, checked_at LIMIT 1500`);
    progress = { done: 0, total: todo.length, started_at: new Date().toISOString() };
    let errors = 0;
    const sc = await api(); // one client (and token) for the whole run
    // Each inspection takes ≈7 s at Google → 5 in parallel (limit is 600/min).
    let stop = false;
    const queue = todo.slice();
    const p = progress;
    const worker = async () => {
      for (let t = queue.shift(); t && !stop; t = queue.shift()) {
        const url = t.url;
        const r = await inspectAndStore(url, st.site!, sc).catch((e: any) => ({ url, error: String(e?.message || e) }));
        if ('error' in r && r.error) {
          errors++;
          console.error('[seo] index check', url, r.error);
          if (/quota|rate/i.test(r.error)) stop = true; // daily quota used up → continue tomorrow
        }
        p.done++;
        await new Promise((ok) => setTimeout(ok, GAP_MS));
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await snapshotDay();
    return { checked: p.done, errors };
  })().finally(() => { running = null; progress = null; });
  return running;
}

async function snapshotDay() {
  const [c] = await query<any>(`SELECT COUNT(*) AS total, SUM(verdict = 'PASS') AS indexed, SUM(verdict IS NOT NULL AND verdict <> 'PASS') AS not_indexed
    FROM seo_index_pages WHERE in_sitemap = 1`);
  await run(`INSERT INTO seo_index_daily (date, total, indexed, not_indexed) VALUES (CURDATE(), ?, ?, ?)
    ON DUPLICATE KEY UPDATE total = VALUES(total), indexed = VALUES(indexed), not_indexed = VALUES(not_indexed)`,
  [Number(c?.total) || 0, Number(c?.indexed) || 0, Number(c?.not_indexed) || 0]);
}

// ---- Sitemap -------------------------------------------------------------------------------------

export async function sitemapInfo() {
  const st = await gscStatus();
  if (!st.connected || !st.site) return null;
  const sc = await api();
  const res = await sc.sitemaps.list({ siteUrl: st.site });
  return (res.data.sitemap || []).map((s) => ({
    path: s.path,
    last_submitted: s.lastSubmitted || null,
    last_downloaded: s.lastDownloaded || null,
    errors: Number(s.errors || 0),
    warnings: Number(s.warnings || 0),
    submitted: (s.contents || []).reduce((n, c) => n + Number(c.submitted || 0), 0),
    is_pending: !!s.isPending,
  }));
}

/** Tells Google to read the sitemap again (needs „Uneingeschränkt“). */
export async function submitSitemap() {
  const st = await gscStatus();
  if (!st.connected || !st.site) throw new Error(st.error || 'Search Console nicht verbunden');
  if (st.permission === 'siteRestrictedUser') throw new Error('Search Console: Berechtigung „Eingeschränkt“ — für das Senden „Uneingeschränkt“ nötig');
  const sc = await api(true);
  await sc.sitemaps.submit({ siteUrl: st.site, feedpath: SITEMAP_URL });
  await saveSetting(SUBMITTED_KEY, new Date().toISOString());
}

/** After a deploy (backend start): resubmit the sitemap, at most once per 24 h. Production only. */
export async function autoSubmitSitemap() {
  if (process.env.NODE_ENV !== 'production' || !(await indexMonitorEnabled())) return;
  const last = await setting(SUBMITTED_KEY);
  if (last && Date.now() - new Date(last).getTime() < 24 * 3600_000) return;
  await submitSitemap();
}

// ---- Read model for the tab ------------------------------------------------------------------------

const section = (u: string) => {
  const p = u.replace(/^https?:\/\/[^/]+/, '') || '/';
  if (/^\/en(\/|$)/.test(p)) return 'en';
  if (/^\/tr(\/|$)/.test(p)) return 'tr';
  if (/^\/blog\//.test(p)) return 'blog';
  return 'main';
};

export async function indexReminder() {
  const enabled = await indexMonitorEnabled();
  if (!enabled) return { enabled, due: false, dropped: 0 };
  const [d] = await query<any>(`SELECT COUNT(*) AS n FROM seo_index_pages WHERE in_sitemap = 1 AND dropped_at IS NOT NULL
    AND dropped_at >= NOW() - INTERVAL ${DROP_DAYS} DAY AND (verdict IS NULL OR verdict <> 'PASS')`);
  const dropped = Number(d?.n) || 0;
  return { enabled, due: dropped > 0, dropped };
}

export async function indexOverview() {
  const rows = await query<any>(`SELECT url, verdict, coverage, indexing_state, page_fetch, robots, google_canonical, user_canonical,
      DATE_FORMAT(last_crawl, '%Y-%m-%dT%H:%i:%sZ') AS last_crawl, crawled_as,
      DATE_FORMAT(checked_at, '%Y-%m-%dT%H:%i:%sZ') AS checked_at, error,
      DATE_FORMAT(indexed_since, '%Y-%m-%dT%H:%i:%sZ') AS indexed_since,
      DATE_FORMAT(dropped_at, '%Y-%m-%dT%H:%i:%sZ') AS dropped_at
    FROM seo_index_pages WHERE in_sitemap = 1 ORDER BY url`);
  // Our own weekly audit reads the live canonical: no open 'canonical_other' issue = the page is
  // already right today and Google only still has an old crawl.
  const liveWrong = new Set((await query<{ url: string }>(`SELECT url FROM seo_audit_issues WHERE resolved_at IS NULL AND type = 'canonical_other'`)).map((r) => r.url.replace(/\/$/, '')));
  const pages = rows.map((r) => {
    const reason = r.checked_at && !r.error ? reasonOf(r.coverage, r.verdict) : null;
    // Google's crawl saw a canonical pointing elsewhere (user_canonical = what our page said then).
    const canonicalMismatch = !!(r.user_canonical && r.user_canonical.replace(/\/$/, '') !== r.url.replace(/\/$/, ''));
    return {
      ...r, section: section(r.url), reason_key: reason?.key || (r.error ? 'error' : 'unchecked'), reason: reason?.label || null, fix: reason?.fix || null,
      canonical_mismatch: canonicalMismatch, canonical_fixed: canonicalMismatch && !liveWrong.has(r.url.replace(/\/$/, '')),
    };
  });
  const checked = pages.filter((p) => p.checked_at && !p.error);
  const indexed = checked.filter((p) => p.verdict === 'PASS').length;
  const reasons: Record<string, { key: string; label: string; fix: string; count: number }> = {};
  for (const p of checked) {
    if (p.verdict === 'PASS') continue;
    const r = reasonOf(p.coverage, p.verdict);
    reasons[r.key] = reasons[r.key] || { ...r, count: 0 };
    reasons[r.key].count++;
  }
  const sections: Record<string, { total: number; indexed: number; checked: number }> = {};
  for (const p of pages) {
    const s = (sections[p.section] = sections[p.section] || { total: 0, indexed: 0, checked: 0 });
    s.total++;
    if (p.checked_at && !p.error) s.checked++;
    if (p.verdict === 'PASS') s.indexed++;
  }
  const history = await query<any>(`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, total, indexed, not_indexed FROM seo_index_daily ORDER BY date DESC LIMIT 90`);
  const st = await gscStatus();
  const [sitemaps, reminder, lastSubmit] = await Promise.all([sitemapInfo().catch(() => null), indexReminder(), setting(SUBMITTED_KEY)]);
  return {
    connected: st.connected,
    site: st.site,
    permission: st.permission,
    can_submit: st.connected && st.permission !== 'siteRestrictedUser',
    enabled: reminder.enabled,
    summary: {
      total: pages.length,
      checked: checked.length,
      indexed,
      not_indexed: checked.length - indexed,
      unchecked: pages.length - checked.length,
      dropped: reminder.dropped,
      canonical_mismatch: pages.filter((p) => p.canonical_mismatch).length,
      canonical_stale: pages.filter((p) => p.canonical_fixed).length,
      last_check: checked.reduce<string | null>((m, p) => (!m || p.checked_at > m ? p.checked_at : m), null),
    },
    reasons: Object.values(reasons).sort((a, b) => b.count - a.count),
    sections,
    history: history.reverse(),
    sitemaps,
    last_auto_submit: lastSubmit,
    running: indexProgress(),
    pages,
  };
}
