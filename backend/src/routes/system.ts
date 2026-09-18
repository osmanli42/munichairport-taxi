import { Router, Response } from 'express';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { Resend } from 'resend';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { runAllChecks, getLatestStatus } from '../services/healthMonitor';
import { query } from '../db';

const router = Router();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'info@flughafen-muenchen.taxi';
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

// Dönüşüm uyarıları — sunucu sağlığı değil, ticari kayıp uyarıları.
// Resend anahtarının 11 gün sessizce ölüp müşteri kaybettirdiği olayın tekrarını önlemek için.
const CONVERSION_THRESHOLDS = {
  // "trafik var ama hiç rezervasyon yok" için gereken en az oturum sayısı (3 saat içinde)
  dry_spell_min_sessions: 20,
  dry_spell_hours: 3,
  // son 1 saatteki hata sayısı, 7 günlük saatlik ortalamanın kaç katı olursa uyarı
  error_spike_factor: 5,
  error_spike_min: 5,
  // /buchen ortalama yükleme süresi (ms) — bunun üstü müşteri kaybettirir
  slow_page_ms: 4000,
  slow_page_min_views: 5,
};

// Per-alert cooldown — configurable, default 4 hours
const lastAlerts: Record<string, number> = {};

// Alert settings — persist in memory (survives until restart), default 4h
const alertSettings = {
  cooldown_hours: 4,   // hours between same alert type
  enabled: true,       // master switch
};

function getCooldownMs(): number {
  return alertSettings.cooldown_hours * 60 * 60 * 1000;
}

function shouldFire(key: string): boolean {
  if (!alertSettings.enabled) return false;
  const now = Date.now();
  const prev = lastAlerts[key] || 0;
  if (now - prev < getCooldownMs()) return false;
  lastAlerts[key] = now;
  return true;
}

// ---------- Alert settings endpoints ----------
router.get('/admin/system-stats/alert-settings', authenticateAdmin, (_req: AuthRequest, res: Response) => {
  // Calculate next possible alert times
  const nextAlerts: Record<string, string | null> = {};
  for (const [key, ts] of Object.entries(lastAlerts)) {
    const nextMs = ts + getCooldownMs();
    nextAlerts[key] = nextMs > Date.now() ? new Date(nextMs).toISOString() : null;
  }
  res.json({ ...alertSettings, next_alerts: nextAlerts });
});

router.post('/admin/system-stats/alert-settings', authenticateAdmin, (req: AuthRequest, res: Response) => {
  const { cooldown_hours, enabled } = req.body || {};
  if (typeof cooldown_hours === 'number' && cooldown_hours >= 1 && cooldown_hours <= 168) {
    alertSettings.cooldown_hours = cooldown_hours;
  }
  if (typeof enabled === 'boolean') {
    alertSettings.enabled = enabled;
  }
  res.json({ ok: true, ...alertSettings });
});

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
              <p style="margin:0;">VPS: <strong>flughafen-muenchen.taxi</strong> · Aynı uyarı ${alertSettings.cooldown_hours} saat boyunca tekrar gönderilmez.</p>
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

// ---------------------------------------------------------------------------
// Dönüşüm uyarıları + günlük özet
// ---------------------------------------------------------------------------
async function checkConversionAlerts(): Promise<void> {
  // 1) Trafik var ama rezervasyon yok
  const h = CONVERSION_THRESHOLDS.dry_spell_hours;
  const [dry] = await query<any>(
    `SELECT
       (SELECT COUNT(*) FROM visitor_sessions
         WHERE is_bot = 0 AND first_seen >= NOW() - INTERVAL ${h} HOUR) AS sessions,
       (SELECT COUNT(*) FROM bookings
         WHERE status <> 'cancelled' AND source = 'web'
           AND created_at >= NOW() - INTERVAL ${h} HOUR) AS bookings`
  );
  const sessions = Number(dry?.sessions || 0);
  const bookings = Number(dry?.bookings || 0);
  if (sessions >= CONVERSION_THRESHOLDS.dry_spell_min_sessions && bookings === 0 && shouldFire('no_conversions')) {
    await sendAlert(
      `${h} saatte ${sessions} ziyaretçi, 0 rezervasyon`,
      `Son ${h} saatte ${sessions} oturum açıldı ama tek bir web rezervasyonu gelmedi.

Olası sebepler: form/ödeme hatası, e-posta gönderimi kırık, fiyat API'si cevap vermiyor.
Admin → Replay sekmesindeki "Neden vazgeçiyorlar" panelinden son oturumlara bak.`
    );
  }

  // 2) Hata patlaması — son 1 saat vs 7 günün saatlik ortalaması
  const [spike] = await query<any>(
    `SELECT
       (SELECT COUNT(*) FROM visitor_events
         WHERE type IN ('field_error', 'js_error', 'api_error')
           AND occurred_at >= NOW() - INTERVAL 1 HOUR) AS last_hour,
       (SELECT COUNT(*) / 168 FROM visitor_events
         WHERE type IN ('field_error', 'js_error', 'api_error')
           AND occurred_at >= NOW() - INTERVAL 7 DAY) AS hourly_avg`
  );
  const lastHour = Number(spike?.last_hour || 0);
  const hourlyAvg = Number(spike?.hourly_avg || 0);
  if (
    lastHour >= CONVERSION_THRESHOLDS.error_spike_min &&
    hourlyAvg > 0 &&
    lastHour >= hourlyAvg * CONVERSION_THRESHOLDS.error_spike_factor &&
    shouldFire('error_spike')
  ) {
    const top = await query<any>(
      `SELECT type, target, COUNT(*) AS n FROM visitor_events
        WHERE type IN ('field_error', 'js_error', 'api_error')
          AND occurred_at >= NOW() - INTERVAL 1 HOUR
        GROUP BY type, target ORDER BY n DESC LIMIT 5`
    );
    await sendAlert(
      `Hata patlaması: son 1 saatte ${lastHour} hata`,
      `Son 1 saat: ${lastHour} hata (7 günlük saatlik ortalama: ${hourlyAvg.toFixed(1)})

En sık görülenler:
${top.map((t: any) => `  - [${t.type}] ${t.target} × ${t.n}`).join('\n')}`
    );
  }

  // 3) /buchen sayfası yavaş
  const [slow] = await query<any>(
    `SELECT COUNT(*) AS views, AVG(load_time_ms) AS avg_ms
       FROM visitor_pageviews
      WHERE path LIKE '%/buchen%' AND load_time_ms IS NOT NULL
        AND viewed_at >= NOW() - INTERVAL 2 HOUR`
  );
  const views = Number(slow?.views || 0);
  const avgMs = Number(slow?.avg_ms || 0);
  if (
    views >= CONVERSION_THRESHOLDS.slow_page_min_views &&
    avgMs > CONVERSION_THRESHOLDS.slow_page_ms &&
    shouldFire('slow_booking_page')
  ) {
    await sendAlert(
      `Rezervasyon sayfası yavaş: ${Math.round(avgMs)} ms`,
      `/buchen son 2 saatte ${views} kez açıldı, ortalama yükleme ${Math.round(avgMs)} ms.

${CONVERSION_THRESHOLDS.slow_page_ms} ms üstü yüklemeler doğrudan rezervasyon kaybettirir.`
    );
  }
}

// Günlük özet — günde bir kez, Berlin saatiyle sabah
const SUMMARY_HOUR = 8;
let lastSummaryDay = '';

async function sendDailySummary(): Promise<void> {
  const berlin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const dayKey = berlin.toISOString().slice(0, 10);
  if (berlin.getHours() < SUMMARY_HOUR || lastSummaryDay === dayKey) return;
  lastSummaryDay = dayKey;

  const [t] = await query<any>(
    `SELECT
       (SELECT COUNT(*) FROM visitor_sessions
         WHERE is_bot = 0 AND DATE(first_seen) = CURDATE() - INTERVAL 1 DAY) AS sessions,
       (SELECT COUNT(*) FROM bookings
         WHERE status <> 'cancelled' AND source = 'web'
           AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY) AS bookings,
       (SELECT COUNT(DISTINCT session_id) FROM visitor_events
         WHERE type = 'call_click' AND DATE(occurred_at) = CURDATE() - INTERVAL 1 DAY) AS calls,
       (SELECT COUNT(*) FROM visitor_events
         WHERE type IN ('js_error', 'api_error') AND DATE(occurred_at) = CURDATE() - INTERVAL 1 DAY) AS tech_errors`
  );

  const fields = await query<any>(
    `SELECT target, COUNT(*) AS n FROM visitor_events
      WHERE type = 'field_focus' AND DATE(occurred_at) = CURDATE() - INTERVAL 1 DAY
      GROUP BY target ORDER BY n DESC LIMIT 3`
  );

  const sessions = Number(t?.sessions || 0);
  const bookings = Number(t?.bookings || 0);
  const rate = sessions > 0 ? `${((bookings / sessions) * 100).toFixed(1)}%` : '—';

  await sendAlert(
    `Günlük özet — ${sessions} oturum, ${bookings} rezervasyon`,
    `Dün (${dayKey}):
  Oturum:       ${sessions}
  Rezervasyon:  ${bookings}  (dönüşüm ${rate})
  Telefona dönen: ${Number(t?.calls || 0)}
  Teknik hata:  ${Number(t?.tech_errors || 0)}

En çok dokunulan form alanları:
${fields.length ? fields.map((f: any) => `  - ${f.target} × ${f.n}`).join('\n') : '  (veri yok)'}`
  );
}

// Run check every 5 minutes
let alertJobStarted = false;
export function startSystemAlertJob(): void {
  if (alertJobStarted) return;
  alertJobStarted = true;
  const intervalMs = 5 * 60 * 1000;
  let tick = 0;
  setInterval(() => {
    try {
      const s = collectStats();
      checkAlerts(s);
    } catch (e: any) {
      console.error('[system-alerts] check failed:', e.message);
    }
    // Dönüşüm/özet kontrolleri DB'ye gittiği için 30 dakikada bir yeter
    // (uyarıların kendi cooldown'ı ayrıca var).
    tick++;
    if (tick % 6 === 0) {
      checkConversionAlerts().catch((e) => console.error('[conversion-alerts] failed:', e.message));
      sendDailySummary().catch((e) => console.error('[daily-summary] failed:', e.message));
    }
  }, intervalMs);
  console.log('[system-alerts] Job started — checks every 5 minutes, alerts cooldown 1h');
}

// GET /api/admin/conversion-health — dönüşüm uyarılarının baktığı ham sayılar.
// E-posta göndermez; System sekmesinde göstermek ve eşikleri doğrulamak için.
router.get('/admin/conversion-health', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const h = CONVERSION_THRESHOLDS.dry_spell_hours;
    const [dry] = await query<any>(
      `SELECT
         (SELECT COUNT(*) FROM visitor_sessions
           WHERE is_bot = 0 AND first_seen >= NOW() - INTERVAL ${h} HOUR) AS sessions,
         (SELECT COUNT(*) FROM bookings
           WHERE status <> 'cancelled' AND source = 'web'
             AND created_at >= NOW() - INTERVAL ${h} HOUR) AS bookings`
    );
    const [spike] = await query<any>(
      `SELECT
         (SELECT COUNT(*) FROM visitor_events
           WHERE type IN ('field_error', 'js_error', 'api_error')
             AND occurred_at >= NOW() - INTERVAL 1 HOUR) AS last_hour,
         (SELECT COUNT(*) / 168 FROM visitor_events
           WHERE type IN ('field_error', 'js_error', 'api_error')
             AND occurred_at >= NOW() - INTERVAL 7 DAY) AS hourly_avg`
    );
    const [slow] = await query<any>(
      `SELECT COUNT(*) AS views, AVG(load_time_ms) AS avg_ms
         FROM visitor_pageviews
        WHERE path LIKE '%/buchen%' AND load_time_ms IS NOT NULL
          AND viewed_at >= NOW() - INTERVAL 2 HOUR`
    );
    res.json({
      thresholds: CONVERSION_THRESHOLDS,
      dry_spell: { hours: h, sessions: Number(dry?.sessions || 0), bookings: Number(dry?.bookings || 0) },
      errors: { last_hour: Number(spike?.last_hour || 0), hourly_avg_7d: Number(spike?.hourly_avg || 0) },
      booking_page: { views_2h: Number(slow?.views || 0), avg_load_ms: Math.round(Number(slow?.avg_ms || 0)) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// POST /api/admin/conversion-health/run — kontrolleri hemen çalıştır (cooldown'a tabi)
router.post('/admin/conversion-health/run', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await checkConversionAlerts();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// GET /api/admin/health — latest health status + 24h trend
router.get('/admin/health', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const data = await getLatestStatus();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// POST /api/admin/health/run — trigger immediate check (manual refresh)
router.post('/admin/health/run', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const results = await runAllChecks();
    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// POST /api/admin/health/fmtde/dismiss-stuck — blendet bewusst nicht beantwortete FMT-Anfragen
// aus dem "Flughafen Taxi .de — API + DB"-Warnhinweis aus (siehe healthMonitor.ts SECONDARY_SITES).
// Ruft FMTs eigenes Backend über ein Shared Secret auf, da FMT kein eigenes Admin-Login hat.
router.post('/admin/health/fmtde/dismiss-stuck', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const secret = process.env.FMT_ADMIN_DISMISS_SECRET;
    if (!secret) { res.status(500).json({ error: 'FMT_ADMIN_DISMISS_SECRET nicht konfiguriert' }); return; }
    const r = await fetch('https://api.flughafen-muenchen-taxi.de/api/admin/inquiries/dismiss-stuck', {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
