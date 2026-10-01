import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Baby, BadgeCheck, Car, ChevronDown, Clock, CreditCard, Luggage,
  MapPin, MessageCircle, Navigation, Phone, Plane, Route, ShieldCheck, Sunrise, Timer, Users,
} from 'lucide-react';
import { citiesBySlug, allCitySlugs, CityData } from '@/lib/citiesData';
import enTranslations from '@/lib/citiesDataEn';
import { cityGeo } from '@/lib/citiesGeo';
import { cityLocal } from '@/lib/cityLocal';
import { CONTACT_INFO } from '@/lib/utils';
import CityBooking from '@/components/city/CityBooking';
import DepartureCalc from '@/components/city/DepartureCalc';
import RouteSketch from '@/components/city/RouteSketch';
import { cityImages } from '@/lib/cityImages';

export const dynamic = 'force-dynamic';

const CITY_BASE_URL = 'https://flughafen-muenchen.taxi';
const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

type Lang = 'de' | 'en' | 'tr';
type Props = { params: { citySlug: string; locale: string } };
type Prices = { kombi: number; van: number; grossraumtaxi: number | null; live: boolean };

const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

/** Distance / drive time: Google's numbers (citiesGeo) when available. */
function route(city: CityData) {
  const g = cityGeo[city.slug];
  return {
    km: g ? Math.round(g.km) : city.distance_km,
    min: g?.min ?? city.drive_minutes,
    rush: g?.rush_min ?? null,
    night: g?.night_min ?? null,
    road: g?.route || null,
    address: g?.address || `${city.nameDE}`,
  };
}

/** Live prices from the booking price engine (same as checkout), cached 1 h. */
async function livePrices(city: CityData): Promise<Prices> {
  const g = cityGeo[city.slug];
  const fallback: Prices = { kombi: city.kombi_price, van: city.van_price, grossraumtaxi: null, live: false };
  if (!g) return fallback;
  try {
    const res = await fetch(`${API_URL}/popular-routes/city-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: g.lat, lng: g.lng, km: g.km, address: g.address }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error('[city] live price HTTP', res.status); return fallback; }
    const j = await res.json();
    const p = j?.prices || {};
    if (!(p.kombi > 0) || !(p.van > 0)) return fallback;
    return { kombi: p.kombi, van: p.van, grossraumtaxi: p.grossraumtaxi > 0 ? p.grossraumtaxi : null, live: true };
  } catch (e) {
    console.error('[city] live price failed', city.slug, (e as Error)?.message);
    return fallback;
  }
}

const money = (n: number, l: Lang) => (l === 'en'
  ? `€${Number.isInteger(n) ? n : n.toFixed(2)}`
  : `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = citiesBySlug[params.citySlug];
  if (!city) return {};
  const l = lang(params.locale);
  const path = `/blog/${params.citySlug}`;
  const r = route(city);
  const p = await livePrices(city);
  const fit = (...variants: string[]) => variants.find((v) => v.length <= 60) ?? variants[variants.length - 1];
  const c = city.nameDE;
  const price = money(p.kombi, l);
  const copy = l === 'en'
    ? {
        title: fit(`Taxi ${c} to Munich Airport – Fixed Price ${price}`, `Taxi ${c} to Munich Airport – from ${price}`, `Taxi ${c} – Munich Airport from ${price}`, `Taxi ${c} to Munich Airport`, `Taxi ${c} – MUC Airport`),
        description: `Taxi from ${c} to Munich Airport (MUC): ${r.km} km, approx. ${r.min} min. Fixed price from ${price}, 24/7, flight monitoring – see your exact price and book online.`,
      }
    : l === 'tr'
      ? {
          title: fit(`${c} Münih Havalimanı Taksi – Sabit Fiyat ${price}`, `${c} Münih Havalimanı Taksi – ${price}'dan`, `${c} Münih Havalimanı Taksi`, `${c} – MUC Taksi`),
          description: `${c} – Münih Havalimanı (MUC) taksi: ${r.km} km, yaklaşık ${r.min} dk. Sabit fiyat ${price}'dan, 7/24, uçuş takibi – fiyatınızı görün ve online rezervasyon yapın.`,
        }
      : {
          title: fit(`Taxi ${c} Flughafen München – Festpreis ${price}`, `Taxi ${c} Flughafen München – ab ${price}`, `Taxi ${c} – Flughafen München ab ${price}`, `Taxi ${c} Flughafen München`, `Taxi ${c} – Flughafen MUC`),
          description: `Taxi von ${c} zum Flughafen München (MUC): ${r.km} km, ca. ${r.min} Min. Festpreis ab ${price}, 24/7, Flugüberwachung – Preis sofort sehen und online buchen.`,
        };
  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: {
      canonical: l === 'de' ? `${CITY_BASE_URL}${path}` : `${CITY_BASE_URL}/${l}${path}`,
      languages: { de: `${CITY_BASE_URL}${path}`, en: `${CITY_BASE_URL}/en${path}`, tr: `${CITY_BASE_URL}/tr${path}`, 'x-default': `${CITY_BASE_URL}${path}` },
    },
    openGraph: { title: copy.title, description: copy.description, type: 'article' },
  };
}

// Internal links: 8 neighbouring routes (same district / country, similar distance to MUC).
function nearbyCities(city: CityData): CityData[] {
  return allCitySlugs
    .map((slug) => citiesBySlug[slug])
    .filter((c, i, a) => c && c.slug !== city.slug && a.findIndex((x) => x.slug === c.slug) === i)
    .sort((a, b) => {
      const rank = (c: CityData) => (city.district && c.district === city.district ? 0 : 1) + (c.country === city.country ? 0 : 2);
      return rank(a) - rank(b) || Math.abs(a.distance_km - city.distance_km) - Math.abs(b.distance_km - city.distance_km);
    })
    .slice(0, 8);
}

const countryFlag: Record<string, string> = { DE: '🇩🇪', AT: '🇦🇹', CH: '🇨🇭' };

function texts(l: Lang, city: CityData, r: ReturnType<typeof route>, p: Prices) {
  const c = city.nameDE;
  const m = (n: number) => money(n, l);
  const roadDe = r.road ? ` über die ${r.road}` : '';
  const roadEn = r.road ? ` via the ${r.road}` : '';
  const roadTr = r.road ? ` ${r.road} üzerinden` : '';
  if (l === 'en') return {
    home: 'Home', blog: 'Airport transfers', crumb: `Taxi ${c} – Munich Airport`,
    tagline: ['Reliable. Punctual. Stress-free.', `Your direct transfer from ${c} to Munich Airport.`],
    heroFeat: [['Fixed price', 'no hidden costs'], ['Flight monitoring', 'included'], ['60 min waiting', 'free of charge'], ['Families & groups', 'up to 8 people']],
    tabs: ['One way', 'Return trip', 'From the airport'] as [string, string, string], people: ['1–8 passengers', 'Saloon, van & large taxi'] as [string, string],
    vehTitle: 'Our vehicles & prices', tipsTitle2: 'Tips for your ride', faqShort: 'FAQ', rideTitle: `Your ride from ${c}`, allPlaces: 'All places', credits: 'Photos', airportName: 'Munich Airport (MUC)',
    genericTips: [
      r.night ? `Early flight? Before 6 am the roads are clear – allow about ${r.night} minutes.` : 'Early flight? We drive around the clock – also at 4 am.',
      r.rush ? `Rush hour (7–9 am) takes about ${r.rush} minutes – our pickup calculator includes it.` : 'Book the evening before – we confirm within minutes.',
      'Families and groups up to 8 people travel in a van or large taxi at a fixed price.',
      'Arriving at MUC? We track your flight and wait 60 minutes free of charge.',
    ],
    h1a: `Taxi ${c}`, h1b: 'to Munich Airport',
    priceFrom: 'Fixed price from',
    facts: `${r.km} km · approx. ${r.min} min${roadEn} · 24/7`,
    trust: ['Fixed price before you book', 'Flight monitoring', '60 min free waiting', 'Free cancellation up to 3 h'],
    formHint: `Pickup is pre-filled with ${c} – add street & house number for your exact price.`,
    call: 'Call', whatsapp: 'WhatsApp',
    pricesTitle: `Prices: ${c} → Munich Airport`,
    pricesSub: `Fixed prices from the centre of ${c}, incl. tolls, flight monitoring and waiting time. Your exact price for your address appears in the booking form.`,
    vehicles: [
      { name: 'Saloon / Estate', pax: '1–3 passengers', bags: 'up to 3 suitcases', note: 'Ideal for 1–3 travellers' },
      { name: 'Van', pax: '4–7 passengers', bags: 'up to 8 suitcases', note: 'Popular with families', badge: 'Popular' },
      { name: 'Large taxi', pax: '8 passengers', bags: 'up to 10 suitcases', note: 'Groups & lots of luggage' },
    ],
    from: 'from', book: 'Book now',
    routeTitle: 'Route & travel time',
    routeGeneric: `From ${c} to Munich Airport it is about ${r.km} km${roadEn}. At normal traffic the ride takes around ${r.min} minutes${r.rush ? `, in the morning rush hour about ${r.rush} minutes` : ''}${r.night ? ` and early in the morning only around ${r.night} minutes` : ''}.`,
    slots: ['Early morning', 'Normal traffic', 'Rush hour'], unit: 'min',
    calc: { title: 'When should we pick you up?', flightTime: 'Departure time', flightType: 'Flight', eu: 'Schengen / EU', intl: 'International', result: 'Recommended pickup time', drive: 'Drive', airport: 'At the airport', buffer: 'Buffer', note: 'Rule of thumb: 2 h before EU flights, 3 h before long-haul. Check your airline’s recommendation.', unit: 'min' },
    stepsTitle: 'How it works',
    steps: [
      ['Enter address & date', 'Price appears instantly – fixed, no taximeter.'],
      ['Book in 1 minute', 'Pay cash, by card or invoice. Confirmation by e-mail.'],
      ['Driver at your door', 'On arrival we track your flight and wait with a name sign.'],
    ],
    localTitle: `Taxi in ${c} – good to know`, pickupsTitle: 'Popular pickup points', tipsTitle: 'Tips',
    inclTitle: 'Always included',
    incl: [
      ['Fixed price', 'No traffic surcharge, tolls included'], ['Flight monitoring', 'We adjust to delays'],
      ['60 min free waiting', 'On airport pickups'], ['Meet & greet', 'Name sign in the arrivals hall'],
      ['Child seats free', 'Please state when booking'], ['Cash, card, invoice', 'Invoices for companies'],
    ],
    aboutTitle: `About ${c}`, stats: ['Residents', 'Growth', 'Area', 'Elevation'], historyTitle: 'History', sightsTitle: 'Sights', knownFor: 'Known for',
    faqTitle: `FAQ – Taxi ${c} to Munich Airport`,
    faqs: [
      { q: `How much is a taxi from ${c} to Munich Airport?`, a: `The fixed price from the centre of ${c} starts at ${m(p.kombi)} for a saloon (1–3 people) and ${m(p.van)} for a van (up to 7)${p.grossraumtaxi ? `; the large taxi for 8 people costs from ${m(p.grossraumtaxi)}` : ''}. The price is confirmed before you book – no taximeter, no surcharges for traffic.` },
      { q: `How long does the ride take?`, a: `About ${r.min} minutes for ${r.km} km${roadEn}${r.rush ? `; in the morning rush hour around ${r.rush} minutes` : ''}${r.night ? `, early in the morning around ${r.night} minutes` : ''}.` },
      { q: 'When should I leave for my flight?', a: 'Plan to be at the airport 2 hours before EU flights and 3 hours before long-haul flights, plus the drive time. The calculator above gives you a pickup time.' },
      { q: `Do you also pick me up at Munich Airport to ${c}?`, a: 'Yes. We monitor your flight, wait up to 60 minutes free of charge after landing and meet you with a name sign in the arrivals hall.' },
      { q: 'Can I pay by card?', a: 'Yes – cash, credit card or invoice (for companies). Cancellation is free up to 3 hours before pickup.' },
      { q: 'Do you have child seats?', a: 'Yes, child seats and boosters are free of charge – just state the age of your child when booking.' },
    ],
    moreTitle: 'More taxi routes to Munich Airport', moreSub: '→ Munich Airport', moreLabel: (n: string) => `Taxi ${n} – Munich Airport`,
    ctaTitle: `Book your taxi from ${c} now`, ctaSub: `Fixed price from ${m(p.kombi)} · 24/7 · instant confirmation`, ctaBook: 'Calculate price',
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', blog: 'Havalimanı transferi', crumb: `${c} – Münih Havalimanı taksi`,
    tagline: ['Güvenilir. Dakik. Stressiz.', `${c}’dan Münih Havalimanı’na doğrudan transfer.`],
    heroFeat: [['Sabit fiyat', 'gizli ücret yok'], ['Uçuş takibi', 'dahil'], ['60 dk bekleme', 'ücretsiz'], ['Aile ve gruplar', '8 kişiye kadar']],
    tabs: ['Tek yön', 'Gidiş-dönüş', 'Havalimanından'] as [string, string, string], people: ['1–8 kişi', 'Binek, Van ve büyük taksi'] as [string, string],
    vehTitle: 'Araçlarımız ve fiyatlar', tipsTitle2: 'Yolculuk ipuçları', faqShort: 'Sık sorulanlar', rideTitle: `${c}’dan yolculuğunuz`, allPlaces: 'Tüm yerler', credits: 'Fotoğraflar', airportName: 'Münih Havalimanı (MUC)',
    genericTips: [
      r.night ? `Erken uçuş mu? Saat 6’dan önce yollar boştur – yaklaşık ${r.night} dakika hesaplayın.` : 'Erken uçuş mu? Gece 4’te de 7/24 yoldayız.',
      r.rush ? `Sabah iş trafiğinde (7–9) yolculuk yaklaşık ${r.rush} dakika – hesaplayıcımız bunu dikkate alır.` : 'Bir akşam önceden rezervasyon yapın – dakikalar içinde onaylıyoruz.',
      '8 kişiye kadar aile ve gruplar sabit fiyatlı Van veya büyük taksiyle gider.',
      'MUC’a mı iniyorsunuz? Uçuşunuzu takip eder, 60 dakika ücretsiz bekleriz.',
    ],
    h1a: `${c}`, h1b: 'Münih Havalimanı taksi',
    priceFrom: 'Sabit fiyat',
    facts: `${r.km} km · yaklaşık ${r.min} dk${roadTr} · 7/24`,
    trust: ['Rezervasyondan önce sabit fiyat', 'Uçuş takibi', '60 dk ücretsiz bekleme', '3 saate kadar ücretsiz iptal'],
    formHint: `Alış yeri ${c} olarak dolu – kesin fiyat için sokak ve kapı numarasını ekleyin.`,
    call: 'Ara', whatsapp: 'WhatsApp',
    pricesTitle: `Fiyatlar: ${c} → Münih Havalimanı`,
    pricesSub: `${c} merkezinden sabit fiyatlar; otoyol ücreti, uçuş takibi ve bekleme dahil. Adresinize göre kesin fiyat rezervasyon formunda görünür.`,
    vehicles: [
      { name: 'Binek / Kombi', pax: '1–3 kişi', bags: '3 valize kadar', note: '1–3 yolcu için ideal' },
      { name: 'Van', pax: '4–7 kişi', bags: '8 valize kadar', note: 'Aileler için en çok tercih edilen', badge: 'Popüler' },
      { name: 'Büyük taksi', pax: '8 kişi', bags: '10 valize kadar', note: 'Gruplar ve çok bagaj' },
    ],
    from: 'başlangıç', book: 'Rezervasyon',
    routeTitle: 'Güzergâh ve yolculuk süresi',
    routeGeneric: `${c}’dan Münih Havalimanı’na yaklaşık ${r.km} km${roadTr}. Normal trafikte yolculuk yaklaşık ${r.min} dakika${r.rush ? `, sabah iş trafiğinde yaklaşık ${r.rush} dakika` : ''}${r.night ? `, sabahın erken saatlerinde ise yalnızca ${r.night} dakika` : ''} sürer.`,
    slots: ['Sabah erken', 'Normal trafik', 'İş trafiği'], unit: 'dk',
    calc: { title: 'Sizi ne zaman alalım?', flightTime: 'Kalkış saati', flightType: 'Uçuş', eu: 'Schengen / AB', intl: 'Uluslararası', result: 'Önerilen alış saati', drive: 'Yol', airport: 'Havalimanında', buffer: 'Tampon', note: 'Kural: AB uçuşlarında 2 saat, uzun mesafede 3 saat önce havalimanında olun. Havayolunuzun önerisini kontrol edin.', unit: 'dk' },
    stepsTitle: 'Nasıl çalışır?',
    steps: [
      ['Adres ve tarihi girin', 'Fiyat hemen görünür – sabit, taksimetre yok.'],
      ['1 dakikada rezervasyon', 'Nakit, kart veya fatura. Onay e-postayla gelir.'],
      ['Şoför kapınızda', 'Varışta uçuşunuzu takip eder, isim tabelasıyla bekleriz.'],
    ],
    localTitle: `${c}’da taksi – bilmeniz gerekenler`, pickupsTitle: 'Sık alış noktaları', tipsTitle: 'İpuçları',
    inclTitle: 'Her zaman dahil',
    incl: [
      ['Sabit fiyat', 'Trafik zammı yok, otoyol dahil'], ['Uçuş takibi', 'Rötara göre ayarlanır'],
      ['60 dk ücretsiz bekleme', 'Havalimanı karşılamada'], ['Karşılama', 'Varış salonunda isim tabelası'],
      ['Çocuk koltuğu ücretsiz', 'Rezervasyonda belirtin'], ['Nakit, kart, fatura', 'Firmalara fatura'],
    ],
    aboutTitle: `${c} hakkında`, stats: ['Nüfus', 'Büyüme', 'Yüzölçümü', 'Rakım'], historyTitle: 'Tarihçe', sightsTitle: 'Görülecek yerler', knownFor: 'Bilinen',
    faqTitle: `Sık sorulan sorular – ${c} Münih Havalimanı taksi`,
    faqs: [
      { q: `${c}’dan Münih Havalimanı’na taksi ne kadar?`, a: `${c} merkezinden sabit fiyat binek araç (1–3 kişi) için ${m(p.kombi)}, Van (7 kişiye kadar) için ${m(p.van)}’dan başlar${p.grossraumtaxi ? `; 8 kişilik büyük taksi ${m(p.grossraumtaxi)}’dan` : ''}. Fiyat rezervasyondan önce kesinleşir – taksimetre ve trafik zammı yok.` },
      { q: 'Yolculuk ne kadar sürer?', a: `${r.km} km için yaklaşık ${r.min} dakika${r.rush ? `; sabah iş trafiğinde yaklaşık ${r.rush} dakika` : ''}${r.night ? `, sabah erken saatlerde yaklaşık ${r.night} dakika` : ''}.` },
      { q: 'Uçuşum için ne zaman yola çıkmalıyım?', a: 'AB uçuşlarında 2 saat, uzun mesafe uçuşlarında 3 saat önce havalimanında olun, buna yol süresini ekleyin. Yukarıdaki hesaplayıcı size alış saatini verir.' },
      { q: `Havalimanından ${c}’a da alıyor musunuz?`, a: 'Evet. Uçuşunuzu takip eder, inişten sonra 60 dakika ücretsiz bekler ve varış salonunda isim tabelasıyla karşılarız.' },
      { q: 'Kartla ödeyebilir miyim?', a: 'Evet – nakit, kredi kartı veya fatura (firmalar). Alış saatinden 3 saat öncesine kadar iptal ücretsizdir.' },
      { q: 'Çocuk koltuğu var mı?', a: 'Evet, çocuk koltuğu ve yükseltici ücretsizdir – rezervasyonda çocuğun yaşını belirtmeniz yeterli.' },
    ],
    moreTitle: 'Münih Havalimanı’na diğer taksi güzergâhları', moreSub: '→ Münih Havalimanı', moreLabel: (n: string) => `${n} – Münih Havalimanı`,
    ctaTitle: `${c}’dan taksinizi şimdi ayırtın`, ctaSub: `Sabit fiyat ${m(p.kombi)}’dan · 7/24 · anında onay`, ctaBook: 'Fiyat hesapla',
  };
  return {
    home: 'Startseite', blog: 'Flughafentransfer', crumb: `Taxi ${c} – Flughafen München`,
    tagline: ['Zuverlässig. Pünktlich. Stressfrei.', `Ihr direkter Transfer von ${c} zum Münchner Flughafen.`],
    heroFeat: [['Festpreis', 'ohne versteckte Kosten'], ['Flugüberwachung', 'inklusive'], ['60 Min. Wartezeit', 'gratis'], ['Für Familien', 'und Gruppen bis 8']],
    tabs: ['Einfache Fahrt', 'Hin- und Rückfahrt', 'Abholung am Flughafen'] as [string, string, string], people: ['1–8 Personen', 'Kombi, Van & Großraumtaxi'] as [string, string],
    vehTitle: 'Unsere Fahrzeuge & Preise', tipsTitle2: 'Tipps für Ihre Fahrt', faqShort: 'Häufige Fragen', rideTitle: `Ihre Fahrt ab ${c}`, allPlaces: 'Alle Orte ansehen', credits: 'Bildnachweis', airportName: 'Flughafen München (MUC)',
    genericTips: [
      r.night ? `Frühflug? Vor 6 Uhr sind die Straßen frei – rechnen Sie mit rund ${r.night} Minuten.` : 'Frühflug? Wir fahren rund um die Uhr – auch um 4 Uhr morgens.',
      r.rush ? `Im Berufsverkehr (7–9 Uhr) dauert die Fahrt etwa ${r.rush} Minuten – unser Abholzeit-Rechner berücksichtigt das.` : 'Am Vorabend buchen – wir bestätigen innerhalb weniger Minuten.',
      'Familien und Gruppen bis 8 Personen fahren im Van oder Großraumtaxi zum Festpreis.',
      'Landung in MUC? Wir verfolgen Ihren Flug und warten 60 Minuten kostenlos.',
    ],
    h1a: `Taxi ${c}`, h1b: 'zum Flughafen München',
    priceFrom: 'Festpreis ab',
    facts: `${r.km} km · ca. ${r.min} Min.${roadDe} · rund um die Uhr`,
    trust: ['Festpreis vor der Buchung', 'Flugüberwachung', '60 Min. Wartezeit gratis', 'Kostenlos stornieren bis 3 Std.'],
    formHint: `Abholort ist mit ${c} vorausgefüllt – Straße & Hausnummer ergänzen für Ihren exakten Preis.`,
    call: 'Anrufen', whatsapp: 'WhatsApp',
    pricesTitle: `Preise: ${c} → Flughafen München`,
    pricesSub: `Festpreise ab Ortsmitte ${c}, inklusive Maut, Flugüberwachung und Wartezeit. Den exakten Preis für Ihre Adresse zeigt das Buchungsformular sofort an.`,
    vehicles: [
      { name: 'Kombi / Limousine', pax: '1–3 Personen', bags: 'bis 3 Koffer', note: 'Ideal für 1–3 Reisende' },
      { name: 'Van', pax: '4–7 Personen', bags: 'bis 8 Koffer', note: 'Beliebt bei Familien', badge: 'Beliebt' },
      { name: 'Großraumtaxi', pax: '8 Personen', bags: 'bis 10 Koffer', note: 'Gruppen & viel Gepäck' },
    ],
    from: 'ab', book: 'Jetzt buchen',
    routeTitle: 'Strecke & Fahrzeit',
    routeGeneric: `Von ${c} zum Flughafen München sind es rund ${r.km} km${roadDe}. Bei normalem Verkehr dauert die Fahrt etwa ${r.min} Minuten${r.rush ? `, im morgendlichen Berufsverkehr etwa ${r.rush} Minuten` : ''}${r.night ? ` und frühmorgens nur rund ${r.night} Minuten` : ''}.`,
    slots: ['Frühmorgens', 'Normaler Verkehr', 'Berufsverkehr'], unit: 'Min.',
    calc: { title: 'Wann sollen wir Sie abholen?', flightTime: 'Abflugzeit', flightType: 'Flug', eu: 'Schengen / EU', intl: 'Interkontinental', result: 'Empfohlene Abholzeit', drive: 'Fahrt', airport: 'Am Flughafen', buffer: 'Puffer', note: 'Faustregel: 2 Std. vor EU-Flügen, 3 Std. vor Langstrecke am Flughafen sein. Bitte die Empfehlung Ihrer Airline beachten.', unit: 'Min.' },
    stepsTitle: 'So einfach geht’s',
    steps: [
      ['Adresse & Termin eingeben', 'Der Preis erscheint sofort – fest, ohne Taxameter.'],
      ['In 1 Minute buchen', 'Bar, Karte oder Rechnung. Bestätigung per E-Mail.'],
      ['Fahrer vor der Tür', 'Bei Ankunft verfolgen wir Ihren Flug und warten mit Namensschild.'],
    ],
    localTitle: `Taxi in ${c} – gut zu wissen`, pickupsTitle: 'Beliebte Abholorte', tipsTitle: 'Tipps',
    inclTitle: 'Immer inklusive',
    incl: [
      ['Festpreis', 'Kein Stauzuschlag, Maut inklusive'], ['Flugüberwachung', 'Wir passen uns Verspätungen an'],
      ['60 Min. Wartezeit gratis', 'Bei Abholung am Flughafen'], ['Meet & Greet', 'Namensschild im Ankunftsbereich'],
      ['Kindersitz kostenlos', 'Bitte bei Buchung angeben'], ['Bar, Karte, Rechnung', 'Rechnung für Firmen'],
    ],
    aboutTitle: `Über ${c}`, stats: ['Einwohner', 'Wachstum', 'Fläche', 'Höhe ü. NN'], historyTitle: 'Geschichte', sightsTitle: 'Sehenswürdigkeiten', knownFor: 'Bekannt für',
    faqTitle: `Häufige Fragen – Taxi ${c} Flughafen München`,
    faqs: [
      { q: `Was kostet ein Taxi von ${c} zum Flughafen München?`, a: `Der Festpreis ab Ortsmitte ${c} beginnt bei ${m(p.kombi)} für Kombi/Limousine (1–3 Personen) und ${m(p.van)} für den Van (bis 7 Personen)${p.grossraumtaxi ? `; das Großraumtaxi für 8 Personen kostet ab ${m(p.grossraumtaxi)}` : ''}. Der Preis steht vor der Buchung fest – kein Taxameter, kein Stauzuschlag.` },
      { q: `Wie lange dauert die Fahrt von ${c} zum Flughafen?`, a: `Etwa ${r.min} Minuten für ${r.km} km${roadDe}${r.rush ? `; im morgendlichen Berufsverkehr rund ${r.rush} Minuten` : ''}${r.night ? `, frühmorgens rund ${r.night} Minuten` : ''}.` },
      { q: 'Wann sollte ich zum Flughafen losfahren?', a: 'Planen Sie 2 Stunden vor EU-Flügen und 3 Stunden vor Langstreckenflügen am Flughafen ein – plus die Fahrzeit. Der Abholzeit-Rechner oben gibt Ihnen eine Uhrzeit.' },
      { q: `Holen Sie mich auch am Flughafen ab und fahren nach ${c}?`, a: 'Ja. Wir verfolgen Ihren Flug, warten nach der Landung bis zu 60 Minuten kostenlos und empfangen Sie mit Namensschild im Ankunftsbereich.' },
      { q: 'Kann ich mit Karte bezahlen?', a: 'Ja – bar, mit Kreditkarte oder auf Rechnung (Firmenkunden). Bis 3 Stunden vor Abholung stornieren Sie kostenlos.' },
      { q: 'Gibt es Kindersitze?', a: 'Ja, Kindersitze und Sitzerhöhungen sind kostenlos – bitte bei der Buchung das Alter des Kindes angeben.' },
    ],
    moreTitle: 'Weitere Taxi-Strecken zum Flughafen München', moreSub: '→ Flughafen München', moreLabel: (n: string) => `Taxi ${n} – Flughafen München`,
    ctaTitle: `Jetzt Taxi von ${c} buchen`, ctaSub: `Festpreis ab ${m(p.kombi)} · rund um die Uhr · Sofortbestätigung`, ctaBook: 'Preis berechnen',
  };
}

const AIRPORT_LNG = 11.7861;

export default async function CityBlogPage({ params }: Props) {
  const city: CityData | undefined = citiesBySlug[params.citySlug];
  if (!city) notFound();
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const r = route(city);
  const p = await livePrices(city);
  const t = texts(l, city, r, p);
  const local = cityLocal[city.slug];
  const img = cityImages[city.slug];
  const geo = cityGeo[city.slug];

  // City texts per language; TR only when written (otherwise hidden — no German on /tr).
  const en = enTranslations[city.slug];
  const about = l === 'de'
    ? { description: city.description, history: city.history, known_for: city.known_for, sights: city.sights }
    : l === 'en'
      ? { description: en?.description ?? city.description_en ?? '', history: en?.history ?? city.history_en ?? '', known_for: en?.known_for ?? city.known_for_en ?? '', sights: en?.sights ?? [] }
      : local?.tr ?? null;

  const vehicles = [
    { ...t.vehicles[0], price: p.kombi, photo: '/images/kombi.webp' },
    { ...t.vehicles[1], price: p.van, photo: '/images/van.webp' },
    ...(p.grossraumtaxi ? [{ ...t.vehicles[2], price: p.grossraumtaxi, photo: '/images/grossraumtaxi.webp' }] : []),
  ];
  const slots = [
    { label: t.slots[0], min: r.night, Icon: Sunrise, bar: 'bg-emerald-500' },
    { label: t.slots[1], min: r.min, Icon: Users, bar: 'bg-amber-400' },
    { label: t.slots[2], min: r.rush, Icon: Car, bar: 'bg-red-500' },
  ].filter((s) => s.min);
  const maxSlot = Math.max(...slots.map((s) => s.min || 0), 1);
  const heroIcons = [BadgeCheck, ShieldCheck, Timer, Users];
  const inclIcons = [BadgeCheck, Plane, Timer, Users, Baby, CreditCard];
  const tipIcons = [Clock, Route, Users, Plane];
  const tips = local?.tips[l] ?? t.genericTips;
  const nearby = nearbyCities(city);
  const usedImages = [city.slug, ...nearby.map((c) => c.slug)].filter((s) => cityImages[s]);

  const pageUrl = `${CITY_BASE_URL}${prefix}/blog/${city.slug}`;
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'TaxiService',
      name: t.crumb,
      url: pageUrl,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: CITY_BASE_URL, address: { '@type': 'PostalAddress', streetAddress: 'Eisvogelweg 2', postalCode: '85356', addressLocality: 'Freising', addressCountry: 'DE' } },
      areaServed: [{ '@type': 'City', name: city.nameDE }, { '@type': 'Airport', name: 'Flughafen München', iataCode: 'MUC' }],
      offers: vehicles.map((v) => ({ '@type': 'Offer', name: v.name, price: v.price.toFixed(2), priceCurrency: 'EUR' })),
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: `${CITY_BASE_URL}${prefix}` },
        { '@type': 'ListItem', position: 2, name: t.blog, item: `${CITY_BASE_URL}/blog/taxi-flughafen-muenchen` },
        { '@type': 'ListItem', position: 3, name: t.crumb, item: pageUrl },
      ],
    },
  ];

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      {/* ── Hero: airport photo, city photo blended in on the left ─────────── */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/images/cities/${city.slug}.webp`} alt="" className="absolute inset-y-0 left-0 h-full w-full object-cover sm:w-3/5 [mask-image:linear-gradient(to_right,black_45%,transparent)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/80 via-primary-900/45 to-primary-900/5" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary-900/70 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-32">
          <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link>
            <ArrowRight size={12} />
            <Link href={`${prefix}/blog/taxi-flughafen-muenchen`} className="hover:text-white">{t.blog}</Link>
            <ArrowRight size={12} />
            <span className="text-white">{t.crumb}</span>
          </nav>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {l === 'tr'
              ? <><span className="text-gold-400">{city.nameDE}</span> – {t.h1b}</>
              : <>{l === 'en' ? 'Taxi' : 'Taxi'} <span className="text-gold-400">{city.nameDE}</span> {t.h1b}</>}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/90 drop-shadow md:text-xl">{t.tagline[0]}<br />{t.tagline[1]}</p>
          <div className="mt-5 inline-flex items-baseline gap-2 rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
            <span className="text-sm text-white/80">{t.priceFrom}</span>
            <span className="text-3xl font-extrabold text-gold-400">{money(p.kombi, l)}</span>
            <span className="hidden text-sm text-white/70 sm:inline">· {t.facts}</span>
          </div>
          <ul className="mt-7 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {t.heroFeat.map(([a, b], i) => {
              const Icon = heroIcons[i];
              return (
                <li key={a} className="flex items-center gap-2.5">
                  <Icon size={28} className="shrink-0 text-gold-400" />
                  <span className="text-sm leading-tight"><b className="block">{a}</b><span className="text-white/75">{b}</span></span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* ── Booking card (overlaps the hero) ─────────────────────────────── */}
        <div id="booking" className="-mt-20 scroll-mt-28">
          <CityBooking pickup={r.address.replace(/, (Deutschland|Österreich|Schweiz)$/, '')} tabs={t.tabs} people={t.people} />
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><Navigation size={13} className="text-gold-600" /> {t.formHint}</span>
            <span className="flex items-center gap-4">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:underline"><Phone size={13} /> {CONTACT_INFO.phone}</a>
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"><MessageCircle size={13} /> {t.whatsapp}</a>
            </span>
          </p>
        </div>

        {/* ── Vehicles & prices (dark panel) + route card ─────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.75fr_1fr]">
          <section className="rounded-2xl bg-primary-900 p-5 text-white shadow-lg md:p-6">
            <h2 className="text-2xl font-extrabold">{t.vehTitle}</h2>
            <p className="mt-1 text-sm text-white/80">{t.pricesSub}</p>
            <div className={`mt-5 grid gap-4 ${vehicles.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {vehicles.map((v, i) => (
                <div key={v.name} className={`relative flex flex-col overflow-hidden rounded-xl bg-white text-gray-900 ${i === 1 ? 'ring-[3px] ring-gold-400' : ''}`}>
                  {'badge' in v && v.badge && <span className="absolute right-2 top-2 z-10 rounded-full bg-gold-400 px-2.5 py-0.5 text-[11px] font-bold text-primary-900 shadow">{v.badge}</span>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.photo} alt={v.name} loading="lazy" className="h-28 w-full object-cover" />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="font-bold">{v.name}</div>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><Users size={14} className="text-gray-400" /> {v.pax}</li>
                      <li className="flex items-center gap-2"><Luggage size={14} className="text-gray-400" /> {v.bags}</li>
                    </ul>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-sm text-gray-500">{t.from}</span>
                      <span className="text-3xl font-extrabold tracking-tight text-primary-800">{money(v.price, l)}</span>
                    </div>
                    <a href="#booking" className={`mt-4 rounded-lg px-3 py-2 text-center text-sm font-bold transition ${i === 1 ? 'bg-gold-400 text-primary-900 hover:bg-gold-300' : 'border-2 border-primary-800 text-primary-800 hover:bg-primary-800 hover:text-white'}`}>{t.book}</a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><Car size={24} className="text-primary-700" /> {t.routeTitle}</h2>
            <div className="mt-4">
              <RouteSketch city={city.nameDE} airport={t.airportName} road={r.road} cityWest={(geo?.lng ?? 0) < AIRPORT_LNG} />
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm font-semibold text-gray-900">
              <span className="inline-flex items-center gap-1.5"><MapPin size={16} className="text-primary-700" /> {r.km} km</span>
              {r.road && <span className="inline-flex items-center gap-1.5"><Route size={16} className="text-primary-700" /> {r.road}</span>}
              <span className="inline-flex items-center gap-1.5"><Clock size={16} className="text-primary-700" /> ~{r.min} {t.unit}</span>
            </div>
            {slots.length > 1 && (
              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                {slots.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="flex w-36 shrink-0 items-center gap-2 text-sm text-gray-600"><s.Icon size={15} className="text-gray-400" /> {s.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${((s.min || 0) / maxSlot) * 100}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">{s.min} {t.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Included strip ───────────────────────────────────────────────── */}
        <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-200 shadow-sm ring-1 ring-gray-200 md:grid-cols-3">
          {t.incl.map(([title, sub], i) => {
            const Icon = inclIcons[i] || ShieldCheck;
            return (
              <div key={title} className="flex items-start gap-3 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-800"><Icon size={18} /></span>
                <div className="min-w-0">
                  <div className="hyphens-auto break-words text-[13px] font-bold text-gray-900 sm:text-sm">{title}</div>
                  <div className="text-xs text-gray-500">{sub}</div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── About | Tips | FAQ ───────────────────────────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {about && about.description ? (
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
              <h2 className="px-5 pt-5 text-2xl font-extrabold text-gray-900">{t.aboutTitle}</h2>
              {img && (
                <figure className="mx-5 mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/cities/${city.slug}.webp`} alt={city.nameDE} loading="lazy" className="h-44 w-full rounded-xl object-cover" />
                  <figcaption className="mt-1 text-[10px] text-gray-400">Foto: {img.artist}, <a href={img.source} target="_blank" rel="noopener noreferrer nofollow" className="underline">{img.license}</a></figcaption>
                </figure>
              )}
              <p className="px-5 pt-3 text-sm leading-relaxed text-gray-700">{about.description}</p>
              <dl className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-2">
                {[
                  [t.stats[0], city.population.toLocaleString('de-DE')],
                  [t.stats[1], city.population_growth],
                  [t.stats[2], `${city.area_km2} km²`],
                  [t.stats[3], `${city.elevation_m} m`],
                ].map(([k, v]) => (
                  <div key={k}><dd className="text-sm font-bold text-gray-900">{v}</dd><dt className="text-[11px] text-gray-500">{k}</dt></div>
                ))}
              </dl>
            </section>
          ) : <div className="hidden lg:block" />}

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.tipsTitle2}</h2>
            <ul className="mt-4 space-y-4">
              {tips.map((x, i) => {
                const Icon = tipIcons[i % tipIcons.length];
                return (
                  <li key={x} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Icon size={17} /></span>{x}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.faqShort}</h2>
            <div className="mt-4 space-y-2">
              {t.faqs.map(({ q, a }) => (
                <details key={q} className="group rounded-lg ring-1 ring-gray-200 open:ring-gold-300">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-gray-800">
                    {q}<span className="shrink-0 text-lg leading-none text-gray-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="px-3 pb-3 text-sm leading-relaxed text-gray-600">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ── Ride details: route text, pickup points, history | pickup-time calculator ── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.rideTitle}</h2>
            <p className="mt-3 leading-relaxed text-gray-700">{local?.route[l] ?? t.routeGeneric}</p>
            {local && (
              <>
                <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-gold-700">{t.pickupsTitle}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {local.pickups[l].map((x) => (
                    <li key={x} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"><MapPin size={13} className="text-gold-600" /> {x}</li>
                  ))}
                </ul>
              </>
            )}
            {about && (about.history || about.sights.length > 0) && (
              <details className="group mt-5 border-t border-gray-100 pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-gray-900">
                  {t.historyTitle} & {t.sightsTitle}
                  <ChevronDown size={16} className="text-gold-600 transition group-open:rotate-180" />
                </summary>
                {about.history && <p className="mt-3 text-sm leading-relaxed text-gray-700">{about.history}</p>}
                {about.sights.length > 0 && (
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {about.sights.map((s, i) => (
                      <li key={s} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[11px] font-bold text-primary-900">{i + 1}</span>{s}
                      </li>
                    ))}
                  </ul>
                )}
                {about.known_for && <p className="mt-3 text-xs text-gray-500"><b className="text-gray-700">{t.knownFor}:</b> {about.known_for}</p>}
              </details>
            )}
          </section>
          <DepartureCalc min={r.min} rush={r.rush} night={r.night} t={t.calc} />
        </div>
      </div>

      {/* ── More routes with city photos (dark band) ─────────────────────── */}
      <section className="relative mt-12 overflow-hidden bg-primary-900 py-10 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">{t.moreTitle}</h2>
            <Link href={`${prefix}/blog/taxi-flughafen-muenchen`} className="rounded-lg px-4 py-2 text-sm font-bold ring-1 ring-white/40 hover:bg-white hover:text-primary-900">{t.allPlaces} →</Link>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {nearby.map((c) => (
              <li key={c.slug}>
                <Link href={`${prefix}/blog/${c.slug}`} className="group block h-full overflow-hidden rounded-xl bg-white text-gray-900 shadow transition hover:-translate-y-0.5">
                  {cityImages[c.slug]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/images/cities/${c.slug}-sm.webp`} alt={c.nameDE} loading="lazy" className="h-20 w-full object-cover" />
                    : <div className="flex h-20 items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 text-white/70"><MapPin size={22} /></div>}
                  <div className="flex items-center justify-between gap-1 p-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{c.nameDE}</span>
                      <span className="block text-[11px] text-gray-500">→ MUC · {Math.round(cityGeo[c.slug]?.km ?? c.distance_km)} km</span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-gray-400 group-hover:text-gold-600" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-gold-400 to-gold-500 p-8 text-center md:p-12">
          <h2 className="text-2xl font-extrabold text-primary-900 md:text-3xl">{t.ctaTitle}</h2>
          <p className="mt-2 text-primary-900/80">{t.ctaSub}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#booking" className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white transition hover:bg-primary-800">{t.ctaBook} →</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 transition hover:bg-primary-900 hover:text-white">
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </section>
        {usedImages.length > 0 && (
          <p className="mt-6 text-[10px] leading-relaxed text-gray-400">
            {t.credits}: {usedImages.map((s, i) => (
              <span key={s}>{i > 0 && ' · '}{citiesBySlug[s]?.nameDE}: {cityImages[s].artist} (<a href={cityImages[s].source} target="_blank" rel="noopener noreferrer nofollow" className="underline">{cityImages[s].license}</a>)</span>
            ))} · Wikimedia Commons
          </p>
        )}
      </div>
    </div>
  );
}
