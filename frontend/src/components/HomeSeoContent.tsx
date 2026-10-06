import Link from 'next/link';
import { ChevronDown, MapPin } from 'lucide-react';

// Startseite: Textblock + FAQ für die Hauptkeywords („Taxi Flughafen München“,
// „Munich Airport Taxi“, „Münih Havalimanı Taksi“). Serverseitig gerendert,
// damit Google den Inhalt ohne JavaScript sieht; FAQ zusätzlich als FAQPage-Schema.

type Block = { h3: string; p: string };
type Copy = {
  eyebrow: string;
  h2: string;
  intro: string;
  blocks: Block[];
  guide: string;
  meeting: string;
  citiesTitle: string;
  faqTitle: string;
  faqs: { q: string; a: string }[];
};

const COPY: Record<'de' | 'en' | 'tr', Copy> = {
  de: {
    eyebrow: 'Flughafentransfer München',
    h2: 'Flughafentaxi München zum Festpreis, rund um die Uhr',
    intro:
      'Ob Abflug oder Ankunft: Mit Flughafen-muenchen.TAXI buchen Sie Ihr Taxi zum Flughafen München (MUC) online in weniger als einer Minute. Der Preis wird vor der Buchung berechnet und bleibt fest – auch bei Stau oder Umleitung.',
    blocks: [
      { h3: 'Festpreis statt Taxameter', p: 'Sie sehen den Endpreis für Kombi, Van oder Großraumtaxi, bevor Sie buchen. Kein Stauaufschlag, keine versteckten Kosten – bezahlt wird bar oder per Kreditkarte.' },
      { h3: 'Abholung am Terminal 1 & 2', p: 'Bei der Ankunft wartet Ihr Fahrer mit Namensschild im Ankunftsbereich. Wir überwachen Ihren Flug und warten bei Verspätung bis zu 60 Minuten kostenlos.' },
      { h3: 'Fahrtzeit & Strecke', p: 'Von der Münchner Innenstadt zum Flughafen sind es rund 38 km über die A9 – je nach Verkehr 35 bis 50 Minuten. Wir fahren aus ganz Bayern, Österreich und der Schweiz.' },
      { h3: 'Für Familien, Gruppen & Firmen', p: 'Kindersitz kostenlos auf Anfrage, Van bis 7 und Großraumtaxi bis 8 Personen mit viel Platz für Gepäck. Firmenkunden erhalten eine Sammelrechnung.' },
    ],
    guide: 'Taxi Flughafen München: alle Preise und Fahrzeiten',
    meeting: 'Treffpunkte am Flughafen München',
    citiesTitle: 'Beliebte Strecken zum Flughafen München',
    faqTitle: 'Häufige Fragen zum Taxi Flughafen München',
    faqs: [
      { q: 'Was kostet ein Taxi zum Flughafen München?', a: 'Der Preis hängt von Abholadresse und Fahrzeug ab. Geben Sie Ihre Adresse oben ein – Sie sehen sofort Ihren Festpreis für Kombi, Van und Großraumtaxi, ohne Stau- oder Wartezeitaufschlag.' },
      { q: 'Wie lange dauert die Fahrt von München zum Flughafen?', a: 'Aus der Innenstadt sind es etwa 38 km über die A9. Je nach Verkehrslage dauert die Fahrt 35 bis 50 Minuten.' },
      { q: 'Was passiert, wenn mein Flug Verspätung hat?', a: 'Wir überwachen Ihren Flug automatisch und passen die Abholzeit an. Bis zu 60 Minuten Wartezeit sind kostenlos.' },
      { q: 'Wo treffe ich meinen Fahrer am Flughafen?', a: 'Ihr Fahrer wartet mit Namensschild im Ankunftsbereich von Terminal 1 oder Terminal 2. Vor der Fahrt erhalten Sie seine Telefonnummer.' },
      { q: 'Kann ich mit Kreditkarte bezahlen?', a: 'Ja, per Kreditkarte vor Fahrtantritt oder bar am Ende der Fahrt.' },
      { q: 'Kann ich kostenlos stornieren?', a: 'Ja, bis 3 Stunden vor Abfahrt können Sie Ihre Buchung online kostenlos stornieren.' },
    ],
  },
  en: {
    eyebrow: 'Munich Airport transfer',
    h2: 'Munich Airport Taxi – fixed price, 24/7',
    intro:
      'Departing or arriving: with Flughafen-muenchen.TAXI you book your taxi to or from Munich Airport (MUC) online in under a minute. The price is calculated before you book and stays fixed – even in traffic or on a detour.',
    blocks: [
      { h3: 'Fixed price, no meter', p: 'You see the final price for estate car, van or large taxi before booking. No traffic surcharge, no hidden costs – pay in cash or by credit card.' },
      { h3: 'Pickup at Terminal 1 & 2', p: 'On arrival your driver waits in the arrivals area with a name sign. We track your flight and wait up to 60 minutes free of charge if it is delayed.' },
      { h3: 'Travel time & route', p: 'Munich city centre to the airport is about 38 km via the A9 – 35 to 50 minutes depending on traffic. We drive from all over Bavaria, Austria and Switzerland.' },
      { h3: 'For families, groups & companies', p: 'Child seat free on request, van for up to 7 and large taxi for up to 8 passengers with plenty of luggage space. Corporate clients receive a collective invoice.' },
    ],
    guide: 'Guide: how much is a taxi to Munich Airport? (German)',
    meeting: 'Meeting points at Munich Airport',
    citiesTitle: 'Popular routes to Munich Airport',
    faqTitle: 'FAQ – Munich Airport Taxi',
    faqs: [
      { q: 'How much is a taxi to Munich Airport?', a: 'It depends on your pickup address and vehicle. Enter your address above to see your fixed price for estate car, van and large taxi instantly – no traffic or waiting surcharge.' },
      { q: 'How long does the taxi from Munich to the airport take?', a: 'From the city centre it is about 38 km via the A9. Depending on traffic the ride takes 35 to 50 minutes.' },
      { q: 'What if my flight is delayed?', a: 'We track your flight automatically and adjust the pickup time. Up to 60 minutes of waiting time are free.' },
      { q: 'Where do I meet my driver at the airport?', a: 'Your driver waits with a name sign in the arrivals area of Terminal 1 or Terminal 2. You receive the driver’s phone number before the ride.' },
      { q: 'Can I pay by credit card?', a: 'Yes, by credit card before the ride or in cash at the end of the ride.' },
      { q: 'Can I cancel for free?', a: 'Yes, you can cancel your booking online free of charge up to 3 hours before departure.' },
    ],
  },
  tr: {
    eyebrow: 'Münih Havalimanı transferi',
    h2: 'Münih Havalimanı Taksi – sabit fiyat, 7/24',
    intro:
      'Gidiş ya da varış: Flughafen-muenchen.TAXI ile Münih Havalimanı (MUC) taksinizi bir dakikadan kısa sürede online ayırtın. Fiyat rezervasyondan önce hesaplanır ve sabit kalır – trafikte veya yol değişikliğinde bile.',
    blocks: [
      { h3: 'Taksimetre yok, sabit fiyat', p: 'Kombi, Van veya Büyük Taksi için son fiyatı rezervasyondan önce görürsünüz. Trafik ek ücreti yok, gizli maliyet yok – nakit veya kredi kartıyla ödeme.' },
      { h3: 'Terminal 1 & 2’de karşılama', p: 'Varışta şoförünüz isim tabelasıyla geliş salonunda bekler. Uçuşunuzu takip ederiz; gecikmede 60 dakikaya kadar ücretsiz bekleriz.' },
      { h3: 'Süre ve güzergâh', p: 'Münih şehir merkezinden havalimanına A9 üzerinden yaklaşık 38 km – trafiğe göre 35–50 dakika. Tüm Bavyera, Avusturya ve İsviçre’den transfer yapıyoruz.' },
      { h3: 'Aileler, gruplar ve firmalar için', p: 'Çocuk koltuğu talep üzerine ücretsiz; 7 kişiye kadar Van, 8 kişiye kadar Büyük Taksi ve geniş bagaj alanı. Firmalara toplu fatura.' },
    ],
    guide: 'Rehber: Münih Havalimanı taksi ne kadar? (Almanca)',
    meeting: 'Münih Havalimanı buluşma noktaları',
    citiesTitle: 'Münih Havalimanı’na popüler güzergâhlar',
    faqTitle: 'Münih Havalimanı Taksi – Sık Sorulan Sorular',
    faqs: [
      { q: 'Münih Havalimanı’na taksi ne kadar?', a: 'Fiyat alış adresine ve araca göre değişir. Yukarıya adresinizi girin – Kombi, Van ve Büyük Taksi için sabit fiyatınızı hemen görürsünüz; trafik veya bekleme ek ücreti yoktur.' },
      { q: 'Münih’ten havalimanına taksi ne kadar sürer?', a: 'Şehir merkezinden A9 üzerinden yaklaşık 38 km’dir. Trafiğe göre yolculuk 35–50 dakika sürer.' },
      { q: 'Uçuşum gecikirse ne olur?', a: 'Uçuşunuzu otomatik takip eder, alış saatini ayarlarız. 60 dakikaya kadar bekleme ücretsizdir.' },
      { q: 'Havalimanında şoförle nerede buluşurum?', a: 'Şoförünüz Terminal 1 veya Terminal 2 geliş salonunda isim tabelasıyla bekler. Yolculuktan önce şoförün telefon numarasını alırsınız.' },
      { q: 'Kredi kartıyla ödeyebilir miyim?', a: 'Evet, yolculuktan önce kredi kartıyla veya yolculuk sonunda nakit.' },
      { q: 'Ücretsiz iptal edebilir miyim?', a: 'Evet, kalkıştan 3 saat öncesine kadar rezervasyonunuzu online ücretsiz iptal edebilirsiniz.' },
    ],
  },
};

const CITIES: { slug: string; name: string }[] = [
  { slug: 'taxi-muenchen-flughafen-muenchen', name: 'München' },
  { slug: 'taxi-freising-flughafen-muenchen', name: 'Freising' },
  { slug: 'taxi-erding-flughafen-muenchen', name: 'Erding' },
  { slug: 'taxi-landshut-flughafen-muenchen', name: 'Landshut' },
  { slug: 'taxi-augsburg-flughafen-muenchen', name: 'Augsburg' },
  { slug: 'taxi-ingolstadt-flughafen-muenchen', name: 'Ingolstadt' },
  { slug: 'taxi-regensburg-flughafen-muenchen', name: 'Regensburg' },
  { slug: 'taxi-rosenheim-flughafen-muenchen', name: 'Rosenheim' },
  { slug: 'taxi-nuernberg-flughafen-muenchen', name: 'Nürnberg' },
  { slug: 'taxi-garmisch-partenkirchen-flughafen-muenchen', name: 'Garmisch-Partenkirchen' },
  { slug: 'taxi-salzburg-flughafen-muenchen', name: 'Salzburg' },
  { slug: 'taxi-innsbruck-flughafen-muenchen', name: 'Innsbruck' },
];

export default function HomeSeoContent({ locale }: { locale: string }) {
  const c = COPY[(locale as keyof typeof COPY)] ?? COPY.de;
  const prefix = locale === 'de' ? '' : `/${locale}`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section className="py-16 bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-[.18em] uppercase mb-3 text-gold-500">{c.eyebrow}</p>
          <h2 className="text-3xl font-bold text-primary-600">{c.h2}</h2>
          <p className="text-gray-600 mt-4 leading-relaxed">{c.intro}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {c.blocks.map((b) => (
            <div key={b.h3} className="border-l-4 border-gold-400 pl-5">
              <h3 className="text-lg font-bold text-primary-700">{b.h3}</h3>
              <p className="text-gray-600 mt-1.5 leading-relaxed">{b.p}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <Link href="/blog/taxi-flughafen-muenchen" className="text-primary-600 hover:text-gold-600 underline underline-offset-4">{c.guide}</Link>
          <Link href={`${prefix}/treffpunkt-flughafen-muenchen`} className="text-primary-600 hover:text-gold-600 underline underline-offset-4">{c.meeting}</Link>
        </div>

        <div className="mt-12">
          <h3 className="text-lg font-bold text-primary-700">{c.citiesTitle}</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`${prefix}/blog/${city.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-700 hover:border-gold-400 hover:text-primary-700 transition-colors"
                >
                  <MapPin size={14} className="text-gold-500" />
                  Taxi {city.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-bold text-primary-600">{c.faqTitle}</h2>
          <div className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50/60">
            {c.faqs.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-primary-700">
                  {f.q}
                  <ChevronDown size={18} className="shrink-0 text-gold-500 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
