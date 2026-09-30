// Google Ads report CSV import (German or English UI): Kampagnen, Suchbegriffe, Keywords.
// Reports downloaded from the Google Ads tables start with a title line and a date-range line,
// then the header row, data rows and „Gesamt: …“ total rows. The report type is detected from
// the header. Nothing is sent to Google — this only reads what the admin uploads.

import { query, run } from '../../db';
import { parseCsv } from '../seo/backlinks';

export type AdsImportKind = 'campaigns' | 'search_terms' | 'keywords';

const norm = (s: string) => s.toLowerCase().replace(/ /g, ' ').replace(/[„“"]/g, '').replace(/\s+/g, ' ').trim();

// Header aliases (lower-case) → field. Order matters only for readability.
const ALIASES: Record<string, string[]> = {
  day: ['tag', 'day', 'datum', 'date'],
  campaign: ['kampagne', 'campaign', 'kampagnenname', 'campaign name'],
  campaign_id: ['kampagnen-id', 'campaign id', 'kampagnen id'],
  ad_group: ['anzeigengruppe', 'ad group'],
  status: ['kampagnenstatus', 'campaign status', 'status', 'keyword-status', 'keyword status'],
  budget: ['budget'],
  term: ['suchbegriff', 'search term', 'suchanfrage', 'search query'],
  keyword: ['keyword', 'suchbegriff-keyword', 'keyword text', 'keywords'],
  match_type: ['übereinstimmungstyp', 'match type', 'keyword-übereinstimmungstyp', 'keyword match type', 'suchbegriff-übereinstimmungstyp', 'search term match type'],
  added: ['hinzugefügt/ausgeschlossen', 'added/excluded'],
  quality: ['qualitätsfaktor', 'quality score'],
  max_cpc: ['max. cpc', 'max. cpc (gebot)', 'max cpc', 'standard-max.-cpc'],
  cost: ['kosten', 'cost', 'kosten (eur)', 'cost (eur)'],
  clicks: ['klicks', 'clicks'],
  impressions: ['impr.', 'impressionen', 'impressions', 'impr'],
  conversions: ['conversions', 'conv.', 'alle conv.'],
  conv_value: ['conv.-wert', 'conv. value', 'conversion value', 'alle conv.-werte'],
  impr_share: ['anteil an möglichen impressionen im suchnetzwerk', 'search impr. share', 'anteil an möglichen impressionen', 'impr. share (is)', 'search impression share'],
  lost_budget: ['anteil an entgangenen impressionen im suchnetzwerk (budget)', 'search lost is (budget)', 'entgangene impressionen (budget)', 'search lost impr. share (budget)'],
  lost_rank: ['anteil an entgangenen impressionen im suchnetzwerk (rang)', 'search lost is (rank)', 'entgangene impressionen (rang)', 'search lost impr. share (rank)'],
};

function mapHeader(row: string[]) {
  const idx: Record<string, number> = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (idx[field] === undefined && names.includes(h)) idx[field] = i;
    }
  });
  return idx;
}

/** Number in German („1.234,56 €“, „45,67 %“, „< 10 %“) or English („1,234.56“) format; „--“ → null. */
export function num(v: string | undefined, german: boolean): number | null {
  let s = String(v ?? '').replace(/ /g, ' ').replace(/[€%\s]|EUR/g, '').replace(/^[<>]/, '').trim();
  if (!s || s === '--' || s === '-' || s === '—') return null;
  if (german) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  januar: 1, jan: 1, january: 1, februar: 2, feb: 2, february: 2, märz: 3, mär: 3, maerz: 3, march: 3, mar: 3, april: 4, apr: 4,
  mai: 5, may: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  oktober: 10, okt: 10, october: 10, oct: 10, november: 11, nov: 11, dezember: 12, dez: 12, december: 12, dec: 12,
};
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** „2026-09-01“, „01.09.2026“, „1. Sept. 2026“, „Mo., 1. Sept. 2026“, „Sep 1, 2026“, „September 1, 2026“. */
export function parseDay(v: string | undefined): string | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/^[a-zäöü]{2,3}\.?,\s*/, '');
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\.?\s+([a-zäöü]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[2]]) return iso(+m[3], MONTHS[m[2]], +m[1]);
  m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/);
  if (m && MONTHS[m[1]]) return iso(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

/** Date range from the report's second line: „1. September 2026 - 30. September 2026“. */
function parseRange(lines: string[][]): { from: string | null; to: string | null } {
  for (const r of lines.slice(0, 3)) {
    const text = r.join(' ');
    const parts = text.split(/\s[-–]\s/);
    if (parts.length === 2) {
      const from = parseDay(parts[0]);
      const to = parseDay(parts[1]);
      if (from && to) return { from, to };
    }
  }
  return { from: null, to: null };
}

export type ParsedReport = {
  kind: AdsImportKind;
  german: boolean;
  from: string | null;
  to: string | null;
  rows: Array<Record<string, any>>;
};

export function parseAdsReport(text: string): ParsedReport {
  const all = parseCsv(text);
  const headerAt = all.findIndex((r) => {
    const idx = mapHeader(r);
    return (idx.campaign !== undefined || idx.term !== undefined || idx.keyword !== undefined) && (idx.cost !== undefined || idx.clicks !== undefined);
  });
  if (headerAt < 0) {
    throw new Error('Google Ads raporu tanınamadı. Kampagnen, Suchbegriffe veya Keywords tablosunu „Herunterladen → CSV“ ile indirip yükleyin.');
  }
  const header = all[headerAt];
  const idx = mapHeader(header);
  const german = header.some((h) => /kosten|klicks|kampagne|suchbegriff/i.test(h));
  const kind: AdsImportKind = idx.term !== undefined ? 'search_terms'
    : idx.keyword !== undefined ? 'keywords'
    : 'campaigns';
  const { from, to } = parseRange(all.slice(0, headerAt));

  const get = (r: string[], f: string) => (idx[f] === undefined ? undefined : r[idx[f]]);
  const rows: Array<Record<string, any>> = [];
  for (const r of all.slice(headerAt + 1)) {
    const first = norm(r[0] || '');
    // Total rows („Gesamt: Konto“, „Total: Campaigns“) and empty lines.
    if (!first || /^(gesamt|total|summe)\b/.test(first) || r.every((c) => !c.trim())) continue;
    const base = {
      cost: num(get(r, 'cost'), german) ?? 0,
      clicks: Math.round(num(get(r, 'clicks'), german) ?? 0),
      impressions: Math.round(num(get(r, 'impressions'), german) ?? 0),
      conversions: num(get(r, 'conversions'), german) ?? 0,
      conv_value: num(get(r, 'conv_value'), german) ?? 0,
    };
    if (kind === 'campaigns') {
      const campaign = (get(r, 'campaign') || '').trim();
      if (!campaign) continue;
      rows.push({
        ...base,
        day: idx.day !== undefined ? parseDay(get(r, 'day')) : null,
        campaign,
        campaign_id: (get(r, 'campaign_id') || '').replace(/\D/g, '') || null,
        status: (get(r, 'status') || '').trim() || null,
        budget: num(get(r, 'budget'), german),
        impr_share: num(get(r, 'impr_share'), german),
        lost_budget: num(get(r, 'lost_budget'), german),
        lost_rank: num(get(r, 'lost_rank'), german),
      });
    } else if (kind === 'search_terms') {
      const term = (get(r, 'term') || '').trim();
      if (!term) continue;
      rows.push({
        ...base,
        term: term.toLowerCase(),
        keyword: (get(r, 'keyword') || '').trim().toLowerCase() || null,
        match_type: (get(r, 'match_type') || '').trim() || null,
        campaign: (get(r, 'campaign') || '').trim() || null,
        ad_group: (get(r, 'ad_group') || '').trim() || null,
        added_status: (get(r, 'added') || '').trim() || null,
      });
    } else {
      const keyword = (get(r, 'keyword') || '').trim();
      if (!keyword) continue;
      rows.push({
        ...base,
        keyword: keyword.toLowerCase(),
        match_type: (get(r, 'match_type') || '').trim() || null,
        campaign: (get(r, 'campaign') || '').trim() || null,
        ad_group: (get(r, 'ad_group') || '').trim() || null,
        status: (get(r, 'status') || '').trim() || null,
        quality_score: (() => { const q = num(get(r, 'quality'), german); return q == null ? null : Math.round(q); })(),
        max_cpc: num(get(r, 'max_cpc'), german),
        impr_share: num(get(r, 'impr_share'), german),
      });
    }
  }
  if (!rows.length) throw new Error('Raporda veri satırı bulunamadı.');
  return { kind, german, from, to, rows };
}

async function insertChunks(table: string, cols: string[], rows: any[][]) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')}`, chunk.flat());
  }
}

export async function importAdsReport(filename: string, text: string) {
  const rep = parseAdsReport(text);
  let from = rep.from;
  let to = rep.to;
  if (rep.kind === 'campaigns') {
    const days = rep.rows.map((r) => r.day).filter(Boolean).sort();
    if (days.length) { from = from || days[0]; to = to || days[days.length - 1]; }
  }
  const res = await run(`INSERT INTO ads_imports (kind, filename, rows_count, period_from, period_to, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
    [rep.kind, filename.slice(0, 200), rep.rows.length, from, to]) as any;
  const id = res.insertId as number;

  if (rep.kind === 'campaigns') {
    // Daily rows replace the same day+campaign from older uploads (re-downloading a range is fine).
    const daily = rep.rows.filter((r) => r.day);
    for (const r of daily) await run(`DELETE FROM ads_campaign_stats WHERE day = ? AND campaign = ? AND import_id <> ?`, [r.day, r.campaign, id]);
    await insertChunks('ads_campaign_stats',
      ['import_id', 'day', 'campaign', 'campaign_id', 'status', 'budget', 'cost', 'clicks', 'impressions', 'conversions', 'conv_value', 'impr_share', 'lost_budget', 'lost_rank'],
      rep.rows.map((r) => [id, r.day, r.campaign.slice(0, 255), r.campaign_id, r.status?.slice(0, 40) ?? null, r.budget, r.cost, r.clicks, r.impressions, r.conversions, r.conv_value, r.impr_share, r.lost_budget, r.lost_rank]));
    for (const r of rep.rows) {
      if (r.campaign_id) await run(`INSERT INTO ads_campaign_names (campaign_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`, [r.campaign_id, r.campaign.slice(0, 255)]);
    }
  } else if (rep.kind === 'search_terms') {
    await insertChunks('ads_search_terms',
      ['import_id', 'term', 'keyword', 'match_type', 'campaign', 'ad_group', 'added_status', 'clicks', 'impressions', 'cost', 'conversions', 'conv_value'],
      rep.rows.map((r) => [id, r.term.slice(0, 500), r.keyword?.slice(0, 255) ?? null, r.match_type?.slice(0, 40) ?? null, r.campaign?.slice(0, 255) ?? null, r.ad_group?.slice(0, 255) ?? null, r.added_status?.slice(0, 60) ?? null, r.clicks, r.impressions, r.cost, r.conversions, r.conv_value]));
  } else {
    await insertChunks('ads_keywords',
      ['import_id', 'keyword', 'match_type', 'campaign', 'ad_group', 'status', 'quality_score', 'max_cpc', 'clicks', 'impressions', 'cost', 'conversions', 'conv_value', 'impr_share'],
      rep.rows.map((r) => [id, r.keyword.slice(0, 255), r.match_type?.slice(0, 40) ?? null, r.campaign?.slice(0, 255) ?? null, r.ad_group?.slice(0, 255) ?? null, r.status?.slice(0, 60) ?? null, r.quality_score, r.max_cpc, r.clicks, r.impressions, r.cost, r.conversions, r.conv_value, r.impr_share]));
  }
  return { id, kind: rep.kind, rows: rep.rows.length, from, to };
}

export async function deleteImport(id: number) {
  await run(`DELETE FROM ads_campaign_stats WHERE import_id = ?`, [id]);
  await run(`DELETE FROM ads_search_terms WHERE import_id = ?`, [id]);
  await run(`DELETE FROM ads_keywords WHERE import_id = ?`, [id]);
  await run(`DELETE FROM ads_imports WHERE id = ?`, [id]);
}

export async function listImports() {
  return query<any>(`SELECT id, kind, filename, rows_count,
      DATE_FORMAT(period_from, '%Y-%m-%d') AS period_from, DATE_FORMAT(period_to, '%Y-%m-%d') AS period_to,
      DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
    FROM ads_imports ORDER BY id DESC LIMIT 30`);
}

export async function latestImport(kind: AdsImportKind) {
  const [r] = await query<any>(`SELECT id, DATE_FORMAT(period_from, '%Y-%m-%d') AS period_from, DATE_FORMAT(period_to, '%Y-%m-%d') AS period_to,
      DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at FROM ads_imports WHERE kind = ? ORDER BY id DESC LIMIT 1`, [kind]);
  return r || null;
}
