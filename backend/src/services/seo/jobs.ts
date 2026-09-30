// Schedules for the SEO tab (Berlin time). Kept here so the data services stay free of
// cron and alert wiring.
//   daily 04:10  Search Console sync (last 6 days) → ranking / click alerts
//   Sun   05:00  site audit → alert on new technical errors
//   Mon   05:30  PageSpeed (Core Web Vitals)
// First start: fills 16 months of Search Console history if the table is empty.

import cron from 'node-cron';
import { gscStatus, syncGscHistory, syncGscRecent } from './gsc';
import { runAudit } from './audit';
import { runVitals } from './vitals';
import { checkAuditAlerts, checkSeoAlerts } from './insights';
import { query } from '../../db';

export async function auditWithAlerts() {
  const started = new Date(Date.now() - 1000);
  const r = await runAudit();
  await checkAuditAlerts(started);
  return r;
}

export function startSeoJobs(): void {
  setTimeout(async () => {
    try {
      const st = await gscStatus();
      if (st.connected && st.rows === 0) await syncGscHistory();
      const [a] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM seo_audit_runs WHERE finished_at IS NOT NULL`);
      if (!Number(a?.n)) await runAudit();
      const [v] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM seo_vitals`);
      if (!Number(v?.n)) await runVitals();
    } catch (e: any) {
      console.error('[seo] initial run:', e?.message || e);
    }
  }, 90_000);
  cron.schedule('10 4 * * *', async () => {
    try {
      if ((await gscStatus()).connected) {
        await syncGscRecent();
        await checkSeoAlerts();
      }
    } catch (e: any) { console.error('[seo] nightly:', e?.message || e); }
  }, { timezone: 'Europe/Berlin' });
  cron.schedule('0 5 * * 0', () => { auditWithAlerts().catch((e) => console.error('[seo] audit:', e?.message || e)); }, { timezone: 'Europe/Berlin' });
  cron.schedule('30 5 * * 1', () => { runVitals().catch(() => {}); }, { timezone: 'Europe/Berlin' });
}
