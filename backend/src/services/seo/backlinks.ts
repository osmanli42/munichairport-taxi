// Backlinks — two free sources:
// 1) Search Console „Links“ report: the API does not expose it, so the admin uploads the CSV export
//    (Links → Export external links / Top linking sites / Top linked pages). Every upload is a snapshot;
//    we compare it with the previous one (new / lost domains).
// 2) Our own tracking: visits that arrived through a link on another website (referrer), with bookings.

import { query, run } from '../../db';
import { berlinDayOfMonth, berlinMidnightUtcSql } from '../../utils/berlinTime';

const OWN = ['flughafen-muenchen.taxi', 'munichairport.taxi', 'localhost'];
// Search engines (= organic, not a backlink) and payment / login redirects (not a link on a website).
const NOT_BACKLINK = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|yandex|qwant|startpage|baidu|brave|kagi|stripe|paypal|klarna|sofort|3dsecure|adyen|zscaler)\.|payment|checkout|3ds/i;

// Where the visit came from — AI assistants are the new „links“ worth watching.
const SOURCE: Array<[RegExp, string]> = [
  [/chatgpt|openai|perplexity|copilot|claude\.ai|gemini|you\.com|mistral/i, 'ai'],
  [/facebook|instagram|twitter|x\.com|t\.co$|linkedin|tiktok|pinterest|reddit|youtube/i, 'social'],
  [/whatsapp|l\.wl\.co|wa\.me|telegram|teams|office\.net|slack|messenger/i, 'messenger'],
];
const sourceOf = (host: string) => SOURCE.find(([re]) => re.test(host))?.[1] || 'web';

export type BacklinkKind = 'pages' | 'sites' | 'targets';

const hostOf = (v: string) => {
  const s = v.trim();
  try { return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
const isOwn = (host: string) => OWN.some((o) => host === o || host.endsWith(`.${o}`));

/** Minimal CSV parser (quotes, comma / semicolon / tab). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  // Delimiter from the first lines (reports often start with a title line). Tab / semicolon win
  // when present: German exports use „,“ as decimal separator inside semicolon files.
  const head = src.split(/\r?\n/, 6);
  const most = (d: string) => Math.max(...head.map((l) => l.split(d).length - 1));
  const delim = most('\t') >= 2 ? '\t' : most(';') >= 2 ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') inQ = false; else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

// Link counts are whole numbers; drop thousands separators of any locale („1.234“, „1,234“).
const num = (v: string | undefined) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? Number(d) : null;
};
const date = (v: string | undefined) => {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

/** Detect which Search Console export this is and turn it into rows. */
export function parseLinksExport(text: string) {
  const all = parseCsv(text);
  const body = all.filter((r) => hostOf(r[0] || '') && /\./.test(r[0] || '') && !/\s/.test((r[0] || '').trim()));
  if (!body.length) throw new Error('CSV\'de link bulunamadı. Search Console → Links → „Externe Links exportieren“ dosyasını yükleyin.');
  const firstHost = hostOf(body[0][0]);
  const hasScheme = /^https?:\/\//i.test(body[0][0].trim());
  let kind: BacklinkKind;
  if (isOwn(firstHost)) kind = 'targets';
  else if (hasScheme) kind = 'pages';
  else kind = 'sites';
  const rows = body.map((r) => {
    const v = r[0].trim();
    if (kind === 'targets') return { domain: firstHost, url: null, target: v, links: num(r[1]), last_crawled: null };
    if (kind === 'pages') return { domain: hostOf(v), url: v, target: null, links: 1, last_crawled: date(r[1]) };
    return { domain: hostOf(v), url: null, target: null, links: num(r[1]), last_crawled: null };
  }).filter((r) => r.domain && (kind === 'targets' || !isOwn(r.domain)));
  return { kind, rows };
}

export async function importLinks(filename: string, text: string) {
  const { kind, rows } = parseLinksExport(text);
  const res = await run(`INSERT INTO seo_backlink_imports (filename, kind, rows_count, created_at) VALUES (?, ?, ?, NOW())`,
    [filename.slice(0, 200), kind, rows.length]) as any;
  const id = res.insertId;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await run(
      `INSERT INTO seo_backlinks (import_id, domain, url, target, links, last_crawled) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}`,
      chunk.flatMap((r) => [id, r.domain.slice(0, 255), r.url?.slice(0, 1000) ?? null, r.target?.slice(0, 1000) ?? null, r.links, r.last_crawled]));
  }
  return { id, kind, rows: rows.length };
}

async function domainsOf(importId: number) {
  const rows = await query<any>(`SELECT domain, COALESCE(SUM(links), COUNT(*)) AS links, COUNT(*) AS n,
      DATE_FORMAT(MAX(last_crawled), '%Y-%m-%d') AS last_crawled, MIN(url) AS sample
    FROM seo_backlinks WHERE import_id = ? GROUP BY domain ORDER BY links DESC`, [importId]);
  return rows.map((r) => ({ domain: r.domain, links: Number(r.links) || Number(r.n) || 0, last_crawled: r.last_crawled, sample: r.sample }));
}

/** Visits from links on other websites (our own tracking) with bookings and revenue. */
export async function referralTraffic(days: number) {
  const rows = await query<any>(`
    SELECT LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(s.referrer, '://', -1), '/', 1), '?', 1)) AS host,
           COUNT(*) AS sessions, COUNT(b.id) AS bookings, COALESCE(SUM(b.price), 0) AS revenue,
           SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT SUBSTRING_INDEX(s.landing_page, '?', 1) ORDER BY s.first_seen DESC SEPARATOR '\\n'), '\\n', 3) AS landings
      FROM visitor_sessions s
      LEFT JOIN bookings b ON b.session_id = s.session_id AND b.status <> 'cancelled'
     WHERE s.is_bot = 0 AND s.referrer IS NOT NULL AND s.referrer <> '' AND s.referrer LIKE 'http%'
       AND s.first_seen >= ?
     GROUP BY host ORDER BY sessions DESC LIMIT 300`, [berlinMidnightUtcSql(-(days - 1))]);
  return rows
    .map((r) => ({ host: String(r.host || '').replace(/^www\./, ''), source: sourceOf(String(r.host || '')), sessions: Number(r.sessions), bookings: Number(r.bookings), revenue: Number(r.revenue), landings: String(r.landings || '').split('\n').filter(Boolean) }))
    .filter((r) => r.host && !isOwn(r.host) && !NOT_BACKLINK.test(`${r.host}.`) && !/^(android-app|ios-app)/.test(r.host))
    .slice(0, 50);
}

export async function backlinkOverview(days: number) {
  const imports = await query<any>(`SELECT id, filename, kind, rows_count, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
    FROM seo_backlink_imports ORDER BY id DESC LIMIT 50`);
  const domainImports = imports.filter((i) => i.kind !== 'targets');
  const latest = domainImports[0] || null;
  const previous = domainImports[1] || null;
  const cur = latest ? await domainsOf(latest.id) : [];
  const prev = previous ? await domainsOf(previous.id) : [];
  const prevSet = new Set(prev.map((d) => d.domain));
  const curSet = new Set(cur.map((d) => d.domain));
  const targetsImport = imports.find((i) => i.kind === 'targets');
  const targets = targetsImport
    ? (await query<any>(`SELECT target, links FROM seo_backlinks WHERE import_id = ? ORDER BY links DESC LIMIT 25`, [targetsImport.id]))
      .map((r) => ({ target: r.target, links: Number(r.links) || 0 }))
    : [];
  const history = [];
  for (const imp of domainImports.slice(0, 12).reverse()) {
    const [r] = await query<any>(`SELECT COUNT(DISTINCT domain) AS domains, COALESCE(SUM(links), COUNT(*)) AS links FROM seo_backlinks WHERE import_id = ?`, [imp.id]);
    history.push({ date: imp.created_at, domains: Number(r?.domains) || 0, links: Number(r?.links) || 0 });
  }
  return {
    latest,
    previous,
    imports: imports.slice(0, 10),
    domains: cur.map((d) => ({ ...d, isNew: !!previous && !prevSet.has(d.domain) })),
    lost: previous ? prev.filter((d) => !curSet.has(d.domain)) : [],
    targets,
    targetsImport: targetsImport || null,
    history,
    referrals: await referralTraffic(days),
  };
}

// Monthly reminder: the Search Console export is due once per calendar month (Berlin).
// Shown as a badge on the SEO tab and in the dashboard's „Handlungsbedarf“; switchable in the Backlinks tab.
const REMINDER_KEY = 'seo_backlink_reminder';

export async function backlinkReminder() {
  const [s] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [REMINDER_KEY]);
  const enabled = s?.setting_value !== '0';
  const monthStart = berlinMidnightUtcSql(-(berlinDayOfMonth() - 1));
  const [last] = await query<any>(`SELECT DATE_FORMAT(MAX(created_at), '%Y-%m-%dT%H:%i:%sZ') AS at FROM seo_backlink_imports WHERE kind <> 'targets'`);
  const lastUpload: string | null = last?.at || null;
  const uploadedThisMonth = !!lastUpload && lastUpload.replace('T', ' ').slice(0, 19) >= monthStart;
  return { enabled, due: enabled && !uploadedThisMonth, lastUpload };
}

export async function setBacklinkReminder(enabled: boolean) {
  const v = enabled ? '1' : '0';
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [REMINDER_KEY, v, v]);
}
