// Live "ab X €" prices for the pillar page /blog/taxi-flughafen-muenchen.
// Same price engine as the city pages (POST /popular-routes/city-quote, priced as a local customer),
// so the numbers match the booking form. The area list (coordinates, km, minutes, fallback prices)
// lives in blogAirportAreas.ts; the fallback is only used when the API is unreachable.

import { AREA_DATA, type AreaData, type AreaQuote } from '@/lib/blogAirportAreas';

const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

export type Quote = AreaQuote;
export type AreaRow = AreaData;
export type PricedRow = AreaData & { quote: AreaQuote; live: boolean };

export const AREA_ROWS: AreaData[] = AREA_DATA;

async function quoteFor(row: AreaData): Promise<PricedRow> {
  try {
    const res = await fetch(`${API_URL}/popular-routes/city-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: row.lat, lng: row.lng, km: row.km, address: row.address }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = (await res.json())?.prices || {};
    if (!(p.kombi > 0) || !(p.van > 0)) throw new Error('empty quote');
    return { ...row, live: true, quote: { kombi: p.kombi, van: p.van, grossraumtaxi: p.grossraumtaxi > 0 ? p.grossraumtaxi : null } };
  } catch (e) {
    console.error('[blog/taxi-flughafen-muenchen] live price failed', row.key, (e as Error)?.message);
    return { ...row, live: false, quote: row.fallback };
  }
}

export async function getAreaPrices(): Promise<PricedRow[]> {
  return Promise.all(AREA_ROWS.map(quoteFor));
}

/** "88,50 €" / "96 €" */
export function eur(n: number): string {
  return `${Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')} €`;
}
