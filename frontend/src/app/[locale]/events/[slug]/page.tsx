'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Head from 'next/head';
import { eventsData, Event } from '@/lib/eventsData';
import SearchBar from '@/components/SearchBar';
import { useTranslation } from '@/contexts/LanguageContext';

interface PageProps {
  params: {
    locale: string;
    slug: string;
  };
}

export default function EventPage({ params }: PageProps) {
  const { locale, slug } = params;
  const { t, language } = useTranslation();
  const [event, setEvent] = useState<Event | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const foundEvent = eventsData.find((e) => e.slug === slug);
    setEvent(foundEvent || null);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (!event) return;

    const updateCountdown = () => {
      const dateStr = event.dateRange.start;
      const [day, month, year] = dateStr.split('.');
      const eventDate = new Date(`${year}-${month}-${day}`).getTime();
      const now = new Date().getTime();
      const distance = eventDate - now;

      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((distance / 1000 / 60) % 60),
          seconds: Math.floor((distance / 1000) % 60),
        });
      } else {
        setCountdown(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{language === 'de' ? 'Lädt...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Head>
          <title>{language === 'de' ? 'Event nicht gefunden' : 'Event not found'} | flughafen-muenchen.taxi</title>
          <meta name="robots" content="noindex" />
        </Head>
        <SearchBar />
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {language === 'de' ? 'Event nicht gefunden' : 'Event not found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {language === 'de'
              ? 'Das gesuchte Event existiert nicht.'
              : 'The requested event does not exist.'}
          </p>
          <Link href={`/${locale}/events`} className="text-blue-600 hover:text-blue-800 font-semibold">
            {language === 'de' ? 'Zurück zu Events' : 'Back to Events'}
          </Link>
        </div>
      </div>
    );
  }

  const isGerman = language === 'de';
  const title = isGerman ? event.title.de : event.title.en;
  const seoTitle = isGerman ? event.seoTitle.de : event.seoTitle.en;
  const seoDescription = isGerman ? event.seoDescription.de : event.seoDescription.en;
  const seoKeywords = isGerman ? event.seoKeywords.de : event.seoKeywords.en;
  const shortDesc = isGerman ? event.shortDescription.de : event.shortDescription.en;
  const description = isGerman ? event.description.de : event.description.en;
  const locationName = isGerman ? event.location.de : event.location.en;
  const highlights = isGerman ? event.highlights.de : event.highlights.en;
  const highlightsDesc = isGerman ? event.highlights_description.de : event.highlights_description.en;

  // Build canonical URL
  const canonicalUrl = `https://flughafen-muenchen.taxi/${locale}/events/${event.slug}`;

  // Generate breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: language === 'de' ? 'Startseite' : 'Home',
        item: `https://flughafen-muenchen.taxi/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: language === 'de' ? 'Events' : 'Events',
        item: `https://flughafen-muenchen.taxi/${locale}/events`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: canonicalUrl,
      },
    ],
  };

  // Generate organization schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'flughafen-muenchen.taxi',
    url: 'https://flughafen-muenchen.taxi',
    logo: 'https://flughafen-muenchen.taxi/logo.png',
    description: language === 'de'
      ? 'Zuverlässiger Taxi-Service vom/zum Flughafen München zu Events'
      : 'Reliable taxi service from/to Munich Airport to events',
    contact: {
      '@type': 'ContactPoint',
      telephone: '+49-89-129-11',
      contactType: language === 'de' ? 'Kundensupport' : 'Customer Support',
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords.join(', ')} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* Open Graph Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={event.ogImage || '📍'} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="flughafen-muenchen.taxi" />
        <meta property="og:locale" content={locale === 'de' ? 'de_DE' : 'en_US'} />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={event.ogImage || '📍'} />

        {/* Canonical Link */}
        <link rel="canonical" href={canonicalUrl} />

        {/* JSON-LD Schemas */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(event.schema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      </Head>

      <SearchBar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/${locale}/events`} className="text-blue-600 hover:text-blue-800 font-semibold">
            {language === 'de' ? '← Zurück zu Events' : '← Back to Events'}
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            <p className="text-xl opacity-90">{shortDesc}</p>
            {event.ogImage && (
              <img
                src={event.ogImage}
                alt={title}
                className="mt-6 w-20 h-20 object-cover rounded-lg"
                loading="lazy"
              />
            )}
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  {language === 'de' ? 'Zeitraum' : 'Dates'}
                </h3>
                <p className="text-2xl font-bold text-blue-600">
                  {event.dateRange.start} - {event.dateRange.end}
                </p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  {language === 'de' ? 'Besucher' : 'Visitors'}
                </h3>
                <p className="text-2xl font-bold text-green-600">{event.stats.visitors}</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">
                  {language === 'de' ? 'Dauer' : 'Duration'}
                </h3>
                <p className="text-2xl font-bold text-purple-600">{event.stats.duration}</p>
              </div>
            </div>

            {countdown && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-yellow-800 mb-6 text-center">
                  {language === 'de' ? 'Zeit bis zum Event' : 'Time Until Event'}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-4xl font-bold text-yellow-600">{countdown.days}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {language === 'de' ? 'Tage' : 'Days'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-4xl font-bold text-yellow-600">{countdown.hours}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {language === 'de' ? 'Stunden' : 'Hours'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-4xl font-bold text-yellow-600">{countdown.minutes}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {language === 'de' ? 'Minuten' : 'Minutes'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-4xl font-bold text-yellow-600">{countdown.seconds}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      {language === 'de' ? 'Sekunden' : 'Seconds'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {language === 'de' ? 'Über das Event' : 'About the Event'}
                </h2>
                <p className="text-gray-700 leading-relaxed text-lg">{description}</p>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {language === 'de' ? 'Standort' : 'Location'}
                </h2>
                <div className="bg-gray-100 p-6 rounded-lg">
                  <p className="font-semibold text-lg text-gray-900 mb-2">{locationName}</p>
                  <p className="text-gray-600">{event.location.address}</p>

                  <div className="mt-6 pt-6 border-t border-gray-300">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      {language === 'de' ? 'Event-Details' : 'Event Details'}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold">
                          {language === 'de' ? 'Preis: ' : 'Price: '}
                        </span>
                        {event.stats.price || 'Kostenlos / Free'}
                      </p>
                      <p>
                        <span className="font-semibold">
                          {language === 'de' ? 'Website: ' : 'Website: '}
                        </span>
                        {event.website ? (
                          <a
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {event.website}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {language === 'de' ? 'Highlights' : 'Highlights'}
              </h2>
              <p className="text-gray-700 mb-6">{highlightsDesc}</p>
              <ul className="grid md:grid-cols-2 gap-4">
                {highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-block w-6 h-6 bg-blue-600 text-white rounded-full text-center text-sm font-bold mr-3 flex-shrink-0">
                      ✓
                    </span>
                    <span className="text-gray-800">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {language === 'de' ? 'Tipps für Besucher' : 'Visitor Tips'}
              </h2>
              <div className="space-y-4">
                {event.tips.map((tip, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-gray-800 font-semibold mb-2">
                      {language === 'de' ? `Tipp ${index + 1}` : `Tip ${index + 1}`}
                    </p>
                    <p className="text-gray-700">{isGerman ? tip.de : tip.en}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {language === 'de' ? 'Benötigen Sie ein Taxi?' : 'Need a Taxi?'}
                </h3>
                <p className="text-gray-700 mb-6">
                  {language === 'de'
                    ? 'Buchen Sie ein Taxi zum Event oder zum Flughafen München'
                    : 'Book a taxi to the event or to Munich Airport'}
                </p>
                <a
                  href={`tel:+498912911`}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
                >
                  {language === 'de' ? 'Taxi buchen' : 'Book Taxi'}
                </a>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <Link href={`/${locale}/events`} className="text-blue-600 hover:text-blue-800 font-semibold">
                {language === 'de' ? '← Alle Events' : '← All Events'}
              </Link>
              {event.website && (
                <a
                  href={event.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300"
                >
                  {language === 'de' ? 'Offizielle Website →' : 'Official Website →'}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            {language === 'de' ? 'Verwandte Events' : 'Related Events'}
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {event.relatedEvents
              .map((relatedSlug) => eventsData.find((e) => e.slug === relatedSlug))
              .filter(Boolean)
              .map((relatedEvent) => relatedEvent && (
                <Link
                  key={relatedEvent.id}
                  href={`/${locale}/events/${relatedEvent.slug}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300 overflow-hidden group"
                  rel="related"
                >
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-32 flex items-center justify-center text-4xl">
                    {relatedEvent.ogImage || '📍'}
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-2">{relatedEvent.dateRange.month}</p>
                    <p className="text-gray-900 font-semibold group-hover:text-blue-600 transition">
                      {isGerman ? relatedEvent.shortDescription.de : relatedEvent.shortDescription.en}
                    </p>
                  </div>
                </Link>
              ))}
          </div>

          {/* Additional Events Grid */}
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            {language === 'de' ? 'Weitere Events' : 'More Events'}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {eventsData
              .filter((e) => e.slug !== slug && !event.relatedEvents.includes(e.slug))
              .slice(0, 3)
              .map((relatedEvent) => (
                <Link
                  key={relatedEvent.id}
                  href={`/${locale}/events/${relatedEvent.slug}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300 overflow-hidden group"
                >
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-32 flex items-center justify-center text-4xl">
                    {relatedEvent.ogImage || '📍'}
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-2">{relatedEvent.dateRange.month}</p>
                    <p className="text-gray-900 font-semibold group-hover:text-blue-600 transition">
                      {isGerman ? relatedEvent.shortDescription.de : relatedEvent.shortDescription.en}
                    </p>
                  </div>
                </Link>
              ))}
          </div>

          {/* Link to main events page */}
          <div className="mt-12 text-center">
            <Link
              href={`/${locale}/events`}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition duration-300"
            >
              {language === 'de' ? 'Alle Events anzeigen' : 'View All Events'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
