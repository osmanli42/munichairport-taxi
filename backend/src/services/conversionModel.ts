/**
 * Kaufwahrscheinlichkeit für Live-Besucher ("% kaç sipariş verir").
 *
 * Logistische Regression, jede Nacht neu trainiert auf den letzten Besuchen
 * (visitor_sessions + visitor_pageviews + visitor_events, Label = Web-Buchung derselben
 * Sitzung). Erklärbar: jede Eigenschaft hat ein Gewicht, die Live-Ansicht zeigt die
 * stärksten Gründe (+/−) je Besucher.
 *
 * Kein Datenleck: Bei gebuchten Sitzungen zählen nur Seitenaufrufe/Ereignisse VOR dem
 * Buchungszeitpunkt — sonst lernte das Modell aus Dingen, die erst nach der Buchung
 * passieren. Live-Sitzungen werden mit ihrem bisherigen Verhalten bewertet.
 */
import { query, run } from '../db';

// Platzhaltertexte der Suchfelder bzw. alten Kartenfelder (VisitorTracker → form_focus)
const SEARCH_FIELDS = ['Abholadresse...', 'Zieladresse...', 'Pickup address...', 'Destination...', 'Alış adresi...', 'Varış adresi...'];
const CARD_FIELDS = ['Karteninhaber', '1234 5678 9012 3456', 'MM/YY', 'CVC', 'CVV'];
const sqlList = (xs: string[]) => xs.map(x => `'${x.replace(/'/g, "''")}'`).join(',');

export interface FeatureDef { key: string; label: (raw: RawFeatures) => string }

interface RawFeatures {
  saw_prices: number; opened_form: number; form_fields: number; card_fields: number; search_used: number;
  pageviews: number; minutes: number; clicks: number; max_scroll: number;
  ads: number; organic: number; mobile: number; returning: number; past_customer: number; foreign: number;
  price: number | null; km: number | null; lead_days: number | null; roundtrip: number;
  call_click: number; errors: number; compare: number;
}

// Reihenfolge = Spalten der Designmatrix. Labels erscheinen als Begründung in der Live-Ansicht.
const FEATURES: { key: string; value: (r: RawFeatures) => number; label: (r: RawFeatures) => string }[] = [
  { key: 'saw_prices', value: r => r.saw_prices, label: () => 'Fiyatları gördü' },
  { key: 'opened_form', value: r => r.opened_form, label: () => 'Rezervasyon formunu açtı' },
  { key: 'form_fields', value: r => Math.min(r.form_fields, 6) / 6, label: r => `Formda ${r.form_fields} alan doldurdu` },
  { key: 'card_fields', value: r => r.card_fields, label: () => 'Kart bilgisine başladı' },
  { key: 'search_used', value: r => r.search_used, label: () => 'Adres aradı' },
  { key: 'pageviews', value: r => Math.log1p(r.pageviews), label: r => `${r.pageviews} sayfa gezdi` },
  { key: 'minutes', value: r => Math.log1p(r.minutes), label: r => `${Math.round(r.minutes)} dk sitede` },
  { key: 'clicks', value: r => Math.log1p(r.clicks), label: r => `${r.clicks} tıklama` },
  { key: 'max_scroll', value: r => r.max_scroll / 100, label: r => `Sayfayı %${Math.round(r.max_scroll)} kaydırdı` },
  { key: 'ads', value: r => r.ads, label: () => 'Google Ads\'ten geldi' },
  { key: 'organic', value: r => r.organic, label: () => 'Google aramasından geldi' },
  { key: 'mobile', value: r => r.mobile, label: () => 'Telefondan' },
  { key: 'returning', value: r => r.returning, label: () => 'Daha önce de gelmiş' },
  { key: 'past_customer', value: r => r.past_customer, label: () => 'Eski müşteri' },
  { key: 'foreign', value: r => r.foreign, label: () => 'Yurt dışından' },
  { key: 'price_high', value: r => (r.price != null && r.price >= 120 ? 1 : 0), label: r => `Fiyat yüksek (${Math.round(r.price || 0)} €)` },
  { key: 'price_low', value: r => (r.price != null && r.price <= 60 ? 1 : 0), label: r => `Fiyat düşük (${Math.round(r.price || 0)} €)` },
  { key: 'km_long', value: r => (r.km != null && r.km >= 60 ? 1 : 0), label: r => `Uzun yol (${Math.round(r.km || 0)} km)` },
  { key: 'same_day', value: r => (r.lead_days != null && r.lead_days <= 0 ? 1 : 0), label: () => 'Aynı gün için arıyor' },
  { key: 'next_day', value: r => (r.lead_days === 1 ? 1 : 0), label: () => 'Yarın için arıyor' },
  { key: 'far_date', value: r => (r.lead_days != null && r.lead_days > 14 ? 1 : 0), label: r => `${r.lead_days} gün sonrası için` },
  { key: 'roundtrip', value: r => r.roundtrip, label: () => 'Gidiş-dönüş' },
  { key: 'call_click', value: r => r.call_click, label: () => 'Telefon/WhatsApp\'a tıkladı' },
  { key: 'errors', value: r => (r.errors > 0 ? 1 : 0), label: () => 'Hata yaşadı' },
  { key: 'compare', value: r => (r.compare > 0 ? 1 : 0), label: () => 'Fiyat karşılaştırıyor' },
];

export interface ConversionModel {
  version: 1;
  trained_at: string;
  days: number;
  n: number;
  positives: number;
  base_rate: number;
  auc: number | null;          // auf zeitlich späteren 20 % geprüft
  auc_engaged: number | null;  // dasselbe, nur Besucher die Preise gesehen haben (der schwierige Teil)
  test_n: number;
  features: string[];
  mean: number[];
  std: number[];
  weights: number[];
  bias: number;
  calibration: { bucket: string; n: number; predicted: number; actual: number }[];
  platt: { a: number; c: number };
}

// ---------- Merkmale aus der Datenbank ----------
type Scope = { sinceDays: number } | { ids: string[] };

function featureSql(scope: Scope): { sql: string; params: any[] } {
  const params: any[] = [];
  let sessWhere: string;
  let pvScope: string;
  let evScope: string;
  if ('ids' in scope) {
    const ph = scope.ids.map(() => '?').join(',');
    sessWhere = `s.session_id IN (${ph})`;
    pvScope = `pv.session_id IN (${ph})`;
    evScope = `ve.session_id IN (${ph})`;
    params.push(...scope.ids, ...scope.ids, ...scope.ids);
  } else {
    const d = Math.max(1, Math.min(365, Math.round(scope.sinceDays)));
    sessWhere = `s.first_seen >= NOW() - INTERVAL ${d} DAY AND s.first_seen < NOW() - INTERVAL 1 HOUR`;
    pvScope = `pv.viewed_at >= NOW() - INTERVAL ${d + 1} DAY`;
    evScope = `ve.occurred_at >= NOW() - INTERVAL ${d + 1} DAY`;
  }
  const BK = `(SELECT session_id, MIN(created_at) AS booked_at FROM bookings
               WHERE status <> 'cancelled' AND source = 'web' AND session_id IS NOT NULL AND session_id <> ''
               GROUP BY session_id)`;
  const sql = `
    SELECT s.session_id, s.first_seen, s.last_seen, s.ua_device, s.country, s.referrer, s.gclid, s.utm_medium,
      bk.booked_at,
      TIMESTAMPDIFF(SECOND, s.first_seen, LEAST(s.last_seen, COALESCE(bk.booked_at, s.last_seen))) AS seconds,
      (SELECT COUNT(*) FROM visitor_sessions s2 WHERE s2.visitor_id = s.visitor_id AND s2.first_seen < s.first_seen) AS prev_visits,
      (SELECT COUNT(*) FROM bookings b WHERE b.visitor_id = s.visitor_id AND b.created_at < s.first_seen AND b.status <> 'cancelled') AS past_bookings,
      COALESCE(pv.pv, 0) AS pv, COALESCE(pv.saw, 0) AS saw, COALESCE(pv.form, 0) AS form, pv.trip_path,
      COALESCE(ev.clicks, 0) AS clicks, COALESCE(ev.max_scroll, 0) AS max_scroll, COALESCE(ev.search_used, 0) AS search_used,
      COALESCE(ev.form_fields, 0) AS form_fields, COALESCE(ev.card_fields, 0) AS card_fields,
      COALESCE(ev.call_clicks, 0) AS call_clicks, COALESCE(ev.errors, 0) AS errors, COALESCE(ev.compare, 0) AS compare,
      ev.price_shown
    FROM visitor_sessions s
    LEFT JOIN ${BK} bk ON bk.session_id = s.session_id
    LEFT JOIN (
      SELECT pv.session_id, COUNT(*) AS pv,
        MAX(pv.path LIKE '%/ergebnisse%') AS saw, MAX(pv.path LIKE '%/buchen%') AS form,
        SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN pv.path LIKE '%/buchen?%' OR pv.path LIKE '%/ergebnisse?%' THEN pv.path END
                        ORDER BY pv.id DESC SEPARATOR '\\n'), '\\n', 1) AS trip_path
      FROM visitor_pageviews pv LEFT JOIN ${BK} bk2 ON bk2.session_id = pv.session_id
      WHERE ${pvScope} AND pv.viewed_at < COALESCE(bk2.booked_at, '9999-12-31')
      GROUP BY pv.session_id
    ) pv ON pv.session_id = s.session_id
    LEFT JOIN (
      SELECT ve.session_id,
        SUM(ve.type = 'click') AS clicks,
        MAX(CASE WHEN ve.type = 'scroll' THEN ve.scroll_depth END) AS max_scroll,
        MAX(ve.type = 'form_focus' AND ve.target IN (${sqlList(SEARCH_FIELDS)})) AS search_used,
        COUNT(DISTINCT CASE WHEN (ve.type = 'form_focus' AND ve.target NOT IN (${sqlList(SEARCH_FIELDS)})
                                    AND ve.target NOT IN (${sqlList(CARD_FIELDS)})) OR ve.type = 'field_focus'
                            THEN ve.target END) AS form_fields,
        MAX(ve.type = 'form_focus' AND ve.target IN (${sqlList(CARD_FIELDS)})) AS card_fields,
        SUM(ve.type = 'call_click') AS call_clicks,
        SUM(ve.type IN ('field_error', 'js_error', 'api_error')) AS errors,
        SUM(ve.type IN ('tab_away', 'price_copy')) AS compare,
        SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN ve.type = 'price_shown' THEN ve.target END ORDER BY ve.id DESC SEPARATOR '\\n'), '\\n', 1) AS price_shown
      FROM visitor_events ve LEFT JOIN ${BK} bk3 ON bk3.session_id = ve.session_id
      WHERE ${evScope} AND ve.occurred_at < COALESCE(bk3.booked_at, '9999-12-31')
      GROUP BY ve.session_id
    ) ev ON ev.session_id = s.session_id
    WHERE (s.is_bot = 0 OR s.is_bot IS NULL) AND ${sessWhere}
    ORDER BY s.first_seen ASC`;
  // Platzhalter im SQL: pv-Scope, ev-Scope, Sitzungs-Scope — jeweils dieselbe ID-Liste
  return { sql, params };
}

function toRaw(row: any): RawFeatures {
  const tripParams = (() => {
    const p = String(row.trip_path || '');
    const i = p.indexOf('?');
    return i >= 0 ? new URLSearchParams(p.slice(i + 1)) : new URLSearchParams();
  })();
  const shown = String(row.price_shown || '').split('|');
  const pricePath = Number(tripParams.get('price'));
  const priceShown = Number(shown[0]);
  const price = priceShown > 0 ? priceShown : pricePath > 0 ? pricePath : null;
  const kmPath = Number(tripParams.get('distance_km'));
  const kmShown = Number(shown[1]);
  const km = kmPath > 0 ? kmPath : kmShown > 0 ? kmShown : null;
  let lead: number | null = null;
  const date = tripParams.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && row.first_seen) {
    const first = new Date(row.first_seen);
    const sess = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
    const trip = Date.parse(`${date}T00:00:00Z`);
    lead = Math.round((trip - sess) / 86400000);
  }
  const ref = String(row.referrer || '').toLowerCase();
  const ads = row.gclid || ['cpc', 'ppc', 'paid'].includes(String(row.utm_medium || '').toLowerCase()) ? 1 : 0;
  const country = String(row.country || '').toUpperCase();
  return {
    saw_prices: Number(row.saw) > 0 ? 1 : 0,
    opened_form: Number(row.form) > 0 ? 1 : 0,
    form_fields: Number(row.form_fields) || 0,
    card_fields: Number(row.card_fields) > 0 ? 1 : 0,
    search_used: Number(row.search_used) > 0 ? 1 : 0,
    pageviews: Number(row.pv) || 0,
    minutes: Math.max(0, Number(row.seconds) || 0) / 60,
    clicks: Number(row.clicks) || 0,
    max_scroll: Math.min(100, Number(row.max_scroll) || 0),
    ads,
    organic: !ads && /google\.|bing\.|duckduckgo|ecosia|yahoo\./.test(ref) ? 1 : 0,
    mobile: row.ua_device === 'mobile' ? 1 : 0,
    returning: Number(row.prev_visits) > 0 ? 1 : 0,
    past_customer: Number(row.past_bookings) > 0 ? 1 : 0,
    foreign: country && country !== 'DE' ? 1 : 0,
    price, km, lead_days: lead,
    roundtrip: tripParams.get('trip_type') === 'roundtrip' ? 1 : 0,
    call_click: Number(row.call_clicks) > 0 ? 1 : 0,
    errors: Number(row.errors) || 0,
    compare: Number(row.compare) || 0,
  };
}

// ---------- Training ----------
const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

// sw = Gewicht je Zeile (jüngere Besuche zählen mehr — die Seite ändert sich, alte Muster veralten)
function fit(X: number[][], y: number[], sw?: number[], l2 = 0.002, iters = 900, lr = 0.05) {
  const n = X.length, d = X[0].length;
  const wt = sw || Array(n).fill(1);
  const W = wt.reduce((a, b) => a + b, 0);
  const mean = Array(d).fill(0), std = Array(d).fill(0);
  for (const x of X) x.forEach((v, j) => { mean[j] += v / n; });
  for (const x of X) x.forEach((v, j) => { std[j] += (v - mean[j]) ** 2 / n; });
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  const Z = X.map(x => x.map((v, j) => (v - mean[j]) / std[j]));
  const w = Array(d).fill(0);
  const base = y.reduce((a, v, i) => a + v * wt[i], 0) / W;
  let b = Math.log((base + 1e-6) / (1 - base + 1e-6));
  // Adam — konvergiert bei unausgewogenen Klassen (≈ 2–3 % Buchungen) zuverlässiger als reines GD
  const mW = Array(d).fill(0), vW = Array(d).fill(0);
  let mB = 0, vB = 0;
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let t = 1; t <= iters; t++) {
    const gW = Array(d).fill(0);
    let gB = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const err = (sigmoid(z) - y[i]) * wt[i];
      gB += err / W;
      for (let j = 0; j < d; j++) gW[j] += (err * Z[i][j]) / W;
    }
    for (let j = 0; j < d; j++) {
      gW[j] += l2 * w[j];
      mW[j] = b1 * mW[j] + (1 - b1) * gW[j];
      vW[j] = b2 * vW[j] + (1 - b2) * gW[j] ** 2;
      w[j] -= (lr * (mW[j] / (1 - b1 ** t))) / (Math.sqrt(vW[j] / (1 - b2 ** t)) + eps);
    }
    mB = b1 * mB + (1 - b1) * gB;
    vB = b2 * vB + (1 - b2) * gB ** 2;
    b -= (lr * (mB / (1 - b1 ** t))) / (Math.sqrt(vB / (1 - b2 ** t)) + eps);
  }
  return { mean, std, w, b };
}

function logitRow(x: number[], m: { mean: number[]; std: number[]; w: number[]; b: number }) {
  let z = m.b;
  for (let j = 0; j < x.length; j++) z += m.w[j] * ((x[j] - m.mean[j]) / m.std[j]);
  return z;
}

// Platt-Skalierung: p = sigmoid(a·z + c). Gleicht aus, dass das Modell bei Drift (die Seite
// konvertiert heute besser als vor Monaten) systematisch zu vorsichtig schätzt.
function fitPlatt(z: number[], y: number[]): { a: number; c: number } {
  let a = 1, c = 0;
  for (let it = 0; it < 3000; it++) {
    let ga = 0, gc = 0;
    for (let i = 0; i < z.length; i++) {
      const e = sigmoid(a * z[i] + c) - y[i];
      ga += e * z[i]; gc += e;
    }
    a -= (0.05 * ga) / z.length;
    c -= (0.05 * gc) / z.length;
  }
  return { a, c };
}

function auc(scores: number[], y: number[]): number | null {
  const pos = y.filter(v => v === 1).length, neg = y.length - pos;
  if (!pos || !neg) return null;
  const idx = scores.map((s, i) => [s, y[i]] as [number, number]).sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  idx.forEach(([, label], r) => { if (label === 1) rankSum += r + 1; });
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await run(`CREATE TABLE IF NOT EXISTS conversion_models (
    id INT NOT NULL AUTO_INCREMENT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload LONGTEXT NOT NULL,
    PRIMARY KEY (id)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  tableReady = true;
}

export async function trainConversionModel(days = 120): Promise<ConversionModel> {
  await ensureTable();
  const { sql, params } = featureSql({ sinceDays: days });
  const rows = await query<any>(sql, params);
  if (rows.length < 200) throw new Error(`zu wenige Sitzungen (${rows.length})`);
  const raw = rows.map(toRaw);
  const X = raw.map(r => FEATURES.map(f => f.value(r)));
  const y: number[] = rows.map(r => (r.booked_at ? 1 : 0));

  // Jüngere Besuche stärker gewichten (Halbwertszeit 45 Tage)
  const HALF_LIFE_DAYS = 45;
  const ageWeight = (ref: number) => rows.map(r => Math.pow(0.5, Math.max(0, (ref - Date.parse(r.first_seen)) / 86400000) / HALF_LIFE_DAYS));

  // Gütemessung: auf den ersten 80 % (zeitlich) trainieren, auf den letzten 20 % prüfen
  const cut = Math.floor(rows.length * 0.8);
  const holdout = fit(X.slice(0, cut), y.slice(0, cut), ageWeight(Date.parse(rows[cut - 1].first_seen)).slice(0, cut));
  const testLogits = X.slice(cut).map(x => logitRow(x, holdout));
  const testY = y.slice(cut);
  // Kalibrierung auf der ersten Hälfte des Testzeitraums lernen, auf der zweiten Hälfte messen
  const half = Math.floor(testLogits.length / 2);
  const plattEval = fitPlatt(testLogits.slice(0, half), testY.slice(0, half));
  const testScores = testLogits.map(z => sigmoid(plattEval.a * z + plattEval.c));
  const aucVal = auc(testScores, testY);
  const engagedIdx = raw.slice(cut).map((r, i) => (r.saw_prices ? i : -1)).filter(i => i >= 0);
  const aucEngaged = auc(engagedIdx.map(i => testScores[i]), engagedIdx.map(i => testY[i]));
  const buckets = [[0, 0.02], [0.02, 0.05], [0.05, 0.15], [0.15, 0.35], [0.35, 1.01]];
  const calibration = buckets.map(([lo, hi]) => {
    const idx = testScores.map((s, i) => (i >= half && s >= lo && s < hi ? i : -1)).filter(i => i >= 0);
    return {
      bucket: `${Math.round(lo * 100)}–${Math.min(100, Math.round(hi * 100))} %`,
      n: idx.length,
      predicted: idx.length ? idx.reduce((a, i) => a + testScores[i], 0) / idx.length : 0,
      actual: idx.length ? idx.reduce((a, i) => a + testY[i], 0) / idx.length : 0,
    };
  });

  // Endgültiges Modell auf allen Daten
  const final = fit(X, y, ageWeight(Date.now()));
  // Kalibrierung für das Endmodell: auf dem ganzen (jüngsten) Testzeitraum
  const platt = fitPlatt(X.slice(cut).map(x => logitRow(x, final)), testY);
  const positives = y.reduce((a, b) => a + b, 0);
  const model: ConversionModel = {
    version: 1,
    trained_at: new Date().toISOString(),
    days,
    n: rows.length,
    positives,
    base_rate: positives / rows.length,
    auc: aucVal,
    auc_engaged: aucEngaged,
    test_n: testY.length,
    features: FEATURES.map(f => f.key),
    mean: final.mean, std: final.std, weights: final.w, bias: final.b,
    calibration,
    platt,
  };
  await run(`INSERT INTO conversion_models (payload) VALUES (?)`, [JSON.stringify(model)]);
  await run(`DELETE FROM conversion_models WHERE id NOT IN (SELECT id FROM (SELECT id FROM conversion_models ORDER BY id DESC LIMIT 10) t)`);
  cached = { at: Date.now(), model };
  return model;
}

let cached: { at: number; model: ConversionModel | null } | null = null;
export async function getConversionModel(): Promise<ConversionModel | null> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.model;
  await ensureTable();
  const [row] = await query<{ payload: string }>(`SELECT payload FROM conversion_models ORDER BY id DESC LIMIT 1`);
  let model: ConversionModel | null = null;
  try { model = row ? JSON.parse(row.payload) : null; } catch { model = null; }
  // Feature-Liste geändert (neue Code-Version) → altes Modell nicht verwenden
  if (model && model.features.join() !== FEATURES.map(f => f.key).join()) model = null;
  cached = { at: Date.now(), model };
  return model;
}

export interface LivePrediction {
  p: number;                       // 0..1
  factors: { label: string; impact: number }[];   // impact in Logit-Einheiten, + erhöht
  price: number | null;            // zuletzt gesehener Fahrpreis (für „erwarteter Umsatz“)
}

export async function scoreLiveSessions(ids: string[]): Promise<Map<string, LivePrediction>> {
  const out = new Map<string, LivePrediction>();
  if (!ids.length) return out;
  const model = await getConversionModel();
  if (!model) return out;
  const { sql, params } = featureSql({ ids });
  const rows = await query<any>(sql, params);
  for (const row of rows) {
    const raw = toRaw(row);
    const x = FEATURES.map(f => f.value(raw));
    const z = logitRow(x, { mean: model.mean, std: model.std, w: model.weights, b: model.bias });
    const p = model.platt ? sigmoid(model.platt.a * z + model.platt.c) : sigmoid(z);
    const contribs = FEATURES.map((f, j) => ({
      label: f.label(raw),
      impact: model.weights[j] * ((x[j] - model.mean[j]) / model.std[j]),
      active: x[j] !== 0,
    }));
    // Nur Eigenschaften, die der Besucher tatsächlich zeigt, und nur spürbare Effekte
    const factors = contribs
      .filter(c => c.active && Math.abs(c.impact) >= 0.15)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 4)
      .map(({ label, impact }) => ({ label, impact: Math.round(impact * 100) / 100 }));
    out.set(row.session_id, { p, factors, price: raw.price });
  }
  return out;
}

/** Gewichte für die Modell-Info im Admin (sortiert nach Einfluss). */
export function modelSummary(m: ConversionModel) {
  return {
    trained_at: m.trained_at, days: m.days, n: m.n, positives: m.positives,
    base_rate: m.base_rate, auc: m.auc, auc_engaged: m.auc_engaged ?? null, test_n: m.test_n, calibration: m.calibration,
    weights: m.features
      .map((k, j) => ({ key: k, weight: Math.round(m.weights[j] * 100) / 100 }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
  };
}

// Nachts (Berlin 02–05 Uhr) neu trainieren — das Training belegt den Server einige Sekunden.
// Nur wenn noch gar kein Modell existiert, wird sofort (3 Min. nach dem Start) trainiert.
export function startConversionModelJob(): void {
  const berlinHour = () => Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }).format(new Date()));
  const tick = async () => {
    try {
      const m = await getConversionModel();
      const ageH = m ? (Date.now() - Date.parse(m.trained_at)) / 3600000 : Infinity;
      const night = berlinHour() >= 2 && berlinHour() < 5;
      if (m && (ageH < 20 || !night)) return;
      const fresh = await trainConversionModel();
      console.log(`[conversion-model] trained: n=${fresh.n}, bookings=${fresh.positives}, AUC=${fresh.auc?.toFixed(3)}`);
    } catch (e: any) {
      console.error('[conversion-model]', e.message);
    }
  };
  setTimeout(tick, 3 * 60_000);
  setInterval(tick, 60 * 60_000);
}
