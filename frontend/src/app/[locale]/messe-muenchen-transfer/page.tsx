import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Building2, CalendarClock, Car, Check, Clock, FileText, Luggage, MapPin, Phone, Route, Users } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import CityBooking from '@/components/city/CityBooking';
import { DESTS, quote, eur } from '@/lib/guideQuote';

// Guide: Munich Airport ↔ Messe München (Riem) taxi transfer for trade-fair visitors and exhibitors.
// Price live from the engine (Messe has a fixed route price).

export const dynamic = 'force-dynamic';

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/messe-muenchen-transfer';
type Lang = 'de' | 'en' | 'tr';
type Props = { params: { locale: string } };
const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

const META = (k: Record<Lang, string>): Record<Lang, { title: string; description: string }> => ({
  de: { title: `Taxi Flughafen München ↔ Messe München – Festpreis ${k.de}`, description: `Messe-Transfer vom Flughafen München zur Messe München (Riem) und zum ICM: Festpreis ab ${k.de}, ca. 35 Min. über die A99, Namensschild, Rechnung für Firmen.` },
  en: { title: `Munich Airport to Messe München Taxi – Fixed Price ${k.en}`, description: `Trade fair transfer from Munich Airport to Messe München (Riem) and the ICM: fixed price from ${k.en}, about 35 min via the A99, invoices for companies.` },
  tr: { title: `Münih Havalimanı ↔ Messe München Taksi – Sabit ${k.tr}`, description: `Münih Havalimanı’ndan Messe München’e (Riem) ve ICM’e fuar transferi: ${k.tr}’dan sabit fiyat, A99 üzerinden yaklaşık 35 dk, isim tabelası, firmalara fatura.` },
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = lang(params.locale);
  const q = await quote(DESTS.messe);
  const k = q?.kombi ?? 90;
  const m = META({ de: eur(k, 'de'), en: eur(k, 'en'), tr: eur(k, 'tr') });
  return {
    title: { absolute: m[l].title },
    description: m[l].description,
    alternates: {
      canonical: l === 'de' ? `${BASE}${PATH}` : `${BASE}/${l}${PATH}`,
      languages: { de: `${BASE}${PATH}`, en: `${BASE}/en${PATH}`, tr: `${BASE}/tr${PATH}`, 'x-default': `${BASE}${PATH}` },
    },
    openGraph: { title: m[l].title, description: m[l].description, type: 'article' },
  };
}

const FAIRS = ['bauma', 'BAU', 'IFAT', 'EXPO REAL', 'electronica', 'productronica', 'analytica', 'transport logistic', 'drinktec', 'automatica', 'LASER World of PHOTONICS', 'The smarter E Europe', 'inhorgenta'];

function texts(l: Lang, p: { k: string; v: string; g: string | null }) {
  if (l === 'en') return {
    home: 'Home', crumb: 'Messe München transfer',
    h1a: 'Taxi Munich Airport', h1b: '↔ Messe München',
    sub: 'For visitors and exhibitors: from the terminal straight to the fair entrance or the ICM – at a fixed price, with meet & greet and an invoice for your company.',
    pill: `Fixed price from ${p.k}`,
    tabs: ['To the airport', 'Return trip', 'From the airport'] as [string, string, string], people: ['1–8 passengers', 'Saloon, van & large taxi'] as [string, string],
    formHint: 'Messe München is pre-filled – choose the direction and your date.',
    facts: [['About 45 km', Route], ['Approx. 35 min via the A99', Clock], ['Entrances West, North, East & ICM', MapPin], ['Invoice for companies', FileText]] as const,
    whyTitle: 'Why a taxi to the fair?',
    why: [
      'No changing trains with luggage and booth material – the S-Bahn would mean a change in Munich.',
      'Fixed price per vehicle: colleagues share the ride, the price stays the same.',
      'We drop you at the entrance you need and pick you up again after the fair day.',
      'Your driver tracks your flight and waits with a name sign – also for delayed flights.',
    ],
    pricesTitle: 'Prices airport ↔ Messe München',
    vehicles: [['Saloon', '1–3 people · 3 suitcases', p.k], ['Van', '4–7 people · 8 suitcases', p.v], ...(p.g ? [['Large taxi', '8 people · 10 suitcases', p.g]] : [])],
    from: 'from',
    fairsTitle: 'For all major fairs at Messe München',
    fairsNote: 'During large fairs taxis in Munich are in short supply – book your transfer early.',
    bizTitle: 'For exhibitors and companies',
    biz: ['Several vehicles for your team at the same time', 'Monthly invoice for your company', 'Transfers for customers and guests with name sign', 'Return pickups at the fair entrance planned in advance'],
    faqTitle: 'FAQ',
    faqs: [
      { q: 'How much is a taxi from Munich Airport to Messe München?', a: `There is a fixed price of ${p.k} for a saloon (up to 3 people) and ${p.v} for a van (up to 7 people). The price is fixed before you book.` },
      { q: 'How long does the ride take?', a: 'About 35 minutes for roughly 45 km via the A99 – longer in rush hour and at the start of large fairs.' },
      { q: 'Can you drop us at a specific entrance or the ICM?', a: 'Yes – enter the entrance (West, North, East) or the ICM in the booking or tell the driver.' },
      { q: 'Do you issue invoices to companies?', a: 'Yes, with your company details; regular customers can get a monthly collective invoice.' },
    ],
    ctaTitle: 'Book your fair transfer now', ctaSub: `Fixed price from ${p.k} · meet & greet · invoice for companies`, ctaBook: 'Calculate price',
    more: 'Airport → city centre guide',
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', crumb: 'Messe München transferi',
    h1a: 'Münih Havalimanı taksi', h1b: '↔ Messe München',
    sub: 'Ziyaretçiler ve katılımcılar için: Terminalden doğrudan fuar girişine veya ICM’e – sabit fiyatla, isim tabelasıyla ve firmanıza faturayla.',
    pill: `Sabit fiyat ${p.k}’dan`,
    tabs: ['Havalimanına', 'Gidiş-dönüş', 'Havalimanından'] as [string, string, string], people: ['1–8 kişi', 'Binek, Van ve büyük taksi'] as [string, string],
    formHint: 'Messe München dolu – yönü ve tarihi seçin.',
    facts: [['Yaklaşık 45 km', Route], ['A99 üzerinden yaklaşık 35 dk', Clock], ['Batı, Kuzey, Doğu girişleri & ICM', MapPin], ['Firmalara fatura', FileText]] as const,
    whyTitle: 'Fuara neden taksi?',
    why: [
      'Valiz ve stand malzemesiyle aktarma yok – S-Bahn’la Münih’te aktarma gerekir.',
      'Araç başı sabit fiyat: Meslektaşlar birlikte gider, fiyat değişmez.',
      'Sizi istediğiniz girişe bırakır, fuar gününden sonra tekrar alırız.',
      'Şoförünüz uçuşunuzu takip eder ve isim tabelasıyla bekler – rötarlı uçuşlarda da.',
    ],
    pricesTitle: 'Havalimanı ↔ Messe München fiyatları',
    vehicles: [['Binek', '1–3 kişi · 3 valiz', p.k], ['Van', '4–7 kişi · 8 valiz', p.v], ...(p.g ? [['Büyük taksi', '8 kişi · 10 valiz', p.g]] : [])],
    from: 'başlangıç',
    fairsTitle: 'Messe München’deki tüm büyük fuarlar için',
    fairsNote: 'Büyük fuarlarda Münih’te taksi bulmak zorlaşır – transferinizi erken ayırtın.',
    bizTitle: 'Katılımcılar ve firmalar için',
    biz: ['Ekibiniz için aynı anda birden fazla araç', 'Firmanıza aylık toplu fatura', 'Müşteri ve misafirler için isim tabelalı transfer', 'Fuar girişinden dönüş alışları önceden planlanır'],
    faqTitle: 'Sık sorulan sorular',
    faqs: [
      { q: 'Münih Havalimanı’ndan Messe München’e taksi ne kadar?', a: `Binek araç (3 kişiye kadar) için ${p.k}, Van (7 kişiye kadar) için ${p.v} sabit fiyat. Fiyat rezervasyondan önce belli.` },
      { q: 'Yolculuk ne kadar sürer?', a: 'A99 üzerinden yaklaşık 45 km için yaklaşık 35 dakika – iş trafiğinde ve büyük fuarların açılışında daha uzun.' },
      { q: 'Bizi belirli bir girişe veya ICM’e bırakabilir misiniz?', a: 'Evet – girişi (Batı, Kuzey, Doğu) veya ICM’i rezervasyonda belirtin ya da şoföre söyleyin.' },
      { q: 'Firmalara fatura kesiyor musunuz?', a: 'Evet, firma bilgilerinizle; düzenli müşteriler aylık toplu fatura alabilir.' },
    ],
    ctaTitle: 'Fuar transferinizi şimdi ayırtın', ctaSub: `Sabit fiyat ${p.k}’dan · isim tabelası · firmalara fatura`, ctaBook: 'Fiyat hesapla',
    more: 'Havalimanı → şehir merkezi rehberi',
  };
  return {
    home: 'Startseite', crumb: 'Messe-Transfer München',
    h1a: 'Taxi Flughafen München', h1b: '↔ Messe München',
    sub: 'Für Besucher und Aussteller: vom Terminal direkt zum Messeeingang oder zum ICM – zum Festpreis, mit Namensschild und Rechnung für Ihre Firma.',
    pill: `Festpreis ab ${p.k}`,
    tabs: ['Zum Flughafen', 'Hin & zurück', 'Vom Flughafen'] as [string, string, string], people: ['1–8 Personen', 'Kombi, Van & Großraumtaxi'] as [string, string],
    formHint: 'Die Messe München ist vorausgefüllt – Richtung und Termin wählen.',
    facts: [['Rund 45 km', Route], ['Ca. 35 Min. über die A99', Clock], ['Eingänge West, Nord, Ost & ICM', MapPin], ['Rechnung für Firmen', FileText]] as const,
    whyTitle: 'Warum mit dem Taxi zur Messe?',
    why: [
      'Kein Umsteigen mit Koffern und Standmaterial – mit der S-Bahn müssten Sie in München umsteigen.',
      'Festpreis pro Fahrzeug: Kollegen fahren gemeinsam, der Preis bleibt gleich.',
      'Wir bringen Sie zum gewünschten Eingang und holen Sie nach dem Messetag wieder ab.',
      'Ihr Fahrer verfolgt Ihren Flug und wartet mit Namensschild – auch bei Verspätung.',
    ],
    pricesTitle: 'Preise Flughafen ↔ Messe München',
    vehicles: [['Kombi / Limousine', '1–3 Personen · 3 Koffer', p.k], ['Van', '4–7 Personen · 8 Koffer', p.v], ...(p.g ? [['Großraumtaxi', '8 Personen · 10 Koffer', p.g]] : [])],
    from: 'ab',
    fairsTitle: 'Für alle großen Messen auf der Messe München',
    fairsNote: 'Während großer Messen sind Taxis in München knapp – buchen Sie Ihren Transfer frühzeitig.',
    bizTitle: 'Für Aussteller und Unternehmen',
    biz: ['Mehrere Fahrzeuge gleichzeitig für Ihr Team', 'Monatliche Sammelrechnung für Ihre Firma', 'Transfers für Kunden und Gäste mit Namensschild', 'Rückfahrten am Messeeingang vorab planen'],
    faqTitle: 'Häufige Fragen',
    faqs: [
      { q: 'Was kostet ein Taxi vom Flughafen München zur Messe München?', a: `Es gilt ein Festpreis von ${p.k} für Kombi/Limousine (bis 3 Personen) und ${p.v} für den Van (bis 7 Personen). Der Preis steht vor der Buchung fest.` },
      { q: 'Wie lange dauert die Fahrt?', a: 'Rund 35 Minuten für etwa 45 km über die A99 – im Berufsverkehr und zu Beginn großer Messen länger.' },
      { q: 'Fahren Sie bis zu einem bestimmten Eingang oder zum ICM?', a: 'Ja – geben Sie den Eingang (West, Nord, Ost) oder das ICM bei der Buchung an oder sagen Sie es dem Fahrer.' },
      { q: 'Bekommen Firmen eine Rechnung?', a: 'Ja, mit Ihren Firmendaten; Stammkunden erhalten auf Wunsch eine monatliche Sammelrechnung.' },
    ],
    ctaTitle: 'Jetzt Messe-Transfer buchen', ctaSub: `Festpreis ab ${p.k} · Namensschild · Rechnung für Firmen`, ctaBook: 'Preis berechnen',
    more: 'Ratgeber: Flughafen → Innenstadt',
  };
}

export default async function MesseTransferPage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const q = await quote(DESTS.messe);
  const p = { k: eur(q?.kombi ?? 90, l), v: eur(q?.van ?? 100, l), g: q?.grossraumtaxi ? eur(q.grossraumtaxi, l) : null };
  const t = texts(l, p);
  const url = `${BASE}${prefix}${PATH}`;
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'TaxiService', name: t.crumb, url,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
      areaServed: [{ '@type': 'Airport', name: 'Flughafen München', iataCode: 'MUC' }, { '@type': 'Place', name: 'Messe München' }],
      ...(q ? { offers: [{ '@type': 'Offer', name: t.vehicles[0][0], price: q.kombi.toFixed(2), priceCurrency: 'EUR' }, { '@type': 'Offer', name: t.vehicles[1][0], price: q.van.toFixed(2), priceCurrency: 'EUR' }] } : {}),
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${BASE}${prefix}` },
      { '@type': 'ListItem', position: 2, name: t.crumb, item: url },
    ] },
  ];

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/55 to-primary-900/10" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-32">
          <nav className="mb-8 flex items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link><ArrowRight size={12} /><span className="text-white">{t.crumb}</span>
          </nav>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {t.h1a} <span className="text-gold-400">{t.h1b}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90 drop-shadow">{t.sub}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-lg font-bold ring-1 ring-white/20 backdrop-blur">
            <BadgeCheck size={20} className="text-gold-400" /> {t.pill}
          </div>
          <ul className="mt-6 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {t.facts.map(([x, Icon]) => <li key={x} className="flex items-center gap-2 text-sm"><Icon size={20} className="shrink-0 text-gold-400" /> {x}</li>)}
          </ul>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div id="booking" className="-mt-20 scroll-mt-28">
          <CityBooking pickup={DESTS.messe.address} tabs={t.tabs} people={t.people} initialMode="arrival" />
          <p className="mt-2 px-1 text-xs text-gray-500">{t.formHint}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl bg-primary-900 p-6 text-white shadow-lg">
            <h2 className="text-2xl font-extrabold">{t.pricesTitle}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {t.vehicles.map(([name, sub, price], i) => (
                <div key={name} className={`rounded-xl bg-white p-4 text-gray-900 ${i === 0 ? 'ring-[3px] ring-gold-400' : ''}`}>
                  <div className="flex items-center gap-2 font-bold"><Car size={16} className="text-primary-700" /> {name}</div>
                  <div className="mt-1 text-xs text-gray-500">{sub}</div>
                  <div className="mt-3 text-sm text-gray-500">{t.from}</div>
                  <div className="whitespace-nowrap text-2xl font-extrabold text-primary-800 xl:text-3xl">{price}</div>
                </div>
              ))}
            </div>
            <a href="#booking" className="mt-5 inline-block rounded-lg bg-gold-400 px-5 py-2.5 font-bold text-primary-900 hover:bg-gold-300">{t.ctaBook} →</a>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.whyTitle}</h2>
            <ul className="mt-4 space-y-3">
              {t.why.map((x) => <li key={x} className="flex gap-2.5 text-sm leading-relaxed text-gray-700"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
            </ul>
          </section>
        </div>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><CalendarClock size={22} className="text-primary-700" /> {t.fairsTitle}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {FAIRS.map((f) => <li key={f} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800">{f}</li>)}
          </ul>
          <p className="mt-4 text-sm text-gray-600">{t.fairsNote}</p>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><Building2 size={22} className="text-primary-700" /> {t.bizTitle}</h2>
            <ul className="mt-4 space-y-2">
              {t.biz.map((x, i) => {
                const Icon = [Users, FileText, Luggage, MapPin][i];
                return <li key={x} className="flex gap-2.5 text-sm text-gray-700"><Icon size={17} className="mt-0.5 shrink-0 text-gold-600" /> {x}</li>;
              })}
            </ul>
            <Link href={`${prefix}/business`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline">Business <ArrowRight size={14} /></Link>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.faqTitle}</h2>
            <div className="mt-4 space-y-2">
              {t.faqs.map(({ q: qq, a }) => (
                <details key={qq} className="group rounded-lg ring-1 ring-gray-200 open:ring-gold-300">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-gray-800">{qq}<span className="shrink-0 text-lg leading-none text-gray-400 transition group-open:rotate-45">+</span></summary>
                  <p className="px-3 pb-3 text-sm leading-relaxed text-gray-600">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section className="my-12 rounded-3xl bg-gradient-to-br from-gold-400 to-gold-500 p-8 text-center md:p-12">
          <h2 className="text-2xl font-extrabold text-primary-900 md:text-3xl">{t.ctaTitle}</h2>
          <p className="mt-2 text-primary-900/80">{t.ctaSub}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a href="#booking" className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white hover:bg-primary-800">{t.ctaBook} →</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
          <Link href={`${prefix}/munich-airport-to-city-centre`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900 hover:underline">{t.more} <ArrowRight size={14} /></Link>
        </section>
      </div>
    </div>
  );
}
