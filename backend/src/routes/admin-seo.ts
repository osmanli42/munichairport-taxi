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
import { gscTotals, organicFunnel, queryTable, pageTable, trackedKeywords } from '../services/seo/analytics';
import { buildTasks, setTaskStatus, trackedKeywordList, SEO_TRACKER_DIR } from '../services/seo/insights';
import { auditWithAlerts } from '../services/seo/jobs';

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
  const [totals, organic, audit, vitals, tasks] = await Promise.all([
    gsc.connected ? gscTotals(d) : Promise.resolve(null),
    organicFunnel(d),
    lastAudit(),
    latestVitals(),
    buildTasks(),
  ]);
  res.json({ days: d, gsc, totals, organic, audit, vitals, tasks: tasks.filter((t) => t.status === 'open').slice(0, 6) });
}));

router.get('/queries', authenticateAdmin, wrap(async (req, res) => {
  const d = days(req.query.days);
  const kw = await trackedKeywordList();
  const [table, tracked] = await Promise.all([queryTable(d, String(req.query.device || '') || undefined), trackedKeywords(kw)]);
  res.json({ days: d, ...table, tracked });
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
