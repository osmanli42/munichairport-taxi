import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Taxi Flughafen München: Kosten, Dauer & Festpreis 2026',
  description:
    'Was kostet ein Taxi zum Flughafen München? Alle Festpreise 2026, Fahrtdauer aus verschiedenen Stadtteilen und Tipps für eine stressfreie Anreise.',
  alternates: {
    canonical: '/blog/taxi-flughafen-muenchen',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Was kostet ein Taxi vom Flughafen München in die Innenstadt?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ein Festpreis-Taxi von Flughafen-muenchen.TAXI kostet vom Hauptbahnhof/Innenstadt zum Flughafen München ab 88 € für einen Kombi. Van und Großraumtaxi sind für Gruppen ab 4 Personen verfügbar.',
      },
    },
    {
      '@type': 'Question',
      name: 'Wie lange dauert ein Taxi vom Flughafen München ins Zentrum?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Die Fahrt vom Flughafen München (MUC) in die Münchner Innenstadt dauert je nach Verkehrslage 35 bis 50 Minuten. Die Straßenstrecke beträgt ca. 38 km über die A9.',
      },
    },
    {
      '@type': 'Question',
      name: 'Was passiert bei Flugverspätung?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Wir überwachen Ihren Flug in Echtzeit und warten bis zu 60 Minuten kostenlos auf Sie. Bei Verspätungen passen wir die Abholzeit automatisch an – kein Aufpreis.',
      },
    },
    {
      '@type': 'Question',
      name: 'Gibt es Kindersitze im Taxi zum Flughafen München?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ja, Kindersitze (Babyschale, Kindersitz, Sitzerhöhung) sind bei uns kostenlos. Bitte bei der Buchung angeben.',
      },
    },
    {
      '@type': 'Question',
      name: 'Wie früh sollte ich das Taxi zum Flughafen München bestellen?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Empfehlenswert ist eine Vorbestellung 24–48 Stunden im Voraus. Planen Sie die Abfahrt mindestens 60–90 Minuten vor dem Check-in ein.',
      },
    },
  ],
};

const PRICES = [
  { area: 'München Hauptbahnhof / Innenstadt', km: 38, kombi: 88, van: 94 },
  { area: 'Schwabing / Maxvorstadt', km: 35, kombi: 82, van: 87 },
  { area: 'Bogenhausen / Haidhausen', km: 32, kombi: 75, van: 80 },
  { area: 'Pasing / Sendling', km: 45, kombi: 103, van: 109 },
  { area: 'Unterschleißheim', km: 15, kombi: 40, van: 43 },
  { area: 'Garching', km: 12, kombi: 33, van: 36 },
  { area: 'Freising', km: 10, kombi: 29, van: 32 },
  { area: 'Augsburg', km: 85, kombi: 187, van: 197 },
  { area: 'Salzburg', km: 145, kombi: 313, van: 329 },
];

export default function TaxiFlughafenMuenchenPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-primary-600">Home</Link>
          <span className="mx-2">›</span>
          <span>Taxi Flughafen München</span>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl lg:text-4xl font-bold text-primary-600 leading-tight mb-4">
            Taxi Flughafen München: Kosten, Fahrtdauer & Festpreise 2026
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Ob früher Morgenflieger oder später Nachtflug – ein zuverlässiges Taxi zum Flughafen München
            ist für viele Reisende die bequemste Option. In diesem Ratgeber erfahren Sie alles Wichtige:
            Was kostet die Fahrt? Wie lange dauert sie? Und warum lohnt sich ein Festpreis-Taxi?
          </p>
        </header>

        {/* CTA Box */}
        <div className="bg-primary-600 text-white rounded-2xl p-6 mb-10 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-lg">Jetzt Festpreis berechnen</p>
            <p className="text-primary-200 text-sm">In 60 Sekunden online buchen – kein Taxameter, kein Stress.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/#booking"
              className="bg-gold-400 hover:bg-gold-500 text-primary-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              Preis berechnen →
            </Link>
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              <Phone size={14} />
              Anrufen
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Wie weit ist der Flughafen München vom Stadtzentrum entfernt?
          </h2>
          <p>
            Der Flughafen München (MUC) liegt rund <strong>38 Kilometer nördlich</strong> der Münchner Innenstadt
            in der Gemeinde Freising. Die Hauptroute führt über die A9 – je nach Tageszeit und Verkehr dauert
            die Fahrt <strong>35 bis 50 Minuten</strong>.
          </p>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Was kostet ein Taxi zum Flughafen München? Festpreise 2026
          </h2>
          <p>
            Bei uns zahlen Sie immer einen <strong>Festpreis</strong> – unabhängig von Staus oder Umwegen.
            Der genaue Preis hängt von Ihrem Abholort ab:
          </p>

          {/* Price table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary-600 text-white">
                  <th className="text-left px-4 py-3 rounded-tl-lg">Abholort</th>
                  <th className="text-center px-4 py-3">Entfernung</th>
                  <th className="text-center px-4 py-3">Kombi</th>
                  <th className="text-center px-4 py-3 rounded-tr-lg">Van</th>
                </tr>
              </thead>
              <tbody>
                {PRICES.map((row, i) => (
                  <tr key={row.area} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.area}</td>
                    <td className="px-4 py-3 text-center text-gray-500">~{row.km} km</td>
                    <td className="px-4 py-3 text-center font-bold text-primary-600">ab {row.kombi} €</td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">ab {row.van} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 -mt-2 mb-6">
            * Preise für einfache Fahrt inkl. Gepäck. Kindersitz kostenlos auf Anfrage. Fahrradtransport auf Anfrage.
          </p>

          <h3 className="text-xl font-bold text-gray-800 mt-8 mb-3">Festpreis vs. Taxameter – was ist günstiger?</h3>
          <p>
            Ein normales Münchner Taxi mit Taxameter berechnet <strong>5,90 € Grundgebühr + 2,70 € pro Kilometer</strong>.
            Bei 38 km wären das mindestens 109 € – ohne Wartezeit im Stau.
            Bei 20 Minuten Stau kommen schnell weitere 15–20 € dazu.
          </p>
          <p>
            Mit unserem Festpreis zahlen Sie immer denselben Betrag – egal wie lange Sie im Stau stehen.
          </p>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Wie lange dauert die Taxifahrt zum Flughafen München?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
            {[
              { from: 'München Innenstadt / Hbf', time: '35–50 Min.' },
              { from: 'Schwabing / Maxvorstadt', time: '35–45 Min.' },
              { from: 'Pasing / Sendling', time: '40–55 Min.' },
              { from: 'Garching', time: '20–30 Min.' },
              { from: 'Unterschleißheim', time: '20–30 Min.' },
              { from: 'Freising', time: '15–20 Min.' },
            ].map(({ from, time }) => (
              <div key={from} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-700">{from}</span>
                <span className="text-sm font-bold text-primary-600 ml-4 shrink-0">{time}</span>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-bold text-gray-800 mt-8 mb-3">Tipps für eine pünktliche Anreise</h3>
          <ul className="space-y-2 text-gray-700">
            <li><strong>Frühflüge (vor 8 Uhr):</strong> Wenig Verkehr – 60 Minuten Puffer genügen meist.</li>
            <li><strong>Tagesflüge (8–17 Uhr):</strong> 75–90 Minuten einplanen.</li>
            <li><strong>Freitagnachmittag & Messzeiten:</strong> Stau auf der A9 fast garantiert – 90+ Minuten Puffer.</li>
            <li><strong>Nachtflüge:</strong> Wenig Verkehr, 60 Minuten reichen in der Regel.</li>
          </ul>
          <p className="mt-3">
            Wir überwachen Ihren Flug in Echtzeit und passen die Abholzeit bei Verspätungen automatisch an.
          </p>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Taxi Flughafen München buchen – so einfach geht's
          </h2>
          <ol className="space-y-4 my-4">
            {[
              { step: '1', title: 'Adresse eingeben', text: 'Abholort, Ziel, Datum und Uhrzeit eingeben – dauert 60 Sekunden.' },
              { step: '2', title: 'Fahrzeug & Festpreis wählen', text: 'Kombi, Van oder Großraumtaxi wählen. Ihr Preis wird sofort angezeigt.' },
              { step: '3', title: 'Bestätigung erhalten', text: 'Sofortige E-Mail-Bestätigung. Bezahlung bar oder per Karte – ohne Aufschlag.' },
            ].map(({ step, title, text }) => (
              <li key={step} className="flex gap-4 items-start">
                <span className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {step}
                </span>
                <div>
                  <p className="font-semibold text-gray-800">{title}</p>
                  <p className="text-gray-600 text-sm">{text}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Welches Fahrzeug passt zu Ihrer Reise?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
            {[
              { name: 'Kombi', model: 'Mercedes E-Klasse', persons: 'bis 4 Personen', luggage: 'bis 4 Koffer', best: 'Einzelreisende & Paare' },
              { name: 'Van / Minibus', model: 'Mercedes Viano', persons: 'bis 7 Personen', luggage: 'bis 10 Koffer', best: 'Familien & Gruppen' },
              { name: 'Großraumtaxi', model: 'Mercedes Vito', persons: 'bis 8 Personen', luggage: 'bis 12 Koffer', best: 'Große Gruppen' },
            ].map((v) => (
              <div key={v.name} className="border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-primary-600 text-lg mb-1">{v.name}</p>
                <p className="text-xs text-gray-400 mb-3">{v.model}</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>👥 {v.persons}</p>
                  <p>🧳 {v.luggage}</p>
                  <p>✓ Ideal für: {v.best}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Taxi zum Flughafen München mit Kind
          </h2>
          <p>
            Reisen Sie mit Kindern? Bei uns ist der <strong>Kindersitz kostenlos</strong> – Babyschale,
            Kindersitz und Sitzerhöhung auf Anfrage. Bitte bei der Buchung angeben.
            In Deutschland gilt die Kindersitzpflicht auch im Taxi.
          </p>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Taxi vom Flughafen München – Abholung bei der Ankunft
          </h2>
          <p>
            Bei vorgebuchten Fahrten empfängt Sie Ihr Fahrer mit einem Namensschild im Ankunftsbereich –
            kein Suchen, kein Schlangestehen. Wir überwachen Ihren Flug und warten bis zu
            <strong> 60 Minuten kostenlos</strong> bei Verspätungen.
          </p>
          <p className="mt-2">
            Alternativ: An den Taxiständen direkt vor den Ankunftshallen von <strong>Terminal 1</strong> und
            <strong> Terminal 2</strong> stehen reguläre Taxis bereit – jedoch ohne Festpreis.
          </p>

          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-4">
            Taxi vs. S-Bahn zum Flughafen München
          </h2>
          <div className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-4 py-3"></th>
                  <th className="text-center px-4 py-3 font-bold text-primary-600">Festpreis-Taxi</th>
                  <th className="text-center px-4 py-3 font-bold text-gray-600">S-Bahn (S1/S8)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ['Fahrzeit', '35–50 Min.', '40–50 Min.'],
                  ['Preis (1 Person)', 'ab 88 €', 'ca. 13 €'],
                  ['Preis (4 Personen)', 'ab 88 €', 'ca. 52 €'],
                  ['Haustür-Service', '✓', '✗'],
                  ['Gepäck', 'Unbegrenzt', 'Begrenzt'],
                  ['Kinderwagen', '✓', 'Eingeschränkt'],
                  ['24/7 verfügbar', '✓', 'Eingeschränkt'],
                  ['Bei Flugverspätung', 'Flexibel', 'Starrer Fahrplan'],
                ].map(([label, taxi, sbahn]) => (
                  <tr key={label} className="even:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
                    <td className="px-4 py-2.5 text-center text-primary-600 font-medium">{taxi}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{sbahn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-600">
            <strong>Fazit:</strong> Ab 2 Personen ist das Festpreis-Taxi pro Person günstiger als die S-Bahn –
            und deutlich komfortabler mit Gepäck.
          </p>

          {/* FAQ */}
          <h2 className="text-2xl font-bold text-primary-600 mt-10 mb-6">
            Häufige Fragen zum Taxi Flughafen München
          </h2>
          <div className="space-y-4">
            {faqSchema.mainEntity.map((faq) => (
              <details key={faq.name} className="border border-gray-200 rounded-xl group">
                <summary className="px-5 py-4 cursor-pointer font-semibold text-gray-800 list-none flex justify-between items-center">
                  {faq.name}
                  <span className="text-primary-600 group-open:rotate-180 transition-transform shrink-0 ml-3">▾</span>
                </summary>
                <p className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">
                  {faq.acceptedAnswer.text}
                </p>
              </details>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-12 bg-gradient-to-br from-primary-600 to-primary-800 text-white rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Bereit für Ihre Fahrt?</h2>
          <p className="text-primary-200 mb-6">
            Jetzt Festpreis berechnen und in 60 Sekunden online buchen.
            Pünktlich, professionell, 24/7.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#booking"
              className="bg-gold-400 hover:bg-gold-500 text-primary-600 px-8 py-3 rounded-xl font-bold transition-colors"
            >
              Jetzt online buchen →
            </Link>
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-8 py-3 rounded-xl font-bold transition-colors"
            >
              <Phone size={18} />
              {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
