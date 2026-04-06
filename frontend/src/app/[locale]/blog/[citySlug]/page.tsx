import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Phone, MapPin, Clock, Users, ArrowRight } from 'lucide-react';
import { citiesBySlug, allCitySlugs, CityData } from '@/lib/citiesData';
import { CONTACT_INFO } from '@/lib/utils';

type Props = { params: { citySlug: string; locale: string } };

export async function generateStaticParams() {
  return allCitySlugs.map((slug) => ({ citySlug: slug }));
}

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
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.munichairport.taxi' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.munichairport.taxi/blog/taxi-flughafen-muenchen' },
      { '@type': 'ListItem', position: 3, name: `Taxi ${city.nameDE} Flughafen München` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <article className="max-w-4xl mx-auto px-4 py-8 md:py-12">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1 flex-wrap">
          <Link href="/" className="hover:text-yellow-600">Home</Link>
          <ArrowRight size={14} />
          <Link href="/blog/taxi-flughafen-muenchen" className="hover:text-yellow-600">Blog</Link>
          <ArrowRight size={14} />
          <span className="text-gray-700">Taxi {city.nameDE} Flughafen München</span>
        </nav>

        {/* Hero */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <span>{countryFlag[city.country]} {countryName[city.country]}</span>
            {city.district && <><span>·</span><span>{city.district}</span></>}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Taxi {city.nameDE} → Flughafen München: Festpreis, Fahrtdauer & Tipps
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            {city.distance_km} km · ca. {city.drive_minutes} Minuten · Festpreis ab{' '}
            <span className="font-semibold text-yellow-600">{city.kombi_price} €</span>
          </p>
        </header>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <MapPin className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.distance_km} km</div>
            <div className="text-xs text-gray-500 mt-1">Entfernung</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Clock className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">~{city.drive_minutes} Min</div>
            <div className="text-xs text-gray-500 mt-1">Fahrtzeit</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Users className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.kombi_price} €</div>
            <div className="text-xs text-gray-500 mt-1">Kombi (1–3 Pax)</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Users className="mx-auto mb-1 text-yellow-600" size={22} />
            <div className="text-2xl font-bold text-gray-900">{city.van_price} €</div>
            <div className="text-xs text-gray-500 mt-1">Van (4–7 Pax)</div>
          </div>
        </div>

        {/* CTA Block */}
        <div className="bg-gray-900 text-white rounded-2xl p-6 md:p-8 mb-10 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="text-lg font-semibold mb-1">Jetzt Ihr Taxi buchen</p>
            <p className="text-gray-300 text-sm">
              Festpreis garantiert · Keine Extrakosten · Rund um die Uhr
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/${locale === 'de' ? '' : locale}`}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-xl text-center transition"
            >
              Online buchen
            </Link>
            <a
              href={phoneHref}
              className="border border-white hover:bg-white hover:text-gray-900 text-white px-6 py-3 rounded-xl text-center flex items-center gap-2 transition"
            >
              <Phone size={16} /> Anrufen
            </a>
          </div>
        </div>

        {/* City Intro */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {city.nameDE} – Überblick
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">{city.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl p-5 text-sm">
            <div>
              <div className="text-gray-500 text-xs mb-1">Einwohner</div>
              <div className="font-semibold">{city.population.toLocaleString('de-DE')}</div>
              <div className="text-xs text-gray-400">({city.population_year})</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Bevölkerungswachstum</div>
              <div className="font-semibold text-green-600">{city.population_growth}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Fläche</div>
              <div className="font-semibold">{city.area_km2} km²</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs mb-1">Höhe ü. NN</div>
              <div className="font-semibold">{city.elevation_m} m</div>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Geschichte von {city.nameDE}
          </h2>
          <p className="text-gray-700 leading-relaxed">{city.history}</p>
        </section>

        {/* Sights */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Sehenswürdigkeiten in {city.nameDE}
          </h2>
          <p className="text-gray-600 mb-4">
            {city.nameDE} bietet Besuchern zahlreiche Sehenswürdigkeiten und Ausflugsziele:
          </p>
          <ul className="space-y-2">
            {city.sights.map((sight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-yellow-400 text-gray-900 text-xs flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-700">{sight}</span>
              </li>
            ))}
          </ul>
          {city.known_for && (
            <p className="mt-4 text-sm text-gray-500 bg-yellow-50 rounded-lg px-4 py-3">
              <span className="font-semibold">Bekannt für:</span> {city.known_for}
            </p>
          )}
        </section>

        {/* Transfer Section */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Taxi von {city.nameDE} zum Flughafen München (MUC)
          </h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            Von {city.nameDE} zum Flughafen München sind es ca. <strong>{city.distance_km} km</strong>.
            Die Fahrtzeit beträgt bei normaler Verkehrslage etwa <strong>{city.drive_minutes} Minuten</strong>.
            Unser Festpreisservice sorgt dafür, dass Sie stressfrei und pünktlich am Terminal ankommen –
            ohne Überraschungen auf dem Taxameter.
          </p>

          {/* Price Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="text-left p-3 rounded-tl-lg">Fahrzeug</th>
                  <th className="text-center p-3">Personen</th>
                  <th className="text-center p-3">Gepäck</th>
                  <th className="text-right p-3 rounded-tr-lg">Festpreis</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-yellow-50">
                  <td className="p-3 font-medium">Kombi / Limousine</td>
                  <td className="p-3 text-center">1 – 3</td>
                  <td className="p-3 text-center">bis 3 Koffer</td>
                  <td className="p-3 text-right font-bold text-yellow-600">{city.kombi_price} €</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-yellow-50">
                  <td className="p-3 font-medium">Van / Großraumtaxi</td>
                  <td className="p-3 text-center">4 – 7</td>
                  <td className="p-3 text-center">bis 6 Koffer</td>
                  <td className="p-3 text-right font-bold text-yellow-600">{city.van_price} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
            <p className="font-semibold mb-2">Unsere Festpreis-Garantie beinhaltet:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Kostenloser Flughafen-Meetservice im Terminal</li>
              <li>60 Minuten kostenlose Wartezeit bei Verspätungen</li>
              <li>Echtzeit-Flugüberwachung (kein Aufpreis)</li>
              <li>Kein Stau-Aufschlag, keine Mautkosten extra</li>
              <li>Kindersitze auf Anfrage kostenlos</li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Häufige Fragen – Taxi {city.nameDE} Flughafen München
          </h2>
          <div className="space-y-4">
            {[
              {
                q: `Was kostet ein Taxi von ${city.nameDE} zum Flughafen München?`,
                a: `Der Festpreis von ${city.nameDE} zum Flughafen München (MUC) beträgt ${city.kombi_price} € für einen Kombi (bis 3 Personen) bzw. ${city.van_price} € für einen Van (bis 7 Personen). Alle Preise sind inklusive Maut und ohne versteckte Kosten.`,
              },
              {
                q: `Wie lange dauert die Fahrt von ${city.nameDE} nach Flughafen München?`,
                a: `Die Fahrt von ${city.nameDE} zum Flughafen München dauert ca. ${city.drive_minutes} Minuten bei normaler Verkehrslage. Die Entfernung beträgt ca. ${city.distance_km} km. Wir empfehlen, bei frühen Flügen ausreichend Puffer einzuplanen.`,
              },
              {
                q: 'Kann ich online buchen und bezahlen?',
                a: 'Ja, auf unserer Website können Sie Ihren Taxi-Transfer bequem online buchen und vorab bezahlen. Sie erhalten eine sofortige Buchungsbestätigung per E-Mail.',
              },
              {
                q: `Fährt das Taxi auch vom Flughafen München zurück nach ${city.nameDE}?`,
                a: `Selbstverständlich! Wir fahren Ankunfts- und Abflug-Transfers. Beim Rücktransfer vom Flughafen München nach ${city.nameDE} überwachen wir Ihren Flug und warten bis zu 60 Minuten kostenlos – auch bei Verspätungen.`,
              },
            ].map(({ q, a }, i) => (
              <details
                key={i}
                className="border border-gray-200 rounded-xl overflow-hidden group"
              >
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
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Jetzt Taxi von {city.nameDE} buchen
          </h3>
          <p className="text-gray-700 mb-6">
            Festpreis ab {city.kombi_price} € · Rund um die Uhr verfügbar · Sofortbestätigung
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale === 'de' ? '' : locale}`}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl transition"
            >
              Online buchen →
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
