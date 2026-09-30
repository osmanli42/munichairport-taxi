// /api/admin/seo2 — the SEO tab (Search Console + own tracking + site audit + page speed).
// The old /api/admin/seo/data (seo-tracker files) stays for the competitor snapshot.

import fs from 'fs';
import path from 'path';
import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { gscStatus, gscSitemaps, inspectUrl, syncGscHistory, syncGscRecent } from '../services/seo/gsc';
import { auditProgress, ISSUE_LABELS } from '../services/seo/audit';
import { runVitals, latestVitals, VITALS_URLS, vitalsError } from '../services/seo/vitals';
import { gscTotals, organicFunnel, queryTable, pageTable, trackedKeywords, positionDistribution, cannibalization } from '../services/seo/analytics';
import { buildTasks, setTaskStatus, trackedKeywordList, SEO_TRACKER_DIR } from '../services/seo/insights';
import { auditWithAlerts } from '../services/seo/jobs';
import { latestSiteCheck, siteCheckOnce } from '../services/seo/sitecheck';
import { backlinkOverview, backlinkReminder, importLinks, setBacklinkReminder } from '../services/seo/backlinks';

const router = Router();
const days = (v: unknown) => ([7, 28, 90].includes(Number(v)) ? Number(v) : 28);
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>) => async (req: AuthRequest, res: Response) => {
  try { await fn(req, res); } catch (e: any) {
    console.error('[admin-seo]', e?.message || e);
    res.status(500).json({ error: e?.message || 'SEO-Fehler' });
  }
};

async function lastAudit() {
  const runs = await query<any>(`SELECT id, DATE_FORMAT(started_at, '%Y-%m-%dT%H:%i:%sZ') AS started_at, DATE_FORMAT(finished_at, '%Y-%m-%dT%H:%i:%sZ') AS finished_at,
    pages, errors, warnings, notices, score FROM seo_audit_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 12`);
  return { last: runs[0] || null, previous: runs[1] || null, history: runs.slice().reverse(), running: auditProgress() };
}

router.get('/status', authenticateAdmin, wrap(async (req, res) => {
  res.json({ gsc: await gscStatus(req.query.fresh === '1'), audit: await lastAudit() });
}));

router.get('/overview', authenticateAdmin, wrap(async (req, res) => {
  const d = days(req.query.days);
  const gsc = await gscStatus();
  const [totals, organic, audit, vitals, tasks, positions] = await Promise.all([
    gsc.connected ? gscTotals(d) : Promise.resolve(null),
    organicFunnel(d),
    lastAudit(),
    latestVitals(),
    buildTasks(),
    gsc.connected ? positionDistribution(d) : Promise.resolve(null),
  ]);
  res.json({ days: d, gsc, totals, organic, audit, vitals, positions, tasks: tasks.filter((t) => t.status === 'open').slice(0, 6) });
}));

router.get('/queries', authenticateAdmin, wrap(async (req, res) => {
  const d = days(req.query.days);
  const kw = await trackedKeywordList();
  const [table, tracked, cannibal] = await Promise.all([queryTable(d, String(req.query.device || '') || undefined), trackedKeywords(kw), cannibalization(d)]);
  res.json({ days: d, ...table, tracked, cannibal });
}));

router.put('/keywords', authenticateAdmin, wrap(async (req, res) => {
  const list = Array.isArray(req.body?.keywords) ? req.body.keywords.map((k: unknown) => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 30) : null;
  if (!list) { res.status(400).json({ error: 'keywords required' }); return; }
  const v = JSON.stringify(Array.from(new Set(list)));
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES ('seo_tracked_keywords', ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [v, v]);
  res.json({ keywords: JSON.parse(v) });
}));

router.get('/pages', authenticateAdmin, wrap(async (req, res) => {
  res.json({ days: days(req.query.days), ...(await pageTable(days(req.query.days))) });
}));

// Index status of the key pages, cached for 12 h (URL Inspection quota: 2000/day).
let inspectCache: { at: number; rows: any[] } | null = null;
router.get('/technical', authenticateAdmin, wrap(async (_req, res) => {
  const gsc = await gscStatus();
  const open = await query<any>(`SELECT url, type, severity, detail, DATE_FORMAT(first_seen, '%Y-%m-%dT%H:%i:%sZ') AS first_seen
    FROM seo_audit_issues WHERE resolved_at IS NULL ORDER BY FIELD(severity, 'error', 'warning', 'notice'), type, url LIMIT 2000`);
  const resolved = await query<any>(`SELECT url, type, severity, DATE_FORMAT(resolved_at, '%Y-%m-%dT%H:%i:%sZ') AS resolved_at
    FROM seo_audit_issues WHERE resolved_at >= NOW() - INTERVAL 30 DAY ORDER BY resolved_at DESC LIMIT 100`);
  let sitemaps = null;
  let inspections = null;
  if (gsc.connected) {
    sitemaps = await gscSitemaps().catch(() => null);
    if (!inspectCache || Date.now() - inspectCache.at > 12 * 3600_000) {
      const rows = [];
      for (const u of VITALS_URLS) rows.push(await inspectUrl(u).catch((e) => ({ url: u, error: String(e?.message || e).slice(0, 200) })));
      inspectCache = { at: Date.now(), rows };
    }
    inspections = inspectCache.rows;
  }
  res.json({ labels: ISSUE_LABELS, open, resolved, audit: await lastAudit(), vitals: await latestVitals(), vitals_error: vitalsError(), sitemaps, inspections, gsc_connected: gsc.connected });
}));

// Title/Meta check per page (from the last audit): Google snippet preview + OK/problem per page.
const META_TYPES = ['http_error', 'redirect', 'noindex', 'title_missing', 'title_long', 'title_short', 'title_duplicate',
  'meta_missing', 'meta_long', 'meta_short', 'meta_duplicate', 'h1_missing', 'h1_multiple', 'canonical_missing', 'canonical_other'];
router.get('/meta', authenticateAdmin, wrap(async (_req, res) => {
  const audit = await lastAudit();
  if (!audit.last) { res.json({ audit, pages: [], labels: ISSUE_LABELS }); return; }
  const since = audit.last.started_at.replace('T', ' ').replace('Z', '');
  const pages = await query<any>(`SELECT url, status, title, meta, h1_count, noindex, DATE_FORMAT(checked_at, '%Y-%m-%dT%H:%i:%sZ') AS checked_at
    FROM seo_audit_pages WHERE checked_at >= ? ORDER BY url LIMIT 1000`, [since]);
  const issues = await query<any>(`SELECT url, type, severity FROM seo_audit_issues
    WHERE resolved_at IS NULL AND type IN (${META_TYPES.map(() => '?').join(',')})`, META_TYPES);
  const byUrl = new Map<string, Array<{ type: string; severity: string }>>();
  for (const i of issues) {
    const list = byUrl.get(i.url) || [];
    list.push({ type: i.type, severity: i.severity });
    byUrl.set(i.url, list);
  }
  res.json({
    audit,
    labels: ISSUE_LABELS,
    pages: pages.map((p) => {
      const problems = byUrl.get(p.url) || [];
      return {
        url: p.url, status: p.status, title: p.title || '', meta: p.meta || '', h1_count: p.h1_count, noindex: !!p.noindex,
        checked_at: p.checked_at, problems,
        ok: problems.length === 0,
      };
    }),
  });
}));

// Site structure from the last audit: structured data coverage, internal links (orphans), content length.
router.get('/structure', authenticateAdmin, wrap(async (_req, res) => {
  const audit = await lastAudit();
  if (!audit.last) { res.json({ audit, pages: 0 }); return; }
  const since = audit.last.started_at.replace('T', ' ').replace('Z', '');
  const rows = await query<any>(`SELECT url, schema_types, inlinks, internal_links, word_count FROM seo_audit_pages
    WHERE checked_at >= ? AND status = 200`, [since]);
  const schema: Record<string, number> = {};
  for (const r of rows) for (const t of String(r.schema_types || '').split(',').map((x) => x.trim()).filter(Boolean)) schema[t] = (schema[t] || 0) + 1;
  const withInlinks = rows.filter((r) => r.inlinks != null);
  const byIn = withInlinks.slice().sort((a, b) => a.inlinks - b.inlinks);
  res.json({
    audit,
    pages: rows.length,
    schema: Object.entries(schema).map(([type, pages]) => ({ type, pages })).sort((a, b) => b.pages - a.pages),
    noSchema: rows.filter((r) => !r.schema_types).map((r) => r.url).slice(0, 30),
    inlinksKnown: withInlinks.length > 0,
    orphans: byIn.filter((r) => r.inlinks === 0).map((r) => ({ url: r.url, words: r.word_count })).slice(0, 50),
    orphanCount: byIn.filter((r) => r.inlinks === 0).length,
    weakest: byIn.filter((r) => r.inlinks > 0).slice(0, 12).map((r) => ({ url: r.url, inlinks: r.inlinks })),
    strongest: byIn.slice(-8).reverse().map((r) => ({ url: r.url, inlinks: r.inlinks })),
    avgInlinks: withInlinks.length ? withInlinks.reduce((a, r) => a + r.inlinks, 0) / withInlinks.length : null,
    thinnest: rows.filter((r) => r.word_count != null).sort((a, b) => a.word_count - b.word_count).slice(0, 10).map((r) => ({ url: r.url, words: r.word_count })),
    avgWords: rows.length ? Math.round(rows.reduce((a, r) => a + (r.word_count || 0), 0) / rows.length) : null,
  });
}));

// Backlinks: Search Console „Links“ CSV uploads (snapshots) + referral visits from our own tracking.
router.get('/backlinks', authenticateAdmin, wrap(async (req, res) => {
  const [overview, reminder] = await Promise.all([
    backlinkOverview([7, 28, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90),
    backlinkReminder(),
  ]);
  res.json({ ...overview, reminder });
}));

// Things due in the SEO tab (badge on the admin tab bar).
router.get('/reminders', authenticateAdmin, wrap(async (_req, res) => {
  const backlinks = await backlinkReminder();
  res.json({ count: backlinks.due ? 1 : 0, backlinks });
}));

router.put('/backlinks/reminder', authenticateAdmin, wrap(async (req, res) => {
  await setBacklinkReminder(req.body?.enabled !== false);
  res.json(await backlinkReminder());
}));

router.post('/backlinks/import', authenticateAdmin, wrap(async (req, res) => {
  const csv = String(req.body?.csv || '');
  if (!csv.trim()) { res.status(400).json({ error: 'CSV boş' }); return; }
  try {
    res.json(await importLinks(String(req.body?.filename || 'links.csv'), csv));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'CSV okunamadı' });
  }
}));

router.delete('/backlinks/import/:id', authenticateAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  await run(`DELETE FROM seo_backlinks WHERE import_id = ?`, [id]);
  await run(`DELETE FROM seo_backlink_imports WHERE id = ?`, [id]);
  res.json({ ok: true });
}));

// Website check (IONOS-style): presence, findability, security, speed.
router.get('/site-check', authenticateAdmin, wrap(async (_req, res) => { res.json(await latestSiteCheck()); }));
router.post('/site-check', authenticateAdmin, wrap(async (_req, res) => {
  await siteCheckOnce();
  res.json(await latestSiteCheck());
}));

router.post('/audit', authenticateAdmin, wrap(async (_req, res) => {
  auditWithAlerts().catch((e) => console.error('[admin-seo] audit:', e?.message || e));
  res.json({ started: true, running: auditProgress() });
}));

router.post('/vitals', authenticateAdmin, wrap(async (_req, res) => {
  const measured = await runVitals();
  res.json({ measured, error: vitalsError() });
}));

router.post('/sync', authenticateAdmin, wrap(async (req, res) => {
  const st = await gscStatus();
  if (!st.connected) { res.status(400).json({ error: st.error || 'Search Console nicht verbunden', gsc: st }); return; }
  if (st.rows === 0 || req.body?.full) {
    syncGscHistory().catch((e) => console.error('[admin-seo] history sync:', e?.message || e));
    res.json({ started: 'history' });
    return;
  }
  res.json({ recent: await syncGscRecent() });
}));

router.get('/tasks', authenticateAdmin, wrap(async (_req, res) => {
  res.json({ tasks: await buildTasks() });
}));

router.put('/tasks/:key', authenticateAdmin, wrap(async (req, res) => {
  await setTaskStatus(String(req.params.key), String(req.body?.status || ''), String(req.body?.title || ''));
  res.json({ ok: true });
}));

// Weekly competitor snapshot written by frontend/scripts/seo-tracker (deepsearch, Mondays).
router.get('/competitors', authenticateAdmin, wrap(async (_req, res) => {
  let files: string[] = [];
  try { files = fs.readdirSync(SEO_TRACKER_DIR).filter((f) => /^deepsearch-.*\.json$/.test(f)).sort(); } catch { /* none */ }
  if (!files.length) { res.json({ available: false }); return; }
  const ds = JSON.parse(fs.readFileSync(path.join(SEO_TRACKER_DIR, files[files.length - 1]), 'utf8'));
  res.json({
    available: true,
    ts: ds.ts,
    keywords: Object.entries(ds.competitors?.keywords || {}).map(([k, v]: [string, any]) => ({ keyword: k, top10: (v?.top10 || []).slice(0, 10) })),
    plans: (ds.plans || []).map((p: any) => ({ keyword: p.keyword, ourUrl: p.ourUrl, ourRank: p.ourRank, competitorUrl: p.competitorUrl, gaps: p.gaps || [], suggestedH2s: p.suggestedH2s || [] })),
    suggestions: ds.keywordExpansion?.newCandidates || [],
  });
}));

export default router;
