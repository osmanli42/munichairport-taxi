// Google Search Console — the real search data: clicks, impressions, CTR and average
// position per query, page, device and day. Read with the service account that also reads
// the calendar (GOOGLE_SERVICE_ACCOUNT_JSON); the site owner adds that e-mail as a user in
// Search Console (permission "Restricted" is enough). Read-only.
//
// Synced nightly into seo_gsc_daily (query × page × device × day) and seo_gsc_totals
// (device × day — the exact totals; the detailed rows leave out anonymised queries).

import crypto from 'crypto';
import { query, run } from '../../db';
import { berlinDateSql } from '../../utils/berlinTime';

const SITE_HOST = 'flughafen-muenchen.taxi';
const HISTORY_MONTHS = 16;
const RECENT_DAYS = 6; // GSC data settles after 2–3 days

// A separate account for Search Console can be set (GSC_SERVICE_ACCOUNT_JSON, JSON or
// base64) — e.g. from another Google Cloud project; otherwise the calendar's account.
function serviceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function gscServiceEmail(): string | null {
  return serviceAccount()?.client_email || null;
}

// write = sitemap submit (needs permission „Uneingeschränkt“ in Search Console); else read-only.
export async function api(write = false) {
  const sa = serviceAccount();
  if (!sa) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON fehlt');
  const { google } = await import('googleapis');
  const scope = write ? 'https://www.googleapis.com/auth/webmasters' : 'https://www.googleapis.com/auth/webmasters.readonly';
  const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: [scope] });
  return google.searchconsole({ version: 'v1', auth });
}

async function setting(key: string): Promise<string | null> {
  const [r] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [key]);
  return r?.setting_value ?? null;
}
async function saveSetting(key: string, value: string) {
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [key, value, value]);
}

export type GscStatus = {
  configured: boolean;       // service account present
  email: string | null;
  connected: boolean;        // a matching property is visible
  site: string | null;       // e.g. 'sc-domain:flughafen-muenchen.taxi'
  permission: string | null;
  error: string | null;
  error_kind: 'no_account' | 'api_disabled' | 'no_access' | 'other' | null;
  last_sync: string | null;
  rows: number;
};

// The property lookup is a Google call; one page load asks several times → 2 min cache.
let accessCache: { at: number; value: Partial<GscStatus> } | null = null;

/** Finds the Search Console property for our domain (domain property preferred). */
export async function gscStatus(fresh = false): Promise<GscStatus> {
  const email = gscServiceEmail();
  const base: GscStatus = { configured: !!email, email, connected: false, site: null, permission: null, error: null, error_kind: null, last_sync: await setting('seo_gsc_last_sync'), rows: 0 };
  const [cnt] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM seo_gsc_daily`);
  base.rows = Number(cnt?.n) || 0;
  if (!email) return { ...base, error_kind: 'no_account', error: 'Kein Service-Account konfiguriert' };
  if (!fresh && accessCache && Date.now() - accessCache.at < 120_000) return { ...base, ...accessCache.value };
  const result = await lookupAccess(base);
  accessCache = { at: Date.now(), value: { connected: result.connected, site: result.site, permission: result.permission, error: result.error, error_kind: result.error_kind } };
  return result;
}

async function lookupAccess(base: GscStatus): Promise<GscStatus> {
  try {
    const sc = await api();
    const res = await sc.sites.list();
    const sites = (res.data.siteEntry || []).filter((s) => (s.siteUrl || '').includes(SITE_HOST) && s.permissionLevel !== 'siteUnverifiedUser');
    const pick = sites.find((s) => s.siteUrl === `sc-domain:${SITE_HOST}`)
      || sites.find((s) => s.siteUrl === `https://${SITE_HOST}/`)
      || sites.find((s) => s.siteUrl === `https://www.${SITE_HOST}/`)
      || sites[0];
    if (!pick) return { ...base, error_kind: 'no_access', error: `Keine Search-Console-Property für ${SITE_HOST} freigegeben` };
    if (pick.siteUrl && pick.siteUrl !== (await setting('seo_gsc_site'))) await saveSetting('seo_gsc_site', pick.siteUrl);
    return { ...base, connected: true, site: pick.siteUrl || null, permission: pick.permissionLevel || null };
  } catch (e: any) {
    const msg = String(e?.errors?.[0]?.message || e?.message || e);
    const kind = /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg) ? 'api_disabled' : /permission|forbidden|403/i.test(msg) ? 'no_access' : 'other';
    return { ...base, error_kind: kind, error: msg.slice(0, 400) };
  }
}

const hash = (...parts: string[]) => crypto.createHash('sha1').update(parts.join('\u0001')).digest('hex');

async function fetchRows(site: string, start: string, end: string, dimensions: string[]) {
  const sc = await api();
  const out: any[] = [];
  for (let startRow = 0; ; startRow += 25000) {
    const res = await sc.searchanalytics.query({
      siteUrl: site,
      requestBody: { startDate: start, endDate: end, dimensions, rowLimit: 25000, startRow, dataState: 'all' },
    });
    const rows = res.data.rows || [];
    out.push(...rows);
    if (rows.length < 25000) break;
  }
  return out;
}

let syncing = false;

/** Re-reads [start, end] from Search Console and replaces those days. */
export async function syncGsc(start: string, end: string): Promise<{ rows: number; totals: number } | null> {
  if (syncing) return null;
  syncing = true;
  try {
    const status = await gscStatus();
    if (!status.connected || !status.site) throw new Error(status.error || 'Search Console nicht verbunden');
    const [detail, totals] = await Promise.all([
      fetchRows(status.site, start, end, ['date', 'query', 'page', 'device']),
      fetchRows(status.site, start, end, ['date', 'device']),
    ]);
    await run(`DELETE FROM seo_gsc_daily WHERE date BETWEEN ? AND ?`, [start, end]);
    await run(`DELETE FROM seo_gsc_totals WHERE date BETWEEN ? AND ?`, [start, end]);
    for (let i = 0; i < detail.length; i += 500) {
      const chunk = detail.slice(i, i + 500);
      await run(
        `INSERT INTO seo_gsc_daily (row_hash, date, query, page, device, clicks, impressions, position) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',')}
         ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), impressions = VALUES(impressions), position = VALUES(position)`,
        chunk.flatMap((r) => {
          const [date, q, page, device] = r.keys;
          return [hash(date, q, page, device), date, String(q).slice(0, 500), String(page).slice(0, 700), device, r.clicks || 0, r.impressions || 0, r.position || 0];
        }));
    }
    for (let i = 0; i < totals.length; i += 500) {
      const chunk = totals.slice(i, i + 500);
      await run(
        `INSERT INTO seo_gsc_totals (date, device, clicks, impressions, position) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?)').join(',')}
         ON DUPLICATE KEY UPDATE clicks = VALUES(clicks), impressions = VALUES(impressions), position = VALUES(position)`,
        chunk.flatMap((r) => [r.keys[0], r.keys[1], r.clicks || 0, r.impressions || 0, r.position || 0]));
    }
    await saveSetting('seo_gsc_last_sync', new Date().toISOString());
    return { rows: detail.length, totals: totals.length };
  } finally {
    syncing = false;
  }
}

export async function syncGscRecent() {
  return syncGsc(berlinDateSql(-RECENT_DAYS), berlinDateSql(-1));
}

/** First run: the whole history Search Console keeps, month by month. */
export async function syncGscHistory() {
  let total = 0;
  for (let m = HISTORY_MONTHS; m > 0; m--) {
    const start = berlinDateSql(-m * 30);
    const end = berlinDateSql(-(m - 1) * 30 - 1);
    const r = await syncGsc(start, end);
    total += r?.rows || 0;
  }
  const r = await syncGscRecent();
  return total + (r?.rows || 0);
}

// ---- Sitemaps & index status ----------------------------------------------------------------

export async function gscSitemaps() {
  const status = await gscStatus();
  if (!status.connected || !status.site) return null;
  const sc = await api();
  const res = await sc.sitemaps.list({ siteUrl: status.site });
  return (res.data.sitemap || []).map((s) => ({
    path: s.path,
    last_submitted: s.lastSubmitted,
    last_downloaded: s.lastDownloaded,
    errors: Number(s.errors || 0),
    warnings: Number(s.warnings || 0),
    submitted: (s.contents || []).reduce((n, c) => n + Number(c.submitted || 0), 0),
    is_pending: !!s.isPending,
  }));
}

export async function inspectUrl(url: string) {
  const status = await gscStatus();
  if (!status.connected || !status.site) return null;
  const sc = await api();
  const res = await sc.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl: status.site, languageCode: 'de' } });
  const r = res.data.inspectionResult?.indexStatusResult;
  return {
    url,
    verdict: r?.verdict || null,                 // PASS / NEUTRAL / FAIL
    coverage: r?.coverageState || null,          // "Submitted and indexed" …
    last_crawl: r?.lastCrawlTime || null,
    google_canonical: r?.googleCanonical || null,
    user_canonical: r?.userCanonical || null,
    robots: r?.robotsTxtState || null,
    indexing: r?.indexingState || null,
  };
}
