// Core Web Vitals via Google PageSpeed Insights (mobile): lab score + field data (CrUX,
// what real Chrome users experienced). Free, but the anonymous quota is shared and often
// exhausted (HTTP 429). Authenticates with PAGESPEED_API_KEY if set, else with the Google
// service account (quota of its project, where "PageSpeed Insights API" must be enabled).
// Weekly for the key pages.

import { query, run } from '../../db';

async function serviceAccountToken(): Promise<string | null> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    const { google } = await import('googleapis');
    const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['openid'] });
    return (await auth.getAccessToken()).token || null;
  } catch {
    return null;
  }
}

export const VITALS_URLS = [
  'https://flughafen-muenchen.taxi/',
  'https://flughafen-muenchen.taxi/ergebnisse',
  'https://flughafen-muenchen.taxi/buchen',
  'https://flughafen-muenchen.taxi/vehicles',
  'https://flughafen-muenchen.taxi/en',
];

async function measure(url: string) {
  const params = new URLSearchParams({ url, strategy: 'mobile', category: 'performance' });
  const headers: Record<string, string> = {};
  if (process.env.PAGESPEED_API_KEY) params.set('key', process.env.PAGESPEED_API_KEY);
  else {
    const token = await serviceAccountToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { headers, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(`PageSpeed HTTP ${res.status}: ${String(body?.error?.message || '').slice(0, 300)}`);
  }
  const j: any = await res.json();
  const a = j.lighthouseResult?.audits || {};
  const f = j.loadingExperience?.metrics || {};
  const num = (v: any) => (typeof v === 'number' ? Math.round(v) : null);
  return {
    score: j.lighthouseResult?.categories?.performance?.score != null ? Math.round(j.lighthouseResult.categories.performance.score * 100) : null,
    lcp_ms: num(a['largest-contentful-paint']?.numericValue),
    cls: typeof a['cumulative-layout-shift']?.numericValue === 'number' ? a['cumulative-layout-shift'].numericValue : null,
    tbt_ms: num(a['total-blocking-time']?.numericValue),
    fcp_ms: num(a['first-contentful-paint']?.numericValue),
    field_lcp_ms: num(f.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
    field_inp_ms: num(f.INTERACTION_TO_NEXT_PAINT?.percentile),
    field_cls: typeof f.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === 'number' ? f.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
    field_category: j.loadingExperience?.overall_category || null,
  };
}

let running = false;
let lastError: string | null = null;
export const vitalsError = () => lastError;

export async function runVitals(): Promise<number> {
  if (running) return 0;
  running = true;
  let n = 0;
  lastError = null;
  try {
    for (const url of VITALS_URLS) {
      try {
        const m = await measure(url);
        await run(
          `INSERT INTO seo_vitals (url, checked_at, score, lcp_ms, cls, tbt_ms, fcp_ms, field_lcp_ms, field_inp_ms, field_cls, field_category)
           VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [url, m.score, m.lcp_ms, m.cls, m.tbt_ms, m.fcp_ms, m.field_lcp_ms, m.field_inp_ms, m.field_cls, m.field_category]);
        n++;
      } catch (e: any) {
        lastError = e?.message || String(e);
        console.error('[seo/vitals]', url, lastError);
      }
    }
  } finally {
    running = false;
  }
  return n;
}

export async function latestVitals() {
  return query<any>(`
    SELECT v.* FROM seo_vitals v
      JOIN (SELECT url, MAX(checked_at) AS m FROM seo_vitals GROUP BY url) x ON x.url = v.url AND x.m = v.checked_at
     ORDER BY v.url`);
}
