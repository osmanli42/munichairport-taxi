/**
 * Google Ads alert job — every 6 hours computes the 30-day ad overview and
 * emails the admin when the health score drops below 50 or a high-severity
 * anomaly appears. Deduplicated: at most one email per day per unique problem
 * set (signature stored in the `settings` table).
 */
import cron from 'node-cron';
import { Resend } from 'resend';
import { query, run } from '../db';
import { computeOverview } from '../routes/ads';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn';
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const SITE_HOST = 'flughafen-muenchen.taxi';
const SIG_KEY = 'ads_last_alert';

async function getLastSignature(): Promise<string> {
  try {
    const rows = await query<{ setting_value: string }>(
      'SELECT setting_value FROM settings WHERE setting_key = ?',
      [SIG_KEY]
    );
    return rows[0]?.setting_value || '';
  } catch {
    return '';
  }
}

async function storeSignature(sig: string): Promise<void> {
  await run(
    `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [SIG_KEY, sig]
  );
}

async function sendAdsAlert(subject: string, score: number | null, items: { title: string; detail: string }[]): Promise<void> {
  const resend = new Resend(RESEND_API_KEY);
  const rows = items
    .map(
      (a) => `
      <div style="background:#fef2f2;padding:12px 14px;border-radius:8px;margin-bottom:8px;">
        <div style="font-weight:600;color:#7f1d1d;font-size:14px;">${a.title}</div>
        <div style="color:#991b1b;font-size:13px;margin-top:4px;">${a.detail}</div>
      </div>`
    )
    .join('');
  await resend.emails.send({
    from: `Munich Airport Taxi <${FROM_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: `📉 ${subject}`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
        <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #f59e0b;">
          <h1 style="margin:0 0 4px;color:#b45309;font-size:20px;">📉 Google Ads Performans Uyarısı</h1>
          <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Son 30 günlük reklam performansı</p>
          ${score !== null ? `<p style="margin:0 0 14px;font-size:15px;">Sağlık skoru: <strong style="color:${score >= 50 ? '#f59e0b' : '#dc2626'};">${score}/100</strong></p>` : ''}
          ${rows}
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
            <p style="margin:0 0 6px;">Zaman: <strong>${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</strong></p>
            <p style="margin:0;">Detay: <a href="https://${SITE_HOST}/admin">https://${SITE_HOST}/admin</a> · Google Ads sekmesi</p>
            <p style="margin:8px 0 0;">Aynı uyarı aynı gün tekrar gönderilmez.</p>
          </div>
        </div>
      </div>`,
  });
}

async function runCheck(): Promise<void> {
  try {
    const r = await computeOverview({ days: 30 });
    const highAlerts = r.alerts.filter((a) => a.severity === 'high');
    const lowScore = r.score !== null && r.score < 50;
    if (highAlerts.length === 0 && !lowScore) return;

    // Signature: today + sorted alert titles + score band. One email per day
    // per unique problem set.
    const today = new Date().toISOString().slice(0, 10);
    const band = r.score === null ? 'na' : r.score < 50 ? 'low' : 'ok';
    const sig = `${today}|${band}|${highAlerts.map((a) => a.title).sort().join(';')}`;
    const last = await getLastSignature();
    if (sig === last) return;

    const items = highAlerts.length > 0
      ? highAlerts
      : [{ title: 'Sağlık skoru düşük', detail: `Reklam sağlık skoru ${r.score}/100 — performans zayıf.` }];
    const subject = lowScore
      ? `Reklam sağlık skoru düştü: ${r.score}/100`
      : 'Reklam performansında kritik uyarı';
    await sendAdsAlert(subject, r.score, items);
    await storeSignature(sig);
    console.log(`[ads-alerts] Email sent: ${subject}`);
  } catch (err: any) {
    console.error('[ads-alerts] check failed:', err.message);
  }
}

export function startAdsAlertJob(): void {
  // Every 6 hours, on the hour.
  cron.schedule('0 */6 * * *', runCheck);
  console.log('[ads-alerts] Job started — checks every 6 hours');
}
