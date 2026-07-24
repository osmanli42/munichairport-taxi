/**
 * Session Recording API — rrweb events storage + replay retrieval.
 *
 * Public endpoints (no auth):
 *   POST /api/track/recording   — append events to a session recording
 *
 * Admin endpoints (JWT required):
 *   GET    /api/admin/recordings              — list recordings (paginated, filtered)
 *   GET    /api/admin/recordings/:id          — get full recording (events)
 *   DELETE /api/admin/recordings/:id          — delete one recording
 *   DELETE /api/admin/recordings/bulk         — delete by criteria (older than X days etc.)
 *   GET    /api/admin/recordings/stats        — total count + disk usage
 */
import { Router, Request, Response } from 'express';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// ---------- Table init ----------
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await run(`
    CREATE TABLE IF NOT EXISTS session_recordings (
      id INT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(64) NOT NULL,
      visitor_id VARCHAR(64) DEFAULT NULL,
      chunk_index INT NOT NULL DEFAULT 0,
      events_json LONGTEXT NOT NULL,
      event_count INT NOT NULL DEFAULT 0,
      bytes INT NOT NULL DEFAULT 0,
      first_event_ts BIGINT DEFAULT NULL,
      last_event_ts BIGINT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_session_id (session_id),
      INDEX idx_visitor_id (visitor_id),
      INDEX idx_created_at (created_at)
    )
  `);
  tableReady = true;
}

const MAX_EVENTS_PER_CHUNK = 500;
const MAX_BYTES_PER_REQUEST = 4 * 1024 * 1024; // 4 MB per upload

// ---------- POST /api/track/recording ----------
router.post('/track/recording', async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { session_id, visitor_id, events } = req.body || {};
    if (!session_id || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'missing fields' });
      return;
    }

    // Cap event batch to prevent abuse
    const batch = events.slice(0, MAX_EVENTS_PER_CHUNK);
    const eventsJson = JSON.stringify(batch);

    if (eventsJson.length > MAX_BYTES_PER_REQUEST) {
      res.status(413).json({ error: 'payload too large' });
      return;
    }

    const firstTs = batch[0]?.timestamp ?? null;
    const lastTs = batch[batch.length - 1]?.timestamp ?? null;

    // Determine next chunk_index for this session
    const [c] = await query<{ next_idx: number }>(
      `SELECT COALESCE(MAX(chunk_index), -1) + 1 AS next_idx FROM session_recordings WHERE session_id = ?`,
      [session_id]
    );
    const chunkIndex = c?.next_idx ?? 0;

    await run(
      `INSERT INTO session_recordings
        (session_id, visitor_id, chunk_index, events_json, event_count, bytes, first_event_ts, last_event_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session_id.slice(0, 64),
        (visitor_id || '').slice(0, 64) || null,
        chunkIndex,
        eventsJson,
        batch.length,
        eventsJson.length,
        firstTs,
        lastTs,
      ]
    );

    res.json({ ok: true, chunk_index: chunkIndex, events: batch.length });
  } catch (err: any) {
    console.error('recording error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- GET /api/admin/recordings ----------
// Query params: limit, offset, only_booked, min_duration_sec, since (ISO date)
router.get('/admin/recordings', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const minDuration = parseInt((req.query.min_duration_sec as string) || '0', 10);
    const onlyBooked = req.query.only_booked === '1';

    // `since` date filter (ISO string → MySQL datetime, validated before interpolation)
    const sinceRaw = req.query.since as string | undefined;
    let sinceClause = '';
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!isNaN(d.getTime())) {
        // Format as MySQL-safe YYYY-MM-DD HH:MM:SS — no user-controlled string content
        const mysqlTs = d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
        sinceClause = `'${mysqlTs}'`;
      }
    }

    // Build WHERE — interpolate numbers (validated) to avoid LIMIT/OFFSET bind issues
    const where: string[] = ['1=1'];
    if (sinceClause) {
      where.push(`r.created_at >= ${sinceClause}`);
    }
    if (minDuration > 0) {
      where.push(`TIMESTAMPDIFF(SECOND, vs.first_seen, vs.last_seen) >= ${minDuration}`);
    }
    // Filter out bot sessions
    where.push('(vs.is_bot = 0 OR vs.is_bot IS NULL)');

    const sql = `
      SELECT
        r.session_id,
        ANY_VALUE(r.visitor_id) AS visitor_id,
        SUM(r.event_count) AS total_events,
        SUM(r.bytes) AS total_bytes,
        MIN(r.first_event_ts) AS first_ts,
        MAX(r.last_event_ts) AS last_ts,
        MIN(r.created_at) AS recorded_from,
        MAX(r.created_at) AS recorded_to,
        COUNT(*) AS chunk_count,
        vs.ua_browser, vs.ua_os, vs.ua_device,
        vs.referrer, vs.utm_source, vs.utm_campaign, vs.gclid,
        vs.country, vs.city,
        vs.landing_page, vs.first_seen, vs.last_seen, vs.pageview_count,
        TIMESTAMPDIFF(SECOND, vs.first_seen, vs.last_seen) AS session_seconds,
        (SELECT GROUP_CONCAT(DISTINCT path SEPARATOR ' → ')
          FROM visitor_pageviews pv WHERE pv.session_id = r.session_id) AS pages,
        (SELECT COUNT(*) FROM bookings b
          WHERE b.created_at BETWEEN vs.first_seen AND DATE_ADD(vs.last_seen, INTERVAL 5 MINUTE)
          ) AS booking_count
      FROM session_recordings r
      LEFT JOIN visitor_sessions vs ON vs.session_id = r.session_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.session_id
      ${onlyBooked ? 'HAVING booking_count > 0' : ''}
      ORDER BY MIN(r.created_at) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await query<any>(sql);

    const [total] = await query<{ n: number }>(
      `SELECT COUNT(DISTINCT session_id) AS n FROM session_recordings`
    );

    res.json({ total: Number(total?.n || 0), recordings: rows });
  } catch (err: any) {
    console.error('recordings list error:', err.message);
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- GET /api/admin/recordings/stats ----------
router.get('/admin/recordings/stats', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const [s] = await query<any>(
      `SELECT
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(*) AS chunks,
        SUM(event_count) AS events,
        SUM(bytes) AS total_bytes,
        MIN(created_at) AS oldest,
        MAX(created_at) AS newest
       FROM session_recordings`
    );

    const buckets = await query<any>(
      `SELECT
         DATE(created_at) AS day,
         COUNT(DISTINCT session_id) AS sessions,
         SUM(bytes) AS bytes
       FROM session_recordings
       WHERE created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY day
       ORDER BY day DESC`
    );

    res.json({ ...s, daily: buckets });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- GET /api/admin/recordings/:id ----------
// :id is session_id. Returns all chunks merged.
router.get('/admin/recordings/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const sessionId = req.params.id;

    const chunks = await query<any>(
      `SELECT chunk_index, events_json, event_count, first_event_ts, last_event_ts, created_at
       FROM session_recordings
       WHERE session_id = ?
       ORDER BY chunk_index ASC`,
      [sessionId]
    );

    if (chunks.length === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    // Merge all chunks into one event array
    const allEvents: any[] = [];
    for (const c of chunks) {
      try {
        const events = JSON.parse(c.events_json);
        if (Array.isArray(events)) allEvents.push(...events);
      } catch {}
    }

    // Also fetch session metadata
    const [meta] = await query<any>(
      `SELECT s.*, TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) AS session_seconds
       FROM visitor_sessions s WHERE s.session_id = ? LIMIT 1`,
      [sessionId]
    );

    const pageviews = await query<any>(
      `SELECT path, title, viewed_at FROM visitor_pageviews
       WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    res.json({
      session_id: sessionId,
      meta: meta || null,
      pageviews,
      events: allEvents,
      event_count: allEvents.length,
      chunk_count: chunks.length,
    });
  } catch (err: any) {
    console.error('recording get error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- DELETE /api/admin/recordings/bulk ----------
// Body: { older_than_days?: number, session_ids?: string[], all?: true }
router.delete('/admin/recordings/bulk', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const { older_than_days, session_ids, all } = req.body || {};

    if (all === true) {
      const r = await run(`DELETE FROM session_recordings`);
      res.json({ ok: true, deleted: r.affectedRows });
      return;
    }

    if (Array.isArray(session_ids) && session_ids.length > 0) {
      const placeholders = session_ids.map(() => '?').join(',');
      const r = await run(
        `DELETE FROM session_recordings WHERE session_id IN (${placeholders})`,
        session_ids
      );
      res.json({ ok: true, deleted: r.affectedRows });
      return;
    }

    if (typeof older_than_days === 'number' && older_than_days > 0) {
      const r = await run(
        `DELETE FROM session_recordings WHERE created_at < NOW() - INTERVAL ? DAY`,
        [older_than_days]
      );
      res.json({ ok: true, deleted: r.affectedRows });
      return;
    }

    res.status(400).json({ error: 'need older_than_days or session_ids or all=true' });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- DELETE /api/admin/recordings/:id ----------
router.delete('/admin/recordings/:id', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const sessionId = req.params.id;
    const r = await run(`DELETE FROM session_recordings WHERE session_id = ?`, [sessionId]);
    res.json({ ok: true, deleted: r.affectedRows });
  } catch (err: any) {
    res.status(500).json({ error: 'failed' });
  }
});

export default router;
