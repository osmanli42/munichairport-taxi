import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Clock, MapPin, MessageCircle, Phone, Ticket, Users } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { DESTS, quote, eur } from '@/lib/guideQuote';

// Stadium & concert transfer (Allianz Arena, Olympiapark, SAP Garden, Zenith …): outward trip
// plus return pickup at a meeting point agreed beforehand. Price from the airport live for the
// Olympiapark; everything else via the normal booking form / on request.

export const dynamic = 'force-dynamic';

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/stadion-konzerte';
type Lang = 'de' | 'en' | 'tr';
type Props = { params: { locale: string } };
const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

const META: Record<Lang, { title: string; description: string }> = {
  de: { title: 'Taxi zur Allianz Arena, Olympiapark & Konzerten – Hin & zurück | München', description: 'Taxi zum Spiel oder Konzert in München: Allianz Arena, Olympiastadion, Olympiahalle, SAP Garden, Zenith. Rückfahrt mit festem Treffpunkt, Van bis 8 Personen, Festpreis.' },
  en: { title: 'Taxi to Allianz Arena, Olympic Park & Concerts – Return Trip | Munich', description: 'Taxi to matches and concerts in Munich: Allianz Arena, Olympic Stadium, Olympiahalle, SAP Garden, Zenith. Return pickup at a fixed meeting point, van for up to 8, fixed price.' },
  tr: { title: 'Allianz Arena, Olympiapark & Konserlere Taksi – Gidiş-Dönüş | Münih', description: 'Münih’te maç ve konserlere taksi: Allianz Arena, Olimpiyat Stadı, Olympiahalle, SAP Garden, Zenith. Sabit buluşma noktasından dönüş, 8 kişiye kadar van, sabit fiyat.' },
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
    openGraph: { title: m.title, description: m.description, type: 'article', images: [`${BASE}/images/stadion/hero.webp`] },
  };
}

const VENUES: { name: string; area: string; text: Record<Lang, string> }[] = [
  { name: 'Allianz Arena', area: 'Fröttmaning', text: { de: 'Bundesliga, Champions League und Länderspiele.', en: 'Bundesliga, Champions League and internationals.', tr: 'Bundesliga, Şampiyonlar Ligi ve milli maçlar.' } },
  { name: 'Olympiastadion & Olympiahalle', area: 'Olympiapark', text: { de: 'Große Open-Air-Konzerte und Hallen-Shows.', en: 'Big open-air concerts and arena shows.', tr: 'Büyük açık hava konserleri ve salon şovları.' } },
  { name: 'SAP Garden', area: 'Olympiapark', text: { de: 'Eishockey (EHC) und Basketball (FC Bayern).', en: 'Ice hockey (EHC) and basketball (FC Bayern).', tr: 'Buz hokeyi (EHC) ve basketbol (FC Bayern).' } },
  { name: 'Zenith & Tonhalle', area: 'Freimann', text: { de: 'Konzerte und Partys im Norden der Stadt.', en: 'Concerts and parties in the north of the city.', tr: 'Şehrin kuzeyinde konser ve partiler.' } },
  { name: 'BMW Park', area: 'Moosach', text: { de: 'Basketball-Heimspiele und Events.', en: 'Basketball home games and events.', tr: 'Basketbol iç saha maçları ve etkinlikler.' } },
  { name: 'Messe München', area: 'Riem', text: { de: 'Open-Air-Konzerte und Großveranstaltungen.', en: 'Open-air concerts and large events.', tr: 'Açık hava konserleri ve büyük etkinlikler.' } },
];

function texts(l: Lang, olymp: string | null) {
  if (l === 'en') return {
    home: 'Home', services: 'Services', crumb: 'Stadium & concerts',
    h1a: 'Taxi to the match', h1b: '& concert',
    sub: 'Allianz Arena, Olympic Park or SAP Garden: we take you there and pick you up again after the event at a meeting point agreed in advance – no queuing at the taxi rank.',
    facts: [['Return trip booked ahead', Check], ['Fixed meeting point', MapPin], ['Van & large taxi up to 8', Users], ['Also from the airport', Clock]] as const,
    price: olymp ? `Airport → Olympic Park from ${olymp}` : null,
    venuesTitle: 'Venues we drive to',
    howTitle: 'Why book in advance?',
    how: ['After the final whistle hundreds of people want a taxi at the same time – with a booking your vehicle is already planned.', 'We agree a meeting point a short walk from the venue, away from the closed-off roads.', 'Your driver waits if the match goes into extra time or the encore takes longer.', 'Fixed price per vehicle – share the ride with friends and split the cost.'],
    faqTitle: 'FAQ',
    faqs: [
      { q: 'Where do you pick us up after the match?', a: 'Roads around the stadium are often closed after the event. We agree a meeting point nearby when you book and send it to you by WhatsApp.' },
      { q: 'What if the match goes into extra time?', a: 'No problem – just send us a short message, your driver waits.' },
      { q: 'Can a group of 8 travel together?', a: 'Yes, in a large taxi for up to 8 people. For bigger groups we coordinate several vehicles.' },
      { q: 'What does it cost?', a: 'The price depends on the pickup address and is fixed before booking – calculate it online or ask us for outward and return trip together.' },
    ],
    ctaTitle: 'Book your event transfer', ctaSub: 'Outward & return trip · fixed meeting point · up to 8 people', book: 'Calculate price', wa: 'Request via WhatsApp',
    waText: 'Hello, I would like a taxi to an event:\nEvent / venue:\nDate & start time:\nPickup address:\nNumber of people:\nReturn trip after the event: yes/no',
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', services: 'Hizmetler', crumb: 'Stadyum & konserler',
    h1a: 'Maça ve konsere', h1b: 'taksiyle',
    sub: 'Allianz Arena, Olympiapark veya SAP Garden: Sizi götürür, etkinlikten sonra önceden belirlenen buluşma noktasından tekrar alırız – taksi durağında kuyruk yok.',
    facts: [['Dönüş önceden ayırtılır', Check], ['Sabit buluşma noktası', MapPin], ['8 kişiye kadar van & büyük taksi', Users], ['Havalimanından da', Clock]] as const,
    price: olymp ? `Havalimanı → Olympiapark ${olymp}’dan` : null,
    venuesTitle: 'Gittiğimiz mekânlar',
    howTitle: 'Neden önceden ayırtmalı?',
    how: ['Son düdükten sonra yüzlerce kişi aynı anda taksi ister – rezervasyonla aracınız zaten planlanmıştır.', 'Kapalı yolların dışında, mekâna kısa yürüme mesafesinde bir buluşma noktası belirleriz.', 'Maç uzatmaya giderse veya bis uzun sürerse şoförünüz bekler.', 'Araç başı sabit fiyat – arkadaşlarınızla paylaşın, masrafı bölün.'],
    faqTitle: 'Sık sorulan sorular',
    faqs: [
      { q: 'Maçtan sonra bizi nerede alıyorsunuz?', a: 'Etkinlikten sonra stadyum çevresindeki yollar çoğu zaman kapalıdır. Rezervasyonda yakın bir buluşma noktası belirler ve WhatsApp’tan göndeririz.' },
      { q: 'Maç uzatmaya giderse?', a: 'Sorun değil – kısa bir mesaj atın, şoförünüz bekler.' },
      { q: '8 kişilik grup birlikte gidebilir mi?', a: 'Evet, 8 kişiye kadar büyük taksiyle. Daha büyük gruplar için birden fazla aracı koordine ederiz.' },
      { q: 'Ücret ne kadar?', a: 'Fiyat alış adresine bağlıdır ve rezervasyondan önce bellidir – online hesaplayın veya gidiş-dönüş için bize sorun.' },
    ],
    ctaTitle: 'Etkinlik transferinizi ayırtın', ctaSub: 'Gidiş & dönüş · sabit buluşma noktası · 8 kişiye kadar', book: 'Fiyat hesapla', wa: 'WhatsApp ile iste',
    waText: 'Merhaba, bir etkinliğe taksi istiyorum:\nEtkinlik / mekân:\nTarih & başlangıç saati:\nAlış adresi:\nKişi sayısı:\nEtkinlik sonrası dönüş: evet/hayır',
  };
  return {
    home: 'Startseite', services: 'Leistungen', crumb: 'Stadion & Konzerte',
    h1a: 'Mit dem Taxi zum Spiel', h1b: '& Konzert',
    sub: 'Allianz Arena, Olympiapark oder SAP Garden: Wir bringen Sie hin und holen Sie nach dem Event an einem vorab vereinbarten Treffpunkt wieder ab – ohne Schlange am Taxistand.',
    facts: [['Rückfahrt vorab gebucht', Check], ['Fester Treffpunkt', MapPin], ['Van & Großraumtaxi bis 8', Users], ['Auch ab Flughafen', Clock]] as const,
    price: olymp ? `Flughafen → Olympiapark ab ${olymp}` : null,
    venuesTitle: 'Hierhin fahren wir',
    howTitle: 'Warum vorab buchen?',
    how: ['Nach dem Abpfiff wollen Hunderte gleichzeitig ein Taxi – mit Buchung ist Ihr Fahrzeug schon eingeplant.', 'Wir vereinbaren einen Treffpunkt kurz zu Fuß vom Stadion, abseits der gesperrten Straßen.', 'Ihr Fahrer wartet, wenn es Verlängerung gibt oder die Zugabe länger dauert.', 'Festpreis pro Fahrzeug – mit Freunden teilen und die Kosten aufteilen.'],
    faqTitle: 'Häufige Fragen',
    faqs: [
      { q: 'Wo holen Sie uns nach dem Spiel ab?', a: 'Rund ums Stadion sind die Straßen nach dem Event oft gesperrt. Wir vereinbaren bei der Buchung einen Treffpunkt in der Nähe und schicken ihn per WhatsApp.' },
      { q: 'Was, wenn es Verlängerung gibt?', a: 'Kein Problem – kurze Nachricht genügt, Ihr Fahrer wartet.' },
      { q: 'Können 8 Personen zusammen fahren?', a: 'Ja, im Großraumtaxi bis 8 Personen. Für größere Gruppen stimmen wir mehrere Fahrzeuge ab.' },
      { q: 'Was kostet die Fahrt?', a: 'Der Preis hängt von der Abholadresse ab und steht vor der Buchung fest – online berechnen oder Hin- und Rückfahrt zusammen bei uns anfragen.' },
    ],
    ctaTitle: 'Jetzt Event-Transfer buchen', ctaSub: 'Hin & zurück · fester Treffpunkt · bis 8 Personen', book: 'Preis berechnen', wa: 'Per WhatsApp anfragen',
    waText: 'Hallo, ich möchte ein Taxi zu einem Event:\nEvent / Ort:\nDatum & Beginn:\nAbholadresse:\nPersonen:\nRückfahrt nach dem Event: ja/nein',
  };
}

export default async function StadionKonzertePage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const q = await quote(DESTS.olympiapark);
  const t = texts(l, q ? eur(q.kombi, l) : null);
  const url = `${BASE}${prefix}${PATH}`;
  const wa = `${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(t.waText)}`;
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'TaxiService', name: t.crumb, url,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
      areaServed: VENUES.map((v) => ({ '@type': 'Place', name: v.name })),
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
        <img src="/images/stadion/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
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
          {t.price && <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-bold ring-1 ring-white/20 backdrop-blur"><Ticket size={18} className="text-gold-400" /> {t.price}</div>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={prefix || '/'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-primary-900 hover:bg-gold-300">{t.book} <ArrowRight size={18} /></Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-6 py-3 font-bold ring-1 ring-white/30 backdrop-blur hover:bg-white/20"><MessageCircle size={18} /> {t.wa}</a>
          </div>
          <ul className="mt-8 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {t.facts.map(([x, Icon]) => <li key={x} className="flex items-center gap-2 text-sm"><Icon size={20} className="shrink-0 text-gold-400" /> {x}</li>)}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-3xl font-extrabold text-gray-900"><MapPin size={26} className="text-primary-700" /> {t.venuesTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VENUES.map((v) => (
              <div key={v.name} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
                <h3 className="text-lg font-extrabold text-gray-900">{v.name}</h3>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gold-600">{v.area}</p>
                <p className="mt-2 text-sm text-gray-600">{v.text[l]}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-primary-900 p-6 text-white shadow-lg">
            <h2 className="text-2xl font-extrabold">{t.howTitle}</h2>
            <ul className="mt-4 space-y-3">
              {t.how.map((x) => <li key={x} className="flex gap-2.5 text-sm leading-relaxed text-white/90"><Check size={17} className="mt-0.5 shrink-0 text-gold-400" /> {x}</li>)}
            </ul>
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
            <Link href={prefix || '/'} className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white hover:bg-primary-800">{t.book} →</Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><MessageCircle size={18} /> {t.wa}</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
          <Link href={`${prefix}/leistungen`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-900 hover:underline">{t.services} <ArrowRight size={14} /></Link>
        </section>
      </div>
    </div>
  );
}
