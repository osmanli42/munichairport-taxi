// /api/admin/ads/v2 — Google Ads coach (cockpit, campaigns, keywords, search terms, audience,
// coach to-dos, change log, report uploads, offline conversion file). The old /api/admin/ads
// endpoints stay for the suspicious-click check and daily spend.

import { Router, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { audience, campaigns, cockpit, keywords, searchTerms, settings, trackingCheck } from '../services/ads/analytics';
import { deleteImport, importAdsReport, listImports } from '../services/ads/imports';
import { adsReminder, buildCoach, FINAL_URL_SUFFIX, learningGuard, setTaskStatus } from '../services/ads/coach';
import { buildExport, exportStatus } from '../services/ads/offline';

const router = Router();
const days = (v: unknown) => ([7, 14, 30, 90].includes(Number(v)) ? Number(v) : 30);
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>) => async (req: AuthRequest, res: Response) => {
  try { await fn(req, res); } catch (e: any) {
    console.error('[ads-v2]', e?.message || e);
    res.status(500).json({ error: e?.message || 'Ads-Fehler' });
  }
};

router.get('/cockpit', authenticateAdmin, wrap(async (req, res) => {
  const d = days(req.query.days);
  const [data, coach, trk] = await Promise.all([cockpit(d), buildCoach(d), trackingCheck()]);
  res.json({ ...data, tracking: trk, guard: coach.guard, tasks: coach.tasks.filter((t) => t.status === 'open').slice(0, 5), openTasks: coach.tasks.filter((t) => t.status === 'open').length });
}));

router.get('/campaigns', authenticateAdmin, wrap(async (req, res) => { res.json(await campaigns(days(req.query.days))); }));
router.get('/keywords', authenticateAdmin, wrap(async (req, res) => {
  const [kw, st] = await Promise.all([keywords(days(req.query.days)), searchTerms()]);
  res.json({ ...kw, searchTerms: st });
}));
router.get('/audience', authenticateAdmin, wrap(async (req, res) => { res.json(await audience(days(req.query.days))); }));

router.get('/coach', authenticateAdmin, wrap(async (req, res) => { res.json(await buildCoach(days(req.query.days))); }));
router.put('/coach/:key', authenticateAdmin, wrap(async (req, res) => {
  await setTaskStatus(String(req.params.key), String(req.body?.status || ''), String(req.body?.title || ''));
  res.json({ ok: true });
}));

router.get('/changelog', authenticateAdmin, wrap(async (_req, res) => {
  const rows = await query<any>(`SELECT id, DATE_FORMAT(day, '%Y-%m-%d') AS day, campaign, category, note, learning FROM ads_changelog ORDER BY day DESC, id DESC LIMIT 200`);
  res.json({ entries: rows, guard: await learningGuard() });
}));
router.post('/changelog', authenticateAdmin, wrap(async (req, res) => {
  const day = String(req.body?.day || '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(req.body.day) : new Date().toISOString().slice(0, 10);
  const note = String(req.body?.note || '').trim();
  if (!note) { res.status(400).json({ error: 'Not boş' }); return; }
  const cat = ['bidding', 'budget', 'keywords', 'ads', 'targeting', 'campaign', 'tracking', 'other'].includes(req.body?.category) ? req.body.category : 'other';
  await run(`INSERT INTO ads_changelog (day, campaign, category, note, learning, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
    [day, String(req.body?.campaign || '').slice(0, 255) || null, cat, note.slice(0, 2000), req.body?.learning ? 1 : 0]);
  res.json({ ok: true });
}));
router.delete('/changelog/:id', authenticateAdmin, wrap(async (req, res) => {
  await run(`DELETE FROM ads_changelog WHERE id = ?`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

router.get('/imports', authenticateAdmin, wrap(async (_req, res) => {
  const [imports, trk, offline, cfg, names, reminder] = await Promise.all([
    listImports(), trackingCheck(), exportStatus(), settings(),
    query<any>(`SELECT campaign_id, name FROM ads_campaign_names ORDER BY name`),
    adsReminder(),
  ]);
  // Campaign ids seen in our tracking (gad_campaignid) that have no name yet.
  const seen = await query<any>(`SELECT utm_campaign AS id, COUNT(*) AS clicks FROM visitor_sessions
    WHERE gclid IS NOT NULL AND gclid <> '' AND utm_campaign REGEXP '^[0-9]+$' AND first_seen >= NOW() - INTERVAL 90 DAY GROUP BY utm_campaign ORDER BY clicks DESC`);
  res.json({ imports, tracking: trk, finalUrlSuffix: FINAL_URL_SUFFIX, offline, settings: cfg, campaignNames: names, seenCampaigns: seen, reminder });
}));
router.post('/imports', authenticateAdmin, wrap(async (req, res) => {
  const csv = String(req.body?.csv || '');
  if (!csv.trim()) { res.status(400).json({ error: 'CSV boş' }); return; }
  try { res.json(await importAdsReport(String(req.body?.filename || 'report.csv'), csv)); }
  catch (e: any) { res.status(400).json({ error: e?.message || 'CSV okunamadı' }); }
}));
router.delete('/imports/:id', authenticateAdmin, wrap(async (req, res) => {
  await deleteImport(Number(req.params.id));
  res.json({ ok: true });
}));

router.put('/campaign-names/:id', authenticateAdmin, wrap(async (req, res) => {
  const id = String(req.params.id).replace(/\D/g, '');
  const name = String(req.body?.name || '').trim();
  if (!id) { res.status(400).json({ error: 'id' }); return; }
  if (!name) await run(`DELETE FROM ads_campaign_names WHERE campaign_id = ?`, [id]);
  else await run(`INSERT INTO ads_campaign_names (campaign_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`, [id, name.slice(0, 255)]);
  res.json({ ok: true });
}));

router.put('/settings', authenticateAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const set = async (k: string, v: string) => run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [k, v, v]);
  const n = (v: unknown) => (v === '' || v == null ? null : Number(v));
  if (b.targetCpa !== undefined && n(b.targetCpa) != null && n(b.targetCpa)! > 0) await set('ads_coach_target_cpa', String(n(b.targetCpa)));
  if (b.monthlyBudget !== undefined && n(b.monthlyBudget) != null && n(b.monthlyBudget)! >= 0) await set('ads_coach_monthly_budget', String(n(b.monthlyBudget)));
  if (b.marginPct !== undefined && n(b.marginPct) != null && n(b.marginPct)! >= 0 && n(b.marginPct)! <= 100) await set('ads_coach_margin_pct', String(n(b.marginPct)));
  if (typeof b.conversionName === 'string' && b.conversionName.trim()) await set('ads_coach_conversion_name', b.conversionName.trim().slice(0, 100));
  if (typeof b.reminder === 'boolean') await set('ads_coach_reminder', b.reminder ? '1' : '0');
  res.json(await settings());
}));

router.get('/offline-export', authenticateAdmin, wrap(async (req, res) => {
  const onlyNew = req.query.all !== '1';
  const record = req.query.record !== '0';
  const out = await buildExport(onlyNew, record);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="google-ads-offline-conversions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('X-Rows', String(out.rows));
  res.send(out.csv);
}));

router.get('/reminders', authenticateAdmin, wrap(async (_req, res) => {
  const reports = await adsReminder();
  res.json({ count: reports.due ? 1 : 0, reports });
}));

export default router;
