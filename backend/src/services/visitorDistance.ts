// Entfernung des Besuchers (IP-Standort) zum Betriebssitz — Zielgruppen-Bedingung der
// automatischen Rabatte. Gleiche Datenquelle wie der IP-Bypass des Pflichtfahrgebiets.
import { Request } from 'express';
import { query } from '../db';
import { getVisitorGeo } from '../utils/ipGeo';
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

// distanceKm: für die Rabatt-Zielgruppe. null = Standort unbekannt (lokale IP, Geo-Dienst
//   down) ODER VPN/Rechenzentrums-IP — deren Standort sagt nichts über den Kunden aus.
// rawDistanceKm: tatsächlich gemessene Entfernung (auch bei VPN) — nur um zu bestimmen,
//   ob dieser Besucher den Pflichtgebiet-Bypass sieht. Die Preislogik selbst bleibt unberührt.
// bypassDistanceKm: ab dieser Entfernung greift der Bypass (null = aus).
export async function visitorDistanceToBase(req: Request): Promise<{
  distanceKm: number | null;
  rawDistanceKm: number | null;
  bypassDistanceKm: number | null;
  isProxy: boolean;
}> {
  try {
    const cfg = await loadBase();
    if (!cfg) return { distanceKm: null, rawDistanceKm: null, bypassDistanceKm: null, isProxy: false };
    const bypassDistanceKm = cfg.ip_bypass_enabled ? Number(cfg.ip_bypass_distance_km || 100) : null;
    const geo = await getVisitorGeo(req);
    if (geo.lat == null || geo.lng == null) {
      return { distanceKm: null, rawDistanceKm: null, bypassDistanceKm, isProxy: geo.proxy };
    }
    const rawDistanceKm = Math.round(
      haversineKm(geo.lat, geo.lng, Number(cfg.betriebssitz_lat), Number(cfg.betriebssitz_lng))
    );
    return { distanceKm: geo.proxy ? null : rawDistanceKm, rawDistanceKm, bypassDistanceKm, isProxy: geo.proxy };
  } catch {
    return { distanceKm: null, rawDistanceKm: null, bypassDistanceKm: null, isProxy: false };
  }
}
