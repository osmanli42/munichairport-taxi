// Kalender-Fahrten ohne Preis: Preis mit dem Tarifrechner der Website schätzen (computeRoutePrice —
// dieselbe Rechnung wie „Suchen“ auf der Startseite: Fahrzeugpreis, Mindestpreis, Festpreisrouten,
// Pflichtfahrgebiet; ohne Rabatte). km aus dem dauerhaften distance_cache (Google, gedeckelt).
// Ergebnis landet in calendar_rides.price mit price_estimated = 1 — alle Summen zählen es mit,
// die Anzeigen markieren es als „geschätzt“. Steht später ein echter Preis im Termin, gilt der.
import { resolveKm, kmFor } from './netEarnings';

type Est = { from: string | null; to: string | null; summary: string; location: string };

function vehicleOf(r: Est): 'kombi' | 'van' | 'grossraumtaxi' {
  const t = `${r.summary} ${r.location}`;
  if (/gro(ß|ss)raum|\bbus\w*|\d+\s*x\s*bus/i.test(t)) return 'grossraumtaxi';
  if (/\bvan\b/i.test(t)) return 'van';
  return 'kombi';
}

// Ohne Besucher: kein IP-Bypass, keine Firmenanmeldung — der normale Tarif für Ortskunden
const NO_VISITOR = { headers: {}, ip: '', socket: { remoteAddress: '' }, query: {}, body: {}, cookies: {} } as any;

/** Schätzt Preise für die übergebenen Fahrten (Index → Preis). Höchstens `budget.left` neue Google-km-Abfragen. */
export async function estimateCalendarPrices(rides: Est[], budget: { left: number }): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const todo = rides.map((r, i) => ({ r, i })).filter(({ r }) => r.from && r.to);
  if (!todo.length) return out;
  const kmMap = await resolveKm(todo.map(({ r }) => [r.from, r.to]), budget);
  const { computeRoutePrice } = await import('../routes/bookings'); // dynamisch: kein Import-Zyklus
  for (const { r, i } of todo) {
    const km = kmFor(kmMap, r.from, r.to);
    if (!km || km <= 0) continue;
    try {
      const est = await computeRoutePrice(NO_VISITOR, vehicleOf(r), km, r.from!, r.to!);
      if (est && est.total_price > 0) out.set(i, est.total_price);
    } catch (e: any) {
      console.error('[calendarPriceEstimate]', e?.message || e);
    }
  }
  return out;
}
