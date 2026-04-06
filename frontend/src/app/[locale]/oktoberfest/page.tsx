'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { useParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';

// Oktoberfest 2026: 19. September – 4. Oktober
const OKTOBERFEST_START = new Date('2026-09-19T12:00:00');
const OKTOBERFEST_END = new Date('2026-10-04T23:59:59');

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function useCountdown(target: Date): TimeLeft {
  const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return zero;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState<TimeLeft>(zero);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setT(calc());
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return mounted ? t : zero;
}

export default function OktoberfestPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'de';
  const isEN = locale === 'en';
  const now = new Date();
  const isLive = now >= OKTOBERFEST_START && now <= OKTOBERFEST_END;
  const isOver = now > OKTOBERFEST_END;
  const countdown = useCountdown(isLive ? OKTOBERFEST_END : OKTOBERFEST_START);

  const ui = isEN ? {
    title: 'Oktoberfest 2026 Munich',
    subtitle: 'The World\'s Largest Folk Festival',
    dates: 'September 19 – October 4, 2026',
    daysLabel: 'Days',
    hoursLabel: 'Hours',
    minLabel: 'Min',
    secLabel: 'Sec',
    countdownTitle: isLive ? '⏳ Oktoberfest is LIVE – ends in:' : isOver ? '🎉 See you at Oktoberfest 2027!' : '🍺 Countdown to Oktoberfest 2026',
    statsTitle: 'Oktoberfest in Numbers',
    historyTitle: 'History of Oktoberfest',
    datesTitle: '2026 Official Dates & Schedule',
    tipsTitle: 'Visitor Tips',
    taxiTitle: 'Taxi to Oktoberfest – Fixed Price from Munich Airport',
    taxiSubtitle: 'We take you directly from Munich Airport (MUC) to the Theresienwiese – stress-free, on time, fixed price.',
    bookBtn: 'Book taxi now',
    callBtn: 'Call now',
    stats: [
      { value: '~6 Mio.', label: 'Visitors per year', icon: '👥' },
      { value: '7.7 Mio.', label: 'Litres of beer served', icon: '🍺' },
      { value: '16', label: 'Days of celebration', icon: '📅' },
      { value: '~500 €', label: 'Avg. spend per visitor', icon: '💶' },
      { value: '14', label: 'Large beer tents', icon: '⛺' },
      { value: '~400.000', label: 'Roast chickens consumed', icon: '🍗' },
    ],
    history: [
      {
        year: '1810',
        text: 'The first Oktoberfest was held on 17 October 1810 to celebrate the wedding of Crown Prince Ludwig of Bavaria to Princess Therese of Saxony-Hildburghausen. The fields where it was held were named "Theresienwiese" in her honour.',
      },
      {
        year: '1818',
        text: 'The first fairground attractions appeared – carousels and swings made the festival more entertaining for visitors.',
      },
      {
        year: '1896',
        text: 'Beer stalls became large beer tents. The first large tents could hold thousands of visitors and marked the beginning of the Oktoberfest we know today.',
      },
      {
        year: '1950',
        text: 'The traditional Oktoberfest barrel-tapping ceremony was held for the first time by Munich Mayor Thomas Wimmer. Today the mayor taps the first barrel and calls "O\'zapft is!" (It\'s tapped!).',
      },
      {
        year: '2000s',
        text: 'Oktoberfest becomes a global brand. Visitors from over 200 nations travel to Munich every year. The event generates over €1.3 billion for the Munich economy.',
      },
    ],
    schedule: [
      { date: 'Sat, 19 Sep 2026', event: '🎉 Opening ceremony & barrel tapping', highlight: true },
      { date: 'Sun, 20 Sep 2026', event: '🎠 Opening Sunday – traditional costume parade', highlight: false },
      { date: 'Sat, 26 Sep – Sun, 27 Sep', event: '🎶 Folklore weekend – traditional music & costumes', highlight: false },
      { date: 'Tue, 29 Sep 2026', event: '👨‍👩‍👧 Family day – reduced prices for rides', highlight: false },
      { date: 'Sun, 4 Oct 2026', event: '🍺 Last day – Last Call at Oktoberfest 2026', highlight: true },
    ],
    tips: [
      { icon: '🎫', tip: 'Book tent reservations months in advance – the most popular tents fill up quickly' },
      { icon: '👘', tip: 'Wear traditional Dirndl or Lederhosen – visitors in traditional dress get priority seating' },
      { icon: '🚌', tip: 'Public transport runs extended hours, but a private taxi is the most comfortable option' },
      { icon: '💳', tip: 'Bring cash – many tents still prefer cash payments' },
      { icon: '⏰', tip: 'Arrive early – before noon for the best chance of getting a table without reservation' },
      { icon: '🏨', tip: 'Book your hotel 6–12 months in advance as Munich accommodations sell out quickly' },
    ],
  } : {
    title: 'Oktoberfest 2026 München',
    subtitle: 'Das größte Volksfest der Welt',
    dates: '19. September – 4. Oktober 2026',
    daysLabel: 'Tage',
    hoursLabel: 'Std.',
    minLabel: 'Min.',
    secLabel: 'Sek.',
    countdownTitle: isLive ? '⏳ Das Oktoberfest läuft – endet in:' : isOver ? '🎉 Bis zum Oktoberfest 2027!' : '🍺 Countdown zum Oktoberfest 2026',
    statsTitle: 'Oktoberfest in Zahlen',
    historyTitle: 'Geschichte des Oktoberfestes',
    datesTitle: '2026 Offizielle Termine & Programm',
    tipsTitle: 'Tipps für Besucher',
    taxiTitle: 'Taxi zum Oktoberfest – Festpreis vom Flughafen München',
    taxiSubtitle: 'Wir bringen Sie direkt vom Flughafen München (MUC) zur Theresienwiese – stressfrei, pünktlich, Festpreis.',
    bookBtn: 'Taxi jetzt buchen',
    callBtn: 'Jetzt anrufen',
    stats: [
      { value: '~6 Mio.', label: 'Besucher pro Jahr', icon: '👥' },
      { value: '7,7 Mio.', label: 'Liter Bier ausgeschenkt', icon: '🍺' },
      { value: '16', label: 'Festtage', icon: '📅' },
      { value: '~500 €', label: 'Ø Ausgaben pro Besucher', icon: '💶' },
      { value: '14', label: 'Große Bierzelte', icon: '⛺' },
      { value: '~400.000', label: 'Verzehrte Hendl (Hähnchen)', icon: '🍗' },
    ],
    history: [
      {
        year: '1810',
        text: 'Das erste Oktoberfest fand am 17. Oktober 1810 anlässlich der Hochzeit von Kronprinz Ludwig von Bayern mit Prinzessin Therese von Sachsen-Hildburghausen statt. Das Festgelände wurde zu Ehren der Braut „Theresienwiese" benannt.',
      },
      {
        year: '1818',
        text: 'Die ersten Fahrgeschäfte tauchten auf – Karussells und Schaukeln machten das Fest für Besucher noch attraktiver.',
      },
      {
        year: '1896',
        text: 'Aus Bierbuden wurden große Bierzelte. Die ersten großen Zelte fassten tausende Besucher und prägten das Oktoberfest, wie wir es heute kennen.',
      },
      {
        year: '1950',
        text: 'Das traditionelle Anzapfen des ersten Fasses wurde erstmals von Münchens Bürgermeister Thomas Wimmer vollzogen. Seitdem ruft der Oberbürgermeister „O\'zapft is!" – und das Fest beginnt.',
      },
      {
        year: '2000er',
        text: 'Das Oktoberfest wird zur globalen Marke. Besucher aus über 200 Nationen reisen jährlich nach München. Die Veranstaltung generiert über 1,3 Milliarden Euro für die Münchner Wirtschaft.',
      },
    ],
    schedule: [
      { date: 'Sa., 19. Sept. 2026', event: '🎉 Eröffnung & offizielles Anzapfen des ersten Fasses', highlight: true },
      { date: 'So., 20. Sept. 2026', event: '🎠 Eröffnungssonntag – Trachten- und Schützenzug', highlight: false },
      { date: 'Sa., 26. – So., 27. Sept.', event: '🎶 Trachtenwochenende – Folklore & Trachtenmode', highlight: false },
      { date: 'Di., 29. Sept. 2026', event: '👨‍👩‍👧 Familientag – ermäßigte Fahrpreise', highlight: false },
      { date: 'So., 4. Okt. 2026', event: '🍺 Letzter Wiesn-Tag – Ausklang des Oktoberfests 2026', highlight: true },
    ],
    tips: [
      { icon: '🎫', tip: 'Zeltreservierungen Monate im Voraus buchen – die beliebtesten Zelte sind schnell ausgebucht' },
      { icon: '👘', tip: 'Dirndl oder Lederhosen tragen – Besucher in Tracht haben bessere Chancen auf einen Platz' },
      { icon: '🚌', tip: 'Der ÖPNV fährt verlängert, aber ein Privattaxi ist die komfortabelste Option' },
      { icon: '💳', tip: 'Bargeld mitnehmen – viele Zelte akzeptieren bevorzugt Bargeld' },
      { icon: '⏰', tip: 'Früh kommen – vor 12 Uhr hat man die besten Chancen auf einen Tisch ohne Reservierung' },
      { icon: '🏨', tip: 'Hotel 6–12 Monate im Voraus buchen – München ist während der Wiesn ausgebucht' },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 text-9xl">🍺</div>
          <div className="absolute top-20 right-20 text-8xl">🎪</div>
          <div className="absolute bottom-10 left-1/3 text-7xl">🥨</div>
          <div className="absolute bottom-20 right-10 text-8xl">🎠</div>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="inline-block bg-yellow-400 text-blue-900 font-black text-sm px-4 py-1 rounded-full mb-4 uppercase tracking-wider">
            {ui.dates}
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 leading-tight">
            {ui.title}
          </h1>
          <p className="text-xl md:text-2xl text-blue-200 mb-10 font-light">
            {ui.subtitle}
          </p>

          {/* Countdown */}
          <div className="mb-10">
            <p className="text-blue-200 text-lg mb-4 font-medium">{ui.countdownTitle}</p>
            {!isOver && (
              <div className="flex justify-center gap-3 md:gap-6">
                {[
                  { v: countdown.days, l: ui.daysLabel },
                  { v: countdown.hours, l: ui.hoursLabel },
                  { v: countdown.minutes, l: ui.minLabel },
                  { v: countdown.seconds, l: ui.secLabel },
                ].map(({ v, l }) => (
                  <div key={l} className="bg-white/10 backdrop-blur rounded-2xl px-4 md:px-8 py-4 md:py-5 min-w-[72px] md:min-w-[100px]" suppressHydrationWarning>
                    <div className="text-4xl md:text-6xl font-black tabular-nums leading-none" suppressHydrationWarning>
                      {String(v).padStart(2, '0')}
                    </div>
                    <div className="text-blue-200 text-xs md:text-sm mt-1 uppercase tracking-wider">{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href={`/${locale}/buchen`}
              className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black py-4 px-8 rounded-xl text-lg transition-colors"
            >
              🚕 {ui.bookBtn}
            </Link>
            <a
              href={`tel:${CONTACT_INFO.phone}`}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors border border-white/30"
            >
              <Phone className="inline w-5 h-5 mr-2 -mt-0.5" />
              {ui.callBtn}
            </a>
          </div>

        </div>
      </section>

      {/* Search Bar */}
      <section className="bg-white py-6 shadow-lg">
        <div className="max-w-5xl mx-auto px-4">
          <SearchBar />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-yellow-400 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-black text-blue-900 text-center mb-10">{ui.statsTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {ui.stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 text-center shadow-sm">
                <div className="text-4xl mb-2">{s.icon}</div>
                <div className="text-3xl font-black text-blue-900 mb-1">{s.value}</div>
                <div className="text-sm text-gray-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Gallery Placeholder */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-gradient-to-br from-blue-100 to-yellow-100 flex items-center justify-center text-5xl border-2 border-dashed border-blue-200"
              >
                {['🍺', '🎪', '🥨', '👘', '🎠', '🏔️'][i - 1]}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">
            {isEN ? 'Photo gallery coming soon' : 'Bildergalerie folgt'}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">

        {/* Dates & Schedule */}
        <section>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.datesTitle}</h2>
          <div className="space-y-3">
            {ui.schedule.map((item, i) => (
              <div
                key={i}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 p-5 rounded-2xl border ${
                  item.highlight
                    ? 'bg-yellow-50 border-yellow-300 shadow-sm'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <span className={`font-bold text-sm whitespace-nowrap ${item.highlight ? 'text-yellow-700' : 'text-gray-500'}`}>
                  {item.date}
                </span>
                <span className={`font-medium ${item.highlight ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                  {item.event}
                </span>
                {item.highlight && (
                  <span className="ml-auto bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {isEN ? 'Key date' : 'Highlight'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.historyTitle}</h2>
          <div className="relative pl-8 border-l-4 border-yellow-400 space-y-8">
            {ui.history.map((item) => (
              <div key={item.year} className="relative">
                <div className="absolute -left-11 top-0 w-6 h-6 rounded-full bg-yellow-400 border-4 border-white shadow flex items-center justify-center" />
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="inline-block bg-blue-900 text-white text-sm font-black px-3 py-1 rounded-lg mb-3">
                    {item.year}
                  </span>
                  <p className="text-gray-700 leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.tipsTitle}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {ui.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-4 bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <span className="text-3xl flex-shrink-0">{tip.icon}</span>
                <p className="text-gray-700 leading-relaxed">{tip.tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Taxi CTA */}
        <section className="bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-3xl p-10 text-center">
          <div className="text-5xl mb-4">🚕</div>
          <h2 className="text-3xl font-black mb-4">{ui.taxiTitle}</h2>
          <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto">{ui.taxiSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/buchen`}
              className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black py-4 px-8 rounded-xl text-lg transition-colors"
            >
              🎫 {ui.bookBtn}
            </Link>
            <a
              href={`tel:${CONTACT_INFO.phone}`}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-xl text-lg transition-colors border border-white/30"
            >
              <Phone className="inline w-5 h-5 mr-2 -mt-0.5" />
              {CONTACT_INFO.phone}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
