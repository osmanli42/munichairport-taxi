import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Baby, BadgeCheck, Building2, Car, ChevronDown, Clock, CreditCard, Luggage, MapPin,
  MessageCircle, Navigation, PawPrint, Phone, Plane, PlaneLanding, Route, ShieldCheck, Sunrise, Timer, Users,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { citiesBySlug } from '@/lib/citiesData';
import { cityGeo } from '@/lib/citiesGeo';
import { cityImages } from '@/lib/cityImages';
import CityBooking from '@/components/city/CityBooking';
import DepartureCalc from '@/components/city/DepartureCalc';
import RouteSketch from '@/components/city/RouteSketch';
import PriceTabs from '@/components/city/PriceTabs';
import { eur, getAreaPrices, type PricedRow } from '@/lib/blogAirportPrices';

// Same page template as the city pages (/blog/taxi-<ort>-flughafen-muenchen), for Munich itself.
// Prices come live from the booking price engine (cached 1 h per request).
export const dynamic = 'force-dynamic';

const SITE = 'https://flughafen-muenchen.taxi';
const AIRPORT_LNG = 11.7861;

const cheapestMunich = (rows: PricedRow[]) => Math.min(...rows.filter((r) => r.group === 'stadt').map((r) => r.quote.kombi));

export async function generateMetadata(): Promise<Metadata> {
  const rows = await getAreaPrices();
  const from = eur(cheapestMunich(rows));
  const title = `Taxi Flughafen München ab ${from}: Preise & Fahrzeit`;
  return {
    title: { absolute: title },
    description: `Taxi zum Flughafen München ab ${from} Festpreis: alle Preise aus München und Umland, Fahrtdauer, Fahrzeuge und Tipps. 24/7, mit Flugüberwachung.`,
    alternates: { canonical: '/blog/taxi-flughafen-muenchen' },
    openGraph: {
      title,
      description: `Festpreise ab ${from}, Fahrer am Ausgang, Kindersitz kostenlos.`,
      url: `${SITE}/blog/taxi-flughafen-muenchen`,
      images: [{ url: `${SITE}/images/hero-airport.webp` }],
      type: 'article',
    },
  };
}

const VEHICLES = [
  { key: 'kombi' as const, name: 'Kombi / Limousine', pax: '1 bis 3 Personen', bags: 'bis 3 Koffer', photo: '/images/kombi.webp', badge: '' },
  { key: 'van' as const, name: 'Van', pax: '4 bis 7 Personen', bags: 'bis 8 Koffer', photo: '/images/van.webp', badge: 'Beliebt' },
  { key: 'grossraumtaxi' as const, name: 'Großraumtaxi', pax: '8 Personen', bags: 'bis 10 Koffer', photo: '/images/grossraumtaxi.webp', badge: '' },
];

const HERO_FEAT: [string, string][] = [['Festpreis', 'ohne versteckte Kosten'], ['Flugüberwachung', 'inklusive'], ['60 Min. Wartezeit', 'gratis'], ['Für Familien', 'und Gruppen bis 8']];
const INCL: [string, string][] = [
  ['Festpreis', 'Kein Stauzuschlag, Maut inklusive'], ['Flugüberwachung', 'Wir passen uns Verspätungen an'],
  ['60 Min. Wartezeit gratis', 'Bei Abholung am Flughafen'], ['Meet & Greet', 'Namensschild im Ankunftsbereich'],
  ['Kindersitz kostenlos', 'Bitte bei Buchung angeben'], ['Bar, Karte, Rechnung', 'Rechnung für Firmen'],
];

const MEETING_POINTS = [
  { Icon: PlaneLanding, name: 'Terminal 1, Ankunftsbereich', text: 'Ihr Fahrer wartet im Ankunftsbereich von Terminal 1 mit einem Namensschild.' },
  { Icon: PlaneLanding, name: 'Terminal 2, Ankunftshalle', text: 'Ihr Fahrer wartet am Ausgang der Ankunftshalle von Terminal 2 mit einem Namensschild.' },
  { Icon: Building2, name: 'München Airport Center (MAC)', text: 'Treffpunkt im München Airport Center zwischen Terminal 1 und Terminal 2.' },
  { Icon: Plane, name: 'General Aviation Terminal (GAT)', text: 'Für Privat- und Geschäftsflüge holen wir Sie auch am General Aviation Terminal ab. Bitte bei der Buchung als Abholort wählen.' },
];

const NEARBY_SLUGS = [
  'taxi-freising-flughafen-muenchen', 'taxi-erding-flughafen-muenchen', 'taxi-dachau-flughafen-muenchen', 'taxi-garching-flughafen-muenchen',
  'taxi-ismaning-flughafen-muenchen', 'taxi-unterschleissheim-flughafen-muenchen', 'taxi-augsburg-flughafen-muenchen', 'taxi-landshut-flughafen-muenchen',
];

export default async function TaxiFlughafenMuenchenPage() {
  const rows = await getAreaPrices();
  const hbf = rows.find((r) => r.key === 'hbf') as PricedRow;
  const stadt = rows.filter((r) => r.group === 'stadt');
  const landkreis = rows.filter((r) => r.group === 'landkreis');
  const umland = rows.filter((r) => r.group === 'umland');
  const toTab = (list: PricedRow[]) => list.map((r) => ({ key: r.key, name: r.name, href: r.href, km: r.km, min: r.min, kombi: r.quote.kombi, van: r.quote.van }));
  const from = cheapestMunich(rows);
  const anyLive = rows.some((r) => r.live);
  const stand = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long', year: 'numeric' });

  // Route card: Munich city centre (Google traffic forecast, same source as the city pages).
  const geo = cityGeo['taxi-muenchen-flughafen-muenchen'];
  const km = geo ? Math.round(geo.km) : 37;
  const min = geo?.min ?? 32;
  const rush = geo?.rush_min ?? null;
  const night = geo?.night_min ?? null;
  const road = 'A9';
  const minKm = Math.round(Math.min(...stadt.map((r) => r.km)));
  const maxKm = Math.round(Math.max(...stadt.map((r) => r.km)));
  const minMin = Math.min(...stadt.map((r) => r.min));
  const maxMin = Math.max(...stadt.map((r) => r.min));

  const hbfKombi = eur(hbf.quote.kombi);
  const vehicles = VEHICLES.flatMap((v) => (hbf.quote[v.key] ? [{ ...v, price: hbf.quote[v.key] as number }] : []));
  const slots = [
    { label: 'Frühmorgens', min: night, Icon: Sunrise, bar: 'bg-emerald-500' },
    { label: 'Normaler Verkehr', min, Icon: Users, bar: 'bg-amber-400' },
    { label: 'Berufsverkehr', min: rush, Icon: Car, bar: 'bg-red-500' },
  ].filter((s) => s.min);
  const maxSlot = Math.max(...slots.map((s) => s.min || 0), 1);

  const tips = [
    { Icon: Clock, text: night ? `Frühflug? Vor 6 Uhr sind die Straßen frei, rechnen Sie ab Stadtmitte mit rund ${night} Minuten.` : 'Frühflug? Wir fahren rund um die Uhr, auch um 4 Uhr morgens.' },
    { Icon: Route, text: rush ? `Im Berufsverkehr (7 bis 9 Uhr) dauert die Fahrt etwa ${rush} Minuten. Unser Abholzeit-Rechner berücksichtigt das.` : 'Am Vorabend buchen, wir bestätigen innerhalb weniger Minuten.' },
    { Icon: Users, text: 'Freitagnachmittag und zu Messezeiten ist auf der A9 Stau fast sicher. Planen Sie dann 90 Minuten und mehr Puffer ein.' },
    { Icon: Plane, text: 'Landung in MUC? Wir verfolgen Ihren Flug und warten 60 Minuten kostenlos.' },
  ];

  const faqs = [
    {
      q: 'Was kostet ein Taxi vom Flughafen München in die Innenstadt?',
      a: `Das Festpreis-Taxi kostet zwischen Flughafen und Hauptbahnhof ab ${hbfKombi} für den Kombi (1 bis 3 Personen) und ab ${eur(hbf.quote.van)} für den Van (bis 7 Personen). Im Preis sind Maut, Gepäck, Flugüberwachung und 60 Minuten Wartezeit enthalten. Den genauen Preis für Ihre Adresse zeigt das Buchungsformular sofort an.`,
    },
    {
      q: 'Wie lange dauert ein Taxi vom Flughafen München ins Zentrum?',
      a: `Die Fahrt zwischen Flughafen München (MUC) und Hauptbahnhof dauert je nach Verkehr etwa ${hbf.min} bis 50 Minuten. Die Strecke beträgt rund ${Math.round(hbf.km)} Kilometer, meist über die A9.`,
    },
    {
      q: 'Was passiert bei Flugverspätung?',
      a: 'Wir überwachen Ihren Flug in Echtzeit und warten bis zu 60 Minuten kostenlos auf Sie. Bei Verspätungen passen wir die Abholzeit automatisch an, ohne Aufpreis.',
    },
    {
      q: 'Gibt es Kindersitze im Taxi zum Flughafen München?',
      a: 'Ja, Kindersitze (Babyschale, Kindersitz, Sitzerhöhung) sind bei uns kostenlos. Bitte bei der Buchung angeben.',
    },
    {
      q: 'Darf ich mein Haustier im Taxi mitnehmen?',
      a: 'Ja. Haustiere werden ausschließlich in einem geschlossenen Käfig bzw. einer Transportbox befördert und bleiben während der gesamten Fahrt darin. Bitte bei der Buchung unter Extras angeben und bestätigen. Assistenzhunde sind von dieser Regel ausgenommen.',
    },
    {
      q: 'Wie früh sollte ich das Taxi zum Flughafen München bestellen?',
      a: 'Empfehlenswert ist eine Vorbestellung 24 bis 48 Stunden im Voraus. Planen Sie die Abfahrt mindestens 60 bis 90 Minuten vor dem Check-in ein.',
    },
  ];

  const nearby = NEARBY_SLUGS.flatMap((slug) => (citiesBySlug[slug] && cityImages[slug] ? [citiesBySlug[slug]] : []));
  const usedImages = nearby.map((c) => c.slug);

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'TaxiService',
      name: 'Taxi zum Flughafen München',
      url: `${SITE}/blog/taxi-flughafen-muenchen`,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: SITE },
      areaServed: [{ '@type': 'City', name: 'München' }, { '@type': 'Airport', name: 'Flughafen München', iataCode: 'MUC' }],
      offers: vehicles.map((v) => ({ '@type': 'Offer', name: `${v.name}: München Hauptbahnhof zum Flughafen`, price: v.price.toFixed(2), priceCurrency: 'EUR' })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Taxi Flughafen München: Kosten, Fahrtdauer und Festpreise',
      image: `${SITE}/images/hero-airport.webp`,
      datePublished: '2026-10-02',
      // Prices on this page are live, so the content is current on every request.
      dateModified: new Date().toISOString().slice(0, 10),
      author: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Flughafen-München.TAXI', url: SITE },
      publisher: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Flughafen-München.TAXI', url: SITE, logo: { '@type': 'ImageObject', url: `${SITE}/icon.png` } },
      mainEntityOfPage: `${SITE}/blog/taxi-flughafen-muenchen`,
    },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Taxi Flughafen München', item: `${SITE}/blog/taxi-flughafen-muenchen` },
      ],
    },
  ];

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      {/* Hero: airport photo, price and the four selling points */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="Fahrer öffnet am Flughafen München die Tür eines Taxis für zwei Reisende mit Koffern" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/80 via-primary-900/45 to-primary-900/5" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary-900/70 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-32">
          <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-white/75" aria-label="Brotkrumen">
            <Link href="/" className="hover:text-white">Startseite</Link>
            <ArrowRight size={12} />
            <span className="text-white">Taxi Flughafen München</span>
          </nav>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            Taxi <span className="text-gold-400">Flughafen München</span>: Kosten, Fahrtdauer und Festpreise 2026
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/90 drop-shadow md:text-xl">
            Zuverlässig. Pünktlich. Stressfrei.<br />Festpreise ab München und Umland, live aus unserem Buchungssystem.
          </p>
          <div className="mt-5 inline-flex flex-wrap items-baseline gap-x-2 rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
            <span className="text-sm text-white/80">Festpreis ab</span>
            <span className="text-3xl font-extrabold text-gold-400">{eur(from)}</span>
            <span className="hidden text-sm text-white/70 sm:inline">· {minKm} bis {maxKm} km · ca. {minMin} bis {maxMin} Min. über die A9 · rund um die Uhr</span>
          </div>
          <ul className="mt-7 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {HERO_FEAT.map(([a, b], i) => {
              const Icon = [BadgeCheck, ShieldCheck, Timer, Users][i];
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
        {/* Booking card overlapping the hero */}
        <div id="booking" className="-mt-20 scroll-mt-28">
          <CityBooking pickup="München Hauptbahnhof" tabs={['Einfache Fahrt', 'Hin- und Rückfahrt', 'Abholung am Flughafen']} people={['1 bis 8 Personen', 'Kombi, Van & Großraumtaxi']} />
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><Navigation size={13} className="text-gold-600" /> Bitte Straße und Hausnummer in München sowie den Terminal am Flughafen aus der Vorschlagsliste wählen. So sehen Sie Ihren exakten Festpreis.</span>
            <span className="flex items-center gap-4">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:underline"><Phone size={13} /> {CONTACT_INFO.phone}</a>
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"><MessageCircle size={13} /> WhatsApp</a>
            </span>
          </p>
        </div>

        {/* Vehicles & prices (dark panel) + route card */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.75fr_1fr]">
          <section className="rounded-2xl bg-primary-900 p-5 text-white shadow-lg md:p-6">
            <h2 className="text-2xl font-extrabold">Unsere Fahrzeuge &amp; Preise</h2>
            <p className="mt-1 text-sm text-white/80">Festpreise ab Hauptbahnhof, inklusive Maut, Flugüberwachung und Wartezeit. Den exakten Preis für Ihre Adresse zeigt das Buchungsformular sofort an.</p>
            <div className={`mt-5 grid gap-4 ${vehicles.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
              {vehicles.map((v, i) => (
                <div key={v.key} className={`relative flex flex-col overflow-hidden rounded-xl bg-white text-gray-900 ${i === 1 ? 'ring-[3px] ring-gold-400' : ''}`}>
                  {v.badge && <span className="absolute right-2 top-2 z-10 rounded-full bg-gold-400 px-2.5 py-0.5 text-[11px] font-bold text-primary-900 shadow">{v.badge}</span>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.photo} alt={v.name} loading="lazy" className="h-28 w-full object-cover" />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="font-bold">{v.name}</div>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      <li className="flex items-center gap-2"><Users size={14} className="text-gray-400" /> {v.pax}</li>
                      <li className="flex items-center gap-2"><Luggage size={14} className="text-gray-400" /> {v.bags}</li>
                    </ul>
                    <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-sm text-gray-500">ab</span>
                      <span className="whitespace-nowrap text-3xl font-extrabold tracking-tight text-primary-800">{eur(v.price)}</span>
                    </div>
                    <a href="#booking" className={`mt-4 rounded-lg px-3 py-2 text-center text-sm font-bold transition ${i === 1 ? 'bg-gold-400 text-primary-900 hover:bg-gold-300' : 'border-2 border-primary-800 text-primary-800 hover:bg-primary-800 hover:text-white'}`}>Jetzt buchen</a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><Car size={24} className="text-primary-700" /> Strecke &amp; Fahrzeit</h2>
            <div className="mt-4">
              <RouteSketch city="München" airport="Flughafen München (MUC)" road={road} cityWest={(geo?.lng ?? 0) < AIRPORT_LNG} />
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm font-semibold text-gray-900">
              <span className="inline-flex items-center gap-1.5"><MapPin size={16} className="text-primary-700" /> {km} km</span>
              <span className="inline-flex items-center gap-1.5"><Route size={16} className="text-primary-700" /> {road}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={16} className="text-primary-700" /> ~{min} Min.</span>
            </div>
            {slots.length > 1 && (
              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                {slots.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="flex w-36 shrink-0 items-center gap-2 text-sm text-gray-600"><s.Icon size={15} className="text-gray-400" /> {s.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${((s.min || 0) / maxSlot) * 100}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900">{s.min} Min.</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500">Gerechnet ab Stadtmitte. Ab Hauptbahnhof sind es rund {Math.round(hbf.km)} km und etwa {hbf.min} Minuten.</p>
          </section>
        </div>

        {/* Included strip */}
        <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-200 shadow-sm ring-1 ring-gray-200 md:grid-cols-3">
          {INCL.map(([title, sub], i) => {
            const Icon = [BadgeCheck, Plane, Timer, Users, Baby, CreditCard][i] || ShieldCheck;
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

        {/* Prices by pick-up area: all Stadtbezirke, Landkreis München, Umland */}
        <section id="preise" className="mt-8 scroll-mt-28" aria-labelledby="preise-titel">
          <h2 id="preise-titel" className="text-2xl font-extrabold text-gray-900">Was kostet ein Taxi zum Flughafen München?</h2>
          <p className="mt-2 max-w-[75ch] text-sm leading-relaxed text-gray-600">
            Bei uns zahlen Sie einen Festpreis, unabhängig von Stau oder Umwegen. Er enthält Maut, Gepäck, Flugüberwachung und 60 Minuten Wartezeit.
            Hier finden Sie die Preise für alle 25 Stadtbezirke Münchens und alle 29 Gemeinden im Landkreis München, berechnet ab der jeweiligen Ortsmitte.
          </p>
          <div className="mt-5">
            <PriceTabs
              searchLabel="Stadtteil oder Ort suchen"
              emptyText="Kein Treffer. Den Preis für Ihre Adresse zeigt das Buchungsformular."
              tabs={[
                { id: 'stadt', label: 'Stadt München', hint: 'Festpreis ab Mitte des Stadtbezirks', rows: toTab(stadt) },
                { id: 'landkreis', label: 'Landkreis München', hint: 'Festpreis ab Ortsmitte der Gemeinde', rows: toTab(landkreis) },
                { id: 'umland', label: 'Umland und Fernziele', hint: 'Festpreis ab Ortsmitte', rows: toTab(umland) },
              ]}
            />
          </div>
          <p className="mt-3 max-w-[85ch] text-xs leading-relaxed text-gray-500">
            {anyLive ? `Live aus unserem Buchungssystem, Stand ${stand}. ` : ''}
            Den genauen Preis für Ihre Adresse zeigt das Buchungsformular. Kindersitz kostenlos, Fahrradtransport auf Anfrage.
          </p>
        </section>

        {/* Fixed price | Tips | FAQ */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">Festpreis statt Taxameter</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Der amtliche Münchner Taxitarif besteht aus 5,90 € Grundgebühr plus Kilometerpreis, dazu kommt Wartezeit im Stau.
              Bei einer Fahrt nach Taxameter steht der Endbetrag erst am Ziel fest. Mit unserem Festpreis kennen Sie ihn schon bei der Buchung.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {[['5,90 €', 'Grundgebühr Münchner Taxitarif'], ['60 Min.', 'Wartezeit am Flughafen gratis'], ['3 Std.', 'Kostenlos stornieren vor Abholung'], ['Maut', 'im Festpreis enthalten']].map(([v, k]) => (
                <div key={k}><dd className="text-sm font-bold text-gray-900">{v}</dd><dt className="text-[11px] text-gray-500">{k}</dt></div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">Tipps für Ihre Fahrt</h2>
            <ul className="mt-4 space-y-4">
              {tips.map(({ Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Icon size={17} /></span>{text}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">Häufige Fragen</h2>
            <div className="mt-4 space-y-2">
              {faqs.map(({ q, a }) => (
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

        {/* Ride details and meeting points | pick-up time calculator */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="text-2xl font-extrabold text-gray-900">Ihre Fahrt zum Flughafen München</h2>
            <p className="mt-3 leading-relaxed text-gray-700">
              Der Flughafen München (MUC) liegt rund {km} km nordöstlich der Stadtmitte in der Gemeinde Freising, die Hauptroute führt über die A9.
              Bei normalem Verkehr dauert die Fahrt etwa {min} Minuten{rush ? `, im morgendlichen Berufsverkehr etwa ${rush} Minuten` : ''}{night ? ` und frühmorgens nur rund ${night} Minuten` : ''}.
              Bei vorgebuchten Fahrten wartet Ihr Fahrer mit Namensschild auf Sie, kein Suchen, kein Schlangestehen.
            </p>
            <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-gold-700">Treffpunkte am Flughafen</h3>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {MEETING_POINTS.map(({ Icon, name, text }) => (
                <li key={name} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Icon size={18} /></span>
                  <span className="text-sm leading-relaxed text-gray-700"><b className="block text-gray-900">{name}</b>{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
              <span>Reguläre Taxis ohne Festpreis stehen an den Taxiständen vor Terminal 1 und Terminal 2 bereit.</span>
              <Link href="/treffpunkt-flughafen-muenchen" className="inline-flex items-center gap-1.5 font-bold text-primary-700 hover:underline">Zum Treffpunkt-Guide <ArrowRight size={14} /></Link>
            </p>

            <details className="group mt-5 border-t border-gray-100 pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-gray-900">
                Mit Kind &amp; Haustier
                <ChevronDown size={16} className="text-gold-600 transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-4 text-sm leading-relaxed text-gray-700 sm:grid-cols-2">
                <p className="flex gap-2"><Baby size={18} className="mt-0.5 shrink-0 text-primary-700" /><span><b className="text-gray-900">Kindersitz kostenlos.</b> Babyschale, Kindersitz und Sitzerhöhung auf Anfrage, bitte bei der Buchung angeben. In Deutschland gilt die Kindersitzpflicht auch im Taxi.</span></p>
                <p className="flex gap-2"><PawPrint size={18} className="mt-0.5 shrink-0 text-primary-700" /><span><b className="text-gray-900">Haustiere im Käfig.</b> Sie reisen im geschlossenen Käfig oder in der Transportbox und bleiben darin, solange die Fahrt dauert. Bitte bei der Buchung unter Extras angeben. Assistenzhunde sind ausgenommen.</span></p>
              </div>
            </details>
          </section>
          <DepartureCalc
            min={min}
            rush={rush}
            night={night}
            t={{ title: 'Wann sollen wir Sie abholen?', flightTime: 'Abflugzeit', flightType: 'Flug', eu: 'Schengen / EU', intl: 'Interkontinental', result: 'Empfohlene Abholzeit', drive: 'Fahrt', airport: 'Am Flughafen', buffer: 'Puffer', note: 'Faustregel: 2 Std. vor EU-Flügen, 3 Std. vor Langstrecke am Flughafen sein. Bitte die Empfehlung Ihrer Airline beachten.', unit: 'Min.' }}
          />
        </div>
      </div>

      {/* More routes with city photos (dark band) */}
      <section className="relative mt-12 overflow-hidden bg-primary-900 py-10 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">Weitere Taxi-Strecken zum Flughafen München</h2>
            <a href="#preise" className="rounded-lg px-4 py-2 text-sm font-bold ring-1 ring-white/40 hover:bg-white hover:text-primary-900">Alle Preise ansehen →</a>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {nearby.map((c) => (
              <li key={c.slug}>
                <Link href={`/blog/${c.slug}`} className="group block h-full overflow-hidden rounded-xl bg-white text-gray-900 shadow transition hover:-translate-y-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/cities/${c.slug}-sm.webp`} alt={c.nameDE} loading="lazy" className="h-20 w-full object-cover" />
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
          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
            <Link href="/munich-airport-to-city-centre" className="hover:text-gold-300 hover:underline">Ratgeber: Flughafen → Innenstadt</Link>
            <Link href="/messe-muenchen-transfer" className="hover:text-gold-300 hover:underline">Messe-Transfer München</Link>
            <Link href="/treffpunkt-flughafen-muenchen" className="hover:text-gold-300 hover:underline">Treffpunkt am Flughafen</Link>
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-br from-gold-400 to-gold-500 p-8 text-center md:p-12">
          <h2 className="text-2xl font-extrabold text-primary-900 md:text-3xl">Jetzt Taxi zum Flughafen München buchen</h2>
          <p className="mt-2 text-primary-900/80">Festpreis ab {eur(from)} · rund um die Uhr · Sofortbestätigung</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#booking" className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white transition hover:bg-primary-800">Preis berechnen →</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 transition hover:bg-primary-900 hover:text-white">
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </section>
        {usedImages.length > 0 && (
          <p className="mt-6 text-[10px] leading-relaxed text-gray-400">
            Bildnachweis: {usedImages.map((s, i) => (
              <span key={s}>{i > 0 && ' · '}{citiesBySlug[s]?.nameDE}: {cityImages[s].artist} (<a href={cityImages[s].source} target="_blank" rel="noopener noreferrer nofollow" className="underline">{cityImages[s].license}</a>)</span>
            ))} · Wikimedia Commons
          </p>
        )}
      </div>
    </div>
  );
}
