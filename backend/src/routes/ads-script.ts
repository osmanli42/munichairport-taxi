// /api/ads-script — receives the weekly reports from the Google Ads Script (see services/ads/script.ts).
// No admin login here: the script authenticates with the secret token shown in the admin panel.

import { Router } from 'express';
import { importFromScript, tokenMatches } from '../services/ads/script';

const router = Router();

router.post('/import', async (req, res) => {
  try {
    if (!(await tokenMatches(String(req.get('x-ads-script-token') || '')))) { res.status(401).json({ error: 'Unauthorized' }); return; }
    const reports = Array.isArray(req.body?.reports) ? req.body.reports : [];
    if (!reports.length) { res.status(400).json({ error: 'No reports' }); return; }
    const results = await importFromScript(reports);
    res.status(results.some((r) => !r.ok) ? 207 : 200).json({ results });
  } catch (e: any) {
    console.error('[ads-script]', e?.message || e);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
