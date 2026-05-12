/**
 * Health Monitor — checks site, API, DB, SSL, bookings flow every 2 minutes.
 * Stores results in `health_checks` table and triggers email alerts on failures.
 */
import https from 'https';
import { TLSSocket } from 'tls';
import { Resend } from 'resend';
import { query, run } from '../db';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn';
const FROM_EMAIL = process.env.SMTP_USER || 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;
const SITE_HOST = 'flughafen-muenchen.taxi';

export type HealthStatus = 'ok' | 'warn' | 'fail';

export interface HealthResult {
  check_name: string;
  label: string;
  status: HealthStatus;
  latency_ms: number;
  message: string;
  details?: Record<string, any>;
}

// ---------- Table init ----------
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await run(`
    CREATE TABLE IF NOT EXISTS health_checks (
      id INT NOT NULL AUTO_INCREMENT,
      check_name VARCHAR(50) NOT NULL,
      status VARCHAR(10) NOT NULL,
      latency_ms INT DEFAULT NULL,
      message VARCHAR(500) DEFAULT NULL,
      checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_check_name (check_name),
      INDEX idx_checked_at (checked_at)
    )
  `);
  tableReady = true;
}

// ---------- Individual checks ----------
function httpsGet(url: string, timeoutMs = 10_000): Promise<{ status: number; latency: number; cert?: any }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let cert: any = null;
      try {
        const sock = res.socket as TLSSocket;
        if (sock && typeof sock.getPeerCertificate === 'function') {
          cert = sock.getPeerCertificate();
        }
      } catch {}
      res.on('data', () => {});
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, latency: Date.now() - start, cert });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function checkSite(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const r = await httpsGet(`https://${SITE_HOST}/`);
    const latency = r.latency;
    if (r.status === 200) {
      let status: HealthStatus = 'ok';
      let msg = `Site OK (${latency}ms)`;
      if (latency > 5000) { status = 'warn'; msg = `Site yavaş (${latency}ms)`; }
      return { check_name: 'site', label: 'Site (HTTPS)', status, latency_ms: latency, message: msg };
    }
    return { check_name: 'site', label: 'Site (HTTPS)', status: 'fail', latency_ms: latency, message: `HTTP ${r.status}` };
  } catch (e: any) {
    return { check_name: 'site', label: 'Site (HTTPS)', status: 'fail', latency_ms: Date.now() - start, message: e.message || 'unreachable' };
  }
}

async function checkApiHealth(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const r = await httpsGet(`https://${SITE_HOST}/api/health`);
    if (r.status === 200) {
      return { check_name: 'api', label: 'API Health', status: 'ok', latency_ms: r.latency, message: `API OK (${r.latency}ms)` };
    }
    return { check_name: 'api', label: 'API Health', status: 'fail', latency_ms: r.latency, message: `HTTP ${r.status}` };
  } catch (e: any) {
    return { check_name: 'api', label: 'API Health', status: 'fail', latency_ms: Date.now() - start, message: e.message };
  }
}

async function checkDb(): Promise<HealthResult> {
  const start = Date.now();
  try {
    await query('SELECT 1 AS test');
    const latency = Date.now() - start;
    let status: HealthStatus = 'ok';
    let msg = `DB OK (${latency}ms)`;
    if (latency > 2000) { status = 'warn'; msg = `DB yavaş (${latency}ms)`; }
    return { check_name: 'db', label: 'MySQL Veritabanı', status, latency_ms: latency, message: msg };
  } catch (e: any) {
    return { check_name: 'db', label: 'MySQL Veritabanı', status: 'fail', latency_ms: Date.now() - start, message: e.message || 'connection failed' };
  }
}

async function checkSsl(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const r = await httpsGet(`https://${SITE_HOST}/`);
    const cert = r.cert;
    if (!cert || !cert.valid_to) {
      return { check_name: 'ssl', label: 'SSL Sertifikası', status: 'warn', latency_ms: r.latency, message: 'sertifika okunamadı' };
    }
    const expiresAt = new Date(cert.valid_to);
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    let status: HealthStatus = 'ok';
    let msg = `${daysLeft} gün kaldı (${expiresAt.toLocaleDateString('de-DE')})`;
    if (daysLeft < 0) { status = 'fail'; msg = `SÜRESI DOLDU! ${expiresAt.toLocaleDateString('de-DE')}`; }
    else if (daysLeft < 14) { status = 'warn'; msg = `${daysLeft} gün kaldı — yenilemen lazım`; }
    return { check_name: 'ssl', label: 'SSL Sertifikası', status, latency_ms: r.latency, message: msg };
  } catch (e: any) {
    return { check_name: 'ssl', label: 'SSL Sertifikası', status: 'fail', latency_ms: Date.now() - start, message: e.message };
  }
}

async function checkBookingsSystem(): Promise<HealthResult> {
  const start = Date.now();
  try {
    // 1) bookings tablosu erişilebilir mi?
    const [c] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM bookings`);
    // 2) Son 24 saatte oluşan booking'ler arasında price=0 veya boş email gibi bozuk kayıt var mı?
    const broken = await query<any>(
      `SELECT id, booking_number, status, price, email
       FROM bookings
       WHERE created_at >= NOW() - INTERVAL 24 HOUR
         AND (price IS NULL OR price <= 0 OR email IS NULL OR email = '')`
    );
    if (broken.length > 0) {
      return {
        check_name: 'bookings',
        label: 'Rezervasyon Sistemi',
        status: 'warn',
        latency_ms: Date.now() - start,
        message: `${broken.length} sorunlu rezervasyon (son 24sa)`,
        details: { broken_samples: broken.slice(0, 3) },
      };
    }
    return {
      check_name: 'bookings',
      label: 'Rezervasyon Sistemi',
      status: 'ok',
      latency_ms: Date.now() - start,
      message: `${c.n} toplam rezervasyon, sorun yok`,
    };
  } catch (e: any) {
    return { check_name: 'bookings', label: 'Rezervasyon Sistemi', status: 'fail', latency_ms: Date.now() - start, message: e.message };
  }
}

async function checkBookingFlow(): Promise<HealthResult> {
  // Site over the homepage and check it serves and contains booking form CSS
  const start = Date.now();
  try {
    const r = await httpsGet(`https://${SITE_HOST}/api/prices/kombi`);
    if (r.status === 200) {
      return { check_name: 'pricing', label: 'Fiyat Hesaplama', status: 'ok', latency_ms: r.latency, message: `Fiyat API OK (${r.latency}ms)` };
    }
    return { check_name: 'pricing', label: 'Fiyat Hesaplama', status: 'fail', latency_ms: r.latency, message: `HTTP ${r.status}` };
  } catch (e: any) {
    return { check_name: 'pricing', label: 'Fiyat Hesaplama', status: 'fail', latency_ms: Date.now() - start, message: e.message };
  }
}

async function checkSettings(): Promise<HealthResult> {
  const start = Date.now();
  try {
    const r = await httpsGet(`https://${SITE_HOST}/api/settings`);
    if (r.status === 200) {
      return { check_name: 'settings', label: 'Ayarlar API', status: 'ok', latency_ms: r.latency, message: `Settings OK (${r.latency}ms)` };
    }
    return { check_name: 'settings', label: 'Ayarlar API', status: 'fail', latency_ms: r.latency, message: `HTTP ${r.status}` };
  } catch (e: any) {
    return { check_name: 'settings', label: 'Ayarlar API', status: 'fail', latency_ms: Date.now() - start, message: e.message };
  }
}

// ---------- Run all checks ----------
export async function runAllChecks(): Promise<HealthResult[]> {
  await ensureTable();
  const results = await Promise.all([
    checkSite(),
    checkApiHealth(),
    checkDb(),
    checkSsl(),
    checkBookingsSystem(),
    checkBookingFlow(),
    checkSettings(),
  ]);

  // Save each result
  for (const r of results) {
    try {
      await run(
        `INSERT INTO health_checks (check_name, status, latency_ms, message) VALUES (?, ?, ?, ?)`,
        [r.check_name, r.status, r.latency_ms, r.message.slice(0, 500)]
      );
    } catch (e: any) {
      console.error('[health] failed to save:', e.message);
    }
  }
  return results;
}

// ---------- Get latest + 24h trend ----------
export async function getLatestStatus(): Promise<{ latest: HealthResult[]; trend: Record<string, any[]> }> {
  await ensureTable();

  // Latest result per check
  const latestRows = await query<any>(`
    SELECT h.* FROM health_checks h
    INNER JOIN (
      SELECT check_name, MAX(id) AS max_id
      FROM health_checks
      GROUP BY check_name
    ) m ON m.max_id = h.id
    ORDER BY h.check_name ASC
  `);

  // 24h trend
  const trendRows = await query<any>(`
    SELECT check_name, status, latency_ms, message, checked_at
    FROM health_checks
    WHERE checked_at >= NOW() - INTERVAL 24 HOUR
    ORDER BY checked_at ASC
  `);

  const trend: Record<string, any[]> = {};
  for (const r of trendRows) {
    if (!trend[r.check_name]) trend[r.check_name] = [];
    trend[r.check_name].push(r);
  }

  // Map to HealthResult shape
  const labelMap: Record<string, string> = {
    site: 'Site (HTTPS)',
    api: 'API Health',
    db: 'MySQL Veritabanı',
    ssl: 'SSL Sertifikası',
    bookings: 'Rezervasyon Sistemi',
    pricing: 'Fiyat Hesaplama',
    settings: 'Ayarlar API',
  };
  const latest: HealthResult[] = latestRows.map((r: any) => ({
    check_name: r.check_name,
    label: labelMap[r.check_name] || r.check_name,
    status: r.status,
    latency_ms: r.latency_ms,
    message: r.message,
  }));

  return { latest, trend };
}

// ---------- Alerting ----------
const lastFailAlerts: Record<string, number> = {};
const lastKnownStatus: Record<string, HealthStatus> = {};
const ALERT_COOLDOWN = 60 * 60 * 1000; // 1 hour
const REQUIRE_CONSECUTIVE = 2; // require 2 consecutive fails before alerting (avoid flapping)
const consecutiveFails: Record<string, number> = {};

async function sendAlert(subject: string, body: string): Promise<void> {
  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: `Munich Airport Taxi Server <${FROM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `🚨 ${subject}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
          <div style="background:#fff;border-radius:12px;padding:24px;border-left:6px solid #dc2626;">
            <h1 style="margin:0 0 12px;color:#dc2626;font-size:20px;">🚨 Site Sorunu</h1>
            <h2 style="margin:0 0 16px;color:#111;font-size:16px;">${subject}</h2>
            <div style="background:#fef2f2;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;color:#7f1d1d;">${body}</div>
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
              <p style="margin:0 0 6px;">Zaman: <strong>${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</strong></p>
              <p style="margin:0;">Admin paneli: <a href="https://${SITE_HOST}/admin">https://${SITE_HOST}/admin</a> · System sekmesi</p>
              <p style="margin:8px 0 0;">Aynı uyarı 1 saat içinde tekrar gönderilmez.</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[health-alert] Email sent: ${subject}`);
  } catch (err: any) {
    console.error('[health-alert] Email failed:', err.message);
  }
}

async function processAlerts(results: HealthResult[]): Promise<void> {
  for (const r of results) {
    const prev = lastKnownStatus[r.check_name];
    lastKnownStatus[r.check_name] = r.status;

    if (r.status === 'fail') {
      consecutiveFails[r.check_name] = (consecutiveFails[r.check_name] || 0) + 1;

      // Only alert after 2 consecutive failures and if cooldown passed
      if (consecutiveFails[r.check_name] >= REQUIRE_CONSECUTIVE) {
        const last = lastFailAlerts[r.check_name] || 0;
        if (Date.now() - last >= ALERT_COOLDOWN) {
          lastFailAlerts[r.check_name] = Date.now();
          await sendAlert(
            `${r.label} çalışmıyor`,
            `Check: ${r.label}
Durum: FAIL
Süre: ${r.latency_ms}ms
Hata: ${r.message}

Bu hata ${consecutiveFails[r.check_name]} kontrolde üst üste alındı.
Hemen müdahale gerekli olabilir.`
          );
        }
      }
    } else {
      // Recovered — clear fail counter
      if (consecutiveFails[r.check_name] && consecutiveFails[r.check_name] > 0) {
        if (prev === 'fail' || consecutiveFails[r.check_name] >= REQUIRE_CONSECUTIVE) {
          // We previously alerted (or were about to) — send recovery notice
          await sendAlert(
            `✅ ${r.label} düzeldi`,
            `Check: ${r.label}
Durum: OK
Süre: ${r.latency_ms}ms
Mesaj: ${r.message}

Sorun çözülmüş görünüyor.`
          );
        }
      }
      consecutiveFails[r.check_name] = 0;
    }
  }
}

// ---------- Cron job ----------
let started = false;
export function startHealthMonitorJob(): void {
  if (started) return;
  started = true;
  // Run first check after 30s (let server warm up)
  setTimeout(async () => {
    try {
      const r = await runAllChecks();
      await processAlerts(r);
    } catch (e: any) {
      console.error('[health] first check failed:', e.message);
    }
  }, 30_000);
  // Then every 2 minutes
  setInterval(async () => {
    try {
      const r = await runAllChecks();
      await processAlerts(r);
    } catch (e: any) {
      console.error('[health] check failed:', e.message);
    }
  }, 2 * 60 * 1000);
  console.log('[health] Monitor started — runs every 2 minutes, alerts after 2 consecutive failures');
}
