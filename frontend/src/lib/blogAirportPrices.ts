// Live "ab X €" prices for the pillar page /blog/taxi-flughafen-muenchen.
// Same price engine as the city pages (POST /popular-routes/city-quote, priced as a local customer),
// so the numbers match the booking form. The fallback values below are the engine output of
// 2 Oct 2026 and are only used when the API is unreachable.
//
// Munich district distances/minutes come from the Google Distance Matrix (same endpoint the
// booking form uses), pick-up points are the station or square named in `address`.

import { citiesBySlug } from '@/lib/citiesData';
import { cityGeo } from '@/lib/citiesGeo';

const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

export type Quote = { kombi: number; van: number; grossraumtaxi: number | null };

export type AreaRow = {
  key: string;
  name: string;
  group: 'muenchen' | 'umland';
  /** Link to the matching city page (only for towns that have one). */
  href?: string;
  lat: number;
  lng: number;
  km: number;
  min: number;
  address: string;
  fallback: Quote;
};

const MUNICH: AreaRow[] = [
  { key: 'hbf', name: 'Hauptbahnhof und Innenstadt', group: 'muenchen', lat: 48.1403, lng: 11.56, km: 40, min: 37, address: 'Hauptbahnhof, 80335 München, Deutschland', fallback: { kombi: 96, van: 106, grossraumtaxi: 109 } },
  { key: 'schwabing', name: 'Schwabing und Maxvorstadt', group: 'muenchen', lat: 48.1621, lng: 11.586, km: 33.6, min: 27, address: 'Münchner Freiheit, 80802 München, Deutschland', fallback: { kombi: 88.5, van: 96, grossraumtaxi: 100 } },
  { key: 'haidhausen', name: 'Haidhausen und Bogenhausen', group: 'muenchen', lat: 48.135, lng: 11.615, km: 37.2, min: 30, address: 'Max-Weber-Platz, 81675 München, Deutschland', fallback: { kombi: 97.5, van: 105, grossraumtaxi: 109 } },
  { key: 'pasing', name: 'Pasing und Sendling', group: 'muenchen', lat: 48.1497, lng: 11.4616, km: 43.4, min: 35, address: 'Bahnhof Pasing, 81241 München, Deutschland', fallback: { kombi: 112.5, van: 120, grossraumtaxi: 124.5 } },
];

const REGION: { slug: string; fallback: Quote }[] = [
  { slug: 'taxi-freising-flughafen-muenchen', fallback: { kombi: 37.5, van: 44.5, grossraumtaxi: 47.5 } },
  { slug: 'taxi-unterschleissheim-flughafen-muenchen', fallback: { kombi: 56.5, van: 64, grossraumtaxi: 67.5 } },
  { slug: 'taxi-garching-flughafen-muenchen', fallback: { kombi: 66, van: 74, grossraumtaxi: 77.5 } },
  { slug: 'taxi-augsburg-flughafen-muenchen', fallback: { kombi: 205, van: 218, grossraumtaxi: 228 } },
  { slug: 'taxi-salzburg-flughafen-muenchen', fallback: { kombi: 419.5, van: 441, grossraumtaxi: 459.5 } },
];

const UMLAND: AreaRow[] = REGION.flatMap(({ slug, fallback }) => {
  const city = citiesBySlug[slug];
  const geo = cityGeo[slug];
  if (!city || !geo) return [];
  return [{
    key: slug,
    name: city.nameDE,
    group: 'umland' as const,
    href: `/blog/${slug}`,
    lat: geo.lat,
    lng: geo.lng,
    km: Math.round(geo.km * 10) / 10,
    min: geo.min,
    address: geo.address,
    fallback,
  }];
});

export const AREA_ROWS: AreaRow[] = [...MUNICH, ...UMLAND];

export type PricedRow = AreaRow & { quote: Quote; live: boolean };

async function quoteFor(row: AreaRow): Promise<PricedRow> {
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
