import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Camera, Car, Check, Clock, Hourglass, MapPin, MessageCircle, Phone, Plane, Route, Users } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

// Sightseeing & day trips by taxi from Munich / Munich Airport. Price per trip on request
// (round trip incl. waiting on site, agreed before the trip) – no hourly chauffeur service.
// Distances/times: approx. from Munich city centre by road.

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/sightseeing';
type Lang = 'de' | 'en' | 'tr';
type Props = { params: { locale: string } };
const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

const META: Record<Lang, { title: string; description: string }> = {
  de: { title: 'Sightseeing & Ausflüge mit dem Taxi ab München – Neuschwanstein, Königssee', description: 'Tagesausflüge mit dem Taxi ab München und vom Flughafen: Neuschwanstein, Königssee, Chiemsee, Salzburg, Zugspitze, Dachau. Fahrer wartet vor Ort, Pauschalpreis vorab.' },
  en: { title: 'Sightseeing & Day Trips by Taxi from Munich – Neuschwanstein, Königssee', description: 'Day trips by taxi from Munich and Munich Airport: Neuschwanstein, Königssee, Chiemsee, Salzburg, Zugspitze, Dachau. Driver waits on site, package price agreed upfront.' },
  tr: { title: 'Münih’ten Taksiyle Gezi & Günübirlik Turlar – Neuschwanstein, Königssee', description: 'Münih’ten ve havalimanından taksiyle günübirlik gezi: Neuschwanstein, Königssee, Chiemsee, Salzburg, Zugspitze, Dachau. Şoför orada bekler, paket fiyat önceden belli.' },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = lang(params.locale);
  const m = META[l];
  return {
    title: { absolute: m.title },
    description: m.description,
    alternates: {
      canonical: l === 'de' ? `${BASE}${PATH}` : `${BASE}/${l}${PATH}`,
      languages: { de: `${BASE}${PATH}`, en: `${BASE}/en${PATH}`, tr: `${BASE}/tr${PATH}`, 'x-default': `${BASE}${PATH}` },
    },
    openGraph: { title: m.title, description: m.description, type: 'article', images: [`${BASE}/images/sightseeing/hero.webp`] },
  };
}

type Trip = { name: string; km: string; time: string; text: Record<Lang, string>; city?: string };

// `city` = existing city page (/blog/<slug>) for the one-way transfer.
const TRIPS: Trip[] = [
  { name: 'Schloss Neuschwanstein & Hohenschwangau', km: '~125 km', time: '~1 h 50', text: {
    de: 'Das Märchenschloss König Ludwigs II. über dem Alpsee. Tipp: Eintrittskarten vorab online reservieren.',
    en: 'King Ludwig II’s fairytale castle above the Alpsee. Tip: reserve your entrance tickets online in advance.',
    tr: 'Kral II. Ludwig’in Alpsee üzerindeki masal şatosu. İpucu: Giriş biletlerini önceden online ayırtın.' } },
  { name: 'Königssee & Berchtesgaden', km: '~155 km', time: '~2 h', city: 'taxi-berchtesgaden-flughafen-muenchen', text: {
    de: 'Smaragdgrüner Bergsee mit Bootsfahrt nach St. Bartholomä – auf Wunsch mit Halt am Kehlsteinhaus.',
    en: 'Emerald mountain lake with a boat trip to St. Bartholomä – on request with a stop near the Eagle’s Nest.',
    tr: 'St. Bartholomä’ya tekne turuyla zümrüt yeşili dağ gölü – istenirse Kehlsteinhaus’ta mola.' } },
  { name: 'Chiemsee & Herrenchiemsee', km: '~90 km', time: '~1 h 10', city: 'taxi-prien-am-chiemsee-flughafen-muenchen', text: {
    de: 'Mit dem Schiff ab Prien zur Herreninsel und zum Schloss Herrenchiemsee, Bayerns „Versailles“.',
    en: 'By boat from Prien to the Herreninsel and Herrenchiemsee Palace, Bavaria’s “Versailles”.',
    tr: 'Prien’den gemiyle Herreninsel’e ve Bavyera’nın “Versailles”ı Herrenchiemsee Sarayı’na.' } },
  { name: 'Salzburg', km: '~145 km', time: '~1 h 45', city: 'taxi-salzburg-flughafen-muenchen', text: {
    de: 'Mozarts Geburtsstadt: Altstadt, Festung Hohensalzburg und Mirabellgarten – an einem Tag gut machbar.',
    en: 'Mozart’s birthplace: old town, Hohensalzburg Fortress and Mirabell Gardens – easy in one day.',
    tr: 'Mozart’ın doğduğu şehir: Eski şehir, Hohensalzburg Kalesi ve Mirabell Bahçesi – bir günde rahatça.' } },
  { name: 'Zugspitze & Garmisch-Partenkirchen', km: '~90 km', time: '~1 h 15', city: 'taxi-garmisch-partenkirchen-flughafen-muenchen', text: {
    de: 'Auf Deutschlands höchsten Berg mit der Seilbahn ab Eibsee – danach Bummel durch Garmisch.',
    en: 'Up Germany’s highest mountain by cable car from the Eibsee – then a stroll through Garmisch.',
    tr: 'Eibsee’den teleferikle Almanya’nın en yüksek dağına – ardından Garmisch’te yürüyüş.' } },
  { name: 'Schloss Linderhof & Oberammergau', km: '~95 km', time: '~1 h 20', text: {
    de: 'Ludwigs kleinstes Schloss mit Venusgrotte und das Passionsspieldorf mit bemalten Häusern.',
    en: 'Ludwig’s smallest palace with its Venus Grotto, and the Passion Play village with painted houses.',
    tr: 'Ludwig’in Venüs mağaralı en küçük sarayı ve boyalı evleriyle Passion Play köyü.' } },
  { name: 'KZ-Gedenkstätte Dachau', km: '~20 km', time: '~30 min', city: 'taxi-dachau-flughafen-muenchen', text: {
    de: 'Ort der Erinnerung nahe München – der Eintritt ist frei, für den Besuch sollten Sie 3–4 Stunden einplanen.',
    en: 'Memorial site near Munich – admission is free; allow 3–4 hours for your visit.',
    tr: 'Münih yakınında anma yeri – giriş ücretsiz; ziyaret için 3–4 saat ayırın.' } },
  { name: 'München-Rundfahrt', km: '', time: '', text: {
    de: 'Nymphenburg, Olympiapark, BMW Welt, Allianz Arena und Altstadt – kompakt mit Fotostopps.',
    en: 'Nymphenburg, Olympic Park, BMW Welt, Allianz Arena and old town – compact, with photo stops.',
    tr: 'Nymphenburg, Olimpiyat Parkı, BMW Welt, Allianz Arena ve eski şehir – fotoğraf molalarıyla.' } },
];

function texts(l: Lang) {
  if (l === 'en') return {
    home: 'Home', services: 'Services', crumb: 'Sightseeing & day trips',
    h1a: 'Sightseeing by taxi', h1b: 'from Munich',
    sub: 'Neuschwanstein, Königssee or Salzburg – your driver picks you up at the hotel or the airport, waits on site and drives you back. No timetables, no changing trains.',
    facts: [['Pickup at hotel or airport', MapPin], ['Driver waits on site', Hourglass], ['Up to 8 people per vehicle', Users], ['Price agreed before the trip', Check]] as const,
    tripsTitle: 'Popular day trips', tripsSub: 'Distances and travel times are approximate, from Munich city centre.',
    ask: 'Request trip', transfer: 'One-way transfer',
    howTitle: 'How it works',
    how: [['Request', 'Tell us the destination, date, number of people and desired stay – by WhatsApp, phone or e-mail.'], ['Package price', 'You get a package price for the outward trip, waiting time on site and the return trip – before you book.'], ['Day trip', 'Your driver picks you up, stops for photos on request and waits while you visit.']] as [string, string][],
    airportTitle: 'Sightseeing straight from the airport',
    airport: 'Landing in Munich and going on to Füssen, Berchtesgaden or Salzburg? Combine the transfer with a stop at a sight on the way – your luggage stays safely in the car.',
    noteTitle: 'Good to know',
    notes: ['Our drivers are not licensed tour guides, but they know the routes and gladly give tips.', 'Entrance tickets, boat and cable car fares are not included – please book them yourself.', 'Child seats free of charge – please mention them in your request.', 'Van or large taxi for families and groups up to 8 people.'],
    faqTitle: 'FAQ',
    faqs: [
      { q: 'What does a day trip by taxi cost?', a: 'It depends on the destination, the number of people and the time on site. You get a package price incl. return trip before the trip – just send us a request.' },
      { q: 'Does the driver wait while we visit?', a: 'Yes. The waiting time on site is agreed in advance and included in the package price.' },
      { q: 'Can we start at the airport?', a: 'Yes – we pick you up at the terminal with a name sign, your luggage stays in the car during the visit.' },
      { q: 'Is the price per person?', a: 'No, the price is per vehicle – it stays the same whether 1 or 4 people travel in the saloon.' },
    ],
    ctaTitle: 'Plan your day trip now', ctaSub: 'Package price incl. return · driver waits on site · up to 8 people', wa: 'Request via WhatsApp',
    waText: (d: string) => `Hello, I would like to request a day trip by taxi to: ${d}\nDate:\nPickup (hotel/airport):\nNumber of people:\nDesired time on site:`,
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', services: 'Hizmetler', crumb: 'Gezi & günübirlik turlar',
    h1a: 'Münih’ten taksiyle', h1b: 'gezi & turlar',
    sub: 'Neuschwanstein, Königssee veya Salzburg – şoförünüz sizi otelden ya da havalimanından alır, orada bekler ve geri getirir. Tarife yok, aktarma yok.',
    facts: [['Otelden veya havalimanından alış', MapPin], ['Şoför orada bekler', Hourglass], ['Araç başı 8 kişiye kadar', Users], ['Fiyat yolculuktan önce belli', Check]] as const,
    tripsTitle: 'Popüler günübirlik geziler', tripsSub: 'Mesafe ve süreler Münih merkezinden yaklaşık değerlerdir.',
    ask: 'Gezi iste', transfer: 'Tek yön transfer',
    howTitle: 'Nasıl çalışır?',
    how: [['Talep', 'Hedefi, tarihi, kişi sayısını ve kalmak istediğiniz süreyi WhatsApp, telefon veya e-postayla bildirin.'], ['Paket fiyat', 'Gidiş, orada bekleme ve dönüş için paket fiyatı rezervasyondan önce alırsınız.'], ['Gezi günü', 'Şoförünüz sizi alır, istediğinizde fotoğraf için durur ve gezerken bekler.']] as [string, string][],
    airportTitle: 'Doğrudan havalimanından gezi',
    airport: 'Münih’e inip Füssen, Berchtesgaden veya Salzburg’a mı gidiyorsunuz? Transferi yoldaki bir gezi durağıyla birleştirin – valizleriniz araçta güvende kalır.',
    noteTitle: 'Bilmeniz gerekenler',
    notes: ['Şoförlerimiz lisanslı rehber değildir, ama yolları bilir ve seve seve ipucu verir.', 'Giriş, tekne ve teleferik biletleri dahil değildir – lütfen kendiniz ayırtın.', 'Çocuk koltuğu ücretsiz – talebinizde belirtin.', 'Aileler ve 8 kişiye kadar gruplar için van veya büyük taksi.'],
    faqTitle: 'Sık sorulan sorular',
    faqs: [
      { q: 'Taksiyle günübirlik gezi ne kadar?', a: 'Hedefe, kişi sayısına ve orada kalma süresine bağlı. Dönüş dahil paket fiyatı yolculuktan önce alırsınız – bize talep göndermeniz yeterli.' },
      { q: 'Şoför biz gezerken bekliyor mu?', a: 'Evet. Bekleme süresi önceden kararlaştırılır ve paket fiyata dahildir.' },
      { q: 'Havalimanından başlayabilir miyiz?', a: 'Evet – sizi terminalde isim tabelasıyla karşılarız, valizleriniz gezi sırasında araçta kalır.' },
      { q: 'Fiyat kişi başı mı?', a: 'Hayır, fiyat araç başıdır – binek araçta 1 kişi de 4 kişi de olsa aynı kalır.' },
    ],
    ctaTitle: 'Gezinizi şimdi planlayın', ctaSub: 'Dönüş dahil paket fiyat · şoför orada bekler · 8 kişiye kadar', wa: 'WhatsApp ile iste',
    waText: (d: string) => `Merhaba, şu hedefe taksiyle günübirlik gezi istiyorum: ${d}\nTarih:\nAlış yeri (otel/havalimanı):\nKişi sayısı:\nOrada kalma süresi:`,
  };
  return {
    home: 'Startseite', services: 'Leistungen', crumb: 'Sightseeing & Ausflüge',
    h1a: 'Sightseeing mit dem Taxi', h1b: 'ab München',
    sub: 'Neuschwanstein, Königssee oder Salzburg – Ihr Fahrer holt Sie am Hotel oder am Flughafen ab, wartet vor Ort und bringt Sie zurück. Ohne Fahrplan, ohne Umsteigen.',
    facts: [['Abholung am Hotel oder Flughafen', MapPin], ['Fahrer wartet vor Ort', Hourglass], ['Bis 8 Personen pro Fahrzeug', Users], ['Preis steht vor der Fahrt fest', Check]] as const,
    tripsTitle: 'Beliebte Tagesausflüge', tripsSub: 'Entfernungen und Fahrzeiten ca. ab München Innenstadt.',
    ask: 'Ausflug anfragen', transfer: 'Einfache Fahrt',
    howTitle: 'So funktioniert’s',
    how: [['Anfrage', 'Nennen Sie Ziel, Datum, Personenzahl und gewünschte Aufenthaltsdauer – per WhatsApp, Telefon oder E-Mail.'], ['Pauschalpreis', 'Sie erhalten vorab einen Pauschalpreis für Hinfahrt, Wartezeit vor Ort und Rückfahrt.'], ['Ausflugstag', 'Ihr Fahrer holt Sie ab, hält auf Wunsch für Fotos und wartet, während Sie besichtigen.']] as [string, string][],
    airportTitle: 'Sightseeing direkt ab Flughafen',
    airport: 'Sie landen in München und reisen weiter nach Füssen, Berchtesgaden oder Salzburg? Verbinden Sie den Transfer mit einem Halt an einer Sehenswürdigkeit – Ihr Gepäck bleibt sicher im Auto.',
    noteTitle: 'Gut zu wissen',
    notes: ['Unsere Fahrer sind keine lizenzierten Gästeführer, kennen aber die Strecken und geben gerne Tipps.', 'Eintritt, Schiff und Seilbahn sind nicht enthalten – bitte selbst buchen.', 'Kindersitze kostenlos – bitte bei der Anfrage angeben.', 'Van oder Großraumtaxi für Familien und Gruppen bis 8 Personen.'],
    faqTitle: 'Häufige Fragen',
    faqs: [
      { q: 'Was kostet ein Tagesausflug mit dem Taxi?', a: 'Das hängt von Ziel, Personenzahl und Aufenthaltsdauer ab. Sie erhalten vor der Fahrt einen Pauschalpreis inkl. Rückfahrt – senden Sie uns einfach eine Anfrage.' },
      { q: 'Wartet der Fahrer während der Besichtigung?', a: 'Ja. Die Wartezeit vor Ort wird vorab vereinbart und ist im Pauschalpreis enthalten.' },
      { q: 'Können wir am Flughafen starten?', a: 'Ja – wir holen Sie mit Namensschild am Terminal ab, Ihr Gepäck bleibt während der Besichtigung im Auto.' },
      { q: 'Ist der Preis pro Person?', a: 'Nein, der Preis gilt pro Fahrzeug – er bleibt gleich, ob 1 oder 4 Personen im Kombi mitfahren.' },
    ],
    ctaTitle: 'Jetzt Ausflug planen', ctaSub: 'Pauschalpreis inkl. Rückfahrt · Fahrer wartet vor Ort · bis 8 Personen', wa: 'Per WhatsApp anfragen',
    waText: (d: string) => `Hallo, ich möchte einen Tagesausflug mit dem Taxi anfragen: ${d}\nDatum:\nAbholung (Hotel/Flughafen):\nPersonen:\nGewünschte Aufenthaltsdauer:`,
  };
}

export default function SightseeingPage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const t = texts(l);
  const url = `${BASE}${prefix}${PATH}`;
  const wa = (d: string) => `${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(t.waText(d))}`;
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'TaxiService', name: t.crumb, url,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
      areaServed: TRIPS.map((x) => ({ '@type': 'TouristAttraction', name: x.name })),
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${BASE}${prefix}` },
      { '@type': 'ListItem', position: 2, name: t.services, item: `${BASE}${prefix}/leistungen` },
      { '@type': 'ListItem', position: 3, name: t.crumb, item: url },
    ] },
  ];

  return (
    <div className="bg-gray-50">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/sightseeing/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/60 to-primary-900/10" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 md:pb-28">
          <nav className="mb-8 flex flex-wrap items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link><ArrowRight size={12} />
            <Link href={`${prefix}/leistungen`} className="hover:text-white">{t.services}</Link><ArrowRight size={12} />
            <span className="text-white">{t.crumb}</span>
          </nav>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {t.h1a} <span className="text-gold-400">{t.h1b}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90 drop-shadow">{t.sub}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={wa(t.crumb)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-primary-900 hover:bg-gold-300"><MessageCircle size={18} /> {t.wa}</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 font-bold ring-1 ring-white/30 backdrop-blur hover:bg-white/20"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
          <ul className="mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {t.facts.map(([x, Icon]) => <li key={x} className="flex items-center gap-2 text-sm"><Icon size={20} className="shrink-0 text-gold-400" /> {x}</li>)}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-3xl font-extrabold text-gray-900"><Camera size={26} className="text-primary-700" /> {t.tripsTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{t.tripsSub}</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRIPS.map((x) => (
              <div key={x.name} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <h3 className="text-lg font-extrabold leading-snug text-gray-900">{x.name}</h3>
                {x.km && (
                  <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-gold-600">
                    <span className="inline-flex items-center gap-1"><Route size={13} /> {x.km}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={13} /> {x.time}</span>
                  </div>
                )}
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{x.text[l]}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm font-bold">
                  <a href={wa(x.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary-700 hover:underline">{t.ask} <ArrowRight size={14} /></a>
                  {x.city && <Link href={`${prefix}/blog/${x.city}`} className="text-xs font-semibold text-gray-500 hover:text-primary-700 hover:underline">{t.transfer}</Link>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-primary-900 p-6 text-white shadow-lg md:p-8">
          <h2 className="text-2xl font-extrabold">{t.howTitle}</h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {t.how.map(([h, x], i) => (
              <li key={h} className="rounded-xl bg-white/10 p-5 ring-1 ring-white/15">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 font-extrabold text-primary-900">{i + 1}</span>
                <h3 className="mt-3 font-bold">{h}</h3>
                <p className="mt-1 text-sm text-white/80">{x}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sightseeing/neuschwanstein.webp" alt="" loading="lazy" className="h-56 w-full object-cover object-[35%_center]" />
            <div className="p-6">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><Plane size={22} className="text-primary-700" /> {t.airportTitle}</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">{t.airport}</p>
              <h3 className="mt-6 flex items-center gap-2 font-extrabold text-gray-900"><Car size={18} className="text-primary-700" /> {t.noteTitle}</h3>
              <ul className="mt-3 space-y-2">
                {t.notes.map((x) => <li key={x} className="flex gap-2.5 text-sm text-gray-700"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
              </ul>
            </div>
          </section>
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-2xl font-extrabold text-gray-900">{t.faqTitle}</h2>
            <div className="mt-4 space-y-2">
              {t.faqs.map(({ q, a }) => (
                <details key={q} className="group rounded-lg ring-1 ring-gray-200 open:ring-gold-300">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-gray-800">{q}<span className="shrink-0 text-lg leading-none text-gray-400 transition group-open:rotate-45">+</span></summary>
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
            <a href={wa(t.crumb)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-900 px-8 py-3 font-bold text-white hover:bg-primary-800"><MessageCircle size={18} /> {t.wa}</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
          <Link href={`${prefix}/leistungen`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900 hover:underline">{t.services} <ArrowRight size={14} /></Link>
        </section>
      </div>
    </div>
  );
}
