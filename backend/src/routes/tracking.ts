import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import https from 'https';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Lazy table initialization — runs once on first request, no-op afterwards.
let tablesReady = false;
async function ensureTables(): Promise<void> {
  if (tablesReady) return;
  await run(`
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) UNIQUE NOT NULL,
      visitor_id VARCHAR(64) NOT NULL,
      ip_hash VARCHAR(64),
      country VARCHAR(8),
      city VARCHAR(100),
      ua_browser VARCHAR(50),
      ua_os VARCHAR(50),
      ua_device VARCHAR(20),
      screen_w SMALLINT DEFAULT NULL,
      screen_h SMALLINT DEFAULT NULL,
      lang VARCHAR(20) DEFAULT NULL,
      is_bot TINYINT(1) NOT NULL DEFAULT 0,
      referrer VARCHAR(500),
      utm_source VARCHAR(100),
      utm_medium VARCHAR(100),
      utm_campaign VARCHAR(255),
      gclid VARCHAR(255),
      landing_page VARCHAR(500),
      first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      pageview_count INT NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      INDEX idx_last_seen (last_seen),
      INDEX idx_first_seen (first_seen),
      INDEX idx_visitor_id (visitor_id),
      INDEX idx_is_bot (is_bot)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS visitor_pageviews (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      path VARCHAR(500) NOT NULL,
      title VARCHAR(255),
      viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_sec INT DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_session_id (session_id),
      INDEX idx_viewed_at (viewed_at)
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS visitor_events (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      type VARCHAR(20) NOT NULL,
      path VARCHAR(500) NOT NULL,
      x_pct DECIMAL(6,3) DEFAULT NULL,
      y_pct DECIMAL(6,3) DEFAULT NULL,
      scroll_depth INT DEFAULT NULL,
      target VARCHAR(255) DEFAULT NULL,
      viewport_w INT DEFAULT NULL,
      viewport_h INT DEFAULT NULL,
      device VARCHAR(20) DEFAULT NULL,
      occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_path_type (path(100), type),
      INDEX idx_occurred_at (occurred_at),
      INDEX idx_session_id (session_id)
    )
  `);
  // Add columns if they don't exist yet (safe for existing installs)
  try { await run(`ALTER TABLE visitor_sessions ADD COLUMN city VARCHAR(100) AFTER country`); } catch {}
  try { await run(`ALTER TABLE visitor_sessions ADD COLUMN screen_w SMALLINT DEFAULT NULL AFTER ua_device`); } catch {}
  try { await run(`ALTER TABLE visitor_sessions ADD COLUMN screen_h SMALLINT DEFAULT NULL AFTER screen_w`); } catch {}
  try { await run(`ALTER TABLE visitor_sessions ADD COLUMN lang VARCHAR(20) DEFAULT NULL AFTER screen_h`); } catch {}
  tablesReady = true;
}

// Geo lookup using ip-api.com (free, no key, 45 req/min)
async function geoFromIp(ip: string): Promise<{ country: string; city: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ country: '', city: '' }), 2000);
    https.get(`https://ip-api.com/json/${ip}?fields=countryCode,city`, (res) => {
      let data = '';
      res.on('data', (c: string) => data += c);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const j = JSON.parse(data);
          resolve({ country: j.countryCode || '', city: j.city || '' });
        } catch { resolve({ country: '', city: '' }); }
      });
    }).on('error', () => { clearTimeout(timeout); resolve({ country: '', city: '' }); });
  });
}

// Daily-rotating salt for IP hashing — same IP gets same hash within a day,
// but changes daily. Prevents cross-day tracking. GDPR-friendly.
function getDailySalt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`muctaxi-${today}-salt`).digest('hex').slice(0, 16);
}

function hashIp(ip: string | undefined): string {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip + getDailySalt()).digest('hex').slice(0, 32);
}

function getClientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return xff.split(',')[0].trim() || req.socket.remoteAddress || '';
}

const BOT_PATTERNS = /bot|crawler|spider|scanner|crawling|curl|wget|python-|java\/|go-http|ruby|axios|postman|headlesschrome|lighthouse|pagespeed|gtmetrix|slackbot|twitterbot|facebookexternalhit|whatsapp|telegrambot|linkedinbot|discordbot|preview|monitor|uptime|pingdom|statuscake|prerender|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|applebot|metabot|meta-externalagent/i;

function detectBot(ua: string): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.test(ua);
}

function parseUa(ua: string): { browser: string; os: string; device: string } {
  const u = ua.toLowerCase();
  let browser = 'other';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('safari/') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('opera') || u.includes('opr/')) browser = 'Opera';

  let os = 'other';
  if (u.includes('windows')) os = 'Windows';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad') || u.includes('ipod')) os = 'iOS';
  else if (u.includes('mac os')) os = 'macOS';
  else if (u.includes('linux')) os = 'Linux';

  let device = 'desktop';
  if (u.includes('mobile') || u.includes('iphone') || u.includes('android')) device = 'mobile';
  if (u.includes('tablet') || u.includes('ipad')) device = 'tablet';

  return { browser, os, device };
}

// Truncate strings to fit DB columns safely
function trunc(s: string | undefined | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// POST /api/track/pageview
// Body: { session_id, visitor_id, path, title?, referrer?, utm_source?, utm_medium?, utm_campaign?, gclid? }
router.post('/track/pageview', async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const {
      session_id, visitor_id, path, title,
      referrer, utm_source, utm_medium, utm_campaign, gclid,
      screen_w, screen_h, lang,
    } = req.body || {};

    if (!session_id || !visitor_id || !path) {
      res.status(400).json({ error: 'missing fields' });
      return;
    }

    const ua = (req.headers['user-agent'] as string) || '';
    const isBot = detectBot(ua) ? 1 : 0;
    const { browser, os, device } = parseUa(ua);
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);

    // Upsert session
    const existing = await query<{ id: number }>(
      `SELECT id FROM visitor_sessions WHERE session_id = ? LIMIT 1`,
      [session_id]
    );

    if (existing.length === 0) {
      // Skip geo for private/local IPs
      const isPrivateIp = !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fd)/.test(ip);
      const geo = isPrivateIp ? { country: '', city: '' } : await geoFromIp(ip!);
      // Accept-Language header fallback if client didn't send
      const acceptLang = (req.headers['accept-language'] as string || '').split(',')[0].trim().slice(0, 20);
      const clientLang = lang ? trunc(lang, 20) : (acceptLang || null);
      await run(
        `INSERT INTO visitor_sessions
          (session_id, visitor_id, ip_hash, country, city, ua_browser, ua_os, ua_device,
           screen_w, screen_h, lang, is_bot,
           referrer, utm_source, utm_medium, utm_campaign, gclid, landing_page, pageview_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          trunc(session_id, 64), trunc(visitor_id, 64), ipHash,
          geo.country, geo.city,
          browser, os, device,
          screen_w ? Number(screen_w) : null,
          screen_h ? Number(screen_h) : null,
          clientLang,
          isBot,
          trunc(referrer, 500), trunc(utm_source, 100), trunc(utm_medium, 100),
          trunc(utm_campaign, 255), trunc(gclid, 255), trunc(path, 500),
        ]
      );
    } else {
      await run(
        `UPDATE visitor_sessions SET last_seen = NOW(), pageview_count = pageview_count + 1 WHERE session_id = ?`,
        [session_id]
      );
    }

    await run(
      `INSERT INTO visitor_pageviews (session_id, path, title) VALUES (?, ?, ?)`,
      [trunc(session_id, 64), trunc(path, 500), trunc(title, 255)]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error('pageview error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// POST /api/track/heartbeat — keeps session "alive" + measures page duration
// Body: { session_id, path }
router.post('/track/heartbeat', async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const { session_id, path } = req.body || {};
    if (!session_id) {
      res.status(400).json({ error: 'missing session_id' });
      return;
    }

    await run(`UPDATE visitor_sessions SET last_seen = NOW() WHERE session_id = ?`, [session_id]);

    if (path) {
      // Update duration of the latest pageview for this session+path
      await run(
        `UPDATE visitor_pageviews
         SET duration_sec = TIMESTAMPDIFF(SECOND, viewed_at, NOW())
         WHERE session_id = ? AND path = ?
         ORDER BY id DESC LIMIT 1`,
        [session_id, path]
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('heartbeat error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// POST /api/track/event — clicks + scroll events (batched array)
// Body: { session_id, path, events: [{type, x_pct, y_pct, scroll_depth, target, viewport_w, viewport_h, device}] }
router.post('/track/event', async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const { session_id, path, events } = req.body || {};
    if (!session_id || !path || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'missing fields' });
      return;
    }
    // Cap batch size to prevent abuse
    const batch = events.slice(0, 50);
    const values: any[] = [];
    const placeholders: string[] = [];
    for (const e of batch) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      values.push(
        trunc(session_id, 64),
        trunc(e.type || 'click', 20),
        trunc(path, 500),
        e.x_pct != null ? Number(e.x_pct) : null,
        e.y_pct != null ? Number(e.y_pct) : null,
        e.scroll_depth != null ? Number(e.scroll_depth) : null,
        trunc(e.target, 255),
        e.viewport_w != null ? Number(e.viewport_w) : null,
        e.viewport_h != null ? Number(e.viewport_h) : null,
        trunc(e.device, 20),
      );
    }
    await run(
      `INSERT INTO visitor_events
        (session_id, type, path, x_pct, y_pct, scroll_depth, target, viewport_w, viewport_h, device)
       VALUES ${placeholders.join(', ')}`,
      values
    );
    // Also keep the session alive
    await run(`UPDATE visitor_sessions SET last_seen = NOW() WHERE session_id = ?`, [session_id]);
    res.json({ ok: true, count: batch.length });
  } catch (err: any) {
    console.error('track/event error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/admin/heatmap-pages — pages with most click data
router.get('/admin/heatmap-pages', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const range = (req.query.range as string) || '7d';
    const since = range === 'today' ? `CURDATE()` :
                  range === '30d' ? `NOW() - INTERVAL 30 DAY` :
                  `NOW() - INTERVAL 7 DAY`;
    const pages = await query<any>(
      `SELECT
         SUBSTRING_INDEX(path, '?', 1) AS path,
         COUNT(*) AS clicks,
         COUNT(DISTINCT session_id) AS visitors
       FROM visitor_events
       WHERE type = 'click' AND occurred_at >= ${since}
       GROUP BY SUBSTRING_INDEX(path, '?', 1)
       ORDER BY clicks DESC
       LIMIT 30`
    );
    res.json({ range, pages });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// GET /api/admin/heatmap?path=X&range=7d&device=all|mobile|desktop
router.get('/admin/heatmap', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const path = (req.query.path as string) || '';
    const range = (req.query.range as string) || '7d';
    const device = (req.query.device as string) || 'all';
    if (!path) {
      res.status(400).json({ error: 'path required' });
      return;
    }
    const since = range === 'today' ? `CURDATE()` :
                  range === '30d' ? `NOW() - INTERVAL 30 DAY` :
                  `NOW() - INTERVAL 7 DAY`;
    const params: any[] = [path];
    let deviceSql = '';
    if (device === 'mobile' || device === 'desktop' || device === 'tablet') {
      deviceSql = `AND device = ?`;
      params.push(device);
    }

    // Match both exact path and path with query params (e.g. / matches /?gclid=...)
    const clicks = await query<any>(
      `SELECT x_pct, y_pct, target, viewport_w, viewport_h, device, occurred_at
       FROM visitor_events
       WHERE type = 'click'
         AND SUBSTRING_INDEX(path, '?', 1) = ?
         AND occurred_at >= ${since} ${deviceSql}
       ORDER BY occurred_at DESC
       LIMIT 5000`,
      params
    );

    // Most clicked elements (target attribute)
    const topTargets = await query<any>(
      `SELECT target, COUNT(*) AS clicks
       FROM visitor_events
       WHERE type = 'click'
         AND SUBSTRING_INDEX(path, '?', 1) = ?
         AND target IS NOT NULL AND target != ''
         AND occurred_at >= ${since} ${deviceSql}
       GROUP BY target
       ORDER BY clicks DESC
       LIMIT 20`,
      params
    );

    // Scroll depth distribution
    const scrollBuckets = await query<any>(
      `SELECT
         CASE
           WHEN scroll_depth >= 100 THEN 100
           WHEN scroll_depth >= 75 THEN 75
           WHEN scroll_depth >= 50 THEN 50
           WHEN scroll_depth >= 25 THEN 25
           ELSE 0
         END AS bucket,
         COUNT(DISTINCT session_id) AS sessions
       FROM visitor_events
       WHERE type = 'scroll'
         AND SUBSTRING_INDEX(path, '?', 1) = ?
         AND occurred_at >= ${since} ${deviceSql}
       GROUP BY bucket
       ORDER BY bucket ASC`,
      params
    );

    res.json({ path, range, device, clicks, topTargets, scrollBuckets });
  } catch (err: any) {
    console.error('heatmap error:', err.message);
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// GET /api/admin/live-visitors — returns sessions active in last 60s
router.get('/admin/live-visitors', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const includeBots = req.query.bots === '1';
    const botFilter = includeBots ? '' : 'AND s.is_bot = 0';

    const sessions = await query<any>(
      `SELECT
         s.session_id, s.visitor_id, s.ua_browser, s.ua_os, s.ua_device,
         s.screen_w, s.screen_h, s.lang,
         s.referrer, s.utm_source, s.utm_medium, s.utm_campaign, s.gclid,
         s.landing_page, s.first_seen, s.last_seen, s.pageview_count, s.is_bot,
         s.country, s.city,
         TIMESTAMPDIFF(SECOND, s.first_seen, NOW()) AS session_seconds,
         TIMESTAMPDIFF(SECOND, s.last_seen, NOW()) AS idle_seconds,
         (SELECT path FROM visitor_pageviews
           WHERE session_id = s.session_id ORDER BY id DESC LIMIT 1) AS current_path,
         (SELECT title FROM visitor_pageviews
           WHERE session_id = s.session_id ORDER BY id DESC LIMIT 1) AS current_title,
         (SELECT COUNT(*) FROM visitor_sessions s2
           WHERE s2.visitor_id = s.visitor_id
             AND s2.first_seen < s.first_seen) AS prev_visits,
         (SELECT MAX(scroll_depth) FROM visitor_events
           WHERE session_id = s.session_id AND type = 'scroll') AS max_scroll,
         (SELECT GROUP_CONCAT(path ORDER BY id DESC SEPARATOR '|||') FROM (
           SELECT path, id FROM visitor_pageviews
           WHERE session_id = s.session_id ORDER BY id DESC LIMIT 5
         ) AS recent_pages) AS page_history,
         (SELECT COUNT(*) FROM visitor_events
           WHERE session_id = s.session_id AND type = 'click'
             AND (target LIKE '%buchen%' OR target LIKE '%Buchen%' OR target LIKE '%booking%')) AS booking_clicks,
         (SELECT COUNT(*) FROM visitor_events
           WHERE session_id = s.session_id AND type = 'click'
             AND (target LIKE '%preis%' OR target LIKE '%Preis%' OR target LIKE '%price%')) AS price_clicks,
         (SELECT COUNT(DISTINCT target) FROM visitor_events
           WHERE session_id = s.session_id AND type = 'form_focus') AS form_fields_touched,
         (SELECT GROUP_CONCAT(DISTINCT target ORDER BY target SEPARATOR ', ') FROM visitor_events
           WHERE session_id = s.session_id AND type = 'form_focus') AS form_fields_list,
         (SELECT COUNT(*) FROM visitor_events
           WHERE session_id = s.session_id AND type = 'click'
             AND (target LIKE '%Jetzt buchen%' OR target LIKE '%Weiter%' OR target LIKE '%submit%' OR target LIKE '%Anfrage%')) AS form_submit_clicks
       FROM visitor_sessions s
       WHERE s.last_seen >= NOW() - INTERVAL 60 SECOND ${botFilter}
       ORDER BY s.last_seen DESC
       LIMIT 100`
    );

    res.json({ count: sessions.length, sessions });
  } catch (err: any) {
    console.error('live-visitors error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// GET /api/admin/visitor-stats?range=today|7d|30d
router.get('/admin/visitor-stats', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const range = (req.query.range as string) || 'today';
    let intervalSql = '1 DAY';
    if (range === '7d') intervalSql = '7 DAY';
    else if (range === '30d') intervalSql = '30 DAY';

    const since = range === 'today'
      ? `CURDATE()`
      : `NOW() - INTERVAL ${intervalSql}`;

    const [totals] = await query<any>(
      `SELECT
         COUNT(*) AS total_sessions,
         COUNT(DISTINCT visitor_id) AS unique_visitors,
         SUM(pageview_count) AS total_pageviews,
         SUM(CASE WHEN pageview_count = 1 THEN 1 ELSE 0 END) AS bounces
       FROM visitor_sessions
       WHERE is_bot = 0 AND first_seen >= ${since}`
    );

    const topPages = await query<any>(
      `SELECT path, COUNT(*) AS views
       FROM visitor_pageviews pv
       JOIN visitor_sessions s ON s.session_id = pv.session_id
       WHERE s.is_bot = 0 AND pv.viewed_at >= ${since}
       GROUP BY path
       ORDER BY views DESC
       LIMIT 15`
    );

    const sources = await query<any>(
      `SELECT
         CASE
           WHEN gclid IS NOT NULL AND gclid != '' THEN 'Google Ads'
           WHEN utm_source IS NOT NULL AND utm_source != '' THEN utm_source
           WHEN referrer LIKE '%google.%' THEN 'Google (organic)'
           WHEN referrer LIKE '%bing.%' THEN 'Bing'
           WHEN referrer LIKE '%duckduckgo.%' THEN 'DuckDuckGo'
           WHEN referrer LIKE '%facebook.%' OR referrer LIKE '%instagram.%' THEN 'Social'
           WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
           ELSE 'Referral'
         END AS source,
         COUNT(*) AS sessions
       FROM visitor_sessions
       WHERE is_bot = 0 AND first_seen >= ${since}
       GROUP BY source
       ORDER BY sessions DESC`
    );

    const devices = await query<any>(
      `SELECT ua_device AS device, COUNT(*) AS sessions
       FROM visitor_sessions
       WHERE is_bot = 0 AND first_seen >= ${since}
       GROUP BY ua_device
       ORDER BY sessions DESC`
    );

    const hourly = await query<any>(
      `SELECT
         DATE_FORMAT(first_seen, '%Y-%m-%d %H:00') AS hour,
         COUNT(*) AS sessions
       FROM visitor_sessions
       WHERE is_bot = 0 AND first_seen >= ${since}
       GROUP BY hour
       ORDER BY hour ASC`
    );

    // Conversion funnel
    const [funnel] = await query<any>(
      `SELECT
         COUNT(DISTINCT s.session_id) AS visited,
         COUNT(DISTINCT CASE WHEN pv.path LIKE '%/ergebnisse%' THEN s.session_id END) AS saw_prices,
         COUNT(DISTINCT CASE WHEN pv.path LIKE '%/buchen%' THEN s.session_id END) AS started_booking
       FROM visitor_sessions s
       LEFT JOIN visitor_pageviews pv ON pv.session_id = s.session_id
       WHERE s.is_bot = 0 AND s.first_seen >= ${since}`
    );

    // Bookings in same range (from existing bookings table)
    const [bookings] = await query<any>(
      `SELECT COUNT(*) AS count FROM bookings WHERE created_at >= ${since}`
    );

    res.json({
      range,
      totals: totals || { total_sessions: 0, unique_visitors: 0, total_pageviews: 0, bounces: 0 },
      topPages,
      sources,
      devices,
      hourly,
      funnel: { ...(funnel || {}), bookings: bookings?.count || 0 },
    });
  } catch (err: any) {
    console.error('visitor-stats error:', err.message);
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// GET /api/admin/session/:id — details for a single session (timeline)
router.get('/admin/session/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTables();
    const sessionId = req.params.id;
    const [session] = await query<any>(
      `SELECT * FROM visitor_sessions WHERE session_id = ? LIMIT 1`,
      [sessionId]
    );
    if (!session) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const pageviews = await query<any>(
      `SELECT path, title, viewed_at, duration_sec FROM visitor_pageviews
       WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );
    res.json({ session, pageviews });
  } catch (err: any) {
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
