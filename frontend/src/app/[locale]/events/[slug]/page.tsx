'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { useParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import { eventsData } from '@/lib/eventsData';
import { notFound } from 'next/navigation';

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

export default function EventPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const locale = (params?.locale as string) ?? 'de';
  const isEN = locale === 'en';

  // Find event by slug
  const event = eventsData.find(e => e.slug === slug);
  if (!event) {
    notFound();
  }

  const now = new Date();
  const isLive = now >= event.startDate && now <= event.endDate;
  const isOver = now > event.endDate;
  const isFuture = now < event.startDate;
  const countdown = useCountdown(isLive ? event.endDate : event.startDate);

  const ui = isEN ? {
    title: event.titleEN,
    subtitle: event.subtitleEN,
    dates: event.datesEN,
    location: event.locationEN,
    description: event.descriptionEN,
    daysLabel: 'Days',
    hoursLabel: 'Hours',
    minLabel: 'Min',
    secLabel: 'Sec',
    countdownTitle: isLive
      ? `⏳ Event is LIVE – ends in:`
      : isOver
        ? `🎉 See you next time!`
        : `📅 Countdown to ${event.titleEN}`,
    aboutTitle: 'About the Event',
    about: event.aboutEN,
    tipsTitle: 'Visitor Tips',
    visitorTitle: 'Visitor Information',
    visitorNumbers: event.visitorNumbers,
    internationality: event.internationality,
    taxiTitle: `Taxi to ${event.titleEN} – Fixed Price from Munich Airport`,
    taxiSubtitle: 'We take you directly from Munich Airport (MUC) to the event – stress-free, on time, fixed price.',
    bookBtn: 'Book taxi now',
    callBtn: 'Call now',
    statsTitle: 'Event in Numbers',
  } : {
    title: event.titleDE,
    subtitle: event.subtitleDE,
    dates: event.datesDE,
    location: event.locationDE,
    description: event.descriptionDE,
    daysLabel: 'Tage',
    hoursLabel: 'Std.',
    minLabel: 'Min.',
    secLabel: 'Sek.',
    countdownTitle: isLive
      ? `⏳ Das Event läuft – endet in:`
      : isOver
        ? `🎉 Bis zum nächsten Mal!`
        : `📅 Countdown zu ${event.titleDE}`,
    aboutTitle: 'Über das Event',
    about: event.aboutDE,
    tipsTitle: 'Tipps für Besucher',
    visitorTitle: 'Besucherinformation',
    visitorNumbers: event.visitorNumbers,
    internationality: event.internationality,
    taxiTitle: `Taxi zu ${event.titleDE} – Festpreis vom Flughafen München`,
    taxiSubtitle: 'Wir bringen Sie direkt vom Flughafen München (MUC) zum Event – stressfrei, pünktlich, Festpreis.',
    bookBtn: 'Taxi jetzt buchen',
    callBtn: 'Jetzt anrufen',
    statsTitle: 'Das Event in Zahlen',
  };

  // Determine icon color and gradient based on event type
  const getColorScheme = () => {
    if (slug.includes('christmas') || slug.includes('christkindl')) {
      return {
        gradient: 'from-red-900 via-red-800 to-green-700',
        accentFrom: 'from-green-500',
        accentTo: 'to-red-500',
        accent: 'bg-red-400',
        accentBright: 'text-red-400',
      };
    }
    if (slug.includes('beer') || slug.includes('oktober') || slug.includes('starkbier') || slug.includes('fruhjahrs')) {
      return {
        gradient: 'from-amber-900 via-amber-800 to-amber-700',
        accentFrom: 'from-amber-500',
        accentTo: 'to-yellow-400',
        accent: 'bg-amber-400',
        accentBright: 'text-amber-400',
      };
    }
    if (slug.includes('csd') || slug.includes('pride')) {
      return {
        gradient: 'from-purple-900 via-pink-800 to-red-700',
        accentFrom: 'from-pink-500',
        accentTo: 'to-purple-500',
        accent: 'bg-pink-400',
        accentBright: 'text-pink-400',
      };
    }
    if (slug.includes('toll') || slug.includes('opern')) {
      return {
        gradient: 'from-purple-900 via-indigo-800 to-blue-700',
        accentFrom: 'from-purple-500',
        accentTo: 'to-pink-500',
        accent: 'bg-purple-400',
        accentBright: 'text-purple-400',
      };
    }
    if (slug.includes('bauma') || slug.includes('analytica') || slug.includes('expo-real') || slug.includes('inhorgenta')) {
      return {
        gradient: 'from-slate-900 via-slate-800 to-gray-700',
        accentFrom: 'from-blue-600',
        accentTo: 'to-cyan-500',
        accent: 'bg-blue-400',
        accentBright: 'text-blue-400',
      };
    }
    if (slug.includes('iaa') || slug.includes('motor') || slug.includes('bayern') || slug.includes('marathon')) {
      return {
        gradient: 'from-blue-900 via-blue-800 to-blue-700',
        accentFrom: 'from-blue-500',
        accentTo: 'to-cyan-400',
        accent: 'bg-blue-400',
        accentBright: 'text-blue-400',
      };
    }
    if (slug.includes('heim') || slug.includes('handwerk')) {
      return {
        gradient: 'from-amber-900 via-orange-800 to-yellow-700',
        accentFrom: 'from-orange-500',
        accentTo: 'to-yellow-400',
        accent: 'bg-orange-400',
        accentBright: 'text-orange-400',
      };
    }
    if (slug.includes('ispo') || slug.includes('golf') || slug.includes('bayern')) {
      return {
        gradient: 'from-green-900 via-green-800 to-emerald-700',
        accentFrom: 'from-green-500',
        accentTo: 'to-emerald-400',
        accent: 'bg-green-400',
        accentBright: 'text-green-400',
      };
    }
    // Default blue scheme
    return {
      gradient: 'from-blue-900 via-blue-800 to-blue-700',
      accentFrom: 'from-yellow-400',
      accentTo: 'to-orange-400',
      accent: 'bg-yellow-400',
      accentBright: 'text-yellow-400',
    };
  };

  const colors = getColorScheme();

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className={`relative bg-gradient-to-br ${colors.gradient} text-white`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 text-9xl">🎪</div>
          <div className="absolute top-20 right-20 text-8xl">🎉</div>
          <div className="absolute bottom-10 left-1/3 text-7xl">🎭</div>
          <div className="absolute bottom-20 right-10 text-8xl">🎊</div>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-12 text-center">
          <div className={`inline-block ${colors.accent} text-gray-900 font-black text-sm px-4 py-1 rounded-full mb-4 uppercase tracking-wider`}>
            {ui.dates}
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 leading-tight">
            {ui.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-3 font-light">
            {ui.subtitle}
          </p>
          <p className="text-lg text-gray-300 mb-10">
            📍 {ui.location}
          </p>

          {/* Countdown */}
          {isFuture && (
            <div className="mb-10">
              <p className="text-gray-200 text-lg mb-4 font-medium">{ui.countdownTitle}</p>
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
                    <div className="text-gray-300 text-xs md:text-sm mt-1 uppercase tracking-wider">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isLive && (
            <div className="mb-10 text-center">
              <div className="inline-block bg-red-500 text-white font-black px-6 py-3 rounded-full text-lg animate-pulse mb-4">
                🔴 {isEN ? 'LIVE NOW' : 'LÄUFT JETZT'}
              </div>
              <p className="text-gray-200 text-lg font-medium">{ui.countdownTitle}</p>
              <div className="flex justify-center gap-3 md:gap-6 mt-4">
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
                    <div className="text-gray-300 text-xs md:text-sm mt-1 uppercase tracking-wider">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isOver && (
            <div className="mb-10 text-center">
              <p className="text-gray-200 text-lg font-medium">{ui.countdownTitle}</p>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href={`/${locale}/buchen`}
              className={`${colors.accent} hover:opacity-90 text-gray-900 font-black py-4 px-8 rounded-xl text-lg transition-colors`}
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

      {/* Description */}
      <section className="bg-gray-50 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-8 border-l-8" style={{ borderColor: colors.accent.replace('bg-', 'border-') }}>
            <p className="text-lg text-gray-700 leading-relaxed">
              {ui.description}
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={`bg-gradient-to-r ${colors.accentFrom} ${colors.accentTo} py-16`}>
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-black text-white text-center mb-10">{ui.statsTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {event.stats.map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center shadow-sm border border-white/20">
                <div className="text-4xl mb-2">{s.icon}</div>
                <div className="text-3xl font-black text-white mb-1">{isEN ? s.valueEN : s.valueDE}</div>
                <div className="text-sm text-white/80">{isEN ? s.labelEN : s.labelDE}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visitor Information */}
      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.visitorTitle}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-blue-50 rounded-2xl p-8 border border-blue-200">
              <div className="text-5xl font-black text-blue-900 mb-2">{ui.visitorNumbers}</div>
              <p className="text-gray-700">
                {isEN ? 'Approximate number of visitors per year or event' : 'Ungefähre Anzahl der Besucher pro Jahr oder Event'}
              </p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-8 border border-purple-200">
              <div className="text-5xl font-black text-purple-900 mb-2">{ui.internationality}</div>
              <p className="text-gray-700">
                {isEN ? 'International visitor share' : 'Anteil internationaler Besucher'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">

        {/* About */}
        <section>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.aboutTitle}</h2>
          <div className="prose prose-lg max-w-none">
            {ui.about.split('\n\n').map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed text-lg mb-6">
                {para}
              </p>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-3xl font-black text-gray-900 mb-8">{ui.tipsTitle}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {event.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-4 bg-blue-50 rounded-2xl p-5 border border-blue-100">
                <span className="text-3xl flex-shrink-0">{tip.icon}</span>
                <p className="text-gray-700 leading-relaxed">
                  {isEN ? tip.tipEN : tip.tipDE}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Taxi CTA */}
        <section className={`bg-gradient-to-br ${colors.gradient} text-white rounded-3xl p-10 text-center`}>
          <div className="text-5xl mb-4">🚕</div>
          <h2 className="text-3xl font-black mb-4">{ui.taxiTitle}</h2>
          <p className="text-gray-200 text-lg mb-8 max-w-2xl mx-auto">{ui.taxiSubtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/buchen`}
              className={`${colors.accent} hover:opacity-90 text-gray-900 font-black py-4 px-8 rounded-xl text-lg transition-colors`}
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
