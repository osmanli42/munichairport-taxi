import {
  Snowflake, Baby, Plane, BadgeCheck, Euro, CreditCard, Luggage, Clock,
  ShieldCheck, Handshake, Users, Gem, MapPin, Briefcase,
} from 'lucide-react';

/** /vehicles sayfasinin yeni tasarimina ait metinler. Arac adlari, aciklamalari ve
 *  ozellikleri messages/*.json icindeki `vehicles` alanindan gelmeye devam ediyor;
 *  burada yalnizca tasarimla gelen yeni metinler var. */

export const incIcons = [
  Snowflake, Baby, Plane, BadgeCheck, Euro,
  CreditCard, Luggage, Clock, ShieldCheck, Handshake,
] as const;

export const trustIcons = [Users, Clock, Gem, MapPin] as const;

/** Kart icindeki ozellik satirlarinin ikonlari (ceviri sirasina gore). */
export const featureIcons = [Snowflake, Briefcase, Luggage] as const;

type Design = {
  eyebrow: string;
  h1a: string;
  h1b: string;
  sub: string;
  popular: string;
  incEyebrow: string;
  incTitleA: string;
  incTitleB: string;
  incSub: string;
  items: { title: string; text: string }[];
  trust: { big: string; small: string }[];
  ctaText: string;
  ctaButton: string;
};

export const design: Record<string, Design> = {
  de: {
    eyebrow: 'Premium Airport Transfer',
    h1a: 'Für jede Gruppe das',
    h1b: 'passende Fahrzeug',
    sub: 'Modern. Komfortabel. Zuverlässig. – Ihr Taxi am Flughafen München.',
    popular: 'Beliebt',
    incEyebrow: 'Alles, was Sie brauchen',
    incTitleA: 'Inklusive',
    incTitleB: '– für eine entspannte Reise',
    incSub: 'Unser Service umfasst alles, was Sie für einen stressfreien Transfer benötigen.',
    items: [
      { title: 'Klimaanlage', text: 'Angenehme Fahrt bei jeder Jahreszeit.' },
      { title: 'Kindersitz auf Anfrage (kostenlos)', text: 'Sicher unterwegs – auch für die Kleinsten.' },
      { title: 'Flugüberwachung bei Ankunftsfahrten', text: 'Wir verfolgen Ihren Flug in Echtzeit – 60 Min. Gratis-Wartezeit bei Verspätung.' },
      { title: 'Namensschild am Flughafen', text: 'Persönliche Begrüßung im Ankunftsbereich.' },
      { title: 'Keine versteckten Gebühren', text: 'Transparente und faire Preise.' },
      { title: 'Zahlung bar oder mit Karte', text: 'Flexible und sichere Zahlungsmöglichkeiten.' },
      { title: 'Gepäckhelfer', text: 'Wir unterstützen beim Ein- und Ausladen.' },
      { title: 'Kostenloser Storno bis 3 Std. vorher', text: 'Maximale Flexibilität für Ihre Reiseplanung.' },
      { title: 'Vollversicherte Fahrzeuge', text: 'Haftpflicht- & Vollkasko inklusive.' },
      { title: '20 Jahre Erfahrung im Flughafentransfer', text: 'Zuverlässig. Professionell. Erfahren.' },
    ],
    trust: [
      { big: '100%', small: 'Zuverlässigkeit' },
      { big: 'Pünktlich', small: 'am Flughafen' },
      { big: 'Erstklassiger', small: 'Service' },
      { big: 'Fahrt in ganz', small: 'Bayern & Österreich' },
    ],
    ctaText: 'Sicher. Pünktlich. Entspannt ankommen.',
    ctaButton: 'Jetzt Transfer buchen',
  },
  en: {
    eyebrow: 'Premium Airport Transfer',
    h1a: 'The right vehicle',
    h1b: 'for every group',
    sub: 'Modern. Comfortable. Reliable. – Your taxi at Munich Airport.',
    popular: 'Popular',
    incEyebrow: 'Everything you need',
    incTitleA: 'Included',
    incTitleB: '– for a relaxed journey',
    incSub: 'Our service covers everything you need for a stress-free transfer.',
    items: [
      { title: 'Air conditioning', text: 'A pleasant ride in every season.' },
      { title: 'Child seat on request (free)', text: 'Safe travels – for the little ones too.' },
      { title: 'Flight monitoring on arrivals', text: 'We track your flight in real time – 60 min. free waiting time on delays.' },
      { title: 'Name sign at the airport', text: 'A personal welcome in the arrivals area.' },
      { title: 'No hidden fees', text: 'Transparent and fair prices.' },
      { title: 'Payment by cash or card', text: 'Flexible and secure payment options.' },
      { title: 'Luggage assistance', text: 'We help with loading and unloading.' },
      { title: 'Free cancellation up to 3 hrs before', text: 'Maximum flexibility for your travel plans.' },
      { title: 'Fully insured vehicles', text: 'Liability and comprehensive cover included.' },
      { title: '20 years of airport transfer experience', text: 'Reliable. Professional. Experienced.' },
    ],
    trust: [
      { big: '100%', small: 'Reliability' },
      { big: 'On time', small: 'at the airport' },
      { big: 'First-class', small: 'service' },
      { big: 'Rides across', small: 'Bavaria & Austria' },
    ],
    ctaText: 'Safe. Punctual. Arrive relaxed.',
    ctaButton: 'Book your transfer now',
  },
  tr: {
    eyebrow: 'Premium Havalimanı Transferi',
    h1a: 'Her grup için',
    h1b: 'doğru araç',
    sub: 'Modern. Konforlu. Güvenilir. – Münih Havalimanı\'ndaki taksiniz.',
    popular: 'Popüler',
    incEyebrow: 'İhtiyacınız olan her şey',
    incTitleA: 'Dahil',
    incTitleB: '– rahat bir yolculuk için',
    incSub: 'Hizmetimiz, stressiz bir transfer için ihtiyacınız olan her şeyi kapsıyor.',
    items: [
      { title: 'Klima', text: 'Her mevsimde konforlu yolculuk.' },
      { title: 'Talep üzerine çocuk koltuğu (ücretsiz)', text: 'Küçükler için de güvenli yolculuk.' },
      { title: 'Varış yolculuklarında uçuş takibi', text: 'Uçuşunuzu gerçek zamanlı izliyoruz – gecikmede 60 dk. ücretsiz bekleme.' },
      { title: 'Havalimanında isim tabelası', text: 'Varış alanında kişisel karşılama.' },
      { title: 'Gizli ücret yok', text: 'Şeffaf ve adil fiyatlar.' },
      { title: 'Nakit veya kartla ödeme', text: 'Esnek ve güvenli ödeme seçenekleri.' },
      { title: 'Bagaj yardımı', text: 'Yükleme ve boşaltmada yardımcı oluyoruz.' },
      { title: '3 saat öncesine kadar ücretsiz iptal', text: 'Seyahat planınız için maksimum esneklik.' },
      { title: 'Tam sigortalı araçlar', text: 'Trafik ve kasko sigortası dahil.' },
      { title: 'Havalimanı transferinde 20 yıl deneyim', text: 'Güvenilir. Profesyonel. Deneyimli.' },
    ],
    trust: [
      { big: '%100', small: 'Güvenilirlik' },
      { big: 'Dakik', small: 'havalimanında' },
      { big: 'Birinci sınıf', small: 'hizmet' },
      { big: 'Tüm Bavyera ve', small: 'Avusturya\'ya yolculuk' },
    ],
    ctaText: 'Güvenli. Dakik. Rahat varış.',
    ctaButton: 'Hemen transfer rezervasyonu',
  },
};
