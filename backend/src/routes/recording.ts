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
 *   GET    /api/admin/recordings/settings     — kayıt aç/kapa, örnekleme, saklama süresi
 *   PUT    /api/admin/recordings/settings
 *   PUT    /api/admin/recordings/:id/mark     — ⭐ / izlendi / not
 */
import { Router, Request, Response } from 'express';
import { promisify } from 'util';
import zlib from 'zlib';
import { query, run } from '../db';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const gzipAsync = promisify(zlib.gzip);

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
  // Admin'in oturum başına işaretleri: ⭐ (otomatik silmeden korunur), izlendi, not.
  // Kolasyon açıkça verilir: session_recordings ile JOIN'de "Illegal mix of collations" olmasın.
  await run(`
    CREATE TABLE IF NOT EXISTS session_recording_marks (
      session_id VARCHAR(64) NOT NULL,
      starred TINYINT(1) NOT NULL DEFAULT 0,
      watched_at DATETIME DEFAULT NULL,
      note VARCHAR(500) DEFAULT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS recording_settings (
      k VARCHAR(40) NOT NULL,
      v VARCHAR(255) NOT NULL,
      PRIMARY KEY (k)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableReady = true;
}

// ---------- Ayarlar (admin'den aç/kapa) ----------
// enabled=0 → yeni kayıt saklanmaz; sample_pct → oturumların yüzde kaçı saklanır;
// retention_days>0 → bu günden eski kayıtlar otomatik silinir (⭐ ve rezervasyonlu
// oturumlar keep_* açıkken korunur). Varsayılanlar bugünkü davranışla aynıdır.
const SETTING_DEFAULTS = { enabled: 1, sample_pct: 100, retention_days: 0, keep_starred: 1, keep_booked: 1 };
type RecSettings = typeof SETTING_DEFAULTS;
let settingsCache: { at: number; v: RecSettings } | null = null;

async function getSettings(force = false): Promise<RecSettings> {
  if (!force && settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.v;
  const v: RecSettings = { ...SETTING_DEFAULTS };
  try {
    const rows = await query<{ k: string; v: string }>(`SELECT k, v FROM recording_settings`);
    for (const r of rows) {
      if (r.k in v) (v as any)[r.k] = Number(r.v) || 0;
    }
  } catch {}
  settingsCache = { at: Date.now(), v };
  return v;
}

// Örnekleme oturum başına sabit olmalı (aynı oturumun bir kısmı kaydedilip bir kısmı
// atlanmasın) — session_id'nin hash'i kullanılır.
function inSample(sessionId: string, pct: number): boolean {
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100) < pct;
}

const MAX_EVENTS_PER_CHUNK = 500;
const MAX_BYTES_PER_REQUEST = 4 * 1024 * 1024; // 4 MB per upload

// ---------- Live watching ----------
// Sessions an admin is watching right now (Live tab → "Canlı izle"). Refreshed by every
// poll of /admin/recordings/:id/live; the upload response then says `watched: true` and
// the visitor's recorder switches from 10 s to 1.5 s uploads (SessionRecorder.tsx).
const WATCH_TTL_MS = 30_000;
const watchedSessions = new Map<string, number>();
function isWatched(sid: string): boolean {
  const until = watchedSessions.get(sid);
  if (!until) return false;
  if (until < Date.now()) { watchedSessions.delete(sid); return false; }
  return true;
}

// ---------- GET /api/track/recording/watched?sid= ----------
// Cheap in-memory check the visitor's recorder makes every few seconds, so live watching
// switches to fast uploads within ~3 s instead of waiting for the next 10 s upload.
router.get('/track/recording/watched', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({ watched: isWatched(String(req.query.sid || '').slice(0, 64)) });
});

// ---------- POST /api/track/recording ----------
router.post('/track/recording', async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const { session_id, visitor_id, events } = req.body || {};
    if (!session_id || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'missing fields' });
      return;
    }

    const settings = await getSettings();
    if (!settings.enabled || !inSample(String(session_id), settings.sample_pct)) {
      res.json({ ok: true, skipped: true });
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

    res.json({ ok: true, chunk_index: chunkIndex, events: batch.length, ...(isWatched(String(session_id)) ? { watched: true } : {}) });
  } catch (err: any) {
    console.error('recording error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- GET /api/admin/recordings ----------
// Query params: limit, offset, only_booked, min_duration_sec, since (ISO date), sort,
//   q (adres / şehir / kampanya / rezervasyon no), device, source (ads|organic),
//   stage (booked|called|form|prices|landing), issues=1, starred=1, unwatched=1,
//   error_target (İçgörüler'deki hata satırı), last_field (terk edilen alan)
router.get('/admin/recordings', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt((req.query.offset as string) || '0', 10) || 0, 0);
    const minDuration = Math.max(parseInt((req.query.min_duration_sec as string) || '0', 10) || 0, 0);
    const onlyBooked = req.query.only_booked === '1';
    // Sıralama: izlemeye değer oturumları öne almak için. Dış sorgu türetilmiş tablonun
    // alias'larını kullandığı için skorlar tekrar hesaplanmaz.
    const sortParam = String(req.query.sort || 'recent');
    const ORDER_BY: Record<string, string> = {
      recent: 't.recorded_from DESC',
      // yüksek niyetli ama rezervasyon yapmamış oturumlar
      intent: '(t.booked_id IS NULL) DESC, t.opened_form DESC, t.fields_touched DESC, t.saw_prices DESC, t.recorded_from DESC',
      frustration: '(t.field_errors + 3 * t.tech_errors) DESC, t.field_errors DESC, t.recorded_from DESC',
      // visitor_sessions süresi geri dönen ziyaretçide günlerce olabiliyor; kaydın kendi uzunluğu esas
      longest: '(t.last_ts - t.first_ts) DESC, t.recorded_from DESC',
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

    // --- İç sorgu filtreleri (gruplamadan önce, ucuz olanlar) ---
    const where: string[] = ['1=1'];
    const params: any[] = [];
    if (sinceClause) {
      where.push(`r.created_at >= ${sinceClause}`);
    }
    if (minDuration > 0) {
      where.push(`TIMESTAMPDIFF(SECOND, vs.first_seen, vs.last_seen) >= ${minDuration}`);
    }
    // Filter out bot sessions
    where.push('(vs.is_bot = 0 OR vs.is_bot IS NULL)');

    const device = String(req.query.device || '');
    if (['mobile', 'tablet', 'desktop'].includes(device)) {
      where.push('vs.ua_device = ?');
      params.push(device);
    }
    // Kaynak tanımı İçgörüler'deki kırılımla aynı (dropoff → breakdown)
    const ADS_SQL = `(COALESCE(vs.gclid, '') <> '' OR vs.utm_medium IN ('cpc','ppc','paid'))`;
    const source = String(req.query.source || '');
    if (source === 'ads') where.push(ADS_SQL);
    else if (source === 'organic') where.push(`NOT ${ADS_SQL}`);

    // Serbest arama: adresler pageview yollarında URL-kodlu durur (K%C3%B6nigs…, boşluk '+'),
    // bu yüzden hem ham hem kodlu hali aranır.
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const enc = encodeURIComponent(q);
      where.push(`(
        vs.city LIKE ? OR vs.utm_campaign LIKE ? OR r.session_id = ?
        OR EXISTS (SELECT 1 FROM visitor_pageviews pv WHERE pv.session_id = r.session_id
                     AND (pv.path LIKE ? OR pv.path LIKE ? OR pv.path LIKE ?))
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = r.session_id AND b.booking_number LIKE ?)
      )`);
      params.push(`%${q}%`, `%${q}%`, q, `%${q}%`, `%${enc}%`, `%${enc.replace(/%20/g, '+')}%`, `%${q}%`);
    }
    const errorTarget = String(req.query.error_target || '').slice(0, 255);
    if (errorTarget) {
      where.push(`EXISTS (SELECT 1 FROM visitor_events ve WHERE ve.session_id = r.session_id
                    AND ve.type IN ('field_error','js_error','api_error') AND ve.target = ?)`);
      params.push(errorTarget);
    }

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
        (SELECT COUNT(*) FROM callback_requests cr
           WHERE cr.session_id = r.session_id) AS callback_requests,
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

    const inner = `
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
        m.starred, m.watched_at, m.note,
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
      LEFT JOIN session_recording_marks m ON m.session_id = r.session_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.session_id`;

    // --- Dış filtreler (türetilmiş alias'lar üzerinde) ---
    // Aşama tanımı aşağıdaki exit_stage türetmesiyle birebir aynı sırayı izler.
    const BOOKED = '(t.booked_id IS NOT NULL OR t.visitor_booking_count > 0)';
    const CALLED = '(t.call_clicks + t.callback_requests) > 0';
    const FORM = 'COALESCE(t.opened_form, 0) > 0';
    const PRICES = 'COALESCE(t.saw_prices, 0) > 0';
    const STAGE_SQL: Record<string, string> = {
      booked: BOOKED,
      called: `NOT ${BOOKED} AND ${CALLED}`,
      form: `NOT ${BOOKED} AND NOT (${CALLED}) AND ${FORM}`,
      prices: `NOT ${BOOKED} AND NOT (${CALLED}) AND NOT ${FORM} AND ${PRICES}`,
      landing: `NOT ${BOOKED} AND NOT (${CALLED}) AND NOT ${FORM} AND NOT ${PRICES}`,
    };
    const outer: string[] = [];
    const outerParams: any[] = [];
    if (onlyBooked) outer.push(BOOKED);
    const stage = String(req.query.stage || '');
    if (STAGE_SQL[stage]) outer.push(STAGE_SQL[stage]);
    if (req.query.issues === '1') outer.push('(t.field_errors + t.tech_errors) > 0');
    if (req.query.starred === '1') outer.push('t.starred = 1');
    if (req.query.unwatched === '1') outer.push('t.watched_at IS NULL');
    const lastField = String(req.query.last_field || '').slice(0, 255);
    if (lastField) {
      outer.push('t.last_field = ?');
      outerParams.push(lastField);
    }
    const outerWhere = outer.length ? `WHERE ${outer.join(' AND ')}` : '';

    const rows = await query<any>(
      `SELECT t.* FROM (${inner}) t ${outerWhere} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
      [...params, ...outerParams]
    );

    // Toplam sayaç, listeyle AYNI filtreleri uygulamalı — aksi halde "Toplam" ve sayfalama
    // filtreden bağımsız kalır. Dış filtre yoksa ağır sinyal alt sorguları atlanır.
    const [total] = outer.length
      ? await query<{ n: number }>(`SELECT COUNT(*) AS n FROM (${inner}) t ${outerWhere}`, [...params, ...outerParams])
      : await query<{ n: number }>(
          `SELECT COUNT(*) AS n FROM (
             SELECT r.session_id FROM session_recordings r
             LEFT JOIN visitor_sessions vs ON vs.session_id = r.session_id
             WHERE ${where.join(' AND ')}
             GROUP BY r.session_id
           ) t`,
          params
        );

    // booking_match / exit_stage türetmesi tek yerde yapılır ki frontend aynı mantığı
    // tekrar etmesin: 'session' = bu oturumdan yaratılmış rezervasyon (kesin),
    // 'visitor' = aynı cihazdan oturum penceresi içinde rezervasyon (olası), 'none' = yok.
    const recordings = rows.map((row: any) => {
      const bookingMatch: 'session' | 'visitor' | 'none' =
        row.booked_id ? 'session'
        : Number(row.visitor_booking_count || 0) > 0 ? 'visitor'
        : 'none';
      // Rückruf-Anfrage zählt wie ein Telefonkontakt: der Kunde hat nicht abgebrochen,
      // er hat den Kanal gewechselt.
      const callClicks = Number(row.call_clicks || 0) + Number(row.callback_requests || 0);
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
        callback_requests: Number(row.callback_requests || 0),
        field_errors: fieldErrors,
        tech_errors: techErrors,
        compare_signals: compareSignals,
        fields_touched: fieldsTouched,
        booking_match: bookingMatch,
        exit_stage: exitStage,
        drop_reason: dropReason,
        frustration,
        intent,
        starred: Number(row.starred || 0) === 1,
        watched: !!row.watched_at,
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
// ?days=N → seçili dönem için ayrıca oturum/bayt toplamı (KPI şeridi)
router.get('/admin/recordings/stats', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const days = Math.min(Math.max(parseInt((req.query.days as string) || '30', 10) || 30, 1), 3650);
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

    const [range] = await query<any>(
      `SELECT COUNT(DISTINCT session_id) AS sessions, SUM(bytes) AS bytes
       FROM session_recordings
       WHERE created_at >= NOW() - INTERVAL ${days} DAY`
    );

    const [marks] = await query<any>(
      `SELECT SUM(starred = 1) AS starred, SUM(watched_at IS NOT NULL) AS watched
       FROM session_recording_marks`
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

    res.json({
      ...s,
      range_days: days,
      range_sessions: Number(range?.sessions || 0),
      range_bytes: Number(range?.bytes || 0),
      starred: Number(marks?.starred || 0),
      watched: Number(marks?.watched || 0),
      daily: buckets,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- GET/PUT /api/admin/recordings/settings ----------
// /:id rotasından ÖNCE tanımlı olmalı, yoksa "settings" bir session_id sanılır.
router.get('/admin/recordings/settings', authenticateAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    res.json(await getSettings(true));
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

router.put('/admin/recordings/settings', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const body = req.body || {};
    const clamp = (v: any, lo: number, hi: number) => Math.min(Math.max(Math.round(Number(v) || 0), lo), hi);
    const next: Partial<RecSettings> = {};
    if ('enabled' in body) next.enabled = body.enabled ? 1 : 0;
    if ('sample_pct' in body) next.sample_pct = clamp(body.sample_pct, 0, 100);
    if ('retention_days' in body) next.retention_days = clamp(body.retention_days, 0, 3650);
    if ('keep_starred' in body) next.keep_starred = body.keep_starred ? 1 : 0;
    if ('keep_booked' in body) next.keep_booked = body.keep_booked ? 1 : 0;
    for (const [k, v] of Object.entries(next)) {
      await run(
        `INSERT INTO recording_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)`,
        [k, String(v)]
      );
    }
    res.json(await getSettings(true));
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- PUT /api/admin/recordings/:id/mark ----------
// Body: { starred?: boolean, watched?: boolean, note?: string | null }
router.put('/admin/recordings/:id/mark', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const sessionId = String(req.params.id).slice(0, 64);
    const { starred, watched, note } = req.body || {};
    await run(`INSERT IGNORE INTO session_recording_marks (session_id) VALUES (?)`, [sessionId]);
    const sets: string[] = [];
    const params: any[] = [];
    if (typeof starred === 'boolean') { sets.push('starred = ?'); params.push(starred ? 1 : 0); }
    if (watched === true) sets.push('watched_at = COALESCE(watched_at, NOW())');
    if (watched === false) sets.push('watched_at = NULL');
    if (note !== undefined) {
      const n = typeof note === 'string' ? note.trim().slice(0, 500) : '';
      sets.push('note = ?');
      params.push(n || null);
    }
    if (sets.length) {
      await run(`UPDATE session_recording_marks SET ${sets.join(', ')} WHERE session_id = ?`, [...params, sessionId]);
    }
    const [m] = await query<any>(
      `SELECT starred, watched_at, note FROM session_recording_marks WHERE session_id = ?`,
      [sessionId]
    );
    res.json({ ok: true, starred: Number(m?.starred || 0) === 1, watched: !!m?.watched_at, note: m?.note || null });
  } catch (err: any) {
    res.status(500).json({ error: 'failed', detail: err.message });
  }
});

// ---------- GET /api/admin/recordings/:id ----------
// :id is session_id. Returns all chunks merged + oynatıcı zaman çizelgesi için
// zaman damgalı sinyaller (visitor_events). Yanıt 1–5 MB JSON olabildiği için gzip'lenir
// (nginx API yanıtlarını sıkıştırmıyor; rrweb JSON'u ~10× küçülür).
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
    // Sekme kapanırken beacon ile gelen parçalar sırasız kaydedilebiliyor; rrweb
    // zaman sırası bekler (sort kararlıdır, aynı ms'deki olayların sırası korunur).
    allEvents.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));

    // Also fetch session metadata
    const [meta] = await query<any>(
      `SELECT s.*, TIMESTAMPDIFF(SECOND, s.first_seen, s.last_seen) AS session_seconds
       FROM visitor_sessions s WHERE s.session_id = ? LIMIT 1`,
      [sessionId]
    );

    const pageviews = await query<any>(
      `SELECT path, title, viewed_at, UNIX_TIMESTAMP(viewed_at) * 1000 AS ts, load_time_ms
       FROM visitor_pageviews
       WHERE session_id = ? ORDER BY id ASC`,
      [sessionId]
    );

    const signals = await query<any>(
      `SELECT type, target, path, UNIX_TIMESTAMP(occurred_at) * 1000 AS ts
       FROM visitor_events
       WHERE session_id = ?
         AND type IN ('click','field_focus','field_error','js_error','api_error',
                      'call_click','price_shown','tab_away','price_copy')
       ORDER BY id ASC LIMIT 3000`,
      [sessionId]
    );

    // DATETIME kolonları saat dilimi bilgisi taşımaz; DB/Node saat dilimi farklıysa
    // sinyaller rrweb zamanından tam saat kayık gelir. İlk pageview ile ilk rrweb olayı
    // aynı anda olduğundan farkı en yakın saate yuvarlayıp düzeltiyoruz.
    let shift = 0;
    const firstEv = allEvents[0]?.timestamp;
    const firstPv = pageviews[0] ? Number(pageviews[0].ts) : 0;
    if (firstEv && firstPv) {
      const diff = firstEv - firstPv;
      if (Math.abs(diff) > 30 * 60_000) shift = Math.round(diff / 3_600_000) * 3_600_000;
    }
    for (const p of pageviews) p.ts = Number(p.ts) + shift;
    for (const s of signals) s.ts = Number(s.ts) + shift;

    const [mark] = await query<any>(
      `SELECT starred, watched_at, note FROM session_recording_marks WHERE session_id = ?`,
      [sessionId]
    );

    const payload = JSON.stringify({
      session_id: sessionId,
      meta: meta || null,
      pageviews,
      signals,
      mark: { starred: Number(mark?.starred || 0) === 1, watched: !!mark?.watched_at, note: mark?.note || null },
      events: allEvents,
      event_count: allEvents.length,
      chunk_count: chunks.length,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding');
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && payload.length > 32_000) {
      const gz = await gzipAsync(payload, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      res.end(gz);
    } else {
      res.end(payload);
    }
  } catch (err: any) {
    console.error('recording get error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- GET /api/admin/recordings/:id/live?after=<chunk id> ----------
// Incremental feed for the live viewer. Cursor is the auto-increment id (chunk_index can
// repeat). Without `after` it starts at the newest Meta+FullSnapshot, so watching begins
// "now" instead of downloading the whole session. Does not mark the session as watched.
router.get('/admin/recordings/:id/live', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const sessionId = String(req.params.id).slice(0, 64);
    watchedSessions.set(sessionId, Date.now() + WATCH_TTL_MS);
    const after = Math.max(0, Number(req.query.after) || 0);

    const settings = await getSettings();
    const recorded = settings.enabled && inSample(sessionId, settings.sample_pct);

    let fromId = after + 1;
    if (!after) {
      // rrweb serialises a FullSnapshot as {"type":2,"data":{"node":…}; start one chunk
      // earlier so the Meta event (viewport size) emitted just before it is included.
      const [snap] = await query<{ id: number }>(
        `SELECT id FROM session_recordings
          WHERE session_id = ? AND LOCATE('{"type":2,"data":{"node"', events_json) > 0
          ORDER BY id DESC LIMIT 1`,
        [sessionId]
      );
      if (!snap) {
        res.json({ events: [], last_id: 0, recorded, waiting: true });
        return;
      }
      const [prev] = await query<{ id: number }>(
        `SELECT id FROM session_recordings WHERE session_id = ? AND id < ? ORDER BY id DESC LIMIT 1`,
        [sessionId, snap.id]
      );
      fromId = prev ? prev.id : snap.id;
    }

    const chunks = await query<{ id: number; events_json: string }>(
      `SELECT id, events_json FROM session_recordings WHERE session_id = ? AND id >= ? ORDER BY id ASC LIMIT 200`,
      [sessionId, fromId]
    );
    let events: any[] = [];
    for (const c of chunks) {
      try {
        const ev = JSON.parse(c.events_json);
        if (Array.isArray(ev)) events.push(...ev);
      } catch { /* skip broken chunk */ }
    }
    events.sort((a, b) => (a?.timestamp || 0) - (b?.timestamp || 0));
    if (!after) {
      // Begin exactly at the newest Meta (4) before the newest FullSnapshot (2).
      let full = -1;
      for (let i = events.length - 1; i >= 0; i--) if (events[i]?.type === 2) { full = i; break; }
      let meta = full;
      for (let i = full; i >= 0; i--) if (events[i]?.type === 4) { meta = i; break; }
      if (meta > 0) events = events.slice(meta);
    }
    const lastId = chunks.length ? chunks[chunks.length - 1].id : after;

    // Seconds since the newest chunk (DB clock), and how far the visitor's device clock is
    // ahead of the server (newest chunk: its last event time vs. when it was stored). The
    // live player needs "now" in the visitor's clock to replay with a constant small delay.
    const [age] = await query<{ sec: number | null; skew_ms: number | null }>(
      `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS sec,
              last_event_ts - UNIX_TIMESTAMP(created_at) * 1000 AS skew_ms
         FROM session_recordings WHERE session_id = ? ORDER BY id DESC LIMIT 1`,
      [sessionId]
    );

    const payload = JSON.stringify({
      events, last_id: lastId, recorded,
      last_chunk_age_sec: age?.sec ?? null,
      visitor_skew_ms: age?.skew_ms != null ? Number(age.skew_ms) : 0,
      server_now: Date.now(),
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Accept-Encoding');
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && payload.length > 32_000) {
      res.setHeader('Content-Encoding', 'gzip');
      res.end(await gzipAsync(payload, { level: 6 }));
    } else {
      res.end(payload);
    }
  } catch (err: any) {
    console.error('recording live error:', err.message);
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- DELETE /api/admin/recordings/bulk ----------
// Body: { older_than_days?: number, session_ids?: string[], all?: true }
// older_than_days ⭐'lı kayıtları korur; all=true gerçekten her şeyi siler.
router.delete('/admin/recordings/bulk', authenticateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const { older_than_days, session_ids, all } = req.body || {};

    if (all === true) {
      const r = await run(`DELETE FROM session_recordings`);
      await run(`DELETE FROM session_recording_marks`);
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
        `DELETE FROM session_recordings WHERE created_at < NOW() - INTERVAL ? DAY
           AND session_id NOT IN (SELECT session_id FROM session_recording_marks WHERE starred = 1)`,
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
    await run(`DELETE FROM session_recording_marks WHERE session_id = ?`, [sessionId]);
    res.json({ ok: true, deleted: r.affectedRows });
  } catch (err: any) {
    res.status(500).json({ error: 'failed' });
  }
});

// ---------- Otomatik saklama süresi ----------
// retention_days = 0 iken hiçbir şey yapmaz (varsayılan). Büyük tabloda uzun kilit
// olmasın diye 2000'lik partilerle siler.
async function runRetention(): Promise<void> {
  await ensureTable();
  const s = await getSettings(true);
  if (!s.retention_days || s.retention_days < 1) return;
  const conds = [`created_at < NOW() - INTERVAL ${Math.round(s.retention_days)} DAY`];
  if (s.keep_starred) {
    conds.push(`session_id NOT IN (SELECT session_id FROM session_recording_marks WHERE starred = 1)`);
  }
  if (s.keep_booked) {
    conds.push(`NOT EXISTS (SELECT 1 FROM bookings b
                  WHERE b.session_id = session_recordings.session_id AND b.status <> 'cancelled')`);
  }
  let deleted = 0;
  for (let i = 0; i < 100; i++) {
    const r = await run(`DELETE FROM session_recordings WHERE ${conds.join(' AND ')} LIMIT 2000`);
    deleted += r.affectedRows;
    if (r.affectedRows < 2000) break;
  }
  if (deleted > 0) console.log(`[recording-retention] ${deleted} eski parça silindi (> ${s.retention_days} gün)`);
}

export function startRecordingRetentionJob(): void {
  const tick = () => { runRetention().catch((e) => console.error('[recording-retention]', e.message)); };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, 6 * 60 * 60_000);
}

export default router;
