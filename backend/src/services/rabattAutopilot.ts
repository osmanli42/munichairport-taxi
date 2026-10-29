// Rabatt-Autopilot (Rabatte-Tab): entscheidet pro Besucher und Strecke, ob und wie viel Rabatt
// (0/3/5/7 %) er sieht — Ziel: möglichst viele Buchungen, Rabatt nur, wo er etwas bewirkt.
//
// Ablauf:
//   1. Kontrollgruppe (holdout %, fester Bucket je Besucher) bekommt nie Rabatt — so lässt sich
//      die echte Wirkung messen (Buchungsquote Angebot vs. Kontrolle).
//   2. Bedarfswert 0..1 aus Nachfrage (ruhiger Tag, freie Stunde), Zögern (Buchungsmodell-
//      Wahrscheinlichkeit, Wiederkehrer, abgebrochene Buchung, Vorlauf) und Wert (lange Fahrt).
//      „Bucht sowieso“ (Modell p > 0,6) → kein Rabatt.
//   3. Ab Bedarf 0,35: Stufe 3/5/7 % per Thompson-Sampling — jede Stufe lernt aus
//      „angeboten → innerhalb 48 h gebucht“, welche am meisten Buchungen bringt.
//   4. Die Entscheidung wird je Besucher + Strecke + Fahrtdatum 24 h eingefroren
//      (autopilot_offers): Karten, /buchen und die Buchung selbst sehen denselben Rabatt.
//
// Regel-Grenzen (Mindest-km, Stammkunde, Firma, max. %) stehen in der Regelzeile
// auto_discounts (dynamic_mode = 'autopilot'), die übrigen Einstellungen in settings.

import { query, run } from '../db';
import { bucket } from '../utils/experiments';
import { berlinDateSql } from '../utils/berlinTime';
import { paceForTrip, ridesNear } from './demandPace';
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

interface Settings { holdoutPct: number; weeklyBudget: number | null; minScore: number }

let settingsCache: { at: number; s: Settings } | null = null;
async function settings(): Promise<Settings> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache.s;
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('autopilot_holdout_pct', 'autopilot_weekly_budget', 'autopilot_min_score')`);
  const v = (k: string) => rows.find(r => r.setting_key === k)?.setting_value;
  const num = (x: string | undefined, d: number) => (x != null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : d);
  const budget = v('autopilot_weekly_budget');
  const s: Settings = {
    holdoutPct: Math.min(50, Math.max(0, num(v('autopilot_holdout_pct'), 15))),
    weeklyBudget: budget === '' || budget === '0' ? null : num(budget, 150),
    minScore: Math.min(0.9, Math.max(0, num(v('autopilot_min_score'), 0.35))),
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
    // Startwert ~10 % Buchungsquote (1 : 9), damit wenige Daten nicht sofort entscheiden
    const draw = sampleBeta(1 + s.booked, 9 + Math.max(0, s.shown - s.booked));
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

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** Bedarfswert 0..1 + Gründe. p = Buchungswahrscheinlichkeit der Sitzung (null = unbekannt). */
export async function needScore(ctx: AutopilotContext): Promise<{ score: number; p: number | null; reasons: string[]; block: boolean }> {
  const reasons: string[] = [];
  // Nachfrage
  let demand = 0;
  const pace = ctx.tripDate ? await paceForTrip(ctx.tripDate).catch(() => null) : null;
  if (pace != null && pace < 0.5) { demand = 1; reasons.push('ruhiger Tag'); }
  else if (pace != null && pace < 0.75) { demand = 0.6; reasons.push('eher ruhiger Tag'); }
  if (ctx.tripDate && ctx.tripMinutes != null) {
    const near = await ridesNear(ctx.tripDate, ctx.tripMinutes, 120).catch(() => 99);
    if (near === 0) { demand = Math.max(demand, 1); reasons.push('freie Stunde'); }
    else if (near <= 2) { demand = Math.max(demand, 0.5); reasons.push('wenig Fahrten ±2 h'); }
  }
  // Zögern
  let p: number | null = null;
  if (ctx.sessionId) {
    try {
      const m = await Promise.race([
        scoreLiveSessions([ctx.sessionId]),
        new Promise<null>((r) => setTimeout(() => r(null), 1500)),
      ]);
      p = m?.get(ctx.sessionId)?.p ?? null;
    } catch { p = null; }
  }
  if (p != null && p > 0.6) return { score: 0, p, reasons: ['bucht wahrscheinlich sowieso'], block: true };
  let hes = p == null ? 0.2 : p < 0.2 ? 0.5 : p < 0.4 ? 0.25 : 0;
  if (p != null && p < 0.4) reasons.push(`Buchungschance ${Math.round(p * 100)} %`);
  if (ctx.visitorId) {
    const [v] = await query<{ n: number }>('SELECT COUNT(*) AS n FROM visitor_sessions WHERE visitor_id = ?', [ctx.visitorId]).catch(() => [{ n: 0 }]);
    if (Number(v?.n) >= 2) { hes += 0.25; reasons.push('Wiederkehrer'); }
    const [d] = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM booking_drafts WHERE visitor_id = ? AND updated_at > NOW() - INTERVAL 14 DAY`, [ctx.visitorId]).catch(() => [{ n: 0 }]);
    if (Number(d?.n) > 0) { hes += 0.35; reasons.push('Buchung abgebrochen'); }
  }
  if (ctx.tripDate) {
    const lead = Math.round((Date.parse(`${ctx.tripDate}T12:00:00Z`) - Date.parse(`${berlinDateSql(0)}T12:00:00Z`)) / 86_400_000);
    if (lead >= 2) { hes += 0.15; reasons.push(`${lead} Tage Vorlauf`); }
  }
  // Wert
  const value = ctx.km >= 60 ? 1 : ctx.km >= 40 ? 0.6 : 0.3;
  if (ctx.km >= 40) reasons.push(`${Math.round(ctx.km)} km`);
  const score = 0.4 * demand + 0.45 * clamp(hes) + 0.15 * value;
  return { score: Math.round(score * 1000) / 1000, p, reasons, block: false };
}

// Gleichzeitige Preisabfragen (3 Fahrzeugkarten) teilen sich eine Entscheidung
const pending = new Map<string, Promise<AutopilotOffer>>();

/** Angebot für Besucher + Strecke (eingefroren 24 h). ruleId = Autopilot-Regel (Budget). */
export async function autopilotOffer(ctx: AutopilotContext, ruleId: number): Promise<AutopilotOffer> {
  if (!ctx.visitorId) return { percent: 0, holdout: false, offerId: null };
  const key = routeKey(ctx);
  const lockKey = `${ctx.visitorId}|${key}`;
  const running = pending.get(lockKey);
  if (running) return running;
  const job = (async (): Promise<AutopilotOffer> => {
    const [existing] = await query<{ id: number; percent: number; holdout: number }>(
      `SELECT id, percent, holdout FROM autopilot_offers WHERE visitor_id = ? AND route_key = ? AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`, [ctx.visitorId, key]);
    if (existing) return { percent: Number(existing.percent), holdout: Number(existing.holdout) === 1, offerId: existing.id };

    const s = await settings();
    const holdout = bucket(ctx.visitorId!, 'rabatt_autopilot') < s.holdoutPct;
    const need = await needScore(ctx);
    let percent = 0;
    const reasons = [...need.reasons];
    if (!holdout && !need.block && need.score >= s.minScore) {
      if (s.weeklyBudget != null && await weekSpent(ruleId) >= s.weeklyBudget) reasons.push('Wochenbudget erreicht');
      else percent = pickLevel(await levelStats(), ctx.maxPercent);
    }
    if (holdout) reasons.unshift('Kontrollgruppe');
    const r = await run(
      `INSERT INTO autopilot_offers (visitor_id, session_id, route_key, trip_date, km, percent, holdout, score, p_model, reasons, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL 24 HOUR)`,
      [ctx.visitorId, ctx.sessionId, key, ctx.tripDate, ctx.km, percent, holdout ? 1 : 0, need.score, need.p,
        reasons.join(', ').slice(0, 255)]);
    return { percent, holdout, offerId: r.insertId };
  })();
  pending.set(lockKey, job);
  try { return await job; } finally { pending.delete(lockKey); }
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
