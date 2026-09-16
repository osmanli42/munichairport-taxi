'use client';

import Link from 'next/link';
import { Caveat } from 'next/font/google';
import {
  Phone, Plane, ShieldCheck, Clock, Users, ArrowRight, Car, Ban, Headphones, BadgeEuro,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { useParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';

const caveat = Caveat({ subsets: ['latin'], weight: ['600'], display: 'swap' });

// Oktoberfest 2026: 19. September – 4. Oktober
const OKTOBERFEST_START = new Date('2026-09-19T12:00:00');
const OKTOBERFEST_END = new Date('2026-10-04T23:59:59');

export default function OktoberfestPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'de';
  const isEN = locale === 'en';
  const now = new Date();
  const isLive = now >= OKTOBERFEST_START && now <= OKTOBERFEST_END;

  const ui = isEN ? {
    title: 'Oktoberfest 2026 Munich',
    titleA: 'Oktoberfest 2026',
    titleB: 'Munich',
    subtitle: 'The World\'s Largest Folk Festival',
    dates: '19 SEPTEMBER – 4 OCTOBER 2026',
    live: 'Happening right now',
    heroFeatures: [
      { a: 'Straight from the airport', b: 'to the Oktoberfest' },
      { a: 'Fixed price', b: 'no hidden costs' },
      { a: 'On time', b: 'and reliable' },
      { a: 'Comfortable', b: 'for groups & families' },
    ],
    searchBadgeA: '1–8 passengers',
    searchBadgeB: 'Vans & minibuses',
    factsEyebrow: 'Oktoberfest in numbers',
    factsTitleA: 'Impressive',
    factsTitleB: 'facts',
    factsSub: 'The Oktoberfest is more than a festival – it is a piece of Bavarian joy of life.',
    datesTitleA: '2026',
    datesTitleB: 'Official dates & programme',
    allDates: 'See all dates',
    highlight: 'Key date',
    tipsTitleA: 'Tips',
    tipsTitleB: 'for visitors',
    historyTitle: 'History of the Oktoberfest',
    taxiTitle: 'Taxi to the Oktoberfest – fixed price from Munich Airport',
    taxiSubtitle: 'We take you directly from Munich Airport (MUC) to the Wiesn – stress-free, on time, at a fixed price.',
    bookBtn: 'Book taxi now',
    stats: [
      { value: '~6 mln.', label: 'Visitors per year', img: 'besucher' },
      { value: '7.7 mln.', label: 'Litres of beer served', img: 'bier' },
      { value: '16', label: 'Days of celebration', img: 'festtage' },
      { value: '~500 €', label: 'Avg. spend per visitor', img: 'ausgaben' },
      { value: '14', label: 'Large beer tents', img: 'zelte' },
      { value: '~400,000', label: 'Roast chickens eaten', img: 'hendl' },
    ],
    schedule: [
      { date: 'Sat, 19 Sep 2026', icon: '🎉', event: 'Opening & official tapping of the first barrel', highlight: true },
      { date: 'Sun, 20 Sep 2026', icon: '👫', event: 'Opening Sunday – costume and riflemen\'s parade', highlight: false },
      { date: 'Sat, 26 – Sun, 27 Sep 2026', icon: '🎶', event: 'Folklore weekend – folk music & traditional fashion', highlight: false },
      { date: 'Tue, 29 Sep 2026', icon: '👨‍👩‍👧', event: 'Family day – reduced ride prices', highlight: false },
      { date: 'Sun, 4 Oct 2026', icon: '🍺', event: 'Last Wiesn day – finale of the Oktoberfest 2026', highlight: true },
    ],
    tips: [
      { icon: '🎫', tip: 'Book tent reservations months in advance' },
      { icon: '👗', tip: 'Wear a Dirndl or Lederhosen – better chances of a seat' },
      { icon: '🚌', tip: 'Public transport is crowded – a private taxi is the most comfortable option' },
      { icon: '💶', tip: 'Bring cash – many tents prefer cash' },
      { icon: '⏰', tip: 'Come early – before noon for the best chance of a table' },
      { icon: '🏨', tip: 'Book a hotel 6–12 months ahead – Munich sells out during the Wiesn' },
    ],
    trust: [
      { label: 'Free cancellation', sub: 'up to 3 hours before' },
      { label: 'Fixed price guaranteed', sub: '' },
      { label: '24/7 customer service', sub: '' },
      { label: 'Modern vehicles', sub: '' },
      { label: 'Safely to your destination', sub: '' },
    ],
    history: [
      { year: '1810', text: 'The first Oktoberfest was held on 17 October 1810 to celebrate the wedding of Crown Prince Ludwig of Bavaria to Princess Therese of Saxony-Hildburghausen. The fields were named "Theresienwiese" in her honour.' },
      { year: '1818', text: 'The first fairground attractions appeared – carousels and swings made the festival more entertaining for visitors.' },
      { year: '1896', text: 'Beer stalls became large beer tents holding thousands of visitors – the beginning of the Oktoberfest we know today.' },
      { year: '1950', text: 'Munich\'s mayor Thomas Wimmer tapped the first barrel for the first time. Since then the mayor calls "O\'zapft is!" and the festival begins.' },
      { year: '2000s', text: 'The Oktoberfest becomes a global brand: visitors from over 200 nations travel to Munich every year and generate more than €1.3 billion for the city\'s economy.' },
    ],
  } : {
    title: 'Oktoberfest 2026 München',
    titleA: 'Oktoberfest 2026',
    titleB: 'München',
    subtitle: 'Das größte Volksfest der Welt',
    dates: '19. SEPTEMBER – 4. OKTOBER 2026',
    live: 'Findet gerade statt',
    heroFeatures: [
      { a: 'Direkt vom Flughafen', b: 'zum Oktoberfest' },
      { a: 'Festpreis', b: 'ohne versteckte Kosten' },
      { a: 'Pünktlich', b: 'und zuverlässig' },
      { a: 'Komfortabel', b: 'für Gruppen & Familien' },
    ],
    searchBadgeA: '1–8 Personen',
    searchBadgeB: 'Vans & Minibusse',
    factsEyebrow: 'Oktoberfest in Zahlen',
    factsTitleA: 'Beeindruckende',
    factsTitleB: 'Fakten',
    factsSub: 'Das Oktoberfest ist mehr als ein Fest – es ist ein Stück bayerische Lebensfreude.',
    datesTitleA: '2026',
    datesTitleB: 'Offizielle Termine & Programm',
    allDates: 'Alle Termine ansehen',
    highlight: 'Highlight',
    tipsTitleA: 'Tipps',
    tipsTitleB: 'für Besucher',
    historyTitle: 'Geschichte des Oktoberfestes',
    taxiTitle: 'Taxi zum Oktoberfest – Festpreis vom Flughafen München',
    taxiSubtitle: 'Wir bringen Sie direkt vom Flughafen München (MUC) zur Wiesn – stressfrei, pünktlich, zum Festpreis.',
    bookBtn: 'Taxi jetzt buchen',
    stats: [
      { value: '~6 Mio.', label: 'Besucher pro Jahr', img: 'besucher' },
      { value: '7,7 Mio.', label: 'Liter Bier ausgeschenkt', img: 'bier' },
      { value: '16', label: 'Festtage', img: 'festtage' },
      { value: '~500 €', label: 'Ø Ausgaben pro Besucher', img: 'ausgaben' },
      { value: '14', label: 'große Bierzelte', img: 'zelte' },
      { value: '~400.000', label: 'Verzehrte Hendl (Hähnchen)', img: 'hendl' },
    ],
    schedule: [
      { date: 'Sa., 19. Sept. 2026', icon: '🎉', event: 'Eröffnung & offizielles Anzapfen des ersten Fasses', highlight: true },
      { date: 'So., 20. Sept. 2026', icon: '👫', event: 'Eröffnungssonntag – Trachten- und Schützenzug', highlight: false },
      { date: 'Sa., 26. – So., 27. Sept. 2026', icon: '🎶', event: 'Trachtenwochenende – Folklore & Trachtenmode', highlight: false },
      { date: 'Di., 29. Sept. 2026', icon: '👨‍👩‍👧', event: 'Familientag – ermäßigte Fahrpreise', highlight: false },
      { date: 'So., 4. Okt. 2026', icon: '🍺', event: 'Letzter Wiesn-Tag – Ausklang des Oktoberfestes 2026', highlight: true },
    ],
    tips: [
      { icon: '🎫', tip: 'Zeltreservierungen Monate im Voraus buchen' },
      { icon: '👗', tip: 'Dirndl oder Lederhosen tragen – bessere Chancen auf einen Platz' },
      { icon: '🚌', tip: 'Der ÖPNV ist überfüllt – Privattaxi ist die komfortabelste Option' },
      { icon: '💶', tip: 'Bargeld mitnehmen – viele Zelte akzeptieren bevorzugt Bargeld' },
      { icon: '⏰', tip: 'Früh kommen – vor 12 Uhr hat man die besten Chancen auf einen Tisch' },
      { icon: '🏨', tip: 'Hotel 6–12 Monate im Voraus buchen – München ist während der Wiesn ausgebucht' },
    ],
    trust: [
      { label: 'Kostenlose Stornierung', sub: 'bis 3 Stunden' },
      { label: 'Festpreis garantiert', sub: '' },
      { label: '24/7 Kundenservice', sub: '' },
      { label: 'Moderne Fahrzeuge', sub: '' },
      { label: 'Sicher ans Ziel', sub: '' },
    ],
    history: [
      { year: '1810', text: 'Das erste Oktoberfest fand am 17. Oktober 1810 anlässlich der Hochzeit von Kronprinz Ludwig von Bayern mit Prinzessin Therese von Sachsen-Hildburghausen statt. Das Festgelände wurde zu Ehren der Braut „Theresienwiese" benannt.' },
      { year: '1818', text: 'Die ersten Fahrgeschäfte tauchten auf – Karussells und Schaukeln machten das Fest für Besucher noch attraktiver.' },
      { year: '1896', text: 'Aus Bierbuden wurden große Bierzelte. Die ersten großen Zelte fassten tausende Besucher und prägten das Oktoberfest, wie wir es heute kennen.' },
      { year: '1950', text: 'Das traditionelle Anzapfen des ersten Fasses wurde erstmals von Münchens Bürgermeister Thomas Wimmer vollzogen. Seitdem ruft der Oberbürgermeister „O\'zapft is!" – und das Fest beginnt.' },
      { year: '2000er', text: 'Das Oktoberfest wird zur globalen Marke. Besucher aus über 200 Nationen reisen jährlich nach München. Die Veranstaltung generiert über 1,3 Milliarden Euro für die Münchner Wirtschaft.' },
    ],
  };

  const heroIcons = [Plane, ShieldCheck, Clock, Users] as const;
  const trustIcons = [Ban, BadgeEuro, Headphones, Car, ShieldCheck] as const;
  const bookHref = locale === 'de' ? '/buchen' : `/${locale}/buchen`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: ui.title },
    ],
  };

  const eventSchema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ui.title,
    startDate: '2026-09-19',
    endDate: '2026-10-04',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'Theresienwiese',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Theresienwiese',
        addressLocality: 'München',
        postalCode: '80336',
        addressCountry: 'DE',
      },
    },
    description: ui.subtitle,
  };

  return (
    <main className="min-h-screen" style={{ background: '#f4f7fb' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden text-white" style={{ background: '#0f1b2d' }}>
        <div className="absolute inset-0" aria-hidden="true">
          <img src="/images/oktoberfest/hero.webp" alt="" className="w-full h-full object-cover" style={{ objectPosition: 'center 38%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(15,27,45,.94) 0%, rgba(15,27,45,.82) 35%, rgba(15,27,45,.45) 62%, rgba(15,27,45,.25) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,27,45,.55) 0%, rgba(15,27,45,0) 35%, rgba(15,27,45,.35) 100%)' }} />
          {/* Großraumtaxi rechts, weich eingeblendet */}
          <img
            src="/images/grossraumtaxi.webp"
            alt=""
            className="hidden lg:block absolute right-[-40px] bottom-[86px] w-[560px] xl:w-[660px] max-w-[48vw]"
            style={{
              WebkitMaskImage: 'radial-gradient(72% 66% at 55% 52%, #000 20%, rgba(0,0,0,.6) 50%, transparent 76%)',
              maskImage: 'radial-gradient(72% 66% at 55% 52%, #000 20%, rgba(0,0,0,.6) 50%, transparent 76%)',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-[132px] md:pb-[124px]">
          <p className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-bold tracking-[.18em] uppercase text-gold-400">
            {ui.dates}
            {isLive && (
              <span className="inline-flex items-center gap-1.5 bg-gold-400 text-primary-800 px-2.5 py-1 rounded-full tracking-normal normal-case text-xs">
                <span className="w-2 h-2 rounded-full bg-primary-800 animate-pulse" /> {ui.live}
              </span>
            )}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            {ui.titleA}<br />{ui.titleB}
          </h1>
          <p className="mt-3 text-lg md:text-xl text-white/90">{ui.subtitle}</p>

          <div className="mt-7 h-[118px] select-none" aria-hidden="true">
            <span className={`${caveat.className} inline-block text-[34px] leading-[1.15] text-white -rotate-[8deg] origin-top-left`}>Mehr als<br />ein Taxi.</span>
            <svg className="mt-3 ml-1 w-[130px] h-4" viewBox="0 0 200 20" fill="none" preserveAspectRatio="none">
              <path d="M4 16 C 60 12, 130 5, 196 3" stroke="#f6c644" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="mt-8 grid grid-cols-2 lg:flex lg:flex-wrap gap-x-8 gap-y-5">
            {ui.heroFeatures.map((f, i) => {
              const Icon = heroIcons[i];
              return (
                <div key={f.a} className="flex items-start gap-2.5 min-w-0">
                  <Icon size={20} strokeWidth={1.8} className="shrink-0 mt-0.5 text-white" />
                  <div className="min-w-0 text-sm leading-tight">
                    <div className="font-semibold">{f.a}</div>
                    <div className="text-white/75">{f.b}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Suchleiste (überlappt den Hero) ─── */}
      <section className="relative z-10 -mt-[104px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_14px_40px_rgba(15,27,45,.14)] px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex justify-end mb-3">
              <span className="inline-flex items-center gap-2.5 text-xs sm:text-sm text-gray-700">
                <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
                  <Users size={16} className="text-primary-800" />
                </span>
                <span className="leading-tight">
                  <span className="block font-semibold text-gray-900">{ui.searchBadgeA}</span>
                  <span className="block text-gray-500">{ui.searchBadgeB}</span>
                </span>
              </span>
            </div>
            <SearchBar />
          </div>
        </div>
      </section>

      {/* ─── Fakten ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <p className="text-xs font-bold tracking-[.2em] uppercase text-gold-600">{ui.factsEyebrow}</p>
        <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-primary-800">
          {ui.factsTitleA} <span className="text-primary-500">{ui.factsTitleB}</span>
        </h2>
        <p className="mt-2 text-gray-600">{ui.factsSub}</p>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ui.stats.map(s => (
            <article key={s.label} className="relative h-[150px] rounded-2xl overflow-hidden border border-gray-100 shadow-[0_4px_18px_rgba(15,27,45,.07)]">
              <img src={`/images/oktoberfest/${s.img}.webp`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff 46%, rgba(255,255,255,.95) 62%, rgba(255,255,255,.45) 82%, rgba(255,255,255,0) 100%)' }} />
              <div className="relative h-full flex items-center gap-4 px-5">
                <span className="flex items-center justify-center w-14 h-14 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
                  <span className="text-2xl leading-none">{['👥', '🍺', '📅', '💰', '⛺', '🍗'][ui.stats.indexOf(s)]}</span>
                </span>
                <div className="min-w-0 max-w-[60%]">
                  <div className="text-2xl sm:text-3xl font-extrabold text-primary-800 leading-tight">{s.value}</div>
                  <div className="text-sm text-gray-700 leading-snug">{s.label}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Termine ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-primary-800">
            <span className="text-primary-500">{ui.datesTitleA}</span> {ui.datesTitleB}
          </h2>
          <a href="https://www.oktoberfest.de/programm" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-800 bg-white border border-gray-200 hover:border-primary-400 rounded-xl px-4 py-2.5 transition-colors">
            {ui.allDates} <ArrowRight size={15} />
          </a>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ui.schedule.map(item => (
            <article key={item.date} className={`rounded-2xl bg-white border p-4 flex flex-col ${item.highlight ? 'border-gold-400' : 'border-gray-100'}`}>
              <p className="text-xs font-semibold text-gray-500">{item.date}</p>
              <span className="text-2xl mt-3" aria-hidden="true">{item.icon}</span>
              <p className="mt-2 text-sm font-semibold text-gray-900 leading-snug flex-1">{item.event}</p>
              {item.highlight && (
                <span className="mt-3 self-start bg-gold-400 text-primary-800 text-xs font-bold px-2.5 py-1 rounded-md">{ui.highlight}</span>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ─── Tipps ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <h2 className="text-2xl md:text-3xl font-extrabold text-primary-800">
          <span className="text-primary-500">{ui.tipsTitleA}</span> {ui.tipsTitleB}
        </h2>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {ui.tips.map(t => (
            <article key={t.tip} className="rounded-2xl bg-white border border-gray-100 p-4 text-center">
              <span className="text-2xl" aria-hidden="true">{t.icon}</span>
              <p className="mt-2 text-xs text-gray-700 leading-snug">{t.tip}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Geschichte (SEO-Inhalt) ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <h2 className="text-2xl md:text-3xl font-extrabold text-primary-800">{ui.historyTitle}</h2>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ui.history.map(h => (
            <article key={h.year} className="rounded-2xl bg-white border border-gray-100 p-5">
              <span className="inline-block bg-primary-800 text-white text-sm font-bold px-3 py-1 rounded-lg">{h.year}</span>
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{h.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ─── Taxi-CTA ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 text-white text-center" style={{ background: '#0f1b2d' }}>
          <span className="pointer-events-none absolute left-6 top-8 text-5xl opacity-90" aria-hidden="true">🚕</span>
          <span className="pointer-events-none absolute right-8 bottom-6 text-4xl opacity-80" aria-hidden="true">🥨</span>
          <div className={`${caveat.className} pointer-events-none absolute right-6 top-8 text-3xl text-gold-400 -rotate-[8deg] hidden sm:block`} aria-hidden="true">O&rsquo;zapft is!</div>
          <h2 className="text-2xl md:text-3xl font-extrabold max-w-3xl mx-auto">{ui.taxiTitle}</h2>
          <p className="mt-3 text-white/85 max-w-2xl mx-auto">{ui.taxiSubtitle}</p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={bookHref}
              className="inline-flex items-center justify-center gap-2.5 bg-gold-400 hover:bg-[#f0b92b] text-primary-800 font-bold px-7 py-4 rounded-xl transition-colors">
              <Car size={18} /> {ui.bookBtn}
            </Link>
            <a href={CONTACT_INFO.phoneHref}
              className="inline-flex items-center justify-center gap-2.5 bg-white/5 hover:bg-white/15 border border-white/25 text-white font-bold px-7 py-4 rounded-xl transition-colors">
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </section>

      {/* ─── Vertrauensleiste ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {ui.trust.map((t, i) => {
            const Icon = trustIcons[i];
            return (
              <div key={t.label} className="flex items-center gap-2.5 min-w-0 justify-center lg:justify-start">
                <Icon size={20} strokeWidth={1.8} className="shrink-0 text-primary-800" />
                <div className="min-w-0 text-[13px] leading-tight">
                  <div className="font-semibold text-gray-900">{t.label}</div>
                  {t.sub && <div className="text-gray-500">{t.sub}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
