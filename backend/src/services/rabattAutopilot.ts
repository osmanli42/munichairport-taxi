// Smart Rabatt (Rabatte-Tab, intern weiter „Autopilot“): entscheidet pro Besucher und Strecke, ob
// und wie viel Rabatt (0/3/5/7 %) er sieht — Rabatt nur, wo er etwas bewirkt.
//
// Ablauf:
//   1. Kontrollgruppe (holdout %, fester Bucket je Besucher) bekommt nie Rabatt — so lässt sich
//      die echte Wirkung messen (Buchungsquote Angebot vs. Kontrolle).
//   2. Bedarfswert 0..1 aus Kalender (ruhiger Tag, freie Stunde), Verhalten des Kunden (siehe
//      needScore) und Wert (lange Fahrt). Alles aus Serverdaten, nicht aus Client-Angaben.
//   3. Ab der Schwelle (Admin-Schieberegler): Stufe per Thompson-Sampling. Die Höchststufe hängt
//      davon ab, wie weit der Wert über der Schwelle liegt.
//   4. Die Entscheidung gilt je Besucher + Strecke + Fahrtdatum 24 h (autopilot_offers). Jede neue
//      Preisabfrage bewertet neu: der Rabatt kann steigen, sinkt aber nie — Karten, /buchen und
//      die Buchung selbst sehen denselben Rabatt.
//
// Regel-Grenzen (Mindest-km, Stammkunde, Firma, max. %) stehen in der Regelzeile
// auto_discounts (dynamic_mode = 'autopilot'), die übrigen Einstellungen in settings.

import { query, run } from '../db';
import { bucket } from '../utils/experiments';
import { berlinDateSql } from '../utils/berlinTime';
import { demandSettings, getDayPace, ridesNear } from './demandPace';
import { scoreLiveSessions } from './conversionModel';

export const AUTOPILOT_LEVELS = [3, 5, 7] as const;

export interface AutopilotContext {
  visitorId: string | null;
  sessionId: string | null;
  pickup: string | null;     // Adresse oder Koordinate — nur zum Wiedererkennen der Strecke
  dropoff: string | null;
  tripDate: string | null;   // 'YYYY-MM-DD' (Berlin)
  tripMinutes: number | null;
  km: number;
  maxPercent: number;        // aus der Regel (discount_value)
}

export interface AutopilotOffer { percent: number; holdout: boolean; offerId: number | null }

interface Settings { holdoutPct: number; weeklyBudget: number | null; minScore: number; signalQuietDay: boolean; signalGap: boolean; signalBehavior: boolean; signalEarly: boolean; earlyDays: number; signalUsualQuiet: boolean; source: string; direction: string }

let settingsCache: { at: number; s: Settings } | null = null;
async function settings(): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.s;
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('autopilot_holdout_pct', 'autopilot_weekly_budget', 'autopilot_min_score', 'smart_signal_quiet_day', 'smart_signal_gap', 'smart_signal_behavior', 'smart_signal_early', 'smart_early_days', 'smart_signal_usual_quiet', 'smart_source', 'smart_direction')`);
  const v = (k: string) => rows.find(r => r.setting_key === k)?.setting_value;
  const num = (x: string | undefined, d: number) => (x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : d);
  const budget = v('autopilot_weekly_budget');
  const s: Settings = {
    holdoutPct: Math.min(50, Math.max(0, num(v('autopilot_holdout_pct'), 15))),
    weeklyBudget: budget === '' || budget === '0' ? null : num(budget, 150),
    minScore: Math.min(0.9, Math.max(0, num(v('autopilot_min_score'), 0.45))),
    signalQuietDay: v('smart_signal_quiet_day') !== '0',
    signalGap: v('smart_signal_gap') !== '0',
    signalBehavior: v('smart_signal_behavior') !== '0',
    signalEarly: v('smart_signal_early') !== '0',
    earlyDays: Math.min(365, Math.max(7, num(v('smart_early_days'), 30))),
    signalUsualQuiet: v('smart_signal_usual_quiet') !== '0',
    source: v('smart_source') || 'all',
    direction: v('smart_direction') || 'all',
  };
  settingsCache = { at: Date.now(), s };
  return s;
}
export function invalidateAutopilotSettings(): void { settingsCache = null; }

/** Strecke wiedererkennen: Adresse normalisiert (Karten, /buchen und Buchung senden dieselbe). */
export function routeKey(ctx: Pick<AutopilotContext, 'pickup' | 'dropoff' | 'tripDate'>): string {
  const norm = (s: string | null) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '').slice(0, 80);
  return `${norm(ctx.pickup)}|${norm(ctx.dropoff)}|${ctx.tripDate || ''}`.slice(0, 200);
}

// ---- Thompson-Sampling (Beta-Verteilung über Gamma, Marsaglia–Tsang) -----------------------
function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gamma(k: number): number {
  if (k < 1) return gamma(k + 1) * Math.pow(Math.random(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gauss(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
export function sampleBeta(a: number, b: number): number { const x = gamma(a); return x / (x + gamma(b)); }

/** Erfolge je Stufe der letzten 60 Tage (Angebot gezeigt → Buchung). */
export async function levelStats(): Promise<Record<number, { shown: number; booked: number }>> {
  const rows = await query<{ percent: number; shown: number; booked: number }>(
    `SELECT percent, COUNT(*) AS shown, SUM(booking_id IS NOT NULL) AS booked FROM autopilot_offers
      WHERE holdout = 0 AND percent > 0 AND created_at > NOW() - INTERVAL 60 DAY GROUP BY percent`);
  const out: Record<number, { shown: number; booked: number }> = {};
  for (const r of rows) out[Number(r.percent)] = { shown: Number(r.shown) || 0, booked: Number(r.booked) || 0 };
  return out;
}

export function pickLevel(stats: Record<number, { shown: number; booked: number }>, maxPercent: number): number {
  const levels = AUTOPILOT_LEVELS.filter(l => l <= maxPercent);
  if (!levels.length) return Math.max(0, Math.floor(maxPercent));
  let best = levels[0], bestDraw = -1;
  for (const l of levels) {
    const s = stats[l] || { shown: 0, booked: 0 };
    // Startwert ~10 % Buchungsquote (1 : 9), damit wenige Daten nicht sofort entscheiden.
    // Ziel ist der Gewinn, nicht die Buchungszahl: von rund 40 % Netto je Fahrt geht der Rabatt ab
    // (%7 lohnt sich nur, wenn er spürbar mehr Buchungen bringt als %3).
    const draw = sampleBeta(1 + s.booked, 9 + Math.max(0, s.shown - s.booked)) * (1 - l / 40);
    if (draw > bestDraw) { bestDraw = draw; best = l; }
  }
  return best;
}

/** Rabatt-€ des Autopiloten in der laufenden Woche (Mo–So, Berlin). */
async function weekSpent(ruleId: number): Promise<number> {
  const today = berlinDateSql(0);
  const wd = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Mo
  const monday = new Date(Date.parse(`${today}T12:00:00Z`) - wd * 86_400_000).toISOString().slice(0, 10);
  const [r] = await query<{ s: number }>(
    `SELECT COALESCE(SUM(auto_discount_amount), 0) AS s FROM bookings
      WHERE auto_discount_id = ? AND status <> 'cancelled' AND created_at >= ?`, [ruleId, `${monday} 00:00:00`]);
  return Number(r?.s) || 0;
}

const clamp = (x: number, max = 1) => Math.max(0, Math.min(max, x));

// Stufen-Obergrenze: je weiter über der Schwelle, desto höher darf der Rabatt sein.
export function levelCap(margin: number): number { return margin < 0.1 ? 3 : margin < 0.25 ? 5 : 7; }

// Signale und ihr Gewicht. Gemessen am 03.11.2026 (30 Tage, 1.848 Sitzungen mit Preisansicht):
// - Formfehler sagen nichts über den Preis aus und zählen deshalb nicht.
// - Zurück vom Formular zum Preis: 43 % buchen trotzdem, daher schwächer als ein Abbruch.
// - Etwa die Hälfte der Abbrecher geht vor 45 s; die erreicht nur das Kalendersignal beim ersten Preis.
const BEHAVIOR_WEIGHTS: Record<string, number> = {
  draft: 0.25, back_from_form: 0.15, exit: 0.2, returning: 0.15, search_changes: 0.15, dwell: 0.15, tab_away: 0.1,
};
export const DWELL_SECONDS = 45;
const GAP_MAX_DAYS = 3;
const EARLY_WEIGHT = 0.25;
const USUAL_QUIET_WEIGHT = 0.25;
const USUAL_WEEKS = 8;

/**
 * Ist diese Stunde an diesem Wochentag üblicherweise leer? Blick auf dieselbe Uhrzeit (±2 h) an
 * den letzten 8 gleichen Wochentagen (Buchungen + Kalender). Für Fahrten weit voraus, deren Tag
 * im echten Plan noch leer ist. Saisonalität (Sommer, Messe) kennt dieser Blick nicht.
 */
async function usuallyQuiet(tripDate: string, minute: number): Promise<boolean> {
  const today = berlinDateSql(0);
  const dayMs = 86_400_000;
  const tripDow = new Date(`${tripDate}T12:00:00Z`).getUTCDay();
  let d = Date.parse(`${today}T12:00:00Z`) - dayMs;
  while (new Date(d).getUTCDay() !== tripDow) d -= dayMs;
  const counts: number[] = [];
  for (let k = 0; k < USUAL_WEEKS; k++) {
    const date = new Date(d - k * 7 * dayMs).toISOString().slice(0, 10);
    counts.push(await ridesNear(date, minute, 120));
  }
  counts.sort((a, b) => a - b);
  // Mehrheit der Wochen ohne Fahrt in diesem Fenster
  return counts[Math.floor(USUAL_WEEKS / 2)] === 0;
}
const GAP_FROM_MIN = 10 * 60;
const GAP_TO_MIN = 22 * 60;
// Zeilen mit anderer Bewertung sind nicht vergleichbar: neue Fassung = neue Nummer, Auswertung beginnt neu
export const SMART_ENGINE = 3;

export interface NeedResult { score: number; signals: string[]; reasons: string[]; block: boolean }

/**
 * Bedarfswert 0..1. offerAgeSec = Alter der bestehenden Entscheidung für diese Strecke
 * (null = erste Abfrage) — so lässt sich „lange ohne Auswahl“ am Server messen.
 */
export async function needScore(ctx: AutopilotContext, s: Settings, offerAgeSec: number | null): Promise<NeedResult> {
  const signals: string[] = [];
  const reasons: string[] = [];

  // Kalender (höchstens 0,40)
  let demand = 0;
  if (ctx.tripDate) {
    const { horizonDays } = await demandSettings();
    if (s.signalQuietDay && ctx.tripDate >= berlinDateSql(0) && ctx.tripDate <= berlinDateSql(horizonDays)) {
      const pace = await getDayPace(ctx.tripDate).then(p => p.pace).catch(() => null);
      if (pace != null && pace < 0.5) { demand = 0.4; signals.push('quiet_day'); reasons.push('ruhiger Tag'); }
      else if (pace != null && pace < 0.75) { demand = 0.24; signals.push('quiet_day'); reasons.push('eher ruhiger Tag'); }
    }
    // Freie Stunde zählt nur nah am Fahrtdatum und tagsüber (Entscheidung 16.10.2026): weit voraus
    // und nachts ist der Kalender immer leer — dort sagt das nichts über die Auslastung.
    if (s.signalGap && ctx.tripMinutes != null && ctx.tripMinutes >= GAP_FROM_MIN && ctx.tripMinutes <= GAP_TO_MIN && ctx.tripDate <= berlinDateSql(GAP_MAX_DAYS)) {
      const near = await ridesNear(ctx.tripDate, ctx.tripMinutes, 120).catch(() => 99);
      if (near === 0) { demand = 0.4; signals.push('gap'); reasons.push('freie Stunde'); }
    }
    // Weit voraus (wie bei Flugtickets): früh Buchende füllen den Kalender planbar. Für Tage, an
    // denen der echte Plan noch leer ist, zählt stattdessen, wie voll dieselbe Stunde sonst ist.
    const lead = Math.round((Date.parse(`${ctx.tripDate}T12:00:00Z`) - Date.parse(`${berlinDateSql(0)}T12:00:00Z`)) / 86_400_000);
    let far = 0;
    if (s.signalEarly && lead >= s.earlyDays) { far += EARLY_WEIGHT; signals.push('early'); reasons.push(`${lead} Tage im Voraus`); }
    if (s.signalUsualQuiet && lead > GAP_MAX_DAYS && ctx.tripMinutes != null && ctx.tripMinutes >= GAP_FROM_MIN && ctx.tripMinutes <= GAP_TO_MIN
        && await usuallyQuiet(ctx.tripDate, ctx.tripMinutes).catch(() => false)) {
      far += USUAL_QUIET_WEIGHT; signals.push('usual_quiet'); reasons.push('Stunde sonst ruhig');
    }
    demand = Math.min(0.4, Math.max(demand, far));
  }

  // Verhalten (höchstens 0,45)
  let behavior = 0;
  let block = false;
  if (s.signalBehavior) {
    const hit: string[] = [];
    if (ctx.visitorId) {
      const [v] = await query<{ n: number }>('SELECT COUNT(*) AS n FROM visitor_sessions WHERE visitor_id = ?', [ctx.visitorId]).catch(() => [{ n: 0 }]);
      if (Number(v?.n) >= 2) hit.push('returning');
      // Nur eine frühere Sitzung zählt: das Formular dieser Sitzung legt selbst einen Entwurf an
      const drafts = await query<{ pickup: string; dropoff: string }>(
        `SELECT pickup, dropoff FROM booking_drafts WHERE visitor_id = ? AND session_id <> ? AND updated_at > NOW() - INTERVAL 14 DAY`,
        [ctx.visitorId, ctx.sessionId || '']).catch(() => []);
      const same = routeKey(ctx);
      if (drafts.some(d => routeKey({ pickup: d.pickup, dropoff: d.dropoff, tripDate: ctx.tripDate }) === same)) hit.push('draft');
    }
    if (ctx.sessionId) {
      const views = await query<{ path: string }>(
        `SELECT path FROM visitor_pageviews WHERE session_id = ? ORDER BY id ASC`, [ctx.sessionId]).catch(() => []);
      let inForm = false;
      const searches = new Set<string>();
      for (const v of views) {
        if (/\/buchen(\?|$)/.test(v.path)) inForm = true;
        else if (/\/ergebnisse(\?|$)/.test(v.path)) {
          if (inForm && !hit.includes('back_from_form')) hit.push('back_from_form');
          searches.add(v.path);
        }
      }
      if (searches.size >= 3) hit.push('search_changes');
      const events = await query<{ type: string }>(
        `SELECT DISTINCT type FROM visitor_events WHERE session_id = ? AND type IN ('tab_away', 'exit_intent', 'call_click')`, [ctx.sessionId]).catch(() => []);
      const has = (t: string) => events.some(e => e.type === t);
      if (has('tab_away')) hit.push('tab_away');
      if (has('exit_intent')) hit.push('exit');
      // Telefon/WhatsApp geklickt: der Kunde ist schon im Gespräch (Buchungsquote dort 33 %)
      if (has('call_click')) block = true;
    }
    if (offerAgeSec != null && offerAgeSec >= DWELL_SECONDS) hit.push('dwell');
    for (const k of hit) { behavior += BEHAVIOR_WEIGHTS[k] || 0; signals.push(k); }
    behavior = clamp(behavior, 0.45);
  }

  // Wert (höchstens 0,15)
  const value = ctx.km >= 60 ? 0.15 : ctx.km >= 40 ? 0.09 : 0.05;
  if (ctx.km >= 40) reasons.push(`${Math.round(ctx.km)} km`);

  if (block) reasons.push('Telefon/WhatsApp');
  const score = demand + behavior + value;
  return { score: Math.round(score * 1000) / 1000, signals, reasons, block };
}

const isAirportAddress = (a: string | null) => /flughafen|airport|terminal|\bMUC\b/i.test(a || '');

/**
 * Besucherkreis, soweit er nicht in der Regelzeile steht (Zone, Kundentyp, Fahrzeug … prüft autoDiscount.ts):
 * Fahrtrichtung zum/vom Flughafen und Herkunft (Google Ads oder nicht).
 */
export async function audienceAllows(ctx: Pick<AutopilotContext, 'sessionId' | 'pickup' | 'dropoff'>): Promise<boolean> {
  const s = await settings();
  if (s.direction === 'from_airport' && !isAirportAddress(ctx.pickup)) return false;
  if (s.direction === 'to_airport' && !isAirportAddress(ctx.dropoff)) return false;
  if (s.source === 'ads' || s.source === 'other') {
    const [row] = ctx.sessionId
      ? await query<{ ads: number }>(`SELECT (gclid IS NOT NULL OR ads_keyword IS NOT NULL) AS ads FROM visitor_sessions WHERE session_id = ?`, [ctx.sessionId])
      : [];
    const fromAds = Number(row?.ads) === 1;
    if (s.source === 'ads' ? !fromAds : fromAds) return false;
  }
  return true;
}

/** Modell-Wahrscheinlichkeit nur mitschreiben (für späteres Neutrainieren), nicht mehr Teil des Werts. */
async function modelP(sessionId: string | null): Promise<number | null> {
  if (!sessionId) return null;
  try {
    const m = await Promise.race([
      scoreLiveSessions([sessionId]),
      new Promise<null>((r) => setTimeout(() => r(null), 1500)),
    ]);
    return m?.get(sessionId)?.p ?? null;
  } catch { return null; }
}

// Gleichzeitige Preisabfragen (3 Fahrzeugkarten) teilen sich eine Entscheidung
const pending = new Map<string, Promise<AutopilotOffer>>();

interface OfferRow { id: number; percent: number; holdout: number; score: number | null; level_cap: number; signals: string | null; blocked: string | null; age: number }

/** Angebot für Besucher + Strecke (gilt 24 h, Rabatt steigt höchstens). ruleId = Autopilot-Regel (Budget). */
export async function autopilotOffer(ctx: AutopilotContext, ruleId: number): Promise<AutopilotOffer> {
  if (!ctx.visitorId) return { percent: 0, holdout: false, offerId: null };
  const key = routeKey(ctx);
  const lockKey = `${ctx.visitorId}|${key}`;
  const running = pending.get(lockKey);
  if (running) return running;
  const job = (async (): Promise<AutopilotOffer> => {
    // Bots (Scanner) bekommen keinen Rabatt und verfälschen die Auswertung nicht
    if (ctx.sessionId) {
      const [sess] = await query<{ is_bot: number }>('SELECT is_bot FROM visitor_sessions WHERE session_id = ?', [ctx.sessionId]).catch(() => []);
      if (Number(sess?.is_bot) === 1) return { percent: 0, holdout: false, offerId: null };
    }
    const s = await settings();
    const [row] = await query<OfferRow>(
      `SELECT id, percent, holdout, score, level_cap, signals, blocked, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age
         FROM autopilot_offers WHERE visitor_id = ? AND route_key = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1`, [ctx.visitorId, key]);
    const holdout = row ? Number(row.holdout) === 1 : bucket(ctx.visitorId!, 'rabatt_autopilot') < s.holdoutPct;
    const need = await needScore(ctx, s, row ? Number(row.age) : null);
    const had = row ? Number(row.percent) : 0;
    const hadCap = row ? Number(row.level_cap) || 0 : 0;

    let percent = had;
    let cap = hadCap;
    const reasons = [...need.reasons];
    if (!need.block && need.score >= s.minScore) {
      cap = Math.max(hadCap, Math.min(levelCap(need.score - s.minScore), ctx.maxPercent));
      // Nur neu auslosen, wenn eine höhere Stufe erreichbar wurde — sonst stiege der Rabatt mit jedem Neuladen
      if (!holdout && cap > hadCap) {
        if (s.weeklyBudget != null && await weekSpent(ruleId) >= s.weeklyBudget) { reasons.push('Wochenbudget erreicht'); cap = hadCap; }
        else percent = Math.max(had, pickLevel(await levelStats(), cap));
      }
    }
    if (holdout) reasons.unshift('Kontrollgruppe');

    if (!row) {
      const r = await run(
        `INSERT INTO autopilot_offers (visitor_id, session_id, route_key, trip_date, km, percent, holdout, score, p_model, reasons, signals, level_cap, engine, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL 24 HOUR)`,
        [ctx.visitorId, ctx.sessionId, key, ctx.tripDate, ctx.km, percent, holdout ? 1 : 0, need.score, await modelP(ctx.sessionId),
          reasons.join(', ').slice(0, 255), need.signals.join(',').slice(0, 255), cap, SMART_ENGINE]);
      return { percent, holdout, offerId: r.insertId };
    }
    // Bestehende Entscheidung nur aktualisieren, wenn sich etwas geändert hat. Signale werden
    // gesammelt: eines, das einmal da war, bleibt für die Auswertung sichtbar.
    const merged = [...new Set([...String(row.signals || '').split(',').filter(Boolean), ...need.signals])].join(',');
    const bestScore = Math.max(Number(row.score) || 0, need.score);
    if (percent !== had || cap !== hadCap || merged !== (row.signals || '') || bestScore !== Number(row.score) || row.blocked) {
      await run(
        `UPDATE autopilot_offers SET percent = ?, score = ?, reasons = ?, signals = ?, level_cap = ?, engine = ?, blocked = NULL WHERE id = ?`,
        [percent, bestScore, reasons.join(', ').slice(0, 255), merged.slice(0, 255), cap, SMART_ENGINE, row.id]);
    }
    return { percent, holdout, offerId: row.id };
  })();
  pending.set(lockKey, job);
  try { return await job; } finally { pending.delete(lockKey); }
}

/** Alle Fahrzeuge belegt: für Live/Replay festhalten, warum kein Rabatt kam. Bestehender Rabatt bleibt im Datensatz. */
export async function noteCapacityBlock(ctx: Pick<AutopilotContext, 'visitorId' | 'sessionId' | 'pickup' | 'dropoff' | 'tripDate' | 'km'>): Promise<void> {
  if (!ctx.visitorId) return;
  const key = routeKey(ctx);
  const r = await run(
    `UPDATE autopilot_offers SET blocked = 'capacity' WHERE visitor_id = ? AND route_key = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1`, [ctx.visitorId, key]);
  if (r.affectedRows > 0) return;
  const s = await settings();
  await run(
    `INSERT INTO autopilot_offers (visitor_id, session_id, route_key, trip_date, km, percent, holdout, blocked, engine, expires_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 'capacity', ?, NOW() + INTERVAL 24 HOUR)`,
    [ctx.visitorId, ctx.sessionId, key, ctx.tripDate, ctx.km, bucket(ctx.visitorId, 'rabatt_autopilot') < s.holdoutPct ? 1 : 0, SMART_ENGINE]);
}

export interface SmartDecision { percent: number; holdout: boolean; blocked: string | null; signals: string[]; score: number | null }

/** Letzte Entscheidung je Sitzung — für die Karar-Zeile in Live und Replay. */
export async function smartDecisions(sessionIds: string[]): Promise<Map<string, SmartDecision>> {
  const out = new Map<string, SmartDecision>();
  if (!sessionIds.length) return out;
  const rows = await query<{ session_id: string; percent: number; holdout: number; blocked: string | null; signals: string | null; score: number | null }>(
    `SELECT session_id, percent, holdout, blocked, signals, score FROM autopilot_offers
      WHERE engine >= 2 AND session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY id ASC`, sessionIds);
  for (const r of rows) {
    out.set(r.session_id, {
      percent: Number(r.percent), holdout: Number(r.holdout) === 1, blocked: r.blocked,
      signals: String(r.signals || '').split(',').filter(Boolean), score: r.score != null ? Number(r.score) : null,
    });
  }
  return out;
}

/**
 * Buchung dem Angebot zuordnen (lernen + messen) — auch der Kontrollgruppe.
 * Erst dieselbe Strecke, sonst das jüngste offene Angebot dieses Besuchers für das Fahrtdatum.
 */
export async function linkBookingToOffer(o: { visitorId: string | null; pickup: string | null; dropoff: string | null; tripDate: string | null; bookingId: number }): Promise<void> {
  if (!o.visitorId) return;
  const key = routeKey(o);
  const r = await run(
    `UPDATE autopilot_offers SET booking_id = ? WHERE visitor_id = ? AND route_key = ? AND booking_id IS NULL
       AND created_at > NOW() - INTERVAL 48 HOUR ORDER BY id DESC LIMIT 1`, [o.bookingId, o.visitorId, key]);
  if (r.affectedRows === 0 && o.tripDate) {
    await run(
      `UPDATE autopilot_offers SET booking_id = ? WHERE visitor_id = ? AND trip_date = ? AND booking_id IS NULL
         AND created_at > NOW() - INTERVAL 48 HOUR ORDER BY id DESC LIMIT 1`, [o.bookingId, o.visitorId, o.tripDate]);
  }
}

/** Offenes Angebot für die Buchung lesen (gleiche Logik wie Zuordnung), ohne neu zu entscheiden. */
export async function findOfferForBooking(o: { visitorId: string | null; pickup: string | null; dropoff: string | null; tripDate: string | null }): Promise<AutopilotOffer | null> {
  if (!o.visitorId) return null;
  const [byRoute] = await query<{ id: number; percent: number; holdout: number }>(
    `SELECT id, percent, holdout FROM autopilot_offers WHERE visitor_id = ? AND route_key = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [o.visitorId, routeKey(o)]);
  const row = byRoute || (o.tripDate ? (await query<{ id: number; percent: number; holdout: number }>(
    `SELECT id, percent, holdout FROM autopilot_offers WHERE visitor_id = ? AND trip_date = ? AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [o.visitorId, o.tripDate]))[0] : null);
  return row ? { percent: Number(row.percent), holdout: Number(row.holdout) === 1, offerId: row.id } : null;
}
