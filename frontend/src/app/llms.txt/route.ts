// /llms.txt: plain-text summary of the business for AI assistants and answer engines (llmstxt.org).
// Prices come live from the booking price engine (same source as the pillar page), so the fares
// quoted here never go stale. Cached for 1 h like the pillar page.

import { citiesBySlug } from '@/lib/citiesData';
import { cityLocal } from '@/lib/cityLocal';
import { getAreaPrices, eur, type PricedRow } from '@/lib/blogAirportPrices';
import { CONTACT_INFO } from '@/lib/utils';

export const revalidate = 3600;

const SITE = 'https://flughafen-muenchen.taxi';

const FARE_ROWS: [key: string, label: string][] = [
  ['hbf', 'Munich Hauptbahnhof (main station)'],
  ['altstadt-lehel', 'Munich Altstadt (old town)'],
  ['maxvorstadt', 'Maxvorstadt'],
  ['schwabing-west', 'Schwabing'],
  ['au-haidhausen', 'Haidhausen'],
  ['bogenhausen', 'Bogenhausen'],
  ['pasing-obermenzing', 'Pasing'],
  ['freising', 'Freising'],
  ['augsburg', 'Augsburg'],
  ['salzburg', 'Salzburg, Austria'],
];

const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

/** Taxi meter tariff for a regular taxi (kombi row of the mandatory tariff set in the admin). */
async function meterTariff(): Promise<{ base: number; perKm: number }> {
  try {
    const res = await fetch(`${API_URL}/pflichtgebiet`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
    const kombi = (await res.json())?.tarife?.find((t: { vehicle_type: string }) => t.vehicle_type === 'kombi');
    if (kombi?.grundgebuehr > 0 && kombi?.min_per_km > 0) return { base: kombi.grundgebuehr, perKm: kombi.min_per_km };
  } catch { /* fall through */ }
  return { base: 5.9, perKm: 2.45 };
}

const pct = (ours: number, theirs: number) => Math.round((1 - ours / theirs) * 100);

export async function GET() {
  const [rows, meter] = await Promise.all([getAreaPrices(), meterTariff()]);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r])) as Record<string, PricedRow>;
  const hbf = byKey.hbf;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const from = Math.min(...rows.filter((r) => r.group === 'stadt').map((r) => r.quote.kombi));

  const fareTable = FARE_ROWS.flatMap(([key, label]) => {
    const r = byKey[key];
    if (!r) return [];
    return [`| ${label} | ${Math.round(r.km)} km | approx. ${r.min} min | ${eur(r.quote.kombi)} | ${eur(r.quote.van)} |`];
  }).join('\n');

  // Long distance (outside the mandatory tariff area): fixed price vs. what the taxi meter would show.
  const meterRows = (['augsburg', 'salzburg'] as const).flatMap((key) => {
    const r = byKey[key];
    if (!r) return [];
    const metered = Math.round((meter.base + r.km * meter.perKm) * 2) / 2;
    return [`| ${r.name} to Munich Airport (${Math.round(r.km)} km) | ${eur(r.quote.kombi)} | ${eur(metered)} | ${pct(r.quote.kombi, metered)}% cheaper |`];
  }).join('\n');
  const cityLinks = Object.keys(cityLocal)
    .filter((slug) => citiesBySlug[slug])
    .map((slug) => `- [Taxi ${citiesBySlug[slug].name} to Munich Airport](${SITE}/en/blog/${slug}): fixed price, distance, travel time, pickup tips`)
    .join('\n');

  const body = `# Flughafen-München.TAXI (Munich Airport Taxi)

> Fixed-price taxi and airport transfer service to and from Munich Airport (MUC), 24/7. Based in Freising next to the airport, serving Munich, all of Bavaria and Austria. Online booking with the final price shown before booking. Rated 4.9/5 on Google, more than 100,000 passengers transported, 20 years of experience.

Last updated: ${today}. Prices below are live from the booking system.

## Key pages

- [Book a transfer (German)](${SITE}/): enter pickup and destination, see the fixed price, book online
- [Book a transfer (English)](${SITE}/en): English booking page
- [Taxi Munich Airport: all prices and travel times](${SITE}/blog/taxi-flughafen-muenchen): fixed fares from every Munich district, Landkreis München and the region (German)
- [Munich Airport to the city centre](${SITE}/munich-airport-to-city-centre): taxi vs. S-Bahn vs. bus, prices and travel times
- [Messe München transfer](${SITE}/messe-muenchen-transfer): airport to the trade fair centre
- [Meeting points at Munich Airport](${SITE}/treffpunkt-flughafen-muenchen): where the driver waits at Terminal 1, Terminal 2, MAC and GAT
- [Vehicles](${SITE}/vehicles): estate car, van and large taxi with capacities
- [Services](${SITE}/leistungen): overview of all services
- [Business customers](${SITE}/business): corporate accounts and monthly invoicing
- [FAQ](${SITE}/faq): booking, payment, cancellation, child seats, luggage
- [Contact](${SITE}/contact): phone, WhatsApp, e-mail

## Company

- Name: Flughafen-München.TAXI
- Address: Eisvogelweg 2, 85356 Freising, Germany
- Phone and WhatsApp: ${CONTACT_INFO.phone}
- E-mail: ${CONTACT_INFO.email}
- Availability: 24 hours a day, 7 days a week, including public holidays
- Languages: German, English, Turkish
- Google rating: 4.9 / 5
- Experience: 20 years, more than 100,000 passengers

## Vehicles

- Estate car / sedan (Mercedes E-Class): 1 to 3 passengers, up to 3 suitcases
- Van (Mercedes Viano): 4 to 7 passengers, up to 8 suitcases
- Large taxi (Mercedes Vito): 8 passengers, up to 10 suitcases

## Fixed fares to or from Munich Airport (MUC)

Starting prices for one way, calculated by the booking system on ${today}. The exact price for an address is shown in the booking form before booking and does not change with traffic. Tolls, luggage, flight monitoring and 60 minutes of waiting time at the airport are included.

| Pickup / destination | Distance | Travel time | Sedan (1 to 3 pax) | Van (4 to 7 pax) |
|---|---|---|---|---|
${fareTable}

Munich city districts start at ${eur(from)} (sedan). Munich Hauptbahnhof to the airport is about ${Math.round(hbf.km)} km via the A9, approximately ${hbf.min} to 50 minutes depending on traffic.

## Compared with a regular taxi

Munich Hauptbahnhof to the airport costs ${eur(hbf.quote.kombi)} and Messe München to the airport 90 €, the same as the Munich taxi fixed fares. The difference is the service: pre-booked, driver waiting with a name sign, flight monitoring, 60 minutes free waiting, free child seats.

For long-distance rides outside Munich, Landkreis München, Freising and Erding our fixed price is below the taxi meter tariff (${eur(meter.base)} plus ${eur(meter.perKm)} per km):

| Route | Our fixed price (sedan) | Taxi meter | Difference |
|---|---|---|---|
${meterRows}

Groups of 5 to 7 people: a regular taxi takes up to 4 passengers and large taxis are not always available at the taxi rank. A pre-booked van (4 to 7 passengers) is guaranteed, for example Munich Hauptbahnhof to the airport ${eur(hbf.quote.van)}.

## What is included

- Fixed price confirmed before booking
- Flight monitoring: pickup time is adjusted to delays automatically
- 60 minutes free waiting time after landing
- Meet and greet with a name sign in the arrivals area of Terminal 1 or Terminal 2
- Child seats (infant carrier, child seat, booster) free of charge on request
- Help with luggage
- Free cancellation up to 3 hours before pickup
- Payment in cash or by credit card; invoices for companies
- Pets travel in a closed transport box; assistance dogs are exempt

## Town pages (distance, travel time and fixed price to Munich Airport)

${cityLinks}

More than 130 town pages follow the same pattern: ${SITE}/en/blog/taxi-<town>-flughafen-muenchen

## Booking

Book online at ${SITE} (German) or ${SITE}/en (English), by phone or WhatsApp at ${CONTACT_INFO.phone}. Round trips, intermediate stops, group and business bookings are available. Booking at least 24 hours ahead is recommended; for short-notice rides call or message on WhatsApp.
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
