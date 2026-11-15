import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Clock, Star, Tag, Baby, CreditCard, Phone, BadgePercent, Plane, Trophy, Ban, MailCheck, ShieldCheck, Users, UsersRound, User, Check, Calendar, Luggage, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
// Platzhalter in Endhöhe der Suche: ohne ihn schiebt die nachgeladene Suche alles darunter
// um bis zu 252px nach unten (CLS ~0,12 auf Mobilgeräten)
const SearchBar = dynamic(() => import('@/components/SearchBar'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[230px] sm:h-[239px] lg:h-[clamp(68px,9.8vh,92px)] rounded-[22px] bg-white/10" />,
});
const AutoDiscountBanner = dynamic(() => import('@/components/AutoDiscountBanner'), { ssr: false });
import PopularRoutes from '@/components/PopularRoutes';
import HomeSeoContent from '@/components/HomeSeoContent';
import StepAnimation from '@/components/StepAnimations';
import HeroBackground, { HeroSeasonMobilePhoto, HeroSnow } from '@/components/HeroBackground';
import { heroTextFor, heroEffects } from '@/lib/heroSeasons';
import { resolveHeroSeasonImg } from '@/lib/heroSeasonServer';
import { CONTACT_INFO } from '@/lib/utils';
import { Outfit } from 'next/font/google';

const heroFont = Outfit({ subsets: ['latin', 'latin-ext'], weight: ['300', '400', '600'], display: 'swap' });

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

const GOLD = '#d6a957';

// Drei Merkmale (Festpreise · Pünktlich · 24/7) im Hero
function HeroBadges({ badges, className }: { badges: { icon: typeof Tag; text: string }[]; className: string }) {
  return (
    <div className={`${heroFont.className} ${className} items-center`}>
              {badges.map(({ icon: Icon, text }, i) => (
                <div key={text} className={`flex items-center gap-2 sm:gap-3 ${i > 0 ? 'pl-3 ml-3 sm:pl-7 sm:ml-7 border-l' : ''}`} style={{ borderColor: 'rgba(214,169,87,.55)' }}>
                  <Icon strokeWidth={1.5} className="shrink-0 w-[18px] h-[18px] sm:w-[clamp(18px,3vh,26px)] sm:h-[clamp(18px,3vh,26px)]" style={{ color: GOLD }} />
                  <span className={`${heroFont.className} text-[12.5px] leading-tight sm:text-[clamp(14px,2.3vh,19px)] font-normal`}>{text}</span>
                </div>
              ))}
    </div>
  );
}

const heroParam = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

// Saisonbild (System → Hero-Kalender) wird hier auf dem Server bestimmt — Wechsel um 00:00 Berliner Zeit
export default async function HomePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const seasonImg = await resolveHeroSeasonImg(heroParam(searchParams?.heroPreview), heroParam(searchParams?.heroDate));
  return <HomeContent seasonImg={seasonImg} />;
}

function HomeContent({ seasonImg }: { seasonImg: string | null }) {
  const t = useTranslations('hero');
  const tVehicles = useTranslations('vehicles');
  const locale = useLocale();

  const stepsData: Record<string, { label: string; title: string; sub: string; steps: { title: string; text: string; extra: string[] }[]; cta: string }> = {
    de: {
      label: 'So einfach geht\'s',
      title: 'In 3 Schritten zum Transfer',
      sub: 'Schnell. Transparent. Zuverlässig.',
      steps: [
        { title: 'Adresse & Zeit eingeben', text: 'Geben Sie Abholadresse, Zielort, Datum und Uhrzeit ein. Unser System berechnet sofort Ihren Festpreis – in unter 1 Sekunde.', extra: ['✓ Zwischenstopp möglich', '✓ Alle Terminals verfügbar', '✓ Rückfahrt buchbar'] },
        { title: 'Fahrzeug & Preis wählen', text: 'Wählen Sie zwischen Kombi, Van oder Großraumtaxi. Transparenter Festpreis, kein Stauaufpreis – Ihr Preis bleibt fest.', extra: ['✓ Kombi bis 4 Pax', '✓ Van bis 7 Pax', '✓ Großraum bis 8 Pax'] },
        { title: 'Entspannt ankommen', text: 'Ihr Fahrer wartet pünktlich am Ausgang – mit Namensschild. Bei Flugverspätung warten wir 60 Minuten kostenlos.', extra: ['✓ Meet & Greet Service', '✓ 60 Min. Wartezeit gratis', '✓ Gepäckhilfe inklusive'] },
      ],
      cta: 'Alle Fahrzeuge ansehen',
    },
    en: {
      label: 'How it works',
      title: 'Transfer in 3 simple steps',
      sub: 'Fast. Transparent. Reliable.',
      steps: [
        { title: 'Enter address & time', text: 'Enter your pickup address, destination, date and time. Our system calculates your fixed price instantly – in under 1 second.', extra: ['✓ Intermediate stop possible', '✓ All terminals available', '✓ Return trip bookable'] },
        { title: 'Choose vehicle & price', text: 'Choose between Kombi, Van or Large Taxi. Transparent fixed price, no traffic surcharge – your price stays fixed.', extra: ['✓ Kombi up to 4 Pax', '✓ Van up to 7 Pax', '✓ Large Taxi up to 8 Pax'] },
        { title: 'Arrive relaxed', text: 'Your driver waits punctually at the exit – with a name sign. We wait 60 minutes for free in case of flight delays.', extra: ['✓ Meet & Greet Service', '✓ 60 min. waiting time free', '✓ Luggage assistance included'] },
      ],
      cta: 'View all vehicles',
    },
    tr: {
      label: 'Bu kadar basit',
      title: '3 adımda transferiniz',
      sub: 'Hızlı. Şeffaf. Güvenilir.',
      steps: [
        { title: 'Adres & saat girin', text: 'Alış adresinizi, varış noktasını, tarih ve saati girin. Sistemimiz sabit fiyatınızı anında hesaplar – 1 saniyenin altında.', extra: ['✓ Ara durak mümkün', '✓ Tüm terminaller mevcut', '✓ Dönüş yolculuğu rezerve edilebilir'] },
        { title: 'Araç & fiyat seçin', text: 'Kombi, Van veya Büyük Taksi arasından seçin. Şeffaf sabit fiyat, trafik ek ücreti yok – fiyatınız sabit kalır.', extra: ['✓ Kombi 4 kişiye kadar', '✓ Van 7 kişiye kadar', '✓ Büyük Taksi 8 kişiye kadar'] },
        { title: 'Rahatça varın', text: 'Sürücünüz isim tabelasıyla çıkışta sizi bekleyecek. Uçuş gecikmelerinde 60 dakika ücretsiz bekliyoruz.', extra: ['✓ Karşılama Hizmeti', '✓ 60 dk. bekleme ücretsiz', '✓ Bagaj yardımı dahil'] },
      ],
      cta: 'Tüm araçları görüntüle',
    },
  };
  const sd = stepsData[locale] || stepsData.de;

  // Saison-Design: eigene Überschrift; ohne Texte bleibt die normale Überschrift
  const seasonText = heroTextFor(seasonImg, locale);
  const fx = heroEffects(seasonImg);
  const heroBadges = [
    { icon: Tag, text: t('features.fixed_price') },
    { icon: Clock, text: t('features.punctual') },
    { icon: Star, text: t('features.247') },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative text-white overflow-visible" style={{ background: '#17191d' }}>
        {/* Foto: neuer Mercedes E-Klasse (2026) Taxi am Terminal — Desktop rechts, Handy vollflächig */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <HeroBackground img={seasonImg} />
          {/* Links dunkel für den Text, rechts freies Foto */}
          <div
            className="absolute inset-0 hidden lg:block"
            style={{ background: seasonImg
              // Saisonbild: weicher Übergang vom dunklen Textbereich ins Foto
              ? 'linear-gradient(90deg, rgba(23,25,29,.97) 0%, rgba(23,25,29,.93) 12%, rgba(23,25,29,.84) 22%, rgba(23,25,29,.68) 32%, rgba(23,25,29,.46) 42%, rgba(23,25,29,.25) 51%, rgba(23,25,29,.1) 60%, rgba(23,25,29,0) 70%)'
              : 'linear-gradient(90deg, #17191d 0%, rgba(23,25,29,.94) 22%, rgba(23,25,29,.72) 38%, rgba(23,25,29,.25) 52%, rgba(23,25,29,0) 64%)' }}
          />
          {(fx.snow || fx.glow) && <HeroSnow snow={fx.snow} glow={fx.glow} />}
          <div
            className={`absolute inset-0 lg:hidden ${seasonImg ? 'hidden' : ''}`}
            style={{ background: 'linear-gradient(180deg, rgba(23,25,29,.82) 0%, rgba(23,25,29,.55) 45%, rgba(23,25,29,.9) 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-40"
            style={{ background: 'linear-gradient(180deg, rgba(23,25,29,0) 0%, rgba(22,24,28,.85) 100%)' }}
          />
        </div>

        <div className={`relative max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-[60px] ${seasonText ? 'pt-5 sm:pt-12 lg:pt-[clamp(14px,6.6vh,70px)]' : 'pt-8 sm:pt-16 lg:pt-[clamp(20px,10.5vh,108px)]'} pb-8 lg:pb-[clamp(12px,4.2vh,44px)]`}>
          <div className="animate-fade-in max-w-[900px]">
            {seasonText && (seasonText.kickerLine === 'none' ? (
              <div className={`${heroFont.className} mb-3 lg:mb-[clamp(8px,2.6vh,28px)] uppercase font-semibold tracking-[.16em] lg:tracking-[.3em] text-[11px] sm:text-sm lg:text-[clamp(11px,1.9vh,17px)]`} style={{ color: GOLD }}>
                <span className="lg:hidden">{seasonText.kickerMobile || seasonText.kicker}</span>
                <span className="hidden lg:inline">{seasonText.kicker}</span>
              </div>
            ) : seasonText.kickerLine === 'after' ? (
              <div className={`${heroFont.className} flex items-center gap-3 lg:gap-5 mb-3 lg:mb-[clamp(8px,2.6vh,28px)] uppercase whitespace-nowrap ${seasonText.kickerWide ? 'font-normal tracking-[.1em] sm:tracking-[.18em] lg:tracking-[.22em] text-[11px] sm:text-sm lg:text-[clamp(12px,2.2vh,20px)]' : 'font-semibold tracking-[.06em] sm:tracking-[.1em] text-[11.5px] sm:text-sm lg:text-[clamp(13px,2.4vh,22px)]'}`} style={{ color: GOLD }}>
                {seasonText.kickerBoldFirst ? (
                  // erster Teil kräftig, Rest leicht (wie im Design)
                  <span>{seasonText.kicker.split(' · ').map((part, i) => <span key={i} className={i === 0 ? 'font-semibold' : 'font-light'}>{i > 0 && ' · '}{part}</span>)}</span>
                ) : (
                  <>
                    <span className="lg:hidden">{seasonText.kickerMobile || seasonText.kicker}</span>
                    <span className="hidden lg:inline">{seasonText.kicker}</span>
                  </>
                )}
                <span className="h-px flex-1 max-w-[270px] lg:flex-none lg:w-24" style={{ background: GOLD }} />
              </div>
            ) : (
              <div className={`${heroFont.className} flex items-center justify-center lg:justify-start gap-3 lg:gap-5 mb-3 lg:mb-[clamp(8px,2.6vh,28px)] uppercase whitespace-nowrap tracking-[.14em] sm:tracking-[.2em] text-[10.5px] sm:text-sm lg:text-[clamp(12px,2.1vh,19px)]`} style={{ color: GOLD }}>
                <span className="h-px w-5 sm:w-8 lg:w-11 shrink-0" style={{ background: GOLD }} />
                <span className="text-center">{seasonText.kicker}</span>
                <span className="h-px w-5 sm:w-8 shrink-0 lg:hidden" style={{ background: GOLD }} />
              </div>
            ))}
            <h1
              className={`${heroFont.className} font-semibold tracking-[-0.01em] leading-[1.12] ${seasonText ? 'text-[30px]' : 'text-[34px]'} sm:text-5xl lg:text-[clamp(34px,min(4.2vw,7.6vh),64px)] mb-4 lg:mb-[clamp(6px,2.2vh,24px)]`}
              style={{ textShadow: '0 2px 18px rgba(0,0,0,0.35)' }}
            >
              {seasonText ? seasonText.title : t('title')}
              <span className="block" style={{ color: GOLD }}>{seasonText ? seasonText.subtitle : t('subtitle')}</span>
            </h1>

            <p className={`${heroFont.className} font-light text-white/95 ${seasonText ? 'text-[15px] leading-snug' : 'text-lg'} sm:text-xl lg:text-[clamp(16px,3vh,26px)] lg:leading-[1.4] ${seasonText ? 'lg:max-w-[clamp(480px,90vh,780px)]' : 'lg:max-w-[clamp(440px,72vh,620px)]'} mb-4 sm:mb-8 lg:mb-[clamp(10px,5.6vh,54px)]`}>
              {seasonText
                // \n im Text = Zeilenumbruch nur am Computer (wie im Design); am Handy fließt der Text
                ? seasonText.description.split('\n').map((part, i) => <span key={i}>{i > 0 && <br className="hidden lg:block" />}{i > 0 && ' '}{part}</span>)
                : t('description')}
            </p>

            {/* Feature-Leiste — auf dem Handy ausgeblendet, damit die Suche oben bleibt */}
            <HeroBadges badges={heroBadges} className={!seasonImg ? 'hidden sm:flex' : seasonText?.badgesBelowPhoto ? 'relative z-10 hidden lg:flex' : 'relative z-10 flex'} />
          </div>

          {seasonImg && <HeroSeasonMobilePhoto img={seasonImg} snow={fx.snow} />}
          {seasonText?.badgesBelowPhoto && <HeroBadges badges={heroBadges} className="relative z-10 flex lg:hidden justify-between mt-7 -mb-1" />}

          {/* Rabatt-Banner (Rabatte-Tab) — fester Platz über der Suche, damit nichts verrutscht */}
          <div className="relative w-full mt-4 sm:mt-0 sm:h-[clamp(14px,7.5vh,76px)] sm:flex sm:items-center">
            <AutoDiscountBanner locale={locale} />
          </div>

          {/* Search Bar */}
          <div id="booking" className="animate-slide-up w-full" style={{ scrollMarginTop: '250px' }}>
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section style={{ background: '#16181c' }} className="py-8 lg:py-[clamp(10px,3.4vh,40px)]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-[60px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 text-center">
            {[
              { value: '20+', label: locale === 'en' ? 'YEARS OF EXPERIENCE' : locale === 'tr' ? 'YIL DENEYİM' : 'JAHRE ERFAHRUNG' },
              { value: locale === 'en' ? '4.7' : '4,7', star: true, label: locale === 'en' ? 'AVG. RATING' : locale === 'tr' ? 'ORT. PUAN' : 'Ø BEWERTUNG' },
              { value: '100%', label: locale === 'en' ? 'FIXED PRICES' : locale === 'tr' ? 'SABİT FİYAT' : 'FESTPREISE' },
              { value: '24/7', label: locale === 'en' ? 'AVAILABLE' : locale === 'tr' ? 'HİZMETTE' : 'VERFÜGBAR' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center ${i > 0 ? 'md:border-l' : ''} ${i % 2 === 1 ? 'border-l md:border-l' : ''}`}
                style={{ borderColor: 'rgba(214,169,87,.5)' }}
              >
                <div className={`${heroFont.className} flex items-center gap-2 text-5xl lg:text-[clamp(28px,6.9vh,62px)] font-semibold leading-none tracking-tight`} style={{ color: GOLD }}>
                  {stat.value}
                  {stat.star && <Star className="w-10 h-10 lg:w-[clamp(24px,5.8vh,52px)] lg:h-[clamp(24px,5.8vh,52px)]" fill={GOLD} strokeWidth={0} />}
                </div>
                <div className={`${heroFont.className} text-sm lg:text-[clamp(11px,2.15vh,20px)] font-normal text-white mt-3 lg:mt-[clamp(4px,1.4vh,16px)] tracking-[.18em] uppercase`}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden py-20" style={{ background: '#f7f9fc' }}>
        {/* Dekoratif arka plan — solda terminal cephesi, sagda kule + ucak izi.
            Kenarlardan bolum rengine dogru soluyor, icerigin arkasinda kaliyor. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-0 hidden md:block" style={{ width: '380px' }}>
            <img src="/images/steps-bg-left.webp" alt="" width={355} height={212} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(247,249,252,.15), #f7f9fc 88%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(247,249,252,0) 30%, #f7f9fc 100%)' }} />
          </div>
          <div className="absolute top-0 right-0 hidden md:block" style={{ width: '380px' }}>
            <img src="/images/steps-bg-right.webp" alt="" width={361} height={212} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(247,249,252,0) 55%, #f7f9fc 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(247,249,252,0) 35%, #f7f9fc 100%)' }} />
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-[.18em] uppercase mb-3" style={{ color: '#c9a84c' }}>
              {sd.label}
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>
              {sd.title}
            </h2>
            <p className="mt-3 text-lg" style={{ color: '#6b7c93' }}>{sd.sub}</p>
            <span className="block mx-auto mt-5 rounded-full" style={{ width: '104px', height: '3px', background: '#c9a84c' }} />
          </div>

          {/* Steps — 3 kart */}
          <div className="grid gap-6 lg:grid-cols-3">
            {sd.steps.map((s, idx) => {
              const ikonlar = [[Clock, Plane, Calendar], [Users, Users, Users], [User, Clock, Luggage]][idx];
              return (
                <div key={s.title} className="relative">
                  <div className="h-full bg-white rounded-2xl p-5 pt-8 flex flex-col" style={{ boxShadow: '0 4px 24px rgba(15,27,45,.07)' }}>
                    {/* Foto + numara rozeti */}
                    <div className="relative">
                      <StepAnimation step={idx} locale={locale} />
                      <span
                        className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full text-white font-extrabold text-lg"
                        style={{ width: '44px', height: '44px', background: '#c9a84c', boxShadow: '0 3px 10px rgba(201,168,76,.45)', border: '3px solid #fff' }}
                        aria-hidden="true"
                      >
                        {idx + 1}
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold mt-5 mb-2 tracking-tight" style={{ color: '#0f1b2d' }}>
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#6b7c93' }}>
                      {s.text}
                    </p>

                    <div className="flex flex-col gap-2 mt-auto">
                      {s.extra.map((e, i) => {
                        const Ikon = ikonlar[i];
                        return (
                          <div
                            key={e}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                            style={{ background: '#fdf8ec', border: '1px solid #f3e7c4' }}
                          >
                            <Ikon size={17} strokeWidth={2} style={{ color: '#c9a84c', flexShrink: 0 }} />
                            <span className="text-sm font-semibold" style={{ color: '#8a6d1f' }}>
                              {e.replace(/^\u2713\s*/, '')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Kartlar arasi ok — sadece 3 sutunlu duzende */}
                  {idx < 2 && (
                    <ChevronRight
                      size={26}
                      strokeWidth={3}
                      className="hidden lg:block absolute top-1/2 -right-5 -translate-y-1/2 z-10"
                      style={{ color: '#c9a84c' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a
              href="#booking"
              className="inline-flex items-center gap-2 font-bold text-base px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              style={{ background: '#1e3a5f', color: '#fff', boxShadow: '0 6px 24px rgba(30,58,95,.28)' }}
            >
              {locale === 'en' ? 'Get your free price quote' : locale === 'tr' ? 'Ücretsiz fiyat hesapla' : 'Jetzt kostenlos Preis berechnen'}
              <ChevronRight size={18} strokeWidth={3} />
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

          {(() => {
            const vf: Record<string, { kombi: string[]; van: string[]; gross: string[] }> = {
              de: {
                kombi: ['Klimaanlage', 'Lederausstattung', 'Großer Kofferraum', 'Komfortables Fahrerlebnis'],
                van:   ['Klimaanlage', '7 Sitzplätze', 'Einfacher Ein- & Ausstieg', 'Viel Gepäckraum'],
                gross: ['Klimaanlage', '8 Sitzplätze', 'Bequeme Einzelsitze', 'Maximaler Gepäckraum'],
              },
              en: {
                kombi: ['Air conditioning', 'Leather seats', 'Large trunk', 'Comfortable ride'],
                van:   ['Air conditioning', '7 seats', 'Easy boarding & exit', 'Extra luggage space'],
                gross: ['Air conditioning', '8 seats', 'Individual comfortable seats', 'Maximum luggage space'],
              },
              tr: {
                kombi: ['Klima', 'Deri koltuklar', 'Geniş bagaj', 'Konforlu sürüş'],
                van:   ['Klima', '7 koltuk', 'Kolay biniş & iniş', 'Geniş bagaj alanı'],
                gross: ['Klima', '8 koltuk', 'Bireysel konforlu koltuklar', 'Maksimum bagaj alanı'],
              },
            };
            const f = vf[locale] || vf.de;
            const vehicles = [
              {
                image: '/images/kombi.webp',
                name: tVehicles('kombi.name'),
                model: 'Mercedes E-Klasse',
                persons: tVehicles('kombi.persons'),
                features: f.kombi,
              },
              {
                image: '/images/van.webp',
                name: tVehicles('van.name'),
                model: 'Mercedes Viano',
                persons: tVehicles('van.persons'),
                features: f.van,
                group: true,
              },
              {
                image: '/images/grossraumtaxi.webp',
                name: tVehicles('grossraumtaxi.name'),
                model: 'Mercedes Vito',
                persons: tVehicles('grossraumtaxi.persons'),
                features: f.gross,
                group: true,
              },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {vehicles.map((v) => (
                  <div
                    key={v.name}
                    /* Gruppenfahrzeuge tragen nur einen Kapazitätshinweis. Absichtlich KEIN
                       hervorgehobener Rahmen: zusammen mit dem Band sah es wie ein teures
                       Upgrade aus, und auf dieser Seite steht kein Preis, der das relativiert. */
                    className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow text-center flex flex-col relative"
                  >
                    {v.group && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-50 text-primary-700 border border-primary-200 text-[11px] font-bold uppercase px-3 py-1 rounded-full whitespace-nowrap">
                        {locale === 'en' ? 'For groups 5–8' : locale === 'tr' ? '5–8 kişilik gruplar' : 'Für Gruppen 5–8'}
                      </span>
                    )}
                    <div className="w-full h-36 overflow-hidden rounded-lg mb-3">
                      <img src={v.image} alt={v.name} loading="lazy" width={400} height={240} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="font-bold text-xl text-primary-600">{v.name}</h3>
                    <p className="text-xs text-gray-400 font-medium mb-1">{v.model}</p>
                    <p className="text-gray-500 text-sm mb-4">{v.persons}</p>
                    <ul className="text-left space-y-1.5 mt-auto">
                      {v.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check size={14} className="text-green-500 shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Gruppen-Argument: ein Fahrzeug für alle statt zwei Taxis — der Preis pro
              Person ist hier das stärkste Verkaufsargument. Absichtlich ohne Nennung
              von Wettbewerbern (vergleichende Preiswerbung wäre rechtlich angreifbar). */}
          <div className="mt-8 rounded-2xl bg-white shadow-md px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <UsersRound size={28} className="text-gold-500 shrink-0 mx-auto sm:mx-0" />
            <div className="flex-1 text-center sm:text-left">
              <div className="font-bold text-primary-700">
                {locale === 'en' ? 'Travelling as a group of 5 to 8?' : locale === 'tr' ? '5–8 kişilik grup mu?' : 'Zu 5 bis 8 Personen unterwegs?'}
              </div>
              {/* Ohne Preisaussage: auf dieser Seite steht kein Preis, deshalb würde ein
                  "pro Person günstiger" hier nur den Gedanken "teuer" wecken. Der
                  Pro-Person-Preis steht dort, wo er hingehört — neben dem echten Preis
                  auf /ergebnisse. */}
              <p className="text-sm text-gray-600 mt-0.5">
                {locale === 'en'
                  ? 'One vehicle for everyone — no second taxi, no transfers. All luggage and child seats included.'
                  : locale === 'tr'
                  ? 'Herkes için tek araç — ikinci taksi yok, aktarma yok. Tüm bagaj ve çocuk koltuğu dahil.'
                  : 'Ein Fahrzeug für alle — kein zweites Taxi, kein Umsteigen. Gepäck und Kindersitze komplett inklusive.'}
              </p>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href={locale === 'de' ? '/vehicles' : `/${locale}/vehicles`} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors inline-block">
              {sd.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Routes — live prices from the tariff engine */}
      <PopularRoutes />

      {/* Why choose us */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(() => {
            const why: Record<string, { heading: string; items: { title: string; text: string }[] }> = {
              de: { heading: 'Warum Flughafen-muenchen.TAXI?', items: [
                { title: 'Festpreisgarantie', text: 'Sie wissen Ihren Preis vor der Buchung. Keine bösen Überraschungen.' },
                { title: 'Immer pünktlich', text: 'Wir überwachen Ihren Flug und passen die Abholzeit bei Verspätungen an.' },
                { title: 'Kindersitz kostenlos', text: 'Auf Wunsch stellen wir Ihnen einen Kindersitz kostenlos zur Verfügung.' },
                { title: 'Flexible Zahlung', text: 'Zahlen Sie bequem bar oder per Karte – ganz wie Sie möchten.' },
                { title: 'Mehrsprachiger Service', text: 'Wir sprechen Deutsch, Englisch und Türkisch – für maximalen Komfort.' },
                { title: 'Keine Kreditkartengebühr', text: 'Zahlen Sie mit Karte – ohne Aufschlag. Bei uns fallen keine zusätzlichen Gebühren an.' },
              ]},
              en: { heading: 'Why Flughafen-muenchen.TAXI?', items: [
                { title: 'Fixed price guarantee', text: 'You know your price before booking. No unpleasant surprises.' },
                { title: 'Always on time', text: 'We monitor your flight and adjust pickup time for delays.' },
                { title: 'Free child seat', text: 'We provide a child seat free of charge upon request.' },
                { title: 'Flexible payment', text: 'Pay comfortably by cash or card – whatever you prefer.' },
                { title: 'Multilingual service', text: 'We speak German, English and Turkish – for maximum comfort.' },
                { title: 'No credit card fee', text: 'Pay by card without surcharge. No additional fees.' },
              ]},
              tr: { heading: 'Neden Flughafen-muenchen.TAXI?', items: [
                { title: 'Sabit fiyat garantisi', text: 'Rezervasyon öncesi fiyatınızı bilirsiniz. Sürpriz ücret yok.' },
                { title: 'Her zaman zamanında', text: 'Uçuşunuzu takip eder, gecikmede alış saatini ayarlarız.' },
                { title: 'Ücretsiz çocuk koltuğu', text: 'Talep üzerine ücretsiz çocuk koltuğu sağlıyoruz.' },
                { title: 'Esnek ödeme', text: 'Nakit veya kartla rahatça ödeme yapın – istediğiniz gibi.' },
                { title: 'Çok dilli hizmet', text: 'Almanca, İngilizce ve Türkçe konuşuyoruz – maksimum konfor için.' },
                { title: 'Kredi kartı ücreti yok', text: 'Kartla ek ücret olmadan ödeme yapın.' },
              ]},
            };
            const w = why[locale] || why.de;
            const icons = [Shield, Clock, Baby, CreditCard, Star, BadgePercent];
            const colors = ['bg-blue-50 text-blue-600','bg-green-50 text-green-600','bg-yellow-50 text-yellow-600','bg-purple-50 text-purple-600','bg-red-50 text-red-600','bg-teal-50 text-teal-600'];
            return (<>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-primary-600">{w.heading.replace('TAXI', '')}<span className="text-gold-400">TAXI</span>?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {w.items.map(({ title, text }, i) => {
              const Icon = icons[i];
              const color = colors[i];
              return (
              <div key={title} className="flex items-start gap-4 p-5 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-600">{text}</p>
                </div>
              </div>
              );
            })}
          </div>
          </>);
          })()}
        </div>
      </section>

      {/* Trust strip — consolidated promises */}
      <section className="py-10 bg-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(() => {
            const tp: Record<string, { heading: string; items: string[] }> = {
              de: { heading: 'Unsere Versprechen an Sie', items: ['Kostenloser Storno bis 3 Std.', '60 Min. Gratis-Wartezeit', 'Persönliche Bestätigung', 'Kindersitze kostenlos', 'Vollversicherte Fahrzeuge', '100.000+ zufriedene Kunden'] },
              en: { heading: 'Our promises to you', items: ['Free cancellation up to 3 hrs', '60 min. free waiting time', 'Personal confirmation', 'Free child seats', 'Fully insured vehicles', '100,000+ happy customers'] },
              tr: { heading: 'Size olan vaatlerimiz', items: ['3 saate kadar ücretsiz iptal', '60 dk. ücretsiz bekleme', 'Kişisel onay', 'Ücretsiz çocuk koltuğu', 'Tam sigortalı araçlar', '100.000+ memnun müşteri'] },
            };
            const tp2 = tp[locale] || tp.de;
            const tpIcons = [Ban, Plane, MailCheck, Baby, ShieldCheck, Users];
            return (
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-6">{tp2.heading}</h2>
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
                  {tp2.items.map((item, i) => {
                    const Icon = tpIcons[i];
                    return (
                      <span key={item} className="inline-flex items-center gap-2 text-sm text-primary-100">
                        <Icon size={16} className="text-gold-400 shrink-0" />
                        {item}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* SEO-Text + FAQ (Hauptkeywords) */}
      <HomeSeoContent locale={locale} />

      {/* CTA Section */}
      <section className="bg-primary-600 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            {locale === 'en' ? 'Ready for Your Ride?' : locale === 'tr' ? 'Yolculuğa Hazır mısınız?' : 'Bereit für Ihre Fahrt?'}
          </h2>
          <p className="text-primary-200 mb-8 text-lg">
            {locale === 'en'
              ? 'Book your airport transfer now and travel stress-free to Munich Airport.'
              : locale === 'tr'
              ? 'Şimdi havalimanı transferinizi rezerve edin ve München Havalimanı\'na stressiz yolculuk yapın.'
              : 'Buchen Sie jetzt Ihren Flughafentransfer und fahren Sie stressfrei zum Flughafen München.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#booking"
              className="bg-gold-400 hover:bg-gold-500 text-primary-600 px-8 py-4 rounded-xl font-bold text-lg transition-colors"
            >
              {locale === 'en' ? 'Book online now' : locale === 'tr' ? 'Hemen online rezervasyon' : 'Jetzt online buchen'}
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
