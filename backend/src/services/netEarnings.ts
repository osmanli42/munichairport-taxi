// Statistik „Uns bleibt“: was nach Fahreranteil und Diesel übrig bleibt (ohne MwSt-Abzug).
//   Fahreranteil = Preis × cost_driver_share_pct — entfällt, wenn ein Partner (cost_partner_drivers,
//                  z. B. „M.Ali“) selbst fährt; bei zwei Fahrern (Bus-Tour) anteilig.
//   Diesel       = einfache Strecke × 2 (Leerfahrt zurück) × Fahrtteile × L/100 km × €/L;
//                  Hin & Rück = zwei Fahrtteile.
// Fahrer: zugewiesener Fahrer der Buchung, sonst das Ende des „Ort“-Felds im Kalendertermin.
// Ohne erkennbaren Fahrer wird vorsichtig der normale Fahreranteil abgezogen.
// Fremdfirma: steht ein Name regelmäßig als Fahrer im Kalender, gehört aber weder zu den eigenen
// Fahrern (cost_own_drivers) noch zum Partner, fuhr eine Fremdfirma „zur Unterstützung“ — diese
// Fahrt zählt in „Uns bleibt“ weder als Umsatz noch mit Diesel (die Umsatz-Kacheln bleiben unverändert).
// km: Buchungen haben distance_km; sonst (Kalender, alte Buchungen) Google Distance Matrix,
// dauerhaft in distance_cache gespeichert (pro Anfrage begrenzt, Rest beim nächsten Laden).
import crypto from 'crypto';
import { query, run } from '../db';
import { drivingDistanceKm } from './calendarInvoice';
import { driverTokens } from '../utils/calendarDriver';

export interface CostSettings {
  driverPct: number; lPer100: number; eurPerL: number; partners: string[];
  /** Eigene Fahrer (Fahreranteil) — wer sonst regelmäßig im Kalender als Fahrer steht, ist Fremdfirma */
  ownDrivers: string[];
  /** Monatliche Fixkosten (Versicherung, Leasing …) — nicht je Fahrt, sondern anteilig je Tag */
  fixedMonthly: Array<{ name: string; amount: number }>;
  /** Namen, die in den letzten 180 Tagen ≥ FREQUENT_MIN mal als Fahrer im Kalender stehen (nameKey) */
  frequent: Set<string>;
}

const num = (v: unknown, d: number) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const list = (v: unknown, d: string) => String(v ?? d).split(',').map((p) => p.trim()).filter(Boolean);
export const DEFAULT_OWN_DRIVERS = 'Zeki, Saban, Muhammet, Ilker, Selahattin, Tevfik';

export async function loadCostSettings(): Promise<CostSettings> {
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN
      ('cost_driver_share_pct', 'cost_fuel_l_per_100km', 'cost_fuel_eur_per_l', 'cost_partner_drivers', 'cost_own_drivers', 'cost_fixed_monthly')`);
  const s = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return {
    driverPct: num(s.cost_driver_share_pct, 40),
    lPer100: num(s.cost_fuel_l_per_100km, 8.5),
    eurPerL: num(s.cost_fuel_eur_per_l, 2.239),
    partners: list(s.cost_partner_drivers, 'M.Ali'),
    ownDrivers: list(s.cost_own_drivers, DEFAULT_OWN_DRIVERS),
    fixedMonthly: parseFixed(s.cost_fixed_monthly),
    frequent: new Set((await calendarDriverCounts()).filter((d) => d.count >= FREQUENT_MIN).map((d) => d.key)),
  };
}

function parseFixed(v: unknown): Array<{ name: string; amount: number }> {
  try {
    const l = JSON.parse(String(v || '[]'));
    return Array.isArray(l) ? l.map((x: any) => ({ name: String(x?.name || ''), amount: Number(x?.amount) || 0 })).filter((x) => x.amount > 0) : [];
  } catch { return []; }
}

/** Fixkosten-Anteil für `days` Tage: Monatssumme × 12 / 365 je Tag. */
export function fixedForDays(s: CostSettings, days: number): number {
  const monthly = s.fixedMonthly.reduce((a, x) => a + x.amount, 0);
  return round2((monthly * 12 / 365) * Math.max(0, days));
}

// „M.ALi“, „M. Ali“, „mali“, „Şaban“/„Saban“, „İlker“/„Ilker“ → gleich
export const nameKey = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').replace(/[^\p{L}]/gu, '');
const inList = (name: string, names: string[]) => { const k = nameKey(name); return !!k && names.some((p) => nameKey(p) === k); };
export function isPartnerDriver(name: string, partners: string[]): boolean { return inList(name, partners); }

export type DriverKind = 'partner' | 'own' | 'fremd' | 'unknown';
/** Partner, eigener Fahrer, Fremdfirma (regelmäßig im Kalender, aber nicht unser Fahrer, oder „Taxi gitti“) oder unklar. */
export function driverKind(name: string, s: CostSettings): DriverKind {
  if (name === 'Fremdtaxi') return 'fremd';
  if (inList(name, s.partners)) return 'partner';
  if (inList(name, s.ownDrivers)) return 'own';
  return s.frequent.has(nameKey(name)) ? 'fremd' : 'unknown';
}

// Wie oft steht welcher Name als Fahrer im Kalender (letzte 180 Tage) — 1 Std. gecacht
const FREQUENT_MIN = 6;
let countsCache: { at: number; list: Array<{ key: string; name: string; count: number }> } | null = null;
export async function calendarDriverCounts(): Promise<Array<{ key: string; name: string; count: number }>> {
  if (countsCache && Date.now() - countsCache.at < 60 * 60_000) return countsCache.list;
  const since = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
  const rows = await query<{ location: string }>(
    `SELECT location FROM calendar_rides WHERE ride_time >= ? AND location IS NOT NULL AND location <> ''`, [`${since}T00:00`]);
  const m = new Map<string, { key: string; name: string; count: number }>();
  for (const r of rows) {
    for (const t of driverTokens(r.location)) {
      const key = nameKey(t);
      if (!key || t === 'Fremdtaxi') continue;
      const e = m.get(key) || { key, name: t, count: 0 };
      e.count++;
      m.set(key, e);
    }
  }
  const out = [...m.values()].sort((a, b) => b.count - a.count);
  countsCache = { at: Date.now(), list: out };
  return out;
}

/** Fahrer einer Fahrt: zugewiesener Fahrer, sonst aus dem „Ort“-Feld des Kalendertermins. */
export function rideDrivers(assigned: string | null | undefined, location: string | null | undefined): string[] {
  if (assigned && assigned.trim()) return [assigned.trim()];
  return location ? driverTokens(location) : [];
}

export interface RideCost {
  km: number | null; driver: number; fuel: number; net: number;
  partner: boolean; no_driver: boolean;
  /** ganz von einer Fremdfirma gefahren → zählt in „Uns bleibt“ weder als Umsatz noch als Kosten */
  fremd: boolean;
  /** davon für uns zählender Umsatz (bei gemischten Touren anteilig) */
  counted: number;
  fremd_names: string[];
}

/** price = Bruttopreis (null = unbepreiste Kalender-Fahrt → zählt nirgends), kmOneWay = einfache Strecke. */
export function rideCosts(price: number | null, kmOneWay: number | null, legs: number, drivers: string[], s: CostSettings): RideCost {
  const p = price == null ? null : Number(price) || 0;
  const kinds = drivers.map((d) => driverKind(d, s));
  const n = drivers.length;
  const partnerN = kinds.filter((k) => k === 'partner').length;
  const fremdN = kinds.filter((k) => k === 'fremd').length;
  const fremdNames = drivers.filter((_, i) => kinds[i] === 'fremd');
  const noDriver = n === 0;
  const base = { partner: partnerN > 0, no_driver: noDriver, fremd: n > 0 && fremdN === n, fremd_names: fremdNames };
  if (p == null) return { km: null, driver: 0, fuel: 0, net: 0, counted: 0, ...base };
  // Anteile: Fremdfirma zählt gar nicht, Partner ohne Fahreranteil, alle anderen mit Fahreranteil
  const ours = noDriver ? 1 : (n - fremdN) / n;
  const withShare = noDriver ? 1 : (n - fremdN - partnerN) / n;
  const counted = round2(p * ours);
  const driver = round2(p * (s.driverPct / 100) * withShare);
  const km = kmOneWay && kmOneWay > 0 ? Math.round(kmOneWay * 2 * legs * ours * 10) / 10 : null;
  const fuel = km ? round2(km * (s.lPer100 / 100) * s.eurPerL) : 0;
  return { km: ours > 0 ? km : null, driver, fuel, net: round2(counted - driver - fuel), counted, ...base };
}

export interface NetSummary {
  revenue: number; driver: number; fuel: number; km: number; net: number;
  rides: number; partner_rides: number; no_driver_rides: number; missing_km: number;
  fremd_rides: number; fremd_revenue: number; fremd_names: string[];
}
export function summarize(items: Array<{ price: number | null; cost: RideCost }>): NetSummary {
  const out: NetSummary = { revenue: 0, driver: 0, fuel: 0, km: 0, net: 0, rides: 0, partner_rides: 0, no_driver_rides: 0, missing_km: 0, fremd_rides: 0, fremd_revenue: 0, fremd_names: [] };
  const names = new Set<string>();
  for (const { price, cost } of items) {
    if (price == null) continue; // ohne Preis: weder Umsatz noch Kosten
    cost.fremd_names.forEach((x) => names.add(x));
    out.fremd_revenue += (Number(price) || 0) - cost.counted;
    if (cost.fremd) { out.fremd_rides++; continue; }
    out.rides++;
    out.revenue += cost.counted;
    out.driver += cost.driver;
    out.fuel += cost.fuel;
    out.km += cost.km || 0;
    out.net += cost.net;
    if (cost.partner) out.partner_rides++;
    if (cost.no_driver) out.no_driver_rides++;
    if (!cost.km) out.missing_km++;
  }
  for (const k of ['revenue', 'driver', 'fuel', 'net', 'fremd_revenue'] as const) out[k] = round2(out[k]);
  out.km = Math.round(out.km);
  out.fremd_names = [...names].slice(0, 12);
  return out;
}

// ---- Strecke je Adresspaar (dauerhaft) ------------------------------------------------

const normAddr = (a: string) => a.toLowerCase().replace(/,\s*(deutschland|germany)\s*$/i, '').replace(/\s+/g, ' ').trim();
const pairKey = (from: string, to: string) => crypto.createHash('sha1').update(`${normAddr(from)}|${normAddr(to)}`).digest('hex');
const RETRY_NULL_DAYS = 7;

/**
 * km für Adresspaare: erst distance_cache, dann höchstens `budget.left` neue Google-Abfragen
 * (parallel, je Anfrage begrenzt). Rückgabe: Schlüssel „from|to“ → km (null = unbekannt).
 */
export async function resolveKm(pairs: Array<[string | null | undefined, string | null | undefined]>, budget: { left: number }): Promise<Map<string, number | null>> {
  const want = new Map<string, { from: string; to: string }>();
  for (const [from, to] of pairs) {
    if (!from || !to || !from.trim() || !to.trim()) continue;
    want.set(pairKey(from, to), { from, to });
  }
  const out = new Map<string, number | null>();
  const keys = [...want.keys()];
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const rows = await query<{ pair_key: string; km: number | null; stale: number }>(
      `SELECT pair_key, km, (km IS NULL AND created_at < NOW() - INTERVAL ${RETRY_NULL_DAYS} DAY) AS stale
         FROM distance_cache WHERE pair_key IN (${chunk.map(() => '?').join(',')})`, chunk);
    for (const r of rows) if (!Number(r.stale)) out.set(r.pair_key, r.km == null ? null : Number(r.km));
  }
  const missing = keys.filter((k) => !out.has(k)).slice(0, Math.max(0, budget.left));
  budget.left -= missing.length;
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.all(missing.slice(i, i + 6).map(async (k) => {
      const { from, to } = want.get(k)!;
      const km = await drivingDistanceKm(from, to);
      out.set(k, km);
      await run(`INSERT INTO distance_cache (pair_key, km) VALUES (?, ?) ON DUPLICATE KEY UPDATE km = VALUES(km), created_at = NOW()`, [k, km])
        .catch(() => {});
    }));
  }
  return out;
}

export function kmFor(map: Map<string, number | null>, from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  return map.get(pairKey(from, to)) ?? null;
}
