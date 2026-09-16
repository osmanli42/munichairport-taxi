// Entfernung des Besuchers (IP-Standort) zum Betriebssitz — Zielgruppen-Bedingung der
// automatischen Rabatte. Gleiche Datenquelle wie der IP-Bypass des Pflichtfahrgebiets.
import { Request } from 'express';
import { query } from '../db';
import { getVisitorCoords } from '../utils/ipGeo';
import { haversineKm } from '../utils/geo';

interface BaseConfig {
  betriebssitz_lat: number;
  betriebssitz_lng: number;
  ip_bypass_enabled: number;
  ip_bypass_distance_km: number | null;
}

let cache: { cfg: BaseConfig | null; loadedAt: number } | null = null;
const CACHE_MS = 60_000;

async function loadBase(): Promise<BaseConfig | null> {
  if (cache && Date.now() - cache.loadedAt < CACHE_MS) return cache.cfg;
  const [cfg] = await query<BaseConfig>(
    'SELECT betriebssitz_lat, betriebssitz_lng, ip_bypass_enabled, ip_bypass_distance_km FROM pflichtgebiet_config WHERE id = 1'
  );
  cache = { cfg: cfg ?? null, loadedAt: Date.now() };
  return cache.cfg;
}

// distanceKm = null: Standort unbekannt (lokale IP, VPN ohne Treffer, Geo-Dienst down).
// bypassDistanceKm: ab dieser Entfernung greift der Pflichtgebiet-Bypass (null = aus).
export async function visitorDistanceToBase(req: Request): Promise<{ distanceKm: number | null; bypassDistanceKm: number | null }> {
  try {
    const cfg = await loadBase();
    if (!cfg) return { distanceKm: null, bypassDistanceKm: null };
    const bypassDistanceKm = cfg.ip_bypass_enabled ? Number(cfg.ip_bypass_distance_km || 100) : null;
    const vc = await getVisitorCoords(req);
    if (vc.lat == null || vc.lng == null) return { distanceKm: null, bypassDistanceKm };
    const distanceKm = Math.round(
      haversineKm(vc.lat, vc.lng, Number(cfg.betriebssitz_lat), Number(cfg.betriebssitz_lng))
    );
    return { distanceKm, bypassDistanceKm };
  } catch {
    return { distanceKm: null, bypassDistanceKm: null };
  }
}
