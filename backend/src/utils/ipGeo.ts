import http from 'http';
import { Request } from 'express';

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fd)/;

export function getClientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return xff.split(',')[0].trim() || req.socket.remoteAddress || '';
}

export function isPrivateIp(ip: string): boolean {
  return !ip || PRIVATE_IP_RE.test(ip);
}

export async function geoFromIp(ip: string): Promise<{ country: string; city: string; lat: number | null; lng: number | null; proxy: boolean }> {
  return new Promise((resolve) => {
    const fallback = { country: '', city: '', lat: null, lng: null, proxy: false };
    const timeout = setTimeout(() => resolve(fallback), 2000);
    // proxy/hosting = VPN- bzw. Rechenzentrums-IP. Kostet keinen zusätzlichen Aufruf.
    http.get(`http://ip-api.com/json/${ip}?fields=countryCode,city,lat,lon,proxy,hosting`, (res) => {
      let data = '';
      res.on('data', (c: string) => data += c);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const j = JSON.parse(data);
          resolve({
            country: j.countryCode || '',
            city: j.city || '',
            lat: j.lat != null ? Number(j.lat) : null,
            lng: j.lon != null ? Number(j.lon) : null,
            proxy: j.proxy === true || j.hosting === true,
          });
        } catch { resolve(fallback); }
      });
    }).on('error', () => { clearTimeout(timeout); resolve(fallback); });
  });
}

// In-memory cache: IP → {lat, lng, ts}
const cache = new Map<string, { lat: number | null; lng: number | null; proxy: boolean; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour
const CACHE_MAX = 10_000;

export async function getVisitorGeo(req: Request): Promise<{ lat: number | null; lng: number | null; proxy: boolean }> {
  const ip = getClientIp(req);
  if (isPrivateIp(ip)) return { lat: null, lng: null, proxy: false };

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng, proxy: cached.proxy };
  }

  const geo = await geoFromIp(ip);

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(ip, { lat: geo.lat, lng: geo.lng, proxy: geo.proxy, ts: Date.now() });

  return { lat: geo.lat, lng: geo.lng, proxy: geo.proxy };
}

// Unverändertes Verhalten für die Preislogik (Pflichtgebiet-Bypass): nur Koordinaten,
// VPN-Erkennung bleibt hier bewusst außen vor.
export async function getVisitorCoords(req: Request): Promise<{ lat: number | null; lng: number | null }> {
  const { lat, lng } = await getVisitorGeo(req);
  return { lat, lng };
}
