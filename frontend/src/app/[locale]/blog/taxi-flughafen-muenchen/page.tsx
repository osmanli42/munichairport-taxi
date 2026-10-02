import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Baby, BadgeCheck, Clock, Luggage, MapPin, MessageCircle, Moon, PawPrint, Phone,
  PlaneLanding, ShieldCheck, Sun, Sunrise, Timer, Users, CalendarClock,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import CityBooking from '@/components/city/CityBooking';
import { eur, getAreaPrices, type PricedRow } from '@/lib/blogAirportPrices';

// Prices come live from the booking price engine (cached 1 h per request), like the city pages.
export const dynamic = 'force-dynamic';

const SITE = 'https://flughafen-muenchen.taxi';

const pick = (rows: PricedRow[], key: string) => rows.find((r) => r.key === key) as PricedRow;
const cheapestMunich = (rows: PricedRow[]) => Math.min(...rows.filter((r) => r.group === 'muenchen').map((r) => r.quote.kombi));

export async function generateMetadata(): Promise<Metadata> {
  const rows = await getAreaPrices();
  const from = eur(cheapestMunich(rows));
  return {
    title: { absolute: 'Taxi Flughafen München: Kosten, Dauer & Festpreis 2026' },
    description: `Taxi zum Flughafen München ab ${from} Festpreis: alle Preise aus München und Umland, Fahrtdauer, Fahrzeuge und Tipps. 24/7, mit Flugüberwachung.`,
    alternates: { canonical: '/blog/taxi-flughafen-muenchen' },
    openGraph: {
      title: 'Taxi Flughafen München: Kosten, Dauer & Festpreis 2026',
      description: `Festpreise ab ${from}, Fahrer am Ausgang, Kindersitz kostenlos.`,
      url: `${SITE}/blog/taxi-flughafen-muenchen`,
      images: [{ url: `${SITE}/images/hero-airport.webp` }],
      type: 'article',
    },
  };
}

const VEHICLES = [
  { key: 'kombi' as const, name: 'Kombi', model: 'Mercedes E-Klasse', pax: 'bis 4 Personen', bags: 'bis 4 Koffer', best: 'Einzelreisende und Paare', photo: '/images/kombi.webp' },
  { key: 'van' as const, name: 'Van', model: 'Mercedes Viano', pax: 'bis 7 Personen', bags: 'bis 10 Koffer', best: 'Familien und kleine Gruppen', photo: '/images/van.webp' },
  { key: 'grossraumtaxi' as const, name: 'Großraumtaxi', model: 'Mercedes Vito', pax: 'bis 8 Personen', bags: 'bis 12 Koffer', best: 'Große Gruppen', photo: '/images/grossraumtaxi.webp' },
];

const TIMES = [
  { Icon: Sunrise, when: 'Frühflüge vor 8 Uhr', text: 'Wenig Verkehr. 60 Minuten Puffer genügen meist.' },
  { Icon: Sun, when: 'Tagesflüge von 8 bis 17 Uhr', text: '75 bis 90 Minuten einplanen.' },
  { Icon: Timer, when: 'Freitagnachmittag und Messezeiten', text: 'Auf der A9 ist Stau fast sicher. Besser 90 Minuten und mehr Puffer.' },
  { Icon: Moon, when: 'Nachtflüge', text: 'Kaum Verkehr, 60 Minuten reichen in der Regel.' },
];

const STEPS = [
  { title: 'Adresse eingeben', text: 'Abholort, Ziel, Datum und Uhrzeit angeben. Das dauert etwa eine Minute.' },
  { title: 'Fahrzeug und Festpreis wählen', text: 'Kombi, Van oder Großraumtaxi wählen. Der Preis erscheint sofort.' },
  { title: 'Bestätigung erhalten', text: 'Sie bekommen die Bestätigung per E-Mail. Bezahlt wird bar oder per Karte, ohne Aufschlag.' },
];

export default async function TaxiFlughafenMuenchenPage() {
  const rows = await getAreaPrices();
  const hbf = pick(rows, 'hbf');
  const munich = rows.filter((r) => r.group === 'muenchen');
  const umland = rows.filter((r) => r.group === 'umland');
  const from = cheapestMunich(rows);
  const anyLive = rows.some((r) => r.live);
  const stand = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'long', year: 'numeric' });
  const hbfKombi = eur(hbf.quote.kombi);

  const faqs = [
    {
      q: 'Was kostet ein Taxi vom Flughafen München in die Innenstadt?',
      a: `Das Festpreis-Taxi kostet zwischen Flughafen und Hauptbahnhof ab ${hbfKombi} für den Kombi (bis 4 Personen) und ab ${eur(hbf.quote.van)} für den Van. Im Preis sind Maut, Gepäck, Flugüberwachung und 60 Minuten Wartezeit enthalten. Den genauen Preis für Ihre Adresse zeigt das Buchungsformular sofort an.`,
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

  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Taxi Flughafen München' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Taxi zum Flughafen München (Festpreis)',
      serviceType: 'Taxi',
      areaServed: 'München',
      provider: { '@type': 'Organization', name: 'Flughafen-München.TAXI', url: SITE },
      offers: VEHICLES.filter((v) => (v.key === 'grossraumtaxi' ? hbf.quote.grossraumtaxi : true)).map((v) => ({
        '@type': 'Offer',
        name: `${v.name}: München Hauptbahnhof zum Flughafen`,
        price: Number(hbf.quote[v.key]).toFixed(2),
        priceCurrency: 'EUR',
      })),
    },
  ];

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Hero: real airport photo, price and one primary action */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-airport.webp"
          alt="Fahrer öffnet am Flughafen München die Tür eines Taxis für zwei Reisende mit Koffern"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/55 to-primary-900/5" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary-900/70 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-32">
          <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-white/75" aria-label="Brotkrumen">
            <Link href="/" className="hover:text-white">Home</Link>
            <ArrowRight size={12} />
            <span className="text-white">Taxi Flughafen München</span>
          </nav>
          <h1 className="max-w-5xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl lg:text-[3.4rem]">
            Taxi Flughafen München: <span className="text-gold-400">Kosten, Fahrtdauer</span> und Festpreise 2026
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/90 drop-shadow md:text-xl">
            Alle Festpreise ab München und Umland, live aus unserem Buchungssystem. Fahrer am Ausgang, Flugüberwachung, Kindersitz kostenlos.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-baseline gap-2 rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/20 backdrop-blur">
              <span className="text-sm text-white/80">Ab München</span>
              <span className="text-3xl font-extrabold text-gold-400">{eur(from)}</span>
            </div>
            <a href="#booking" className="rounded-xl bg-gold-400 px-6 py-3 text-sm font-bold text-primary-900 transition hover:bg-gold-300">
              Jetzt buchen
            </a>
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Booking card overlapping the hero, same component as the city pages */}
        <div id="booking" className="-mt-20 scroll-mt-28">
          <CityBooking
            pickup="München Hauptbahnhof"
            tabs={['Einfache Fahrt', 'Hin- und Rückfahrt', 'Abholung am Flughafen']}
            people={['1 bis 8 Personen', 'Kombi, Van und Großraumtaxi']}
          />
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500">
            <span>Abholort ist vorausgefüllt. Mit Straße und Hausnummer sehen Sie Ihren genauen Preis.</span>
            <span className="flex items-center gap-4">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:underline"><Phone size={13} /> {CONTACT_INFO.phone}</a>
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:underline"><MessageCircle size={13} /> WhatsApp</a>
            </span>
          </p>
        </div>

        {/* Prices */}
        <section className="mt-14" aria-labelledby="preise">
          <div className="max-w-3xl">
            <h2 id="preise" className="text-3xl font-extrabold tracking-tight text-primary-800">Was kostet ein Taxi zum Flughafen München?</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Bei uns zahlen Sie einen Festpreis, unabhängig von Stau oder Umwegen. Er enthält Maut, Gepäck, Flugüberwachung und 60 Minuten Wartezeit.
              Die Preise gelten für die einfache Fahrt ab Stadtmitte bzw. Ortsmitte.
            </p>
          </div>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
            <PriceGroup title="Ab München" rows={munich} />
            <PriceGroup title="Umland und Fernziele" rows={umland} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-500 max-w-[75ch]">
            {anyLive ? `Live aus unserem Buchungssystem, Stand ${stand}. ` : ''}
            Den genauen Preis für Ihre Adresse zeigt das Buchungsformular. Kindersitz kostenlos, Fahrradtransport auf Anfrage.
          </p>
        </section>

        {/* Fixed price vs taximeter */}
        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary-800">Festpreis statt Taxameter</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Der amtliche Münchner Taxitarif besteht aus <strong className="text-gray-900">5,90 € Grundgebühr</strong> plus Kilometerpreis, dazu kommt Wartezeit im Stau.
              Bei einer Fahrt nach Taxameter steht der Endbetrag erst am Ziel fest und schwankt mit dem Verkehr.
            </p>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Mit unserem Festpreis kennen Sie den Betrag schon bei der Buchung. Er ändert sich nicht durch Wartezeiten oder Umwege.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { Icon: BadgeCheck, t: 'Preis vor der Buchung', d: 'Keine Überraschung am Ziel' },
              { Icon: PlaneLanding, t: 'Flugüberwachung', d: 'Abholzeit passt sich an' },
              { Icon: Clock, t: '60 Minuten Wartezeit', d: 'Bei Verspätung kostenlos' },
              { Icon: ShieldCheck, t: 'Kostenlose Stornierung', d: 'Bis 3 Stunden vor der Fahrt' },
            ].map(({ Icon, t, d }) => (
              <li key={t} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <Icon size={22} className="mt-0.5 shrink-0 text-primary-700" />
                <span className="text-sm leading-snug"><b className="block text-gray-900">{t}</b><span className="text-gray-600">{d}</span></span>
              </li>
            ))}
          </ul>
        </section>

        {/* Vehicles: one lead vehicle, two supporting, not three equal cards */}
        <section className="mt-14" aria-labelledby="fahrzeuge">
          <h2 id="fahrzeuge" className="text-3xl font-extrabold tracking-tight text-primary-800">Welches Fahrzeug passt zu Ihrer Reise?</h2>
          <p className="mt-3 text-base text-gray-600 max-w-[65ch]">Preise ab Hauptbahnhof, jeweils für das ganze Fahrzeug.</p>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            {VEHICLES.map((v, i) => {
              const price = hbf.quote[v.key];
              if (!price) return null;
              const lead = i === 0;
              return (
                <article
                  key={v.key}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 ${lead ? 'lg:row-span-2' : 'sm:flex'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.photo}
                    alt={`${v.name}, ${v.model}`}
                    loading="lazy"
                    className={lead ? 'h-56 w-full object-cover sm:h-72' : 'h-44 w-full object-cover sm:h-auto sm:w-2/5'}
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-xl font-extrabold text-gray-900">{v.name}</h3>
                      <p className="text-sm text-gray-500">ab <span className="text-2xl font-extrabold tracking-tight text-primary-800">{eur(price)}</span></p>
                    </div>
                    <p className="text-sm text-gray-500">{v.model}</p>
                    <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                      <li className="flex items-center gap-2"><Users size={15} className="text-gray-400" /> {v.pax}</li>
                      <li className="flex items-center gap-2"><Luggage size={15} className="text-gray-400" /> {v.bags}</li>
                      <li className="flex items-center gap-2"><BadgeCheck size={15} className="text-gray-400" /> Ideal für {v.best}</li>
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Travel time and when to leave */}
        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="fahrtdauer">
          <div>
            <h2 id="fahrtdauer" className="text-3xl font-extrabold tracking-tight text-primary-800">Wie lange dauert die Fahrt?</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Der Flughafen München (MUC) liegt rund <strong className="text-gray-900">{Math.round(hbf.km)} Kilometer</strong> nordöstlich des Hauptbahnhofs in der Gemeinde Freising.
              Die Hauptroute führt über die A9. Je nach Tageszeit dauert die Fahrt <strong className="text-gray-900">{hbf.min} bis 50 Minuten</strong>.
            </p>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Die Fahrzeit für jeden Abholort finden Sie in der Preistabelle oben. Wir überwachen Ihren Flug und passen die Abholzeit bei Verspätung automatisch an.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h3 className="text-lg font-extrabold text-gray-900">Wann sollten Sie losfahren?</h3>
            <ul className="mt-4 space-y-4">
              {TIMES.map(({ Icon, when, text }) => (
                <li key={when} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Icon size={18} /></span>
                  <span className="text-sm leading-snug"><b className="block text-gray-900">{when}</b><span className="text-gray-600">{text}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Taxi vs S-Bahn, honest comparison */}
        <section className="mt-14" aria-labelledby="sbahn">
          <h2 id="sbahn" className="text-3xl font-extrabold tracking-tight text-primary-800">Taxi oder S-Bahn zum Flughafen München?</h2>
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-800 text-white">
                  <th className="px-4 py-3 text-left font-semibold"><span className="sr-only">Merkmal</span></th>
                  <th className="px-4 py-3 text-center font-semibold">Festpreis-Taxi</th>
                  <th className="px-4 py-3 text-center font-semibold">S-Bahn (S1, S8)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Fahrzeit ab Hauptbahnhof', `${hbf.min} bis 50 Min.`, '40 bis 50 Min.'],
                  ['Preis für 1 Person', `ab ${hbfKombi}`, 'ca. 15,10 €'],
                  ['Preis für 4 Personen', `ab ${hbfKombi} gesamt`, 'ca. 60 € (4 Tickets)'],
                  ['Tür zu Tür', 'Ja', 'Nein, Umstieg möglich'],
                  ['Gepäck und Kinderwagen', 'Bequem im Fahrzeug', 'Eingeschränkt'],
                  ['Nachts und früh', 'Rund um die Uhr', 'Eingeschränkter Fahrplan'],
                ].map(([label, taxi, sbahn], i) => (
                  <tr key={label} className={i % 2 ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-800">{label}</td>
                    <td className="px-4 py-3 text-center font-semibold text-primary-800">{taxi}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{sbahn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 max-w-[75ch]">
            <strong className="text-gray-900">Fazit:</strong> Die S-Bahn ist günstiger, das Taxi spart Umstiege und Schlepperei.
            Es lohnt sich besonders mit Kindern, viel Gepäck, zu dritt oder zu viert und bei sehr frühen oder späten Flügen.
            Das S-Bahn-Einzelticket zum Flughafen (Zone M-5) kostet laut MVV 15,10 € (Stand Juli 2026).
          </p>
        </section>

        {/* Booking steps as a vertical timeline */}
        <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="buchen">
          <div>
            <h2 id="buchen" className="text-3xl font-extrabold tracking-tight text-primary-800">Taxi zum Flughafen München buchen</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-600 max-w-[65ch]">
              Bei vorgebuchten Fahrten empfängt Sie Ihr Fahrer mit Namensschild im Ankunftsbereich. Kein Suchen, kein Schlangestehen.
              Alternativ stehen an den Taxiständen vor Terminal 1 und Terminal 2 reguläre Taxis bereit, allerdings ohne Festpreis.
            </p>
          </div>
          <ol className="relative space-y-6 border-l-2 border-primary-100 pl-6">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="relative">
                <span className="absolute -left-[2.15rem] flex h-8 w-8 items-center justify-center rounded-full bg-primary-800 text-sm font-bold text-white ring-4 ring-gray-50">{i + 1}</span>
                <p className="font-bold text-gray-900">{title}</p>
                <p className="mt-1 text-sm text-gray-600 max-w-[60ch]">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Children and pets */}
        <section className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900"><Baby size={22} className="text-primary-700" /> Mit Kind</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Der Kindersitz ist bei uns kostenlos: Babyschale, Kindersitz und Sitzerhöhung auf Anfrage. Bitte bei der Buchung angeben.
              In Deutschland gilt die Kindersitzpflicht auch im Taxi.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 md:p-6">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900"><PawPrint size={22} className="text-primary-700" /> Mit Haustier</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Haustiere reisen im geschlossenen Käfig oder in der Transportbox und bleiben darin, solange die Fahrt dauert.
              Bitte bei der Buchung unter Extras angeben. Assistenzhunde sind ausgenommen.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14" aria-labelledby="faq">
          <h2 id="faq" className="text-3xl font-extrabold tracking-tight text-primary-800">Häufige Fragen zum Taxi Flughafen München</h2>
          <div className="mt-6 space-y-3 max-w-3xl">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl bg-white ring-1 ring-gray-200">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-gray-900">
                  {f.q}
                  <span className="shrink-0 text-primary-700 transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mb-16 mt-14 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-900 p-8 text-center text-white md:p-10">
          <h2 className="text-2xl font-extrabold md:text-3xl">Bereit für Ihre Fahrt?</h2>
          <p className="mx-auto mt-2 max-w-xl text-primary-100">Festpreis berechnen, in einer Minute buchen. Pünktlich, professionell, rund um die Uhr.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#booking" className="rounded-xl bg-gold-400 px-8 py-3 font-bold text-primary-900 transition hover:bg-gold-300">Jetzt buchen</a>
            <a href={CONTACT_INFO.phoneHref} className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-8 py-3 font-bold text-white transition hover:bg-white/20">
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function PriceGroup({ title, rows }: { title: string; rows: PricedRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center justify-between bg-primary-800 px-4 py-3 text-white">
        <h3 className="text-base font-bold">{title}</h3>
        <div className="flex gap-3 pr-1 text-xs font-semibold uppercase tracking-wide text-white/80">
          <span className="w-[5.25rem] text-right">Kombi</span>
          <span className="w-[5.25rem] text-right">Van</span>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              {r.href ? (
                <Link href={r.href} className="font-semibold text-gray-900 hover:text-primary-700 hover:underline">{r.name}</Link>
              ) : (
                <span className="font-semibold text-gray-900">{r.name}</span>
              )}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><MapPin size={12} /> {Math.round(r.km)} km</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap"><CalendarClock size={12} /> ca. {r.min} Min.</span>
              </p>
            </div>
            <div className="flex gap-3 tabular-nums">
              <span className="w-[5.25rem] whitespace-nowrap text-right text-base font-extrabold text-primary-800">{eur(r.quote.kombi)}</span>
              <span className="w-[5.25rem] whitespace-nowrap text-right text-base font-bold text-gray-700">{eur(r.quote.van)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
