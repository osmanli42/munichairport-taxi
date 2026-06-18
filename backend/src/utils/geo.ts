// Pflichtfahrgebiet (mandatory taxi tariff zone) geo helpers.
// Isolated from the existing free-pricing engine — only used to decide whether a
// trip falls inside the mandatory zone (union of airport + Betriebssitz circles).

export interface PgConfig {
  enabled: number;
  mode: string; // 'floor' | 'replace'
  radius_km: number;
  roundtrip_discount_enabled: number;
  airport_enabled: number;
  airport_lat: number;
  airport_lng: number;
  betriebssitz_enabled: number;
  betriebssitz_lat: number;
  betriebssitz_lng: number;
  ip_bypass_enabled: number;
  ip_bypass_distance_km: number;
}

export interface Coords {
  lat: number;
  lng: number;
}

// Great-circle distance between two coordinates in kilometers.
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Is a single point within the radius of any active center?
export function pointInZone(point: Coords | undefined | null, cfg: PgConfig): boolean {
  if (!point || !isFinite(point.lat) || !isFinite(point.lng)) return false;
  const r = cfg.radius_km > 0 ? cfg.radius_km : 50;
  if (cfg.airport_enabled) {
    if (haversineKm(point.lat, point.lng, cfg.airport_lat, cfg.airport_lng) <= r) return true;
  }
  if (cfg.betriebssitz_enabled) {
    if (haversineKm(point.lat, point.lng, cfg.betriebssitz_lat, cfg.betriebssitz_lng) <= r) return true;
  }
  return false;
}

// A trip is in the mandatory zone only if BOTH pickup AND dropoff are inside the
// union. Long-distance trips (destination outside 50 km) use free pricing.
export function tripInZone(
  pickup: Coords | undefined | null,
  dropoff: Coords | undefined | null,
  cfg: PgConfig
): boolean {
  return pointInZone(pickup, cfg) && pointInZone(dropoff, cfg);
}
