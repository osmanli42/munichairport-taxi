import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Phone, MapPin, Clock, Users, ArrowRight } from 'lucide-react';
import { citiesBySlug, allCitySlugs, CityData } from '@/lib/citiesData';
import enTranslations from '@/lib/citiesDataEn';
import { CONTACT_INFO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CITY_BASE_URL = 'https://www.flughafen-muenchen.taxi';

type Props = { params: { citySlug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = citiesBySlug[params.citySlug];
  if (!city) return {};

  const countryLabel = city.country === 'AT' ? 'Österreich' : city.country === 'CH' ? 'Schweiz' : 'Bayern';

  return {
    title: `Taxi ${city.nameDE} Flughafen München – Festpreis ${city.kombi_price} €`,
    description: `Taxi von ${city.nameDE} zum Flughafen München (MUC): ${city.distance_km} km, ca. ${city.drive_minutes} Min. Fahrtzeit. Festpreis ab ${city.kombi_price} € – jetzt online buchen!`,
    alternates: {
      canonical: `/blog/${params.citySlug}`,
    },
    openGraph: {
      title: `Taxi ${city.nameDE} → Flughafen München | Festpreis ${city.kombi_price} €`,
      description: `${city.distance_km} km, ${city.drive_minutes} Min. Fahrtzeit ab ${city.nameDE}. Kombi ab ${city.kombi_price} €, Van ab ${city.van_price} €. Rund um die Uhr, pünktlich & zuverlässig.`,
      type: 'article',
    },
  };
}

const countryFlag: Record<string, string> = { DE: '🇩🇪', AT: '🇦🇹', CH: '🇨🇭' };
const countryName: Record<string, string> = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' };

export default function CityBlogPage({ params }: Props) {
  const city: CityData | undefined = citiesBySlug[params.citySlug];
  if (!city) notFound();

  const locale = params.locale;
  const phoneHref = `tel:${CONTACT_INFO.phone}`;
  const baseUrl = CITY_BASE_URL;
  const isEN = locale === 'en';
  const t = isEN ? enTranslations[params.citySlug] : null;

  // Content helpers – fall back to German if no EN translation
  const desc = t?.description ?? city.description;
  const hist = t?.history ?? city.history;
  const knownFor = t?.known_for ?? city.known_for;
  const sights = t?.sights ?? city.sights;

  // UI strings
  const ui = isEN ? {
    breadcrumbBlog: 'Blog',
    heroSubtitle: `${city.distance_km} km · approx. ${city.drive_minutes} min · Fixed price from`,
    cardDistance: 'Distance',
    cardTime: 'Travel time',
    cardKombi: 'Saloon (1–3 pax)',
    cardVan: 'Van (4–7 pax)',
    ctaTitle: 'Book your taxi now',
    ctaSubtitle: 'Fixed price guaranteed · No hidden costs · 24/7',
    ctaBook: 'Book online',
    ctaCall: 'Call',
    overviewTitle: `${city.nameDE} – Overview`,
    statsLabel: ['Residents', 'Population growth', 'Area', 'Elevation'],
    historyTitle: `History of ${city.nameDE}`,
    sightsTitle: `Sights in ${city.nameDE}`,
    sightsIntro: `${city.nameDE} offers visitors numerous attractions and excursion destinations:`,
    knownForLabel: 'Known for',
    transferTitle: `Taxi from ${city.nameDE} to Munich Airport (MUC)`,
    transferIntro: (t?.intro ?? `From ${city.nameDE} to Munich Airport (MUC) is approx. <strong>${city.distance_km} km</strong>. Travel time at normal traffic is about <strong>${city.drive_minutes} minutes</strong>. Our fixed-price service ensures you arrive at the terminal stress-free and on time.`),
    tableHeaders: ['Vehicle', 'Passengers', 'Luggage', 'Fixed price'],
    tableRows: [['Saloon / Sedan', '1 – 3', 'up to 3 suitcases'], ['Van / MPV', '4 – 7', 'up to 6 suitcases']],
    includedTitle: 'Our fixed-price guarantee includes:',
    included: ['Free airport meet & greet service in the terminal', 'Up to 60 min free waiting time for delays', 'Real-time flight monitoring (no surcharge)', 'No traffic surcharge, no toll extra', 'Child seats on request, free of charge'],
    faqTitle: `FAQ – Taxi ${city.nameDE} Munich Airport`,
    faqs: [
      { q: `How much does a taxi from ${city.nameDE} to Munich Airport cost?`, a: `The fixed price from ${city.nameDE} to Munich Airport (MUC) is ${city.kombi_price} € for a saloon (up to 3 passengers) or ${city.van_price} € for a van (up to 7 passengers). All prices include toll and have no hidden charges.` },
      { q: `How long is the journey from ${city.nameDE} to Munich Airport?`, a: `The journey from ${city.nameDE} to Munich Airport takes approx. ${city.drive_minutes} minutes at normal traffic. The distance is approx. ${city.distance_km} km. For early-morning flights we recommend allowing extra buffer time.` },
      { q: 'Can I book and pay online?', a: 'Yes, you can conveniently book your taxi transfer online on our website and pay in advance. You will receive an instant booking confirmation by email.' },
      { q: `Does the taxi also go from Munich Airport back to ${city.nameDE}?`, a: `Of course! We operate arrival and departure transfers. For the return from Munich Airport to ${city.nameDE} we monitor your flight and wait up to 60 minutes free of charge – even for delays.` },
    ],
    finalCtaTitle: `Book your taxi from ${city.nameDE} now`,
    finalCtaSubtitle: `Fixed price from ${city.kombi_price} € · Available 24/7 · Instant confirmation`,
    bookBtn: 'Book online →',
  } : {
    breadcrumbBlog: 'Blog',
    heroSubtitle: `${city.distance_km} km · ca. ${city.drive_minutes} Min. · Festpreis ab`,
    cardDistance: 'Entfernung',
    cardTime: 'Fahrtzeit',
    cardKombi: 'Kombi (1–3 Pax)',
    cardVan: 'Van (4–7 Pax)',
    ctaTitle: 'Jetzt Ihr Taxi buchen',
    ctaSubtitle: 'Festpreis garantiert · Keine Extrakosten · Rund um die Uhr',
    ctaBook: 'Online buchen',
    ctaCall: 'Anrufen',
    overviewTitle: `${city.nameDE} – Überblick`,
    statsLabel: ['Einwohner', 'Bevölkerungswachstum', 'Fläche', 'Höhe ü. NN'],
    historyTitle: `Geschichte von ${city.nameDE}`,
    sightsTitle: `Sehenswürdigkeiten in ${city.nameDE}`,
    sightsIntro: `${city.nameDE} bietet Besuchern zahlreiche Sehenswürdigkeiten und Ausflugsziele:`,
    knownForLabel: 'Bekannt für',
    transferTitle: `Taxi von ${city.nameDE} zum Flughafen München (MUC)`,
    transferIntro: `Von ${city.nameDE} zum Flughafen München sind es ca. <strong>${city.distance_km} km</strong>. Die Fahrtzeit beträgt bei normaler Verkehrslage etwa <strong>${city.drive_minutes} Minuten</strong>. Unser Festpreisservice sorgt dafür, dass Sie stressfrei und pünktlich am Terminal ankommen.`,
    tableHeaders: ['Fahrzeug', 'Personen', 'Gepäck', 'Festpreis'],
    tableRows: [['Kombi / Limousine', '1 – 3', 'bis 3 Koffer'], ['Van / Großraumtaxi', '4 – 7', 'bis 6 Koffer']],
    includedTitle: 'Unsere Festpreis-Garantie beinhaltet:',
    included: ['Kostenloser Flughafen-Meetservice im Terminal', '60 Minuten kostenlose Wartezeit bei Verspätungen', 'Echtzeit-Flugüberwachung (kein Aufpreis)', 'Kein Stau-Aufschlag, keine Mautkosten extra', 'Kindersitze auf Anfrage kostenlos'],
    faqTitle: `Häufige Fragen – Taxi ${city.nameDE} Flughafen München`,
    faqs: [
      { q: `Was kostet ein Taxi von ${city.nameDE} zum Flughafen München?`, a: `Der Festpreis von ${city.nameDE} zum Flughafen München (MUC) beträgt ${city.kombi_price} € für einen Kombi (bis 3 Personen) bzw. ${city.van_price} € für einen Van (bis 7 Personen). Alle Preise sind inklusive Maut und ohne versteckte Kosten.` },
      { q: `Wie lange dauert die Fahrt von ${city.nameDE} nach Flughafen München?`, a: `Die Fahrt von ${city.nameDE} zum Flughafen München dauert ca. ${city.drive_minutes} Minuten bei normaler Verkehrslage. Die Entfernung beträgt ca. ${city.distance_km} km.` },
      { q: 'Kann ich online buchen und bezahlen?', a: 'Ja, auf unserer Website können Sie Ihren Taxi-Transfer bequem online buchen und vorab bezahlen. Sie erhalten eine sofortige Buchungsbestätigung per E-Mail.' },
      { q: `Fährt das Taxi auch vom Flughafen München zurück nach ${city.nameDE}?`, a: `Selbstverständlich! Wir fahren Ankunfts- und Abflug-Transfers. Beim Rücktransfer vom Flughafen München nach ${city.nameDE} überwachen wir Ihren Flug und warten bis zu 60 Minuten kostenlos.` },
    ],
    finalCtaTitle: `Jetzt Taxi von ${city.nameDE} buchen`,
    finalCtaSubtitle: `Festpreis ab ${city.kombi_price} € · Rund um die Uhr verfügbar · Sofortbestätigung`,
    bookBtn: 'Online buchen →',
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Was kostet ein Taxi von ${city.nameDE} zum Flughafen München?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Ein Festpreis-Taxi von ${city.nameDE} zum Flughafen München (MUC) kostet ab ${city.kombi_price} € (Kombi/Limousine) bzw. ${city.van_price} € (Van). Die Strecke beträgt ca. ${city.distance_km} km.`,
        },
      },
      {
        '@type': 'Question',
        name: `Wie lange dauert die Fahrt von ${city.nameDE} zum Flughafen München?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Die Fahrt von ${city.nameDE} zum Flughafen München dauert ca. ${city.drive_minutes} Minuten (${city.distance_km} km). Bei starkem Verkehr oder in der Rushhour kann es länger dauern.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Gibt es einen Festpreis oder wird nach Taxameter abgerechnet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Wir bieten garantierte Festpreise – kein Taxameter, kein Stau-Aufschlag. Der Preis von ${city.kombi_price} € (Kombi) bzw. ${city.van_price} € (Van) ist fix und wird vorab bestätigt.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Kann ich auch vom Flughafen München nach ${city.nameDE} fahren?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Ja, wir fahren natürlich auch vom Flughafen München zurück nach ${city.nameDE}. Bei Ankunfts-Transfers überwachen wir Ihren Flug und warten bis zu 60 Minuten kostenlos.`,
        },
      },
    ],
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/blog/taxi-flughafen-muenchen` },
      { '@type': 'ListItem', position: 3, name: `Taxi ${city.nameDE} Flughafen München` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <article className="max-w-4xl mx-auto px-4 py-8 md:py-12">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1 flex-wrap">
          <Link href="/" className="hover:text-yellow-600">Home</Link>
          <ArrowRight size={14} />
          <Link href="/blog/taxi-flughafen-muenchen" className="hover:text-yellow-600">{ui.breadcrumbBlog}</Link>
          <ArrowRight size={14} />
          <span className="text-gray-700">Taxi {city.nameDE} München Airport</span>
        </nav>

        {/* Hero */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <span>{countryFlag[city.country]} {countryName[city.country]}</span>
            {city.district && <><span>·</span><span>{city.district}</span></>}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Taxi {city.nameDE} → {isEN ? 'Munich Airport' : 'Flughafen München'}: {isEN ? 'Fixed Price, Journey Time & Tips' : 'Festpreis, Fahrtdauer & Tipps'}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {ui.heroSubtitle}{' '}
            <span className="font-semibold text-yellow-600">{city.kombi_price} €</span>
          </p>
        </header>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <MapPin className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.distance_km} km</div>
            <div className="text-xs text-gray-500 mt-1">{ui.cardDistance}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Clock className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">~{city.drive_minutes} {isEN ? 'min' : 'Min'}</div>
            <div className="text-xs text-gray-500 mt-1">{ui.cardTime}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Users className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.kombi_price} €</div>
            <div className="text-xs text-gray-500 mt-1">{ui.cardKombi}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Users className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.van_price} €</div>
            <div className="text-xs text-gray-500 mt-1">{ui.cardVan}</div>
          </div>
        </div>

        {/* CTA Block */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 md:p-8 mb-10 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="text-lg font-semibold mb-1">{ui.ctaTitle}</p>
            <p className="text-gray-300 text-sm">{ui.ctaSubtitle}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${locale === 'de' ? '' : locale}`}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-xl text-center transition"
            >
              {ui.ctaBook}
            </Link>
            <a
              href={phoneHref}
              className="border border-white hover:bg-white hover:text-gray-900 text-white px-6 py-3 rounded-xl text-center flex items-center gap-2 transition"
            >
              <Phone size={16} /> {ui.ctaCall}
            </a>
          </div>
        </div>

        {/* City Overview */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{ui.overviewTitle}</h2>
          <p className="text-gray-700 leading-relaxed mb-4">{desc}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl p-5 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">{ui.statsLabel[0]}</div>
              <div className="font-semibold">{city.population.toLocaleString('de-DE')}</div>
              <div className="text-xs text-gray-400">({city.population_year})</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">{ui.statsLabel[1]}</div>
              <div className="font-semibold text-green-600">{city.population_growth}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">{ui.statsLabel[2]}</div>
              <div className="font-semibold">{city.area_km2} km²</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">{ui.statsLabel[3]}</div>
              <div className="font-semibold">{city.elevation_m} m</div>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{ui.historyTitle}</h2>
          <p className="text-gray-700 leading-relaxed">{hist}</p>
        </section>

        {/* Sights */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{ui.sightsTitle}</h2>
          <p className="text-gray-600 mb-4">{ui.sightsIntro}</p>
          <ul className="space-y-2">
            {sights.map((sight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-yellow-400 text-gray-900 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-700">{sight}</span>
              </li>
            ))}
          </ul>
          {knownFor && (
            <p className="mt-4 text-sm text-gray-500 bg-yellow-50 rounded-lg px-4 py-3">
              <span className="font-semibold">{ui.knownForLabel}:</span> {knownFor}
            </p>
          )}
        </section>

        {/* Transfer Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{ui.transferTitle}</h2>
          <p
            className="text-gray-700 leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: ui.transferIntro }}
          />
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  {ui.tableHeaders.map((h, i) => (
                    <th key={i} className={`p-3 ${i === 0 ? 'text-left rounded-tl-lg' : i === ui.tableHeaders.length - 1 ? 'text-right rounded-tr-lg' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ui.tableRows.map(([vehicle, pax, luggage], i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-yellow-50">
                    <td className="p-3 font-medium">{vehicle}</td>
                    <td className="p-3 text-center">{pax}</td>
                    <td className="p-3 text-center">{luggage}</td>
                    <td className="p-3 text-right font-bold text-yellow-600">
                      {i === 0 ? city.kombi_price : city.van_price} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
            <p className="font-semibold mb-2">{ui.includedTitle}</p>
            <ul className="space-y-1 list-disc list-inside">
              {ui.included.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{ui.faqTitle}</h2>
          <div className="space-y-4">
            {ui.faqs.map(({ q, a }, i) => (
              <details key={i} className="border border-gray-200 rounded-xl overflow-hidden group">
                <summary className="flex justify-between items-center cursor-pointer p-4 font-semibold text-gray-800 hover:bg-gray-50 select-none">
                  {q}
                  <span className="ml-4 text-yellow-500 font-bold text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-gray-600 text-sm leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="bg-yellow-400 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{ui.finalCtaTitle}</h3>
          <p className="text-gray-700 mb-6">{ui.finalCtaSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale === 'de' ? '' : locale}`}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl transition"
            >
              {ui.bookBtn}
            </Link>
            <a
              href={phoneHref}
              className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
