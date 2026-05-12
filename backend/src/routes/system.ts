import { Router, Response } from 'express';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { Resend } from 'resend';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { runAllChecks, getLatestStatus } from '../services/healthMonitor';

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_fLtaXc2i_KSwkQA9PQduHyfhjq1m8B2Nn';
const FROM_EMAIL = process.env.SMTP_USER || 'info@flughafen-muenchen.taxi';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || FROM_EMAIL;

// ---------- Helpers ----------
function readMeminfo(): Record<string, number> {
  try {
    const text = fs.readFileSync('/proc/meminfo', 'utf8');
    const out: Record<string, number> = {};
    for (const line of text.split('\n')) {
      const m = line.match(/^(\w+):\s+(\d+)\s*kB$/);
      if (m) out[m[1]] = parseInt(m[2], 10) * 1024; // bytes
    }
    return out;
  } catch {
    return {};
  }
}

function diskUsage(): { total: number; used: number; free: number; pct: number } {
  try {
    const out = execSync("df -B1 / | tail -1", { encoding: 'utf8' }).trim();
    const parts = out.split(/\s+/);
    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);
    const free = parseInt(parts[3], 10);
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return { total, used, free, pct };
  } catch {
    return { total: 0, used: 0, free: 0, pct: 0 };
  }
}

function pm2List(): Array<{ name: string; pm_id: number; status: string; cpu: number; memory: number; uptime: number; restarts: number }> {
  try {
    const out = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8' });
    const arr = JSON.parse(out);
    return arr.map((p: any) => ({
      name: p.name,
      pm_id: p.pm_id,
      status: p.pm2_env?.status || 'unknown',
      cpu: p.monit?.cpu ?? 0,
      memory: p.monit?.memory ?? 0,
      uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      restarts: p.pm2_env?.restart_time ?? 0,
    }));
  } catch {
    return [];
  }
}

function collectStats() {
  const mi = readMeminfo();
  const ramTotal = mi.MemTotal || os.totalmem();
  const ramFree = mi.MemAvailable || os.freemem();
  const ramUsed = ramTotal - ramFree;
  const ramPct = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0;

  const swapTotal = mi.SwapTotal || 0;
  const swapFree = mi.SwapFree || 0;
  const swapUsed = swapTotal - swapFree;
  const swapPct = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

  const disk = diskUsage();
  const load = os.loadavg(); // [1m, 5m, 15m]
  const cpus = os.cpus().length;

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    uptime_sec: os.uptime(),
    ram: { total: ramTotal, used: ramUsed, free: ramFree, pct: ramPct },
    swap: { total: swapTotal, used: swapUsed, free: swapFree, pct: swapPct },
    disk,
    cpu: {
      cores: cpus,
      load1: load[0],
      load5: load[1],
      load15: load[2],
      load1_pct: cpus > 0 ? Math.round((load[0] / cpus) * 100) : 0,
    },
    pm2: pm2List(),
  };
}

// ---------- Endpoint ----------
router.get('/admin/system-stats', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    res.json(collectStats());
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- Alert thresholds + email ----------
const THRESHOLDS = {
  ram_pct: 85,
  swap_used_mb: 500,
  disk_pct: 85,
  load1_pct: 150, // load > 1.5x cores
  pm2_offline: true,
};

// Per-alert cooldown so we don't spam — at most one email per alert kind per hour
const lastAlerts: Record<string, number> = {};
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function shouldFire(key: string): boolean {
  const now = Date.now();
  const prev = lastAlerts[key] || 0;
  if (now - prev < COOLDOWN_MS) return false;
  lastAlerts[key] = now;
  return true;
}

function fmtMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
function fmtGB(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}g ${h}s ${m}d` : h > 0 ? `${h}s ${m}d` : `${m}d`;
}

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
            <h1 style="margin:0 0 12px;color:#dc2626;font-size:20px;">🚨 Sunucu Uyarısı</h1>
            <h2 style="margin:0 0 16px;color:#111;font-size:16px;">${subject}</h2>
            <div style="background:#fef2f2;padding:16px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;color:#7f1d1d;">${body}</div>
            <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
              <p style="margin:0 0 6px;">Bu uyarı saat <strong>${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</strong> tarihinde gönderildi.</p>
              <p style="margin:0;">VPS: <strong>flughafen-muenchen.taxi</strong> · Aynı uyarı 1 saat boyunca tekrar gönderilmez.</p>
            </div>
          </div>
        </div>
      `,
    });
    console.log(`[ALERT] Email sent: ${subject}`);
  } catch (err: any) {
    console.error('[ALERT] Email failed:', err.message);
  }
}

function checkAlerts(s: ReturnType<typeof collectStats>): void {
  // RAM
  if (s.ram.pct >= THRESHOLDS.ram_pct && shouldFire('ram')) {
    sendAlert(
      `RAM kullanımı yüksek: %${s.ram.pct}`,
      `RAM: ${fmtGB(s.ram.used)} / ${fmtGB(s.ram.total)} (${s.ram.pct}%)
Boş: ${fmtMB(s.ram.free)}

Bu durum sürerse Standard 2 tarifine yükseltmeyi değerlendir (4 GB RAM, +51€/yıl).`
    );
  }

  // Swap
  const swapUsedMB = s.swap.used / 1024 / 1024;
  if (swapUsedMB >= THRESHOLDS.swap_used_mb && shouldFire('swap')) {
    sendAlert(
      `Swap kullanımı yüksek: ${fmtMB(s.swap.used)}`,
      `Swap: ${fmtMB(s.swap.used)} / ${fmtGB(s.swap.total)} kullanılıyor.

Bu, RAM'in yetmediği anlamına gelir. Performans düşer.
Standard 2 (4 GB RAM) tarifine geçmek mantıklı olabilir.`
    );
  }

  // Disk
  if (s.disk.pct >= THRESHOLDS.disk_pct && shouldFire('disk')) {
    sendAlert(
      `Disk doluyor: %${s.disk.pct}`,
      `Disk: ${fmtGB(s.disk.used)} / ${fmtGB(s.disk.total)} (${s.disk.pct}%)
Boş: ${fmtGB(s.disk.free)}

Logları, eski backup'ları veya gereksiz dosyaları temizlemek gerek.`
    );
  }

  // CPU load
  if (s.cpu.load1_pct >= THRESHOLDS.load1_pct && shouldFire('cpu')) {
    sendAlert(
      `CPU yükü yüksek: ${s.cpu.load1.toFixed(2)} (${s.cpu.cores} core)`,
      `Load avg: ${s.cpu.load1.toFixed(2)} / ${s.cpu.load5.toFixed(2)} / ${s.cpu.load15.toFixed(2)} (1m / 5m / 15m)
Cores: ${s.cpu.cores}

Sürekli yüksek yük varsa Standard 2 (2 core) ya da Standard 3 (4 core) düşün.`
    );
  }

  // PM2 offline
  const offline = s.pm2.filter((p) => p.status !== 'online');
  if (offline.length > 0 && shouldFire('pm2_offline')) {
    sendAlert(
      `${offline.length} servis çalışmıyor`,
      `Çalışmayan PM2 servisleri:
${offline.map((p) => `  - ${p.name} (${p.status}, ${p.restarts} restart)`).join('\n')}

ssh ile bağlanıp 'pm2 restart all' çalıştırman gerekebilir.`
    );
  }
}

// Run check every 5 minutes
let alertJobStarted = false;
export function startSystemAlertJob(): void {
  if (alertJobStarted) return;
  alertJobStarted = true;
  const intervalMs = 5 * 60 * 1000;
  setInterval(() => {
    try {
      const s = collectStats();
      checkAlerts(s);
    } catch (e: any) {
      console.error('[system-alerts] check failed:', e.message);
    }
  }, intervalMs);
  console.log('[system-alerts] Job started — checks every 5 minutes, alerts cooldown 1h');
}

// Manual test endpoint — send a test alert
router.post('/admin/system-stats/test-alert', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    delete lastAlerts.test; // reset cooldown for this kind
    if (shouldFire('test')) {
      await sendAlert(
        'Test uyarısı (manuel)',
        `Bu bir test mesajıdır. E-posta sistemi çalışıyor.

Zaman: ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`
      );
      res.json({ ok: true, sent_to: ADMIN_EMAIL });
    } else {
      res.json({ ok: false, reason: 'cooldown' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

export default router;
