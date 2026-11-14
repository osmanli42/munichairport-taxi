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
  quick: [string, string, string][];
  helpEyebrow: string;
  helpTitle: string;
  help: [string, string, string][];
  detailsTitle: string;
};

export const contactDesign: Record<string, ContactDesign> = {
  de: {
    quick: [
      ['Anrufen', 'Rund um die Uhr persönlich erreichbar – auch nachts und an Feiertagen.', 'call'],
      ['WhatsApp', 'Adresse, Flugnummer oder Fotos bequem per Nachricht senden.', 'wa'],
      ['E-Mail', 'Für Angebote, Rechnungen und Anfragen von Firmen.', 'mail'],
    ],
    helpEyebrow: 'Ihr Anliegen',
    helpTitle: 'Wobei können wir helfen?',
    help: [
      ['Fahrt buchen & Preis berechnen', 'Festpreis online in wenigen Sekunden – für Kombi, Van und Großraumtaxi.', '/'],
      ['Buchung ansehen oder ändern', 'Zeit, Personen oder Gepäck anpassen – oder bis 3 Std. vorher kostenlos stornieren.', '/buchung-verwalten'],
      ['Firmenkunden & Rechnung', 'Firmenkonto mit monatlicher Sammelrechnung und Buchungsportal.', '/business'],
      ['Gruppen, Events & Shuttle', 'Mehrere Fahrzeuge für Hochzeiten, Firmenfeiern und Stadion-Besuche.', '/leistungen#gruppen'],
      ['Krankenfahrten', 'Sitzende Fahrten zu Klinik, Arzt, Dialyse und Reha.', '/krankenfahrten'],
      ['Ausflüge & Sightseeing', 'Neuschwanstein, Königssee, Salzburg – mit Fahrer, der vor Ort wartet.', '/sightseeing'],
    ],
    detailsTitle: 'So erreichen Sie uns',
    heroTitleA: 'Wir sind',
    heroTitleB: 'für Sie da.',
    heroTagline: 'Schnell. Persönlich. Zuverlässig.',
    heroText: 'Ob Buchung, Preisanfrage oder Firmenkonto – Sie erreichen uns rund um die Uhr persönlich per Telefon, WhatsApp oder E-Mail.',
    heroStats: ['Persönliche Beratung', '24/7 Erreichbar', 'Schnelle Antwort'],
    routeLabel: 'Route',
    bookingChecklist: [
      'Kostenlose Stornierung bis 3 Std. vorher',
      'Keine versteckten Gebühren',
      'Sichere & flexible Zahlung (bar oder Karte)',
      'Persönliche Bestätigung per E-Mail & WhatsApp',
    ],
    allQuestions: 'Alle Fragen anzeigen',
    areaEyebrow: 'Einzugsgebiet',
    areaTitle: 'Unser Fahrgebiet',
    areaText: 'Wir fahren zu und von allen Adressen im Großraum München zum Flughafen München (MUC) und zurück – sowie nach Österreich und in alle angrenzenden Regionen.',
    areaMore: 'und viele weitere …',
  },
  en: {
    quick: [
      ['Call us', 'Personally reachable around the clock – also at night and on holidays.', 'call'],
      ['WhatsApp', 'Send your address, flight number or photos by message.', 'wa'],
      ['Email', 'For quotes, invoices and company enquiries.', 'mail'],
    ],
    helpEyebrow: 'Your request',
    helpTitle: 'How can we help?',
    help: [
      ['Book a ride & get a price', 'Fixed price online in seconds – for saloon, van and large taxi.', '/'],
      ['View or change a booking', 'Change time, passengers or luggage – or cancel free of charge up to 3 hrs before.', '/buchung-verwalten'],
      ['Business clients & invoices', 'Company account with monthly collective invoice and booking portal.', '/business'],
      ['Groups, events & shuttle', 'Several vehicles for weddings, company parties and stadium visits.', '/leistungen#gruppen'],
      ['Patient transport', 'Seated rides to hospital, doctor, dialysis and rehab.', '/krankenfahrten'],
      ['Day trips & sightseeing', 'Neuschwanstein, Königssee, Salzburg – with a driver who waits on site.', '/sightseeing'],
    ],
    detailsTitle: 'How to reach us',
    heroTitleA: 'We are',
    heroTitleB: 'here for you.',
    heroTagline: 'Fast. Personal. Reliable.',
    heroText: 'Whether a booking, a price enquiry or a company account – you can reach us personally around the clock by phone, WhatsApp or email.',
    heroStats: ['Personal advice', 'Available 24/7', 'Fast response'],
    routeLabel: 'Route',
    bookingChecklist: [
      'Free cancellation up to 3 hrs before',
      'No hidden fees',
      'Safe & flexible payment (cash or card)',
      'Personal confirmation by email & WhatsApp',
    ],
    allQuestions: 'Show all questions',
    areaEyebrow: 'Service area',
    areaTitle: 'Our service area',
    areaText: 'We drive to and from all addresses in the greater Munich area to Munich Airport (MUC) and back – as well as to Austria and all neighbouring regions.',
    areaMore: 'and many more …',
  },
  tr: {
    quick: [
      ['Arayın', 'Günün her saati, gece ve tatillerde de kişisel olarak ulaşılabilir.', 'call'],
      ['WhatsApp', 'Adres, uçuş numarası veya fotoğrafları mesajla gönderin.', 'wa'],
      ['E-posta', 'Teklif, fatura ve firma talepleri için.', 'mail'],
    ],
    helpEyebrow: 'Talebiniz',
    helpTitle: 'Size nasıl yardımcı olabiliriz?',
    help: [
      ['Yolculuk ayırt & fiyat hesapla', 'Saniyeler içinde online sabit fiyat – binek, van ve büyük taksi.', '/'],
      ['Rezervasyonu gör veya değiştir', 'Saat, kişi veya bagajı değiştirin – ya da 3 saat öncesine kadar ücretsiz iptal edin.', '/buchung-verwalten'],
      ['Firma müşterileri & fatura', 'Aylık toplu fatura ve rezervasyon portalıyla firma hesabı.', '/business'],
      ['Gruplar, etkinlikler & shuttle', 'Düğün, firma kutlaması ve stadyum için birden fazla araç.', '/leistungen#gruppen'],
      ['Hasta yolculukları', 'Klinik, doktor, diyaliz ve rehabilitasyona oturarak yolculuk.', '/krankenfahrten'],
      ['Gezi & turlar', 'Neuschwanstein, Königssee, Salzburg – orada bekleyen şoförle.', '/sightseeing'],
    ],
    detailsTitle: 'Bize nasıl ulaşırsınız',
    heroTitleA: 'Sizin için',
    heroTitleB: 'buradayız.',
    heroTagline: 'Hızlı. Kişisel. Güvenilir.',
    heroText: 'Rezervasyon, fiyat sorusu veya firma hesabı – bize günün her saati telefon, WhatsApp veya e-postayla kişisel olarak ulaşabilirsiniz.',
    heroStats: ['Kişisel danışmanlık', '7/24 Ulaşılabilir', 'Hızlı yanıt'],
    routeLabel: 'Yol tarifi',
    bookingChecklist: [
      '3 saat öncesine kadar ücretsiz iptal',
      'Gizli ücret yok',
      'Güvenli & esnek ödeme (nakit veya kart)',
      'E-posta ve WhatsApp ile kişisel onay',
    ],
    allQuestions: 'Tüm soruları göster',
    areaEyebrow: 'Hizmet bölgesi',
    areaTitle: 'Hizmet bölgemiz',
    areaText: 'Büyük München bölgesindeki tüm adreslerden Münih Havalimanı\'na (MUC) ve geri dönüşe, ayrıca Avusturya ve tüm komşu bölgelere sürüş yapıyoruz.',
    areaMore: 've daha fazlası …',
  },
};
