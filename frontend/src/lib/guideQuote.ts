// Live fixed prices for guide pages (airport ↔ well-known Munich destinations), from the
// booking price engine via /api/popular-routes/city-quote (cached 1 h). Distances: Google
// Directions from the airport, 2 Oct 2026.

const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

export type Dest = { key: string; address: string; lat: number; lng: number; km: number; min: number };

export const DESTS: Record<string, Dest> = {
  hbf: { key: 'hbf', address: 'München Hauptbahnhof, Bayerstraße 10A, 80335 München', lat: 48.14041, lng: 11.55827, km: 39.5, min: 39 },
  marienplatz: { key: 'marienplatz', address: 'Marienplatz 1, 80331 München', lat: 48.13743, lng: 11.57472, km: 40.1, min: 41 },
  schwabing: { key: 'schwabing', address: 'Münchner Freiheit, 80802 München', lat: 48.16321, lng: 11.58705, km: 34.4, min: 27 },
  olympiapark: { key: 'olympiapark', address: 'Olympiapark, Spiridon-Louis-Ring 21, 80809 München', lat: 48.17543, lng: 11.55199, km: 35.1, min: 27 },
  messe: { key: 'messe', address: 'Messe München, Am Messesee 2, 81829 München', lat: 48.13552, lng: 11.69245, km: 44.8, min: 32 },
  theresienwiese: { key: 'theresienwiese', address: 'Theresienwiese, 80336 München', lat: 48.1309, lng: 11.55094, km: 42.1, min: 41 },
};

export type Quote = { kombi: number; van: number; grossraumtaxi: number | null } | null;

export async function quote(d: Dest): Promise<Quote> {
  try {
    const res = await fetch(`${API_URL}/popular-routes/city-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: d.lat, lng: d.lng, km: d.km, address: d.address }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const p = (await res.json())?.prices || {};
    if (!(p.kombi > 0)) return null;
    return { kombi: p.kombi, van: p.van, grossraumtaxi: p.grossraumtaxi > 0 ? p.grossraumtaxi : null };
  } catch {
    return null;
  }
}

export const eur = (n: number, l: string) => (l === 'en'
  ? `€${Number.isInteger(n) ? n : n.toFixed(2)}`
  : `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`);
