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
    // Sıralama: izlemeye değer oturumları öne almak için. Alias'lar MySQL'de ORDER BY
    // içinde kullanılabildiği için skorlar tekrar hesaplanmaz.
    const sortParam = String(req.query.sort || 'recent');
    const ORDER_BY: Record<string, string> = {
      recent: 'MIN(r.created_at) DESC',
      // yüksek niyetli ama rezervasyon yapmamış oturumlar
      intent: '(booked_id IS NULL) DESC, opened_form DESC, fields_touched DESC, saw_prices DESC, MIN(r.created_at) DESC',
      frustration: '(field_errors + 3 * tech_errors) DESC, field_errors DESC, MIN(r.created_at) DESC',
    };
    const orderBy = ORDER_BY[sortParam] || ORDER_BY.recent;

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

    // --- Rezervasyon eşleştirmesi ---
    // ÖNEMLİ: burada bir zaman-penceresi COUNT(*) kullanılamaz — oturumla korele olmayan
    // böyle bir alt sorgu, o oturum sırasında sitede BAŞKA birinin yaptığı rezervasyonu da
    // sayar ve neredeyse her uzun oturumu "rezervasyon yapıldı" gösterir (eski bug).
    // Doğru anahtarlar: bookings.session_id (kesin) ve bookings.visitor_id (aynı cihaz, olası).
    const bookingExprs = `
        (SELECT b.id FROM bookings b
           WHERE b.session_id = r.session_id AND b.status <> 'cancelled'
           ORDER BY b.created_at LIMIT 1) AS booked_id,
        (SELECT b.booking_number FROM bookings b
           WHERE b.session_id = r.session_id AND b.status <> 'cancelled'
           ORDER BY b.created_at LIMIT 1) AS booked_number,
        (SELECT b.price FROM bookings b
           WHERE b.session_id = r.session_id AND b.status <> 'cancelled'
           ORDER BY b.created_at LIMIT 1) AS booked_price,
        (SELECT COUNT(*) FROM bookings b
           WHERE vs.visitor_id IS NOT NULL AND b.visitor_id = vs.visitor_id
             AND b.status <> 'cancelled' AND b.source = 'web'
             AND b.created_at BETWEEN vs.first_seen AND DATE_ADD(vs.last_seen, INTERVAL 30 MINUTE)
           ) AS visitor_booking_count`;

    // --- Vazgeçme sinyalleri (BookingFunnelTracker'ın yazdığı visitor_events tipleri) ---
    // last_field: oturumun SON odaklanılan alanı = kullanıcının takıldığı nokta.
    const signalExprs = `
        (SELECT ve.target FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type = 'field_focus'
           ORDER BY ve.occurred_at DESC, ve.id DESC LIMIT 1) AS last_field,
        (SELECT COUNT(DISTINCT ve.target) FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type = 'field_focus') AS fields_touched,
        (SELECT COUNT(*) FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type = 'call_click') AS call_clicks,
        (SELECT COUNT(*) FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type = 'field_error') AS field_errors,
        (SELECT COUNT(*) FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type IN ('js_error', 'api_error')) AS tech_errors,
        (SELECT COUNT(*) FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type IN ('tab_away', 'price_copy')) AS compare_signals,
        (SELECT ve.target FROM visitor_events ve
           WHERE ve.session_id = r.session_id AND ve.type = 'price_shown'
           ORDER BY ve.id DESC LIMIT 1) AS price_shown,
        (SELECT MAX(pv.load_time_ms) FROM visitor_pageviews pv
           WHERE pv.session_id = r.session_id) AS max_load_time_ms`;

    const havingClause = onlyBooked
      ? 'HAVING (booked_id IS NOT NULL OR visitor_booking_count > 0)'
      : '';

    const sql = `
      SELECT
        r.session_id,
        -- MIN() yerine ANY_VALUE() da olurdu ama bazı MariaDB sürümlerinde ANY_VALUE yok;
        -- visitor_id bir oturum içinde sabit olduğu için MIN aynı değeri verir.
        MIN(r.visitor_id) AS visitor_id,
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
        -- Huni aşaması: fiyat sayfası / rezervasyon formu görüldü mü
        (SELECT MAX(pv.path LIKE '%/ergebnisse%') FROM visitor_pageviews pv
           WHERE pv.session_id = r.session_id) AS saw_prices,
        (SELECT MAX(pv.path LIKE '%/buchen%') FROM visitor_pageviews pv
           WHERE pv.session_id = r.session_id) AS opened_form,
        ${signalExprs},
        ${bookingExprs}
      FROM session_recordings r
      LEFT JOIN visitor_sessions vs ON vs.session_id = r.session_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.session_id
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await query<any>(sql);

    // Toplam sayaç, listeyle AYNI filtreleri uygulamalı — aksi halde "Toplam" ve sayfalama
    // filtreden bağımsız kalır (eski davranış: filtresiz COUNT(DISTINCT session_id)).
    const [total] = await query<{ n: number }>(`
      SELECT COUNT(*) AS n FROM (
        SELECT r.session_id, ${bookingExprs}
        FROM session_recordings r
        LEFT JOIN visitor_sessions vs ON vs.session_id = r.session_id
        WHERE ${where.join(' AND ')}
        GROUP BY r.session_id
        ${havingClause}
      ) t
    `);

    // booking_match / exit_stage türetmesi tek yerde yapılır ki frontend aynı mantığı
    // tekrar etmesin: 'session' = bu oturumdan yaratılmış rezervasyon (kesin),
    // 'visitor' = aynı cihazdan oturum penceresi içinde rezervasyon (olası), 'none' = yok.
    const recordings = rows.map((row: any) => {
      const bookingMatch: 'session' | 'visitor' | 'none' =
        row.booked_id ? 'session'
        : Number(row.visitor_booking_count || 0) > 0 ? 'visitor'
        : 'none';
      const callClicks = Number(row.call_clicks || 0);
      const fieldErrors = Number(row.field_errors || 0);
      const techErrors = Number(row.tech_errors || 0);
      const compareSignals = Number(row.compare_signals || 0);
      const fieldsTouched = Number(row.fields_touched || 0);
      const openedForm = Number(row.opened_form || 0) > 0;
      const sawPrices = Number(row.saw_prices || 0) > 0;
      // 6 sn: tek yavaş sayfa yükü oturumu "yavaş" diye etiketlemesin diye eşik yüksek
      const slow = Number(row.max_load_time_ms || 0) > 6000;

      // 'called' = telefona/WhatsApp'a döndü: bu müşteri vazgeçmedi, kanal değiştirdi.
      const exitStage: 'booked' | 'called' | 'form' | 'prices' | 'landing' =
        bookingMatch !== 'none' ? 'booked'
        : callClicks > 0 ? 'called'
        : openedForm ? 'form'
        : sawPrices ? 'prices'
        : 'landing';

      // Hangi sinyal baskınsa vazgeçme sebebi o kabul edilir (sıra = güven sırası).
      const dropReason: string =
        bookingMatch !== 'none' ? 'booked'
        : callClicks > 0 ? 'called'
        : techErrors > 0 ? 'tech_error'
        : fieldErrors > 0 ? 'field_error'
        : compareSignals > 0 ? 'compare'
        : slow ? 'slow'
        : 'unknown';

      // frustration: teknik hata en ağır; intent: forma ne kadar yaklaştı
      const frustration = fieldErrors + 3 * techErrors + (slow ? 1 : 0);
      const intent =
        (sawPrices ? 1 : 0) + (openedForm ? 2 : 0) + Math.min(fieldsTouched, 6) +
        (Number(row.session_seconds || 0) >= 60 ? 1 : 0);

      return {
        ...row,
        saw_prices: sawPrices,
        opened_form: openedForm,
        visitor_booking_count: Number(row.visitor_booking_count || 0),
        call_clicks: callClicks,
        field_errors: fieldErrors,
        tech_errors: techErrors,
        compare_signals: compareSignals,
        fields_touched: fieldsTouched,
        booking_match: bookingMatch,
        exit_stage: exitStage,
        drop_reason: dropReason,
        frustration,
        intent,
      };
    });

    res.json({ total: Number(total?.n || 0), recordings });
  } catch (err: any) {
    console.error('recordings list error:', err.message);
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- GET /api/admin/recordings/dropoff ----------
// "Neden vazgeçiyorlar" özeti. Liste ile aynı `since` filtresini alır.
// Kaynak: visitor_sessions + visitor_pageviews + visitor_events (BookingFunnelTracker) + bookings.
router.get('/admin/recordings/dropoff', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();

    // `since`: gün sayısı olarak alınır (liste tarafındaki ISO tarih ile aynı aralığı verir)
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 365);
    const since = `NOW() - INTERVAL ${days} DAY`;

    // Huni — Live sekmesindeki (tracking.ts) desenin aynısı: bookings EXISTS ile bağlanır,
    // pageview JOIN'ine eklenirse satırlar çarpılıp saw_prices/opened_form şişer.
    const [funnel] = await query<any>(
      `SELECT
         COUNT(DISTINCT s.session_id) AS visited,
         COUNT(DISTINCT CASE WHEN pv.path LIKE '%/ergebnisse%' THEN s.session_id END) AS saw_prices,
         COUNT(DISTINCT CASE WHEN pv.path LIKE '%/buchen%' THEN s.session_id END) AS opened_form
       FROM visitor_sessions s
       LEFT JOIN visitor_pageviews pv ON pv.session_id = s.session_id
       WHERE s.is_bot = 0 AND s.first_seen >= ${since}`
    );

    const [converted] = await query<any>(
      `SELECT COUNT(DISTINCT b.session_id) AS booked
       FROM bookings b
       WHERE b.status <> 'cancelled' AND b.source = 'web' AND b.session_id IS NOT NULL
         AND b.created_at >= ${since}`
    );

    const [called] = await query<any>(
      `SELECT COUNT(DISTINCT ve.session_id) AS called
       FROM visitor_events ve
       JOIN visitor_sessions s ON s.session_id = ve.session_id
       WHERE ve.type = 'call_click' AND s.is_bot = 0 AND s.first_seen >= ${since}`
    );

    // En çok terk edilen form alanı = oturumun son field_focus'u (rezervasyonsuz oturumlarda)
    const lastFields = await query<any>(
      `SELECT last_field AS field, COUNT(*) AS n FROM (
         SELECT (SELECT ve.target FROM visitor_events ve
                   WHERE ve.session_id = s.session_id AND ve.type = 'field_focus'
                   ORDER BY ve.occurred_at DESC, ve.id DESC LIMIT 1) AS last_field
         FROM visitor_sessions s
         WHERE s.is_bot = 0 AND s.first_seen >= ${since}
           AND NOT EXISTS (SELECT 1 FROM bookings b
                            WHERE b.session_id = s.session_id AND b.status <> 'cancelled')
       ) t
       WHERE last_field IS NOT NULL
       GROUP BY last_field ORDER BY n DESC LIMIT 10`
    );

    const errors = await query<any>(
      `SELECT ve.type, ve.target, COUNT(*) AS n
       FROM visitor_events ve
       JOIN visitor_sessions s ON s.session_id = ve.session_id
       WHERE ve.type IN ('field_error', 'js_error', 'api_error')
         AND s.is_bot = 0 AND s.first_seen >= ${since}
       GROUP BY ve.type, ve.target ORDER BY n DESC LIMIT 10`
    );

    // Fiyat bandına göre terk: price_shown "fiyat|km|araç" formatında
    const priceBands = await query<any>(
      `SELECT band, COUNT(*) AS sessions, SUM(booked) AS booked FROM (
         SELECT
           CASE
             WHEN p < 40 THEN '0-40'
             WHEN p < 70 THEN '40-70'
             WHEN p < 120 THEN '70-120'
             ELSE '120+'
           END AS band,
           booked
         FROM (
           SELECT
             CAST(SUBSTRING_INDEX(ve.target, '|', 1) AS DECIMAL(10,2)) AS p,
             EXISTS (SELECT 1 FROM bookings b
                      WHERE b.session_id = ve.session_id AND b.status <> 'cancelled') AS booked
           FROM visitor_events ve
           JOIN visitor_sessions s ON s.session_id = ve.session_id
           WHERE ve.type = 'price_shown' AND s.is_bot = 0 AND s.first_seen >= ${since}
           GROUP BY ve.session_id, ve.target
         ) x
         WHERE p > 0
       ) y
       GROUP BY band ORDER BY FIELD(band, '0-40', '40-70', '70-120', '120+')`
    );

    // Kırılımlar: cihaz ve kaynak (Ads vs organik) bazında dönüşüm
    const breakdown = await query<any>(
      `SELECT
         COALESCE(s.ua_device, 'bilinmiyor') AS device,
         CASE WHEN COALESCE(s.gclid, '') <> '' OR s.utm_medium IN ('cpc','ppc','paid')
              THEN 'ads' ELSE 'organik' END AS source,
         COUNT(*) AS sessions,
         SUM(EXISTS (SELECT 1 FROM bookings b
                      WHERE b.session_id = s.session_id AND b.status <> 'cancelled')) AS booked,
         SUM(EXISTS (SELECT 1 FROM visitor_events ve
                      WHERE ve.session_id = s.session_id AND ve.type = 'call_click')) AS called
       FROM visitor_sessions s
       WHERE s.is_bot = 0 AND s.first_seen >= ${since}
       GROUP BY device, source ORDER BY sessions DESC`
    );

    // A/B varyant kırılımı — exp_variants zaten yazılıyor (utils/experiments.ts)
    const variants = await query<any>(
      `SELECT
         COALESCE(NULLIF(s.exp_variants, ''), '—') AS variant,
         COUNT(*) AS sessions,
         SUM(EXISTS (SELECT 1 FROM visitor_pageviews pv
                      WHERE pv.session_id = s.session_id AND pv.path LIKE '%/buchen%')) AS opened_form,
         SUM(EXISTS (SELECT 1 FROM bookings b
                      WHERE b.session_id = s.session_id AND b.status <> 'cancelled')) AS booked
       FROM visitor_sessions s
       WHERE s.is_bot = 0 AND s.first_seen >= ${since}
       GROUP BY variant ORDER BY sessions DESC LIMIT 10`
    );

    res.json({
      days,
      funnel: {
        visited: Number(funnel?.visited || 0),
        saw_prices: Number(funnel?.saw_prices || 0),
        opened_form: Number(funnel?.opened_form || 0),
        booked: Number(converted?.booked || 0),
        called: Number(called?.called || 0),
      },
      last_fields: lastFields,
      errors,
      price_bands: priceBands,
      breakdown,
      variants,
    });
  } catch (err: any) {
    console.error('dropoff error:', err.message);
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
       -- chunk_index, eşzamanlı yüklemelerde MAX(chunk_index)+1 yarışı nedeniyle
       -- tekrar edebiliyor; id her zaman artan olduğu için sıralama ona göre yapılır.
       ORDER BY id ASC`,
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
