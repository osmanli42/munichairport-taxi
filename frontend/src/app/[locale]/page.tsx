import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Clock, Star, Baby, CreditCard, Phone, BadgePercent } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { CONTACT_INFO } from '@/lib/utils';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  return {
    title: t('home_title'),
    description: t('home_description'),
  };
}

export default function HomePage() {
  const t = useTranslations('hero');
  const tVehicles = useTranslations('vehicles');

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-visible">
        {/* Background taxi image — right side fading in */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "url('/images/hero-taxis.PNG')",
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            opacity: 0.18,
          }}
        />
        {/* Dark overlay gradient — keeps left side readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(26,54,93,0.92) 0%, rgba(26,54,93,0.75) 50%, rgba(26,54,93,0.35) 100%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
          {/* Hero text - centered top */}
          <div className="text-center animate-fade-in mb-10">
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <div className="inline-flex items-center bg-white/10 backdrop-blur rounded-full px-4 py-2 text-sm">
                <Star size={14} className="text-gold-400 mr-2" />
                <span>Professioneller Flughafentransfer München</span>
              </div>
              <div className="inline-flex items-center bg-gold-400/20 backdrop-blur rounded-full px-4 py-2 text-sm border border-gold-400/40">
                <span className="text-gold-300 mr-1">💰</span>
                <span className="text-gold-200 font-medium">Festpreis – kein Taxameter</span>
              </div>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-4">
              {t('title')}
              <span className="block text-gold-400">{t('subtitle')}</span>
            </h1>

            <p className="text-primary-200 text-lg mb-8 max-w-2xl mx-auto">{t('description')}</p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { icon: Shield, text: t('features.fixed_price') },
                { icon: Clock, text: t('features.punctual') },
                { icon: Star, text: t('features.247') },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                  <Icon size={16} className="text-gold-400" />
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <Phone size={18} />
                {t('phone')}
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Search Bar */}
          <div id="booking" className="animate-slide-up w-full">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-primary-900 border-b border-primary-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '20+', label: 'JAHRE ERFAHRUNG' },
              { value: '4,9 ★', label: 'Ø BEWERTUNG' },
              { value: '100%', label: 'FESTPREISE' },
              { value: '24/7', label: 'VERFÜGBAR' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <div className="text-4xl font-extrabold text-gold-400 leading-tight tracking-tight">{stat.value}</div>
                <div className="text-xs font-bold text-primary-300 mt-1 tracking-widest uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20" style={{ background: '#f4f7fb' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[.18em] uppercase mb-3" style={{ color: '#c9a84c' }}>
              So einfach geht&apos;s
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>
              In 3 Schritten zum Transfer
            </h2>
          </div>

          {/* Steps — alternating left/right rows */}
          <div className="flex flex-col gap-6">
            {[
              {
                step: 1,
                icon: '📍',
                title: 'Adresse & Zeit eingeben',
                text: 'Geben Sie Abholadresse, Zielort, Datum und Uhrzeit ein. Unser System berechnet sofort Ihren Festpreis – in unter einer Minute.',
                extra: ['✓ Google Maps Integration', '✓ Alle Terminals verfügbar', '✓ Rückfahrt buchbar'],
                reverse: false,
              },
              {
                step: 2,
                icon: '🚗',
                title: 'Fahrzeug & Preis wählen',
                text: 'Wählen Sie zwischen Kombi, Van oder Großraumtaxi. Kein Taxameter, kein Stauaufpreis – Ihr Preis bleibt fest.',
                extra: ['✓ Kombi bis 4 Pax', '✓ Van bis 7 Pax', '✓ Großraum bis 8 Pax'],
                reverse: true,
              },
              {
                step: 3,
                icon: '✈️',
                title: 'Entspannt ankommen',
                text: 'Ihr Fahrer wartet pünktlich am Ausgang – mit Namensschild. Bei Flugverspätung warten wir 60 Minuten kostenlos.',
                extra: ['✓ Meet & Greet Service', '✓ 60 Min. Wartezeit gratis', '✓ Gepäckhilfe inklusive'],
                reverse: false,
              },
            ].map(({ step, icon, title, text, extra, reverse }) => (
              <div
                key={step}
                className={`flex flex-col md:flex-row items-center gap-8 ${reverse ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Big number + icon side */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl w-full md:w-72"
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2a5080 100%)',
                    minHeight: '200px',
                    padding: '36px 32px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                  {/* Big faded step number in background */}
                  <span style={{
                    position: 'absolute',
                    fontSize: '120px',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,.04)',
                    lineHeight: 1,
                    bottom: '-10px',
                    right: '16px',
                    userSelect: 'none',
                    letterSpacing: '-0.04em',
                  }}>{step}</span>
                  {/* Step pill */}
                  <div className="mb-4 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}>
                    Schritt {step}
                  </div>
                  {/* Emoji icon */}
                  <div style={{ fontSize: '52px', lineHeight: 1 }}>{icon}</div>
                </div>

                {/* Text side */}
                <div className="flex-1 rounded-2xl p-8"
                  style={{
                    background: '#fff',
                    border: '1px solid #e5edf5',
                    boxShadow: '0 2px 20px rgba(15,27,45,.05)',
                  }}>
                  <h3 className="text-2xl font-extrabold mb-3 tracking-tight" style={{ color: '#0f1b2d' }}>
                    {title}
                  </h3>
                  <p className="text-base mb-5 leading-relaxed" style={{ color: '#6b7c93' }}>
                    {text}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {extra.map(e => (
                      <span key={e} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: '#fdf8ec', color: '#a07820', border: '1px solid #f0e0a0' }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a
              href="#booking"
              className="inline-flex items-center gap-2 font-bold text-base px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              style={{
                background: '#c9a84c',
                color: '#0f1b2d',
                boxShadow: '0 4px 24px rgba(201,168,76,.3)',
              }}
            >
              Jetzt kostenlos Preis berechnen →
            </a>
          </div>
        </div>
      </section>

      {/* Vehicles Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-600">{tVehicles('title')}</h2>
            <p className="text-gray-600 mt-2">{tVehicles('subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                image: '/images/kombi.PNG',
                name: tVehicles('kombi.name'),
                model: 'Mercedes E-Klasse',
                persons: tVehicles('kombi.persons'),
                features: ['Klimaanlage', 'Lederausstattung', 'Großer Kofferraum', 'Komfortabler Kombi'],
              },
              {
                image: '/images/van.PNG',
                name: tVehicles('van.name'),
                model: 'Mercedes Viano',
                persons: tVehicles('van.persons'),
                features: ['Klimaanlage', '7 Sitzplätze', 'Schiebetür', 'Viel Gepäckraum'],
              },
              {
                image: '/images/van.PNG',
                name: tVehicles('grossraumtaxi.name'),
                model: 'Mercedes Vito',
                persons: tVehicles('grossraumtaxi.persons'),
                features: ['Klimaanlage', '8 Sitzplätze', 'Bequeme Einzelsitze', 'Maximaler Gepäckraum'],
              },
            ].map((v) => (
              <div key={v.name} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow text-center flex flex-col">
                <div className="w-full h-36 overflow-hidden rounded-lg mb-3">
                  <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-bold text-xl text-primary-600">{v.name}</h3>
                <p className="text-xs text-gray-400 font-medium mb-1">{v.model}</p>
                <p className="text-gray-500 text-sm mb-4">{v.persons}</p>
                <ul className="text-left space-y-1.5 mt-auto">
                  {v.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/vehicles" className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors inline-block">
              Alle Fahrzeuge & Preise
            </Link>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-600">Warum Flughafen-muenchen.<span className="text-gold-400">TAXI</span>?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: 'Festpreisgarantie',
                text: 'Sie wissen Ihren Preis vor der Buchung. Keine bösen Überraschungen.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Clock,
                title: 'Immer pünktlich',
                text: 'Wir überwachen Ihren Flug und passen die Abholzeit bei Verspätungen an.',
                color: 'bg-green-50 text-green-600',
              },
              {
                icon: Baby,
                title: 'Kindersitz kostenlos',
                text: 'Auf Wunsch stellen wir Ihnen einen Kindersitz kostenlos zur Verfügung.',
                color: 'bg-yellow-50 text-yellow-600',
              },
              {
                icon: CreditCard,
                title: 'Flexible Zahlung',
                text: 'Zahlen Sie bequem bar oder per Karte – ganz wie Sie möchten.',
                color: 'bg-purple-50 text-purple-600',
              },
              {
                icon: Star,
                title: 'Mehrsprachiger Service',
                text: 'Wir sprechen Deutsch, Englisch und Türkisch – für maximalen Komfort.',
                color: 'bg-red-50 text-red-600',
              },
              {
                icon: BadgePercent,
                title: 'Keine Kreditkartengebühr',
                text: 'Zahlen Sie mit Karte – ohne Aufschlag. Bei uns fallen keine zusätzlichen Gebühren an.',
                color: 'bg-teal-50 text-teal-600',
              },
            ].map(({ icon: Icon, title, text, color }) => (
              <div key={title} className="flex items-start gap-4 p-5 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Promises Section */}
      <section className="py-16 bg-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-4">
              <span>🏆</span>
              <span>20 Jahre Erfahrung – Ihr Vertrauen ist unser Auftrag</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Unsere Versprechen an Sie</h2>
            <p className="text-primary-200 mt-2 text-lg">Keine Überraschungen. Keine versteckten Kosten. Nur verlässlicher Service.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { icon: '🏆', title: '20 Jahre Erfahrung', sub: 'Seit 20 Jahren Ihr zuverlässiger Flughafentransfer' },
              { icon: '🚫', title: 'Kostenloser Storno', sub: 'Bis 3 Stunden vor der Fahrt – keine Gebühren' },
              { icon: '💰', title: 'Festpreisgarantie', sub: 'Kein Taxameter – Preis steht bei Buchung fest' },
              { icon: '✈️', title: '60 Min. Gratis-Wartezeit', sub: 'Bei Flugverspätungen warten wir kostenlos' },
              { icon: '📧', title: 'Sofortige Bestätigung', sub: 'E-Mail-Bestätigung direkt nach der Buchung' },
              { icon: '👶', title: 'Kindersitze kostenlos', sub: 'Babyschale, Kindersitz & Sitzerhöhung gratis' },
              { icon: '🛡️', title: 'Vollversicherte Fahrzeuge', sub: 'Haftpflicht & Vollkasko für alle Fahrzeuge' },
              { icon: '🔒', title: 'Sichere Zahlung', sub: 'Bar oder verschlüsselte Kreditkarte' },
              { icon: '📱', title: '24/7 erreichbar', sub: 'Telefon & WhatsApp – Tag und Nacht' },
              { icon: '🌐', title: 'Mehrsprachiger Service', sub: 'Deutsch, Englisch & Türkisch' },
              { icon: '🧾', title: 'Keine versteckten Kosten', sub: 'Was Sie sehen, zahlen Sie – nicht mehr' },
              { icon: '👥', title: '100.000+ Kunden', sub: 'Über 100.000 zufriedene Fahrgäste vertrauen uns' },
            ].map(({ icon, title, sub }) => (
              <div key={title} className="bg-white/10 hover:bg-white/15 transition-colors rounded-2xl p-5 flex items-start gap-4">
                <span className="text-3xl shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-primary-200 text-xs mt-0.5 leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex justify-center gap-1 mb-3">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={24} className="fill-gold-400 text-gold-400" />
              ))}
            </div>
            <h2 className="text-3xl font-bold text-primary-600">Was unsere Kunden sagen</h2>
            <p className="text-gray-600 mt-2">Über 100.000 zufriedene Fahrgäste – lesen Sie selbst</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: 'Thomas K.',
                city: 'München',
                stars: 5,
                text: 'Pünktlich, freundlich und der Preis war genau wie vereinbart. Kein Taxameter, kein Stress. Werde definitiv wieder buchen!',
                date: 'März 2025',
              },
              {
                name: 'Sarah M.',
                city: 'Augsburg',
                stars: 5,
                text: 'Unser Flug hatte 2 Stunden Verspätung – der Fahrer hat gewartet, ohne extra Kosten. Absolut zuverlässig!',
                date: 'Februar 2025',
              },
              {
                name: 'Mehmet Y.',
                city: 'München',
                stars: 5,
                text: 'Kindersitz war kostenlos dabei, das Auto war sauber und der Fahrer sehr höflich. Perfekter Service für die Familie.',
                date: 'Januar 2025',
              },
              {
                name: 'Andrea L.',
                city: 'Rosenheim',
                stars: 5,
                text: 'Habe den Service mehrfach für Geschäftsreisen genutzt. Immer pünktlich, immer professionell. Sehr empfehlenswert.',
                date: 'März 2025',
              },
              {
                name: 'David H.',
                city: 'Salzburg',
                stars: 5,
                text: 'Transfer von München nach Salzburg war entspannt und günstig. Festpreis ohne böse Überraschungen. Top!',
                date: 'Februar 2025',
              },
              {
                name: 'Julia R.',
                city: 'Innsbruck',
                stars: 5,
                text: 'Online gebucht, sofort Bestätigung erhalten. Der Fahrer war schon da als wir ankamen. Einfach und stressfrei.',
                date: 'Januar 2025',
              },
            ].map(({ name, city, stars, text, date }) => (
              <div key={name} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={16} className="fill-gold-400 text-gold-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    <p className="text-xs text-gray-500">{city}</p>
                  </div>
                  <p className="text-xs text-gray-400">{date}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <div className="inline-flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-md">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={20} className="fill-gold-400 text-gold-400" />
                ))}
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">4.9 / 5.0</p>
                <p className="text-xs text-gray-500">Basierend auf 100.000+ Fahrten</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Bereit für Ihre Fahrt?</h2>
          <p className="text-primary-200 mb-8 text-lg">Buchen Sie jetzt Ihren Flughafentransfer und fahren Sie stressfrei zum Flughafen München.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#booking"
              className="bg-gold-400 hover:bg-gold-500 text-primary-600 px-8 py-4 rounded-xl font-bold text-lg transition-colors"
            >
              Jetzt online buchen
            </a>
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-8 py-4 rounded-xl font-bold text-lg transition-colors"
            >
              <Phone size={20} />
              {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
