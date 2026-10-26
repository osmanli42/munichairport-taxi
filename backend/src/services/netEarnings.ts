// Statistik „Uns bleibt“: was nach Fahreranteil und Diesel übrig bleibt (ohne MwSt-Abzug).
//   Fahreranteil = Preis × cost_driver_share_pct — entfällt, wenn ein Partner (cost_partner_drivers,
//                  z. B. „M.Ali“) selbst fährt; bei zwei Fahrern (Bus-Tour) anteilig.
//   Diesel       = einfache Strecke × 2 (Leerfahrt zurück) × Fahrtteile × L/100 km × €/L;
//                  Hin & Rück = zwei Fahrtteile.
// Fahrer: zugewiesener Fahrer der Buchung, sonst das Ende des „Ort“-Felds im Kalendertermin.
// Ohne erkennbaren Fahrer wird vorsichtig der normale Fahreranteil abgezogen.
// km: Buchungen haben distance_km; sonst (Kalender, alte Buchungen) Google Distance Matrix,
// dauerhaft in distance_cache gespeichert (pro Anfrage begrenzt, Rest beim nächsten Laden).
import crypto from 'crypto';
import { query, run } from '../db';
import { drivingDistanceKm } from './calendarInvoice';
import { driverTokens } from '../utils/calendarDriver';

export interface CostSettings {
  driverPct: number; lPer100: number; eurPerL: number; partners: string[];
  /** Monatliche Fixkosten (Versicherung, Leasing …) — nicht je Fahrt, sondern anteilig je Tag */
  fixedMonthly: Array<{ name: string; amount: number }>;
}

const num = (v: unknown, d: number) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function loadCostSettings(): Promise<CostSettings> {
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN
      ('cost_driver_share_pct', 'cost_fuel_l_per_100km', 'cost_fuel_eur_per_l', 'cost_partner_drivers', 'cost_fixed_monthly')`);
  const s = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return {
    driverPct: num(s.cost_driver_share_pct, 40),
    lPer100: num(s.cost_fuel_l_per_100km, 8.5),
    eurPerL: num(s.cost_fuel_eur_per_l, 2.239),
    partners: String(s.cost_partner_drivers ?? 'M.Ali').split(',').map((p) => p.trim()).filter(Boolean),
    fixedMonthly: parseFixed(s.cost_fixed_monthly),
  };
}

function parseFixed(v: unknown): Array<{ name: string; amount: number }> {
  try {
    const list = JSON.parse(String(v || '[]'));
    return Array.isArray(list) ? list.map((x: any) => ({ name: String(x?.name || ''), amount: Number(x?.amount) || 0 })).filter((x) => x.amount > 0) : [];
  } catch { return []; }
}

/** Fixkosten-Anteil für `days` Tage: Monatssumme × 12 / 365 je Tag. */
export function fixedForDays(s: CostSettings, days: number): number {
  const monthly = s.fixedMonthly.reduce((a, x) => a + x.amount, 0);
  return round2((monthly * 12 / 365) * Math.max(0, days));
}

// „M.ALi“, „M. Ali“, „mali“ → gleich
const nameKey = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, '');
export function isPartnerDriver(name: string, partners: string[]): boolean {
  const k = nameKey(name);
  return !!k && partners.some((p) => nameKey(p) === k);
}

/** Fahrer einer Fahrt: zugewiesener Fahrer, sonst aus dem „Ort“-Feld des Kalendertermins. */
export function rideDrivers(assigned: string | null | undefined, location: string | null | undefined): string[] {
  if (assigned && assigned.trim()) return [assigned.trim()];
  return location ? driverTokens(location) : [];
}

export interface RideCost { km: number | null; driver: number; fuel: number; net: number; partner: boolean; no_driver: boolean }

/** price = Bruttopreis (null = unbepreiste Kalender-Fahrt → zählt nirgends), kmOneWay = einfache Strecke. */
export function rideCosts(price: number | null, kmOneWay: number | null, legs: number, drivers: string[], s: CostSettings): RideCost {
  const p = price == null ? null : Number(price) || 0;
  const partnerN = drivers.filter((d) => isPartnerDriver(d, s.partners)).length;
  const noDriver = drivers.length === 0;
  if (p == null) return { km: null, driver: 0, fuel: 0, net: 0, partner: partnerN > 0, no_driver: noDriver };
  const otherShare = noDriver ? 1 : (drivers.length - partnerN) / drivers.length;
  const driver = round2(p * (s.driverPct / 100) * otherShare);
  const km = kmOneWay && kmOneWay > 0 ? Math.round(kmOneWay * 2 * legs * 10) / 10 : null;
  const fuel = km ? round2(km * (s.lPer100 / 100) * s.eurPerL) : 0;
  return { km, driver, fuel, net: round2(p - driver - fuel), partner: partnerN > 0, no_driver: noDriver };
}

export interface NetSummary {
  revenue: number; driver: number; fuel: number; km: number; net: number;
  rides: number; partner_rides: number; no_driver_rides: number; missing_km: number;
}
export function summarize(list: Array<{ price: number | null; cost: RideCost }>): NetSummary {
  const out: NetSummary = { revenue: 0, driver: 0, fuel: 0, km: 0, net: 0, rides: 0, partner_rides: 0, no_driver_rides: 0, missing_km: 0 };
  for (const { price, cost } of list) {
    if (price == null) continue; // ohne Preis: weder Umsatz noch Kosten
    out.rides++;
    out.revenue += Number(price) || 0;
    out.driver += cost.driver;
    out.fuel += cost.fuel;
    out.km += cost.km || 0;
    out.net += cost.net;
    if (cost.partner) out.partner_rides++;
    if (cost.no_driver) out.no_driver_rides++;
    if (!cost.km) out.missing_km++;
  }
  for (const k of ['revenue', 'driver', 'fuel', 'net'] as const) out[k] = round2(out[k]);
  out.km = Math.round(out.km);
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
