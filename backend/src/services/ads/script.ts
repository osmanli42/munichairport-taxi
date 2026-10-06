// Automatic weekly report import via a Google Ads Script (no developer token needed).
// The script runs inside the Google Ads account, builds the three reports the coach uses
// (campaigns per day, search terms, keywords; last 30 days) with GAQL and posts them as CSV to
// POST /api/ads-script/import. The CSV layout matches the English Google Ads UI export, so the
// regular importer (imports.ts) parses it. The script only reads reports; it changes nothing.

import crypto from 'crypto';
import { query, run } from '../../db';
import { importAdsReport } from './imports';

const TOKEN_KEY = 'ads_script_token';
const LAST_KEY = 'ads_script_last';
const ENDPOINT = 'https://flughafen-muenchen.taxi/api/ads-script/import';

async function getSetting(key: string): Promise<string | null> {
  const [r] = await query<any>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [key]);
  return r?.setting_value ?? null;
}
async function setSetting(key: string, value: string) {
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [key, value, value]);
}

export async function scriptToken(rotate = false): Promise<string> {
  const existing = rotate ? null : await getSetting(TOKEN_KEY);
  if (existing) return existing;
  const fresh = crypto.randomBytes(24).toString('hex');
  await setSetting(TOKEN_KEY, fresh);
  return fresh;
}

export async function tokenMatches(given: string): Promise<boolean> {
  const expected = await getSetting(TOKEN_KEY);
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function lastScriptRun(): Promise<any | null> {
  const v = await getSetting(LAST_KEY);
  try { return v ? JSON.parse(v) : null; } catch { return null; }
}

/** Import the reports a script run sent; records the outcome for the admin card. */
export async function importFromScript(reports: Array<{ filename?: string; csv?: string }>) {
  const results: any[] = [];
  for (const r of reports.slice(0, 3)) {
    const name = String(r?.filename || 'Google Ads Script.csv').slice(0, 200);
    try {
      results.push({ filename: name, ok: true, ...(await importAdsReport(name, String(r?.csv || ''))) });
    } catch (e: any) {
      results.push({ filename: name, ok: false, error: e?.message || 'Import fehlgeschlagen' });
    }
  }
  await setSetting(LAST_KEY, JSON.stringify({ at: new Date().toISOString(), results }));
  return results;
}

export function buildScript(token: string): string {
  return `// Flughafen-München.TAXI: Google Ads → Admin (Ads Coach), automatischer Wochenbericht.
// Liest nur Berichte (Kampagnen pro Tag, Suchbegriffe, Keywords; letzte 30 Tage)
// und sendet sie an das Admin-Panel. Ändert nichts im Google-Ads-Konto.
var ENDPOINT = '${ENDPOINT}';
var TOKEN = '${token}';

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var day = 24 * 3600 * 1000;
  var from = Utilities.formatDate(new Date(Date.now() - 30 * day), tz, 'yyyy-MM-dd');
  var to = Utilities.formatDate(new Date(Date.now() - day), tz, 'yyyy-MM-dd');
  var range = "segments.date BETWEEN '" + from + "' AND '" + to + "'";
  var reports = [
    { filename: 'Kampagnen ' + from + ' bis ' + to + ' (Script).csv', csv: campaigns(range, from, to) },
    { filename: 'Suchbegriffe ' + from + ' bis ' + to + ' (Script).csv', csv: searchTerms(range, from, to) },
    { filename: 'Keywords ' + from + ' bis ' + to + ' (Script).csv', csv: keywords(range, from, to) }
  ];
  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Ads-Script-Token': TOKEN },
    payload: JSON.stringify({ reports: reports }),
    muteHttpExceptions: true
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error('Upload fehlgeschlagen: HTTP ' + res.getResponseCode());
}

function line(values) {
  return values.map(function (v) {
    v = v === null || v === undefined ? '' : String(v);
    return /[",\\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(',');
}
function eur(micros) { return (Number(micros || 0) / 1000000).toFixed(2); }
function pct(x) { return x === null || x === undefined || x === '' ? '' : (Number(x) * 100).toFixed(2); }
function word(s) { s = String(s || ''); return s ? s.charAt(0) + s.slice(1).toLowerCase() : ''; }
function rows(gaql, map) {
  var out = [];
  var it = AdsApp.search(gaql);
  while (it.hasNext()) out.push(line(map(it.next())));
  return out;
}

function campaigns(range, from, to) {
  var head = ['Day', 'Campaign', 'Campaign ID', 'Campaign status', 'Budget', 'Cost', 'Clicks', 'Impressions', 'Conversions', 'Conv. value',
    'Search impr. share', 'Search lost IS (budget)', 'Search lost IS (rank)'];
  return ['Campaign report', from + ' - ' + to, line(head)].concat(rows(
    'SELECT segments.date, campaign.name, campaign.id, campaign.status, campaign_budget.amount_micros, metrics.cost_micros, metrics.clicks, ' +
    'metrics.impressions, metrics.conversions, metrics.conversions_value, metrics.search_impression_share, ' +
    'metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM campaign WHERE ' + range,
    function (r) {
      var m = r.metrics || {};
      return [r.segments.date, r.campaign.name, r.campaign.id, word(r.campaign.status), eur(r.campaignBudget && r.campaignBudget.amountMicros),
        eur(m.costMicros), m.clicks, m.impressions, m.conversions, m.conversionsValue,
        pct(m.searchImpressionShare), pct(m.searchBudgetLostImpressionShare), pct(m.searchRankLostImpressionShare)];
    })).join('\\n');
}

function searchTerms(range, from, to) {
  var head = ['Search term', 'Keyword', 'Match type', 'Campaign', 'Ad group', 'Added/Excluded', 'Clicks', 'Impressions', 'Cost', 'Conversions', 'Conv. value'];
  return ['Search terms report', from + ' - ' + to, line(head)].concat(rows(
    'SELECT search_term_view.search_term, search_term_view.status, segments.search_term_match_type, segments.keyword.info.text, ' +
    'campaign.name, ad_group.name, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
    'FROM search_term_view WHERE ' + range,
    function (r) {
      var m = r.metrics || {};
      var kw = r.segments && r.segments.keyword && r.segments.keyword.info ? r.segments.keyword.info.text : '';
      return [r.searchTermView.searchTerm, kw, word(r.segments.searchTermMatchType), r.campaign.name, r.adGroup.name, word(r.searchTermView.status),
        m.clicks, m.impressions, eur(m.costMicros), m.conversions, m.conversionsValue];
    })).join('\\n');
}

function keywords(range, from, to) {
  var head = ['Keyword', 'Match type', 'Campaign', 'Ad group', 'Keyword status', 'Quality score', 'Max. CPC', 'Clicks', 'Impressions', 'Cost',
    'Conversions', 'Conv. value', 'Search impr. share'];
  return ['Keyword report', from + ' - ' + to, line(head)].concat(rows(
    'SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.name, ad_group.name, ad_group_criterion.status, ' +
    'ad_group_criterion.quality_info.quality_score, ad_group_criterion.effective_cpc_bid_micros, metrics.clicks, metrics.impressions, ' +
    'metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.search_impression_share FROM keyword_view ' +
    "WHERE ad_group_criterion.status != 'REMOVED' AND " + range,
    function (r) {
      var m = r.metrics || {};
      var c = r.adGroupCriterion;
      return [c.keyword.text, word(c.keyword.matchType), r.campaign.name, r.adGroup.name, word(c.status),
        c.qualityInfo ? c.qualityInfo.qualityScore : '', eur(c.effectiveCpcBidMicros), m.clicks, m.impressions, eur(m.costMicros),
        m.conversions, m.conversionsValue, pct(m.searchImpressionShare)];
    })).join('\\n');
}
`;
}
