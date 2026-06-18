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

export async function geoFromIp(ip: string): Promise<{ country: string; city: string; lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    const fallback = { country: '', city: '', lat: null, lng: null };
    const timeout = setTimeout(() => resolve(fallback), 2000);
    http.get(`http://ip-api.com/json/${ip}?fields=countryCode,city,lat,lon`, (res) => {
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
          });
        } catch { resolve(fallback); }
      });
    }).on('error', () => { clearTimeout(timeout); resolve(fallback); });
  });
}

// In-memory cache: IP → {lat, lng, ts}
const cache = new Map<string, { lat: number | null; lng: number | null; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour
const CACHE_MAX = 10_000;

export async function getVisitorCoords(req: Request): Promise<{ lat: number | null; lng: number | null }> {
  const ip = getClientIp(req);
  if (isPrivateIp(ip)) return { lat: null, lng: null };

  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng };
  }

  const geo = await geoFromIp(ip);

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(ip, { lat: geo.lat, lng: geo.lng, ts: Date.now() });

  return { lat: geo.lat, lng: geo.lng };
}
