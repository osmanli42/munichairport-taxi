import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Bus, Car, Check, Clock, Luggage, MapPin, Phone, Plane, Smartphone, TrainFront, Users, X } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import CityBooking from '@/components/city/CityBooking';
import { DESTS, quote, eur } from '@/lib/guideQuote';

// Guide: Munich Airport → city centre (taxi vs S-Bahn vs bus). Public-transport facts from
// munich-airport.com and mvv-muenchen.de (checked 2 Oct 2026); taxi prices live from our engine.

export const dynamic = 'force-dynamic';

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/munich-airport-to-city-centre';
type Lang = 'de' | 'en' | 'tr';
type Props = { params: { locale: string } };
const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

const META = (k: Record<Lang, string>): Record<Lang, { title: string; description: string }> => ({
  en: { title: 'Munich Airport to City Centre: Taxi, S-Bahn or Bus? (2026)', description: `Munich Airport to the city centre: fixed-price taxi from ${k.en} to the Hauptbahnhof, S-Bahn S1/S8 (~40 min, from €17.50), Lufthansa Express Bus compared.` },
  de: { title: 'Flughafen München in die Innenstadt: Taxi, S-Bahn oder Bus?', description: `Vom Flughafen München in die Innenstadt im Vergleich: Festpreis-Taxi ab ${k.de} zum Hauptbahnhof, S-Bahn S1/S8 (~40 Min., ab 17,50 €), Lufthansa Express Bus.` },
  tr: { title: 'Münih Havalimanı’ndan Şehir Merkezine: Taksi, S-Bahn, Otobüs', description: `Münih Havalimanı’ndan şehir merkezine karşılaştırma: Hauptbahnhof’a ${k.tr}’dan sabit fiyatlı taksi, S-Bahn S1/S8 (~40 dk, 17,50 €’dan), Lufthansa Express Bus.` },
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = lang(params.locale);
  const q = await quote(DESTS.hbf);
  const k = q?.kombi ?? 96;
  const m = META({ de: eur(k, 'de'), en: eur(k, 'en'), tr: eur(k, 'tr') });
  return {
    title: { absolute: m[l].title },
    description: m[l].description,
    alternates: {
      canonical: l === 'de' ? `${BASE}${PATH}` : `${BASE}/${l}${PATH}`,
      languages: { de: `${BASE}${PATH}`, en: `${BASE}/en${PATH}`, tr: `${BASE}/tr${PATH}`, 'x-default': `${BASE}/en${PATH}` },
    },
    openGraph: { title: m[l].title, description: m[l].description, type: 'article' },
  };
}

function texts(l: Lang, hbf: string) {
  if (l === 'de') return {
    home: 'Startseite', crumb: 'Flughafen → Innenstadt',
    h1a: 'Flughafen München', h1b: 'in die Innenstadt',
    sub: 'Taxi, S-Bahn oder Bus? Alle Optionen mit Fahrzeit, Preis und Komfort – damit Sie nach der Landung schnell und entspannt ankommen.',
    pill: `Festpreis-Taxi zum Hauptbahnhof: ${hbf}`,
    tabs: ['Zum Flughafen', 'Hin & zurück', 'Vom Flughafen'] as [string, string, string], people: ['1–8 Personen', 'Kombi, Van & Großraumtaxi'] as [string, string],
    formHint: 'Ziel ist mit dem Hauptbahnhof vorausgefüllt – ändern Sie es auf Ihr Hotel oder Ihre Adresse.',
    cmpTitle: 'Die Optionen im Vergleich',
    options: [
      { name: 'Festpreis-Taxi (wir)', Icon: Car, time: '30–45 Min. Tür zu Tür', price: `ab ${hbf} pro Fahrzeug`, pros: ['Preis vor der Fahrt fest', 'Abholung mit Namensschild, Flugüberwachung', 'Direkt zum Hotel, mit Gepäck'], cons: ['Für Alleinreisende teurer als die S-Bahn'], best: true },
      { name: 'S-Bahn S1 / S8', Icon: TrainFront, time: 'ca. 40 Min. bis Hauptbahnhof', price: 'Airport-City-Day-Ticket ab 17,50 € p. P.', pros: ['Alle 10 Minuten', 'S8 fährt rund um die Uhr'], cons: ['Mit Koffern umsteigen, Treppen', 'Nur bis zum Bahnhof, nicht bis zur Tür'] },
      { name: 'Lufthansa Express Bus', Icon: Bus, time: '45 Min. bis Hauptbahnhof, 25 Min. bis Schwabing (Nord)', price: 'Ticket beim Betreiber', pros: ['Alle 20 Minuten', 'Gepäckfach'], cons: ['Nur Hauptbahnhof und Schwabing Nord'] },
      { name: 'Taxi am Taxistand', Icon: Car, time: '30–45 Min.', price: 'nach Taxameter', pros: ['Ohne Buchung'], cons: ['Endpreis erst am Ziel bekannt', 'Lange Schlangen zu Stoßzeiten'] },
      { name: 'Fahrdienst-Apps', Icon: Smartphone, time: '30–45 Min.', price: 'je nach Nachfrage', pros: ['Buchung per App'], cons: ['Preis schwankt mit der Nachfrage'] },
    ],
    whoTitle: 'Was passt zu Ihnen?',
    who: [
      ['Allein, wenig Gepäck, Ziel nahe Hauptbahnhof', 'Die S-Bahn ist am günstigsten.'],
      ['Familie oder Gruppe mit Koffern', 'Das Festpreis-Taxi bringt alle zusammen bis vor die Tür – im Van bis 7, im Großraumtaxi bis 8 Personen.'],
      ['Spät abends oder sehr früh', 'Taxi: kein Warten am Bahnsteig, kein Umsteigen nachts.'],
      ['Geschäftsreise, Termin in der Stadt', 'Taxi mit Abholung am Terminal und Rechnung für Ihre Firma.'],
    ],
    destTitle: 'Festpreise vom Flughafen zu beliebten Zielen',
    destSub: 'Live aus unserem Buchungssystem – Kombi für bis zu 3 Personen. Ihr exakter Preis erscheint im Buchungsformular.',
    dests: { hbf: 'Hauptbahnhof', marienplatz: 'Marienplatz / Altstadt', schwabing: 'Schwabing (Münchner Freiheit)', olympiapark: 'Olympiapark', messe: 'Messe München (Riem)', theresienwiese: 'Theresienwiese (Wiesn)' } as Record<string, string>,
    from: 'ab', min: 'Min.',
    meetTitle: 'So finden Sie Ihren Fahrer',
    meetText: 'Wir verfolgen Ihren Flug und warten nach der Landung 60 Minuten kostenlos. Ihr Fahrer steht mit Namensschild im Ankunftsbereich von Terminal 1 oder 2.',
    meetLink: 'Treffpunkt-Guide ansehen',
    faqTitle: 'Häufige Fragen',
    faqs: [
      { q: 'Wie lange dauert die Fahrt vom Flughafen München in die Innenstadt?', a: 'Mit dem Taxi je nach Ziel und Verkehr 30 bis 45 Minuten, mit der S-Bahn S1 oder S8 rund 40 Minuten bis zum Hauptbahnhof, mit dem Lufthansa Express Bus 45 Minuten.' },
      { q: 'Was kostet ein Taxi vom Flughafen zum Hauptbahnhof?', a: `Bei uns gilt ein Festpreis von ${hbf} für den Kombi (bis 3 Personen). Der Preis steht vor der Buchung fest – unabhängig von Stau oder Umwegen.` },
      { q: 'Fährt nachts eine S-Bahn vom Flughafen?', a: 'Die S8 fährt rund um die Uhr, zwischen etwa 1 und 4 Uhr alle 40 Minuten. Die S1 fährt von etwa 3 Uhr bis Mitternacht.' },
      { q: 'Lohnt sich das Taxi für eine Familie?', a: 'Oft ja: Der Festpreis gilt pro Fahrzeug, nicht pro Person. Mit Kindern und Koffern sparen Sie sich das Umsteigen und kommen direkt bis vor die Tür.' },
    ],
    ctaTitle: 'Nach der Landung direkt ins Hotel', ctaSub: `Festpreis ab ${hbf} · Namensschild · 60 Min. Wartezeit gratis`, ctaBook: 'Preis berechnen',
    sources: 'Angaben zu S-Bahn und Bus: Flughafen München und MVV, Stand Oktober 2026. Ticketpreise können sich ändern.',
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', crumb: 'Havalimanı → şehir merkezi',
    h1a: 'Münih Havalimanı’ndan', h1b: 'şehir merkezine',
    sub: 'Taksi, S-Bahn mı otobüs mü? Tüm seçenekler süre, fiyat ve konforuyla – inişten sonra hızlı ve rahat varmanız için.',
    pill: `Hauptbahnhof’a sabit fiyatlı taksi: ${hbf}`,
    tabs: ['Havalimanına', 'Gidiş-dönüş', 'Havalimanından'] as [string, string, string], people: ['1–8 kişi', 'Binek, Van ve büyük taksi'] as [string, string],
    formHint: 'Varış yeri Hauptbahnhof olarak dolu – otelinize veya adresinize göre değiştirin.',
    cmpTitle: 'Seçeneklerin karşılaştırması',
    options: [
      { name: 'Sabit fiyatlı taksi (biz)', Icon: Car, time: 'Kapıdan kapıya 30–45 dk', price: `araç başına ${hbf}’dan`, pros: ['Fiyat yolculuktan önce belli', 'İsim tabelasıyla karşılama, uçuş takibi', 'Valizinizle doğrudan otele'], cons: ['Tek kişi için S-Bahn’dan pahalı'], best: true },
      { name: 'S-Bahn S1 / S8', Icon: TrainFront, time: 'Hauptbahnhof’a yaklaşık 40 dk', price: 'Airport-City-Day-Ticket kişi başı 17,50 €’dan', pros: ['10 dakikada bir', 'S8 7/24 çalışır'], cons: ['Valizle aktarma, merdiven', 'Sadece istasyona kadar'] },
      { name: 'Lufthansa Express Bus', Icon: Bus, time: 'Hauptbahnhof’a 45 dk, Schwabing’e (Kuzey) 25 dk', price: 'Bilet işletmeciden', pros: ['20 dakikada bir', 'Bagaj bölmesi'], cons: ['Sadece Hauptbahnhof ve Schwabing Kuzey'] },
      { name: 'Taksi durağı', Icon: Car, time: '30–45 dk', price: 'taksimetreye göre', pros: ['Rezervasyonsuz'], cons: ['Son fiyat varışta belli olur', 'Yoğun saatlerde uzun kuyruk'] },
      { name: 'Araç çağırma uygulamaları', Icon: Smartphone, time: '30–45 dk', price: 'talebe göre', pros: ['Uygulamadan rezervasyon'], cons: ['Fiyat talebe göre değişir'] },
    ],
    whoTitle: 'Size hangisi uygun?',
    who: [
      ['Tek başına, az bagaj, Hauptbahnhof yakını', 'En ucuzu S-Bahn.'],
      ['Valizli aile veya grup', 'Sabit fiyatlı taksi herkesi kapıya kadar götürür – Van’da 7, büyük taksiyle 8 kişiye kadar.'],
      ['Gece geç veya sabah çok erken', 'Taksi: Peronda bekleme ve gece aktarma yok.'],
      ['İş seyahati, şehirde toplantı', 'Terminalde karşılama ve firmanıza fatura.'],
    ],
    destTitle: 'Havalimanından popüler noktalara sabit fiyatlar',
    destSub: 'Rezervasyon sistemimizden canlı – 3 kişiye kadar binek araç. Kesin fiyatınız rezervasyon formunda görünür.',
    dests: { hbf: 'Hauptbahnhof (merkez istasyon)', marienplatz: 'Marienplatz / eski şehir', schwabing: 'Schwabing (Münchner Freiheit)', olympiapark: 'Olimpiyat Parkı', messe: 'Messe München (Riem)', theresienwiese: 'Theresienwiese (Oktoberfest)' } as Record<string, string>,
    from: '’dan', min: 'dk',
    meetTitle: 'Şoförünüzü nasıl bulursunuz',
    meetText: 'Uçuşunuzu takip eder, inişten sonra 60 dakika ücretsiz bekleriz. Şoförünüz Terminal 1 veya 2’nin varış salonunda isim tabelasıyla bekler.',
    meetLink: 'Buluşma noktası rehberi',
    faqTitle: 'Sık sorulan sorular',
    faqs: [
      { q: 'Münih Havalimanı’ndan şehir merkezine yolculuk ne kadar sürer?', a: 'Taksiyle varış noktası ve trafiğe göre 30–45 dakika, S1 veya S8 ile Hauptbahnhof’a yaklaşık 40 dakika, Lufthansa Express Bus ile 45 dakika.' },
      { q: 'Havalimanından Hauptbahnhof’a taksi ne kadar?', a: `Bizde 3 kişiye kadar binek araç için sabit fiyat ${hbf}. Fiyat rezervasyondan önce belli – trafik veya yol değişikliğinden bağımsız.` },
      { q: 'Gece havalimanından S-Bahn var mı?', a: 'S8 7/24 çalışır; gece yaklaşık 1–4 arası 40 dakikada bir. S1 sabah yaklaşık 3’ten gece yarısına kadar çalışır.' },
      { q: 'Aile için taksi mantıklı mı?', a: 'Genellikle evet: Sabit fiyat kişi başı değil araç başıdır. Çocuk ve valizle aktarma yapmadan kapıya kadar gidersiniz.' },
    ],
    ctaTitle: 'İnişten sonra doğrudan otele', ctaSub: `Sabit fiyat ${hbf}’dan · isim tabelası · 60 dk ücretsiz bekleme`, ctaBook: 'Fiyat hesapla',
    sources: 'S-Bahn ve otobüs bilgileri: Münih Havalimanı ve MVV, Ekim 2026. Bilet fiyatları değişebilir.',
  };
  return {
    home: 'Home', crumb: 'Airport → city centre',
    h1a: 'Munich Airport', h1b: 'to the city centre',
    sub: 'Taxi, S-Bahn or bus? Every option with journey time, price and comfort – so you get into town quickly and relaxed after landing.',
    pill: `Fixed-price taxi to the Hauptbahnhof: ${hbf}`,
    tabs: ['To the airport', 'Return trip', 'From the airport'] as [string, string, string], people: ['1–8 passengers', 'Saloon, van & large taxi'] as [string, string],
    formHint: 'The destination is pre-filled with the Hauptbahnhof – change it to your hotel or address.',
    cmpTitle: 'Your options compared',
    options: [
      { name: 'Fixed-price taxi (us)', Icon: Car, time: '30–45 min door to door', price: `from ${hbf} per car`, pros: ['Price fixed before the ride', 'Meet & greet with name sign, flight monitoring', 'Straight to your hotel with luggage'], cons: ['More expensive than the S-Bahn for solo travellers'], best: true },
      { name: 'S-Bahn S1 / S8', Icon: TrainFront, time: 'about 40 min to the Hauptbahnhof', price: 'Airport-City-Day-Ticket from €17.50 per person', pros: ['Every 10 minutes', 'S8 runs 24/7'], cons: ['Changing trains with luggage, stairs', 'Only to the station, not your door'] },
      { name: 'Lufthansa Express Bus', Icon: Bus, time: '45 min to the Hauptbahnhof, 25 min to Munich North (Schwabing)', price: 'ticket from the operator', pros: ['Every 20 minutes', 'Luggage hold'], cons: ['Only Hauptbahnhof and Munich North'] },
      { name: 'Taxi rank', Icon: Car, time: '30–45 min', price: 'by meter', pros: ['No booking needed'], cons: ['Final price known only at the end', 'Long queues at peak times'] },
      { name: 'Ride-hailing apps', Icon: Smartphone, time: '30–45 min', price: 'depends on demand', pros: ['Book in the app'], cons: ['Price varies with demand'] },
    ],
    whoTitle: 'Which option suits you?',
    who: [
      ['Travelling alone, light luggage, staying near the Hauptbahnhof', 'The S-Bahn is cheapest.'],
      ['Family or group with suitcases', 'The fixed-price taxi takes everyone to the door – up to 7 in the van, 8 in the large taxi.'],
      ['Late at night or very early', 'Taxi: no waiting on the platform, no changing trains at night.'],
      ['Business trip, meeting in town', 'Taxi with pickup at the terminal and an invoice for your company.'],
    ],
    destTitle: 'Fixed prices from the airport to popular destinations',
    destSub: 'Live from our booking system – saloon for up to 3 people. Your exact price appears in the booking form.',
    dests: { hbf: 'Hauptbahnhof (central station)', marienplatz: 'Marienplatz / old town', schwabing: 'Schwabing (Münchner Freiheit)', olympiapark: 'Olympic Park', messe: 'Messe München trade fair (Riem)', theresienwiese: 'Theresienwiese (Oktoberfest)' } as Record<string, string>,
    from: 'from', min: 'min',
    meetTitle: 'How to find your driver',
    meetText: 'We track your flight and wait 60 minutes free of charge after landing. Your driver waits with a name sign in the arrivals area of Terminal 1 or 2.',
    meetLink: 'See the meeting point guide',
    faqTitle: 'FAQ',
    faqs: [
      { q: 'How long does it take from Munich Airport to the city centre?', a: 'By taxi 30 to 45 minutes depending on destination and traffic, by S-Bahn S1 or S8 about 40 minutes to the Hauptbahnhof, by Lufthansa Express Bus 45 minutes.' },
      { q: 'How much is a taxi from Munich Airport to the Hauptbahnhof?', a: `With us there is a fixed price of ${hbf} for a saloon (up to 3 people). The price is fixed before you book – regardless of traffic or detours.` },
      { q: 'Is there an S-Bahn from the airport at night?', a: 'The S8 runs around the clock, every 40 minutes between about 1 and 4 am. The S1 runs from about 3 am to midnight.' },
      { q: 'Is a taxi worth it for a family?', a: 'Often yes: the fixed price is per car, not per person. With children and suitcases you avoid changing trains and get straight to your door.' },
    ],
    ctaTitle: 'Straight to your hotel after landing', ctaSub: `Fixed price from ${hbf} · name sign · 60 min free waiting`, ctaBook: 'Calculate price',
    sources: 'S-Bahn and bus details: Munich Airport and MVV, October 2026. Ticket prices may change.',
  };
}

export default async function AirportToCityPage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const keys = ['hbf', 'marienplatz', 'schwabing', 'olympiapark', 'messe', 'theresienwiese'];
  const quotes = await Promise.all(keys.map((k) => quote(DESTS[k])));
  const hbfPrice = quotes[0]?.kombi ?? 96;
  const t = texts(l, eur(hbfPrice, l));
  const url = `${BASE}${prefix}${PATH}`;
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'TaxiService', name: t.crumb, url,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
      areaServed: { '@type': 'City', name: 'München' },
      offers: keys.map((k, i) => quotes[i] ? { '@type': 'Offer', name: t.dests[k], price: quotes[i]!.kombi.toFixed(2), priceCurrency: 'EUR' } : null).filter(Boolean),
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/cities/taxi-muenchen-flughafen-muenchen.webp" alt="" className="absolute inset-y-0 left-0 h-full w-full object-cover sm:w-3/5 [mask-image:linear-gradient(to_right,black_45%,transparent)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/85 via-primary-900/50 to-primary-900/5" />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-32">
          <nav className="mb-8 flex items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link><ArrowRight size={12} /><span className="text-white">{t.crumb}</span>
          </nav>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {t.h1a} <span className="text-gold-400">{t.h1b}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/90 drop-shadow">{t.sub}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold ring-1 ring-white/20 backdrop-blur">
            <BadgeCheck size={18} className="text-gold-400" /> {t.pill}
          </div>
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div id="booking" className="-mt-20 scroll-mt-28">
          <CityBooking pickup="München Hauptbahnhof, 80335 München" tabs={t.tabs} people={t.people} initialMode="arrival" />
          <p className="mt-2 px-1 text-xs text-gray-500">{t.formHint}</p>
        </div>

        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-gray-900 md:text-3xl">{t.cmpTitle}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.options.map((o) => (
              <div key={o.name} className={`flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ${'best' in o && o.best ? 'ring-2 ring-gold-400' : 'ring-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${'best' in o && o.best ? 'bg-gold-400 text-primary-900' : 'bg-primary-50 text-primary-700'}`}><o.Icon size={20} /></span>
                  <div className="font-bold text-gray-900">{o.name}</div>
                </div>
                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex items-start gap-2 text-gray-700"><Clock size={15} className="mt-0.5 shrink-0 text-gray-400" /> {o.time}</div>
                  <div className="flex items-start gap-2 font-semibold text-gray-900"><Luggage size={15} className="mt-0.5 shrink-0 text-gray-400" /> {o.price}</div>
                </dl>
                <ul className="mt-3 space-y-1 text-sm">
                  {o.pros.map((x) => <li key={x} className="flex gap-2 text-gray-700"><Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> {x}</li>)}
                  {o.cons.map((x) => <li key={x} className="flex gap-2 text-gray-500"><X size={15} className="mt-0.5 shrink-0 text-red-400" /> {x}</li>)}
                </ul>
                {'best' in o && o.best && <a href="#booking" className="mt-auto pt-4"><span className="block rounded-lg bg-gold-400 px-3 py-2 text-center text-sm font-bold text-primary-900 hover:bg-gold-300">{t.ctaBook}</span></a>}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl bg-primary-900 p-6 text-white md:p-10">
          <h2 className="text-2xl font-extrabold md:text-3xl">{t.whoTitle}</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {t.who.map(([a, b]) => (
              <li key={a} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-2 font-semibold text-gold-300"><Users size={16} /> {a}</div>
                <p className="mt-1 text-sm text-white/85">{b}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-gray-900 md:text-3xl">{t.destTitle}</h2>
          <p className="mt-1 text-gray-600">{t.destSub}</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((k, i) => (
              <li key={k} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold text-gray-900"><MapPin size={15} className="shrink-0 text-gold-600" /> {t.dests[k]}</span>
                  <span className="text-xs text-gray-500">{Math.round(DESTS[k].km)} km · ~{DESTS[k].min} {t.min}</span>
                </span>
                {quotes[i] && <span className="shrink-0 text-right"><span className="block text-[11px] text-gray-500">{t.from}</span><span className="text-xl font-extrabold text-primary-800">{eur(quotes[i]!.kombi, l)}</span></span>}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900"><Plane size={22} className="text-primary-700" /> {t.meetTitle}</h2>
            <p className="mt-3 text-gray-700">{t.meetText}</p>
            <Link href={`${prefix}/treffpunkt-flughafen-muenchen`} className="mt-4 inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:underline">{t.meetLink} <ArrowRight size={15} /></Link>
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
            <a href="#booking" className="rounded-xl bg-primary-900 px-8 py-3 font-bold text-white hover:bg-primary-800">{t.ctaBook} →</a>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 hover:bg-primary-900 hover:text-white"><Phone size={18} /> {CONTACT_INFO.phone}</a>
          </div>
        </section>
        <p className="pb-8 text-[11px] text-gray-400">{t.sources}</p>
      </div>
    </div>
  );
}
