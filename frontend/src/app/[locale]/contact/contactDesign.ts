import { Headphones, Clock, ShieldCheck } from 'lucide-react';

/** Kontakt sayfasinin yeni tasarimina ait metinler. Diger tum icerik (title,
 *  contact_info_title, faqs, booking_* vb.) messages/*.json icindeki `contact`
 *  alanindan geliyor; burada yalnizca tasarimla gelen yeni metinler var. */

export const heroStatIcons = [Headphones, Clock, ShieldCheck] as const;

type ContactDesign = {
  heroTitleA: string;
  heroTitleB: string;
  heroTagline: string;
  heroText: string;
  heroStats: string[];
  routeLabel: string;
  bookingChecklist: string[];
  allQuestions: string;
  areaEyebrow: string;
  areaTitle: string;
  areaText: string;
  areaMore: string;
};

export const contactDesign: Record<string, ContactDesign> = {
  de: {
    heroTitleA: 'Wir sind',
    heroTitleB: 'für Sie da.',
    heroTagline: 'Schnell. Persönlich. Zuverlässig.',
    heroText: 'Ihr Flughafentransfer in besten Händen – rund um die Uhr erreichbar.',
    heroStats: ['Persönliche Beratung', '24/7 Erreichbar', 'Schnelle Antwort'],
    routeLabel: 'Route',
    bookingChecklist: [
      'Kostenlose Stornierung bis 3 Std. vorher',
      'Keine versteckten Gebühren',
      'Sichere & flexible Zahlung (bar oder Karte)',
      'Bestätigung in wenigen Minuten',
    ],
    allQuestions: 'Alle Fragen anzeigen',
    areaEyebrow: 'Einzugsgebiet',
    areaTitle: 'Unser Fahrgebiet',
    areaText: 'Wir fahren zu und von allen Adressen im Großraum München zum Flughafen München (MUC) und zurück – sowie nach Österreich und in alle angrenzenden Regionen.',
    areaMore: 'und viele weitere …',
  },
  en: {
    heroTitleA: 'We are',
    heroTitleB: 'here for you.',
    heroTagline: 'Fast. Personal. Reliable.',
    heroText: 'Your airport transfer in the best hands – reachable around the clock.',
    heroStats: ['Personal advice', 'Available 24/7', 'Fast response'],
    routeLabel: 'Route',
    bookingChecklist: [
      'Free cancellation up to 3 hrs before',
      'No hidden fees',
      'Safe & flexible payment (cash or card)',
      'Confirmation within minutes',
    ],
    allQuestions: 'Show all questions',
    areaEyebrow: 'Service area',
    areaTitle: 'Our service area',
    areaText: 'We drive to and from all addresses in the greater Munich area to Munich Airport (MUC) and back – as well as to Austria and all neighbouring regions.',
    areaMore: 'and many more …',
  },
  tr: {
    heroTitleA: 'Sizin için',
    heroTitleB: 'buradayız.',
    heroTagline: 'Hızlı. Kişisel. Güvenilir.',
    heroText: 'Havalimanı transferiniz emin ellerde – günün her saati ulaşılabilir.',
    heroStats: ['Kişisel danışmanlık', '7/24 Ulaşılabilir', 'Hızlı yanıt'],
    routeLabel: 'Yol tarifi',
    bookingChecklist: [
      '3 saat öncesine kadar ücretsiz iptal',
      'Gizli ücret yok',
      'Güvenli & esnek ödeme (nakit veya kart)',
      'Birkaç dakika içinde onay',
    ],
    allQuestions: 'Tüm soruları göster',
    areaEyebrow: 'Hizmet bölgesi',
    areaTitle: 'Hizmet bölgemiz',
    areaText: 'Büyük München bölgesindeki tüm adreslerden Münih Havalimanı\'na (MUC) ve geri dönüşe, ayrıca Avusturya ve tüm komşu bölgelere sürüş yapıyoruz.',
    areaMore: 've daha fazlası …',
  },
};
