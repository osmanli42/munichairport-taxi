import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Clock, Star, Baby, CreditCard, Phone, BadgePercent } from 'lucide-react';
import dynamic from 'next/dynamic';
const SearchBar = dynamic(() => import('@/components/SearchBar'), { ssr: false });
import { CONTACT_INFO } from '@/lib/utils';

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

export default function HomePage() {
  const t = useTranslations('hero');
  const tVehicles = useTranslations('vehicles');
  const locale = useLocale();

  const stepsData: Record<string, { label: string; title: string; steps: { title: string; text: string; extra: string[] }[]; cta: string }> = {
    de: {
      label: 'So einfach geht\'s',
      title: 'In 3 Schritten zum Transfer',
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
      steps: [
        { title: 'Enter address & time', text: 'Enter your pickup address, destination, date and time. Our system calculates your fixed price instantly – in under 1 second.', extra: ['✓ Intermediate stop possible', '✓ All terminals available', '✓ Return trip bookable'] },
        { title: 'Choose vehicle & price', text: 'Choose between Sedan, Van or Large Taxi. Transparent fixed price, no traffic surcharge – your price stays fixed.', extra: ['✓ Sedan up to 4 Pax', '✓ Van up to 7 Pax', '✓ Large Taxi up to 8 Pax'] },
        { title: 'Arrive relaxed', text: 'Your driver waits punctually at the exit – with a name sign. We wait 60 minutes for free in case of flight delays.', extra: ['✓ Meet & Greet Service', '✓ 60 min. waiting time free', '✓ Luggage assistance included'] },
      ],
      cta: 'View all vehicles',
    },
    tr: {
      label: 'Bu kadar basit',
      title: '3 adımda transferiniz',
      steps: [
        { title: 'Adres & saat girin', text: 'Alış adresinizi, varış noktasını, tarih ve saati girin. Sistemimiz sabit fiyatınızı anında hesaplar – 1 saniyenin altında.', extra: ['✓ Ara durak mümkün', '✓ Tüm terminaller mevcut', '✓ Dönüş yolculuğu rezerve edilebilir'] },
        { title: 'Araç & fiyat seçin', text: 'Kombi, Van veya Büyük Taksi arasından seçin. Şeffaf sabit fiyat, trafik ek ücreti yok – fiyatınız sabit kalır.', extra: ['✓ Kombi 4 kişiye kadar', '✓ Van 7 kişiye kadar', '✓ Büyük Taksi 8 kişiye kadar'] },
        { title: 'Rahatça varın', text: 'Sürücünüz isim tabelasıyla çıkışta sizi bekleyecek. Uçuş gecikmelerinde 60 dakika ücretsiz bekliyoruz.', extra: ['✓ Karşılama Hizmeti', '✓ 60 dk. bekleme ücretsiz', '✓ Bagaj yardımı dahil'] },
      ],
      cta: 'Tüm araçları görüntüle',
    },
  };
  const sd = stepsData[locale] || stepsData.de;

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-visible">
        {/* Background taxi image — right side fading in */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "url('/images/hero-taxis.PNG')",
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            opacity: 0.18,
          }}
        />
        {/* Dark overlay gradient — keeps left side readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(26,54,93,0.92) 0%, rgba(26,54,93,0.75) 50%, rgba(26,54,93,0.35) 100%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
          {/* Hero text - centered top */}
          <div className="text-center animate-fade-in mb-10">
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <div className="inline-flex items-center bg-white/10 backdrop-blur rounded-full px-4 py-2 text-sm">
                <Star size={14} className="text-gold-400 mr-2" />
                <span>Professioneller Flughafentransfer München</span>
              </div>
              <div className="inline-flex items-center bg-gold-400/20 backdrop-blur rounded-full px-4 py-2 text-sm border border-gold-400/40">
                <span className="text-gold-300 mr-1">💰</span>
                <span className="text-gold-200 font-medium">Festpreis – transparent & fair</span>
              </div>
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-4">
              {t('title')}
              <span className="block text-gold-400">{t('subtitle')}</span>
            </h1>

            <p className="text-primary-200 text-lg mb-8 max-w-2xl mx-auto">{t('description')}</p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { icon: Shield, text: t('features.fixed_price') },
                { icon: Clock, text: t('features.punctual') },
                { icon: Star, text: t('features.247') },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
                  <Icon size={16} className="text-gold-400" />
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <Phone size={18} />
                {t('phone')}
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          {/* Search Bar */}
          <div id="booking" className="animate-slide-up w-full" style={{ scrollMarginTop: '250px' }}>
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-primary-900 border-b border-primary-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '20+', label: 'JAHRE ERFAHRUNG' },
              { value: '4,9 ★', label: 'Ø BEWERTUNG' },
              { value: '100%', label: 'FESTPREISE' },
              { value: '24/7', label: 'VERFÜGBAR' },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <div className="text-4xl font-extrabold text-gold-400 leading-tight tracking-tight">{stat.value}</div>
                <div className="text-xs font-bold text-primary-300 mt-1 tracking-widest uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20" style={{ background: '#f4f7fb' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-[.18em] uppercase mb-3" style={{ color: '#c9a84c' }}>
              {sd.label}
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>
              {sd.title}
            </h2>
          </div>

          {/* Steps — alternating left/right rows */}
          <div className="flex flex-col gap-6">
            {(['📍', '🚗', '✈️'] as const).map((icon, idx) => {
              const { title, text, extra } = sd.steps[idx];
              const step = idx + 1;
              const reverse = idx === 1;
              return (
              <div
                key={step}
                className={`flex flex-col md:flex-row items-center gap-8 ${reverse ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Big number + icon side */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl w-full md:w-72"
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2a5080 100%)',
                    minHeight: '200px',
                    padding: '36px 32px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                  {/* Big faded step number in background */}
                  <span style={{
                    position: 'absolute',
                    fontSize: '120px',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,.04)',
                    lineHeight: 1,
                    bottom: '-10px',
                    right: '16px',
                    userSelect: 'none',
                    letterSpacing: '-0.04em',
                  }}>{step}</span>
                  {/* Step pill */}
                  <div className="mb-4 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}>
                    Schritt {step}
                  </div>
                  {/* Emoji icon */}
                  <div style={{ fontSize: '52px', lineHeight: 1 }}>{icon}</div>
                </div>

                {/* Text side */}
                <div className="flex-1 rounded-2xl p-8"
                  style={{
                    background: '#fff',
                    border: '1px solid #e5edf5',
                    boxShadow: '0 2px 20px rgba(15,27,45,.05)',
                  }}>
                  <h3 className="text-2xl font-extrabold mb-3 tracking-tight" style={{ color: '#0f1b2d' }}>
                    {title}
                  </h3>
                  <p className="text-base mb-5 leading-relaxed" style={{ color: '#6b7c93' }}>
                    {text}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {extra.map(e => (
                      <span key={e} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                        style={{ background: '#fdf8ec', color: '#a07820', border: '1px solid #f0e0a0' }}>
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a
              href="#booking"
              className="inline-flex items-center gap-2 font-bold text-base px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              style={{
                background: '#c9a84c',
                color: '#0f1b2d',
                boxShadow: '0 4px 24px rgba(201,168,76,.3)',
              }}
            >
              Jetzt kostenlos Preis berechnen →
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
                image: '/images/kombi.PNG',
                name: tVehicles('kombi.name'),
                model: 'Mercedes E-Klasse',
                persons: tVehicles('kombi.persons'),
                features: f.kombi,
              },
              {
                image: '/images/van.PNG',
                name: tVehicles('van.name'),
                model: 'Mercedes Viano',
                persons: tVehicles('van.persons'),
                features: f.van,
              },
              {
                image: '/images/van.PNG',
                name: tVehicles('grossraumtaxi.name'),
                model: 'Mercedes Vito',
                persons: tVehicles('grossraumtaxi.persons'),
                features: f.gross,
              },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {vehicles.map((v) => (
                  <div key={v.name} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow text-center flex flex-col">
                    <div className="w-full h-36 overflow-hidden rounded-lg mb-3">
                      <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                    </div>
                    <h3 className="font-bold text-xl text-primary-600">{v.name}</h3>
                    <p className="text-xs text-gray-400 font-medium mb-1">{v.model}</p>
                    <p className="text-gray-500 text-sm mb-4">{v.persons}</p>
                    <ul className="text-left space-y-1.5 mt-auto">
                      {v.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-green-500 font-bold">✓</span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="text-center mt-8">
            <Link href="/vehicles" className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors inline-block">
              {sd.cta}
            </Link>
          </div>
        </div>
      </section>

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

      {/* Trust Promises Section */}
      <section className="py-16 bg-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(() => {
            const tp: Record<string, { badge: string; heading: string; sub: string; items: { icon: string; title: string; sub: string }[] }> = {
              de: { badge: '20 Jahre Erfahrung – Ihr Vertrauen ist unser Auftrag', heading: 'Unsere Versprechen an Sie', sub: 'Keine Überraschungen. Keine versteckten Kosten. Nur verlässlicher Service.', items: [
                { icon: '🏆', title: '20 Jahre Erfahrung', sub: 'Seit 20 Jahren Ihr zuverlässiger Flughafentransfer' },
                { icon: '🚫', title: 'Kostenloser Storno', sub: 'Bis 3 Stunden vor der Fahrt – keine Gebühren' },
                { icon: '💰', title: 'Festpreisgarantie', sub: 'Preis steht bei Buchung fest – transparent & fair' },
                { icon: '✈️', title: '60 Min. Gratis-Wartezeit', sub: 'Bei Flugverspätungen warten wir kostenlos' },
                { icon: '📧', title: 'Sofortige Bestätigung', sub: 'E-Mail-Bestätigung direkt nach der Buchung' },
                { icon: '👶', title: 'Kindersitze kostenlos', sub: 'Babyschale, Kindersitz & Sitzerhöhung gratis' },
                { icon: '🛡️', title: 'Vollversicherte Fahrzeuge', sub: 'Haftpflicht & Vollkasko für alle Fahrzeuge' },
                { icon: '🔒', title: 'Sichere Zahlung', sub: 'Bar oder verschlüsselte Kreditkarte' },
                { icon: '📱', title: '24/7 erreichbar', sub: 'Telefon & WhatsApp – Tag und Nacht' },
                { icon: '🌐', title: 'Mehrsprachiger Service', sub: 'Deutsch, Englisch & Türkisch' },
                { icon: '🧾', title: 'Keine versteckten Kosten', sub: 'Was Sie sehen, zahlen Sie – nicht mehr' },
                { icon: '👥', title: '100.000+ Kunden', sub: 'Über 100.000 zufriedene Fahrgäste vertrauen uns' },
              ]},
              en: { badge: '20 years of experience – Your trust is our mission', heading: 'Our promises to you', sub: 'No surprises. No hidden costs. Just reliable service.', items: [
                { icon: '🏆', title: '20 years of experience', sub: 'Your reliable airport transfer for 20 years' },
                { icon: '🚫', title: 'Free cancellation', sub: 'Up to 3 hours before the ride – no fees' },
                { icon: '💰', title: 'Fixed price guarantee', sub: 'No meter – price is set at booking' },
                { icon: '✈️', title: '60 min. free wait', sub: 'We wait free of charge for flight delays' },
                { icon: '📧', title: 'Instant confirmation', sub: 'Email confirmation right after booking' },
                { icon: '👶', title: 'Free child seats', sub: 'Baby seat, child seat & booster free' },
                { icon: '🛡️', title: 'Fully insured vehicles', sub: 'Liability & comprehensive insurance' },
                { icon: '🔒', title: 'Secure payment', sub: 'Cash or encrypted credit card' },
                { icon: '📱', title: '24/7 reachable', sub: 'Phone & WhatsApp – day and night' },
                { icon: '🌐', title: 'Multilingual service', sub: 'German, English & Turkish' },
                { icon: '🧾', title: 'No hidden costs', sub: 'What you see is what you pay – nothing more' },
                { icon: '👥', title: '100,000+ customers', sub: 'Over 100,000 satisfied passengers trust us' },
              ]},
              tr: { badge: '20 yıl deneyim – Güveniniz bizim görevimiz', heading: 'Size olan vaatlerimiz', sub: 'Sürpriz yok. Gizli maliyet yok. Sadece güvenilir hizmet.', items: [
                { icon: '🏆', title: '20 yıl deneyim', sub: '20 yıldır güvenilir havalimanı transferiniz' },
                { icon: '🚫', title: 'Ücretsiz iptal', sub: 'Sürüşten 3 saat öncesine kadar – ücret yok' },
                { icon: '💰', title: 'Sabit fiyat garantisi', sub: 'Taksimetre yok – fiyat rezervasyonda belirlenir' },
                { icon: '✈️', title: '60 dk ücretsiz bekleme', sub: 'Uçuş gecikmelerinde ücretsiz bekliyoruz' },
                { icon: '📧', title: 'Anında onay', sub: 'Rezervasyondan hemen sonra e-posta onayı' },
                { icon: '👶', title: 'Ücretsiz çocuk koltuğu', sub: 'Bebek koltuğu, çocuk koltuğu & yükseltici ücretsiz' },
                { icon: '🛡️', title: 'Tam sigortalı araçlar', sub: 'Tüm araçlar için sorumluluk & kapsamlı sigorta' },
                { icon: '🔒', title: 'Güvenli ödeme', sub: 'Nakit veya şifreli kredi kartı' },
                { icon: '📱', title: '7/24 ulaşılabilir', sub: 'Telefon & WhatsApp – gece gündüz' },
                { icon: '🌐', title: 'Çok dilli hizmet', sub: 'Almanca, İngilizce & Türkçe' },
                { icon: '🧾', title: 'Gizli maliyet yok', sub: 'Gördüğünüzü ödersiniz – daha fazla değil' },
                { icon: '👥', title: '100.000+ müşteri', sub: '100.000\'den fazla memnun yolcu bize güveniyor' },
              ]},
            };
            const tp2 = tp[locale] || tp.de;
            return (<>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-4">
              <span>🏆</span>
              <span>{tp2.badge}</span>
            </div>
            <h2 className="text-3xl font-bold text-white">{tp2.heading}</h2>
            <p className="text-primary-200 mt-2 text-lg">{tp2.sub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tp2.items.map(({ icon, title, sub }) => (
              <div key={title} className="bg-white/10 hover:bg-white/15 transition-colors rounded-2xl p-5 flex items-start gap-4">
                <span className="text-3xl shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-primary-200 text-xs mt-0.5 leading-relaxed">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          </>);
          })()}
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex justify-center gap-1 mb-3">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={24} className="fill-gold-400 text-gold-400" />
              ))}
            </div>
            {locale === 'en' ? <h2 className="text-3xl font-bold text-primary-600">What our customers say</h2> : locale === 'tr' ? <h2 className="text-3xl font-bold text-primary-600">Müşterilerimiz ne diyor</h2> : <h2 className="text-3xl font-bold text-primary-600">Was unsere Kunden sagen</h2>}
            <p className="text-gray-600 mt-2">{locale === 'en' ? 'Over 100,000 satisfied passengers – read for yourself' : locale === 'tr' ? '100.000\'den fazla memnun yolcu – kendiniz okuyun' : 'Über 100.000 zufriedene Fahrgäste – lesen Sie selbst'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(locale === 'en' ? [
              { name: 'Thomas K.', city: 'Munich', stars: 5, text: 'On time, friendly and the price was exactly as agreed. No meter, no stress. Will definitely book again!', date: 'March 2025' },
              { name: 'Sarah M.', city: 'Augsburg', stars: 5, text: 'Our flight was delayed by 2 hours – the driver waited without extra charge. Absolutely reliable!', date: 'February 2025' },
              { name: 'Mehmet Y.', city: 'Munich', stars: 5, text: 'Child seat was included for free, the car was clean and the driver very polite. Perfect family service.', date: 'January 2025' },
              { name: 'Andrea L.', city: 'Rosenheim', stars: 5, text: 'Used the service multiple times for business trips. Always on time, always professional. Highly recommended.', date: 'March 2025' },
              { name: 'David H.', city: 'Salzburg', stars: 5, text: 'Transfer from Munich to Salzburg was relaxed and affordable. Fixed price with no nasty surprises. Top!', date: 'February 2025' },
              { name: 'Julia R.', city: 'Innsbruck', stars: 5, text: 'Booked online, got instant confirmation. The driver was already there when we arrived. Simple and stress-free.', date: 'January 2025' },
            ] : locale === 'tr' ? [
              { name: 'Thomas K.', city: 'Münih', stars: 5, text: 'Zamanında, güler yüzlü ve fiyat tam anlaşıldığı gibi. Taksimetre yok, stres yok. Kesinlikle tekrar rezervasyon yapacağım!', date: 'Mart 2025' },
              { name: 'Sarah M.', city: 'Augsburg', stars: 5, text: 'Uçuşumuz 2 saat gecikmişti – sürücü ek ücret almadan bekledi. Kesinlikle güvenilir!', date: 'Şubat 2025' },
              { name: 'Mehmet Y.', city: 'Münih', stars: 5, text: 'Çocuk koltuğu ücretsiz dahildi, araç temizdi ve sürücü çok kibardi. Aile için mükemmel hizmet.', date: 'Ocak 2025' },
              { name: 'Andrea L.', city: 'Rosenheim', stars: 5, text: 'Hizmeti iş seyahatleri için birçok kez kullandım. Her zaman zamanında, her zaman profesyonel. Kesinlikle tavsiye ederim.', date: 'Mart 2025' },
              { name: 'David H.', city: 'Salzburg', stars: 5, text: 'Münih\'ten Salzburg\'a transfer rahat ve uygundu. Sürpriz olmadan sabit fiyat. Harika!', date: 'Şubat 2025' },
              { name: 'Julia R.', city: 'Innsbruck', stars: 5, text: 'Online rezervasyon yaptım, anında onay aldım. Geldiğimizde sürücü zaten oradaydı. Basit ve stressiz.', date: 'Ocak 2025' },
            ] : [
              { name: 'Thomas K.', city: 'München', stars: 5, text: 'Pünktlich, freundlich und der Preis war genau wie vereinbart. Kein Taxameter, kein Stress. Werde definitiv wieder buchen!', date: 'März 2025' },
              { name: 'Sarah M.', city: 'Augsburg', stars: 5, text: 'Unser Flug hatte 2 Stunden Verspätung – der Fahrer hat gewartet, ohne extra Kosten. Absolut zuverlässig!', date: 'Februar 2025' },
              { name: 'Mehmet Y.', city: 'München', stars: 5, text: 'Kindersitz war kostenlos dabei, das Auto war sauber und der Fahrer sehr höflich. Perfekter Service für die Familie.', date: 'Januar 2025' },
              { name: 'Andrea L.', city: 'Rosenheim', stars: 5, text: 'Habe den Service mehrfach für Geschäftsreisen genutzt. Immer pünktlich, immer professionell. Sehr empfehlenswert.', date: 'März 2025' },
              { name: 'David H.', city: 'Salzburg', stars: 5, text: 'Transfer von München nach Salzburg war entspannt und günstig. Festpreis ohne böse Überraschungen. Top!', date: 'Februar 2025' },
              { name: 'Julia R.', city: 'Innsbruck', stars: 5, text: 'Online gebucht, sofort Bestätigung erhalten. Der Fahrer war schon da als wir ankamen. Einfach und stressfrei.', date: 'Januar 2025' },
            ]).map(({ name, city, stars, text, date }) => (
              <div key={name} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={16} className="fill-gold-400 text-gold-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    <p className="text-xs text-gray-500">{city}</p>
                  </div>
                  <p className="text-xs text-gray-400">{date}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href="https://www.google.com/maps/search/?api=1&query=Flughafen+München+Taxi+flughafen-muenchen.taxi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white rounded-2xl px-6 py-4 shadow-md hover:shadow-lg transition-shadow border border-transparent hover:border-blue-200"
            >
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={20} className="fill-gold-400 text-gold-400" />
                ))}
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900">4.9 / 5.0</p>
                <p className="text-xs text-gray-500">Bewertungen auf Google ansehen ↗</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.9l6-6C34.3 3.2 29.4 1 24 1 14.8 1 7 6.7 3.7 14.7l7 5.4C12.4 13.6 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.8-2.1 5.2-4.4 6.8l7 5.4c4-3.7 6.2-9.1 6.2-16.2z"/>
                <path fill="#FBBC05" d="M10.7 28.5A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5l-7-5.4A23.8 23.8 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6.3z"/>
                <path fill="#34A853" d="M24 47c5.4 0 10-1.8 13.3-4.8l-7-5.4c-1.8 1.2-4.1 1.9-6.3 1.9-6.3 0-11.6-4.1-13.3-9.8l-8.2 6.3C7 41.3 14.8 47 24 47z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

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
