import { Headphones, MessageCircle, ShieldCheck } from 'lucide-react';

/** Über uns: Texte des neuen Designs (14 Nov 2026). Kennzahlen, Kontaktlabels und das
 *  Fahrtgebiet kommen weiter aus messages/*.json (`about`). */

export const contactExtraIcons = [Headphones, MessageCircle, ShieldCheck] as const;

type AboutDesign = {
  heroSub: string;
  heroBook: string;
  heroContact: string;
  storyEyebrow: string;
  storyTitle: string;
  storyP1: string;
  storyP2: string;
  quote: string;
  valuesEyebrow: string;
  valuesTitle: string;
  values: [string, string][];
  fleetEyebrow: string;
  fleetTitle: string;
  fleetText: string;
  fleetCta: string;
  areaCta: string;
  ctaTitle: string;
  ctaText: string;
  ctaCall: string;
  ctaWhatsapp: string;
  contactExtra: string[];
  areaMore: string;
};

export const aboutDesign: Record<string, AboutDesign> = {
  de: {
    heroSub: 'Ihr inhabergeführtes Taxiunternehmen aus Freising – seit über 20 Jahren am Flughafen München zu Hause. Wir bringen Reisende, Geschäftskunden und Familien sicher, pünktlich und zum Festpreis ans Ziel.',
    heroBook: 'Fahrt buchen',
    heroContact: 'Kontakt aufnehmen',
    storyEyebrow: 'Unsere Geschichte',
    storyTitle: 'Aus Freising. Für Ihre Reise.',
    storyP1: 'Flughafen-München.TAXI ist ein konzessioniertes Taxiunternehmen mit Sitz in Freising – nur wenige Minuten vom Flughafen München entfernt. Seit über 20 Jahren bringen wir Fluggäste zum Terminal und holen sie dort ab: Geschäftsreisende, Familien, Urlauber und Messebesucher.',
    storyP2: 'Unser Anspruch ist einfach: Jede Fahrt soll so verlaufen, wie Sie es sich wünschen. Deshalb steht bei uns der Preis vor der Buchung fest, wir verfolgen bei jeder Abholung Ihren Flug, und Ihr Fahrer erwartet Sie mit Namensschild im Ankunftsbereich. Von hier aus fahren wir in ganz Bayern, nach Österreich und in die Schweiz.',
    quote: 'Unser Ziel ist es, jede Fahrt zu einem angenehmen Erlebnis zu machen – sicher, pünktlich und komfortabel.',
    valuesEyebrow: 'Wofür wir stehen',
    valuesTitle: 'Was Sie von uns erwarten können',
    values: [
      ['Erfahrung', 'Über 20 Jahre und mehr als 100.000 Fahrgäste am Flughafen München.'],
      ['Pünktlichkeit', 'Wir verfolgen Ihren Flug und passen die Abholung an – bei Verspätung warten wir bis zu 60 Minuten kostenlos.'],
      ['Festpreise', 'Der Preis steht vor der Buchung fest – ohne Taxameter-Überraschungen und ohne versteckte Kosten.'],
      ['Mehrsprachig', 'Am Telefon und per WhatsApp sprechen wir Deutsch, Englisch und Türkisch.'],
      ['Konzessioniert & versichert', 'Behördlich konzessioniertes Taxiunternehmen, alle Fahrzeuge mit Haftpflicht und Vollkasko.'],
      ['Mercedes-Flotte', 'Gepflegte Mercedes E-Klasse und V-Klasse – klimatisiert, mit viel Platz für Gepäck.'],
    ],
    fleetEyebrow: 'Unsere Flotte',
    fleetTitle: 'Komfortabel unterwegs – vom Kombi bis zum Großraumtaxi',
    fleetText: 'Für bis zu drei Personen fahren wir Kombi, für Familien und Gruppen bis acht Personen Van und Großraumtaxi. Kindersitze stellen wir auf Anfrage kostenlos bereit.',
    fleetCta: 'Fahrzeuge ansehen',
    areaCta: 'Alle Leistungen',
    ctaTitle: 'Direkt für Sie da',
    ctaText: 'Wir sind 24 Stunden am Tag, 7 Tage die Woche erreichbar – per Telefon, E-Mail oder WhatsApp. Ob einzelne Fahrt, Firmenkonto oder Gruppentransfer: Wir beraten Sie persönlich.',
    ctaCall: 'Jetzt anrufen',
    ctaWhatsapp: 'WhatsApp schreiben',
    contactExtra: ['Persönliche Beratung', 'Schnelle Antwort', 'Kompetent & zuverlässig'],
    areaMore: 'und viele weitere …',
  },
  en: {
    heroSub: 'Your owner-managed taxi company from Freising – at home at Munich Airport for more than 20 years. We take travellers, business clients and families to their destination safely, on time and at a fixed price.',
    heroBook: 'Book a ride',
    heroContact: 'Get in touch',
    storyEyebrow: 'Our story',
    storyTitle: 'From Freising. For your journey.',
    storyP1: 'Flughafen-München.TAXI is a licensed taxi company based in Freising – just a few minutes from Munich Airport. For more than 20 years we have been taking passengers to the terminal and picking them up there: business travellers, families, holidaymakers and trade fair visitors.',
    storyP2: 'Our standard is simple: every ride should go the way you want it to. That is why the price is fixed before you book, we track your flight for every pickup, and your driver waits for you with a name sign in the arrivals area. From here we drive all over Bavaria, to Austria and to Switzerland.',
    quote: 'Our goal is to make every ride a pleasant experience – safe, punctual and comfortable.',
    valuesEyebrow: 'What we stand for',
    valuesTitle: 'What you can expect from us',
    values: [
      ['Experience', 'More than 20 years and over 100,000 passengers at Munich Airport.'],
      ['Punctuality', 'We track your flight and adjust the pickup – if you are delayed we wait up to 60 minutes free of charge.'],
      ['Fixed prices', 'The price is fixed before you book – no taximeter surprises and no hidden costs.'],
      ['Multilingual', 'On the phone and on WhatsApp we speak German, English and Turkish.'],
      ['Licensed & insured', 'Officially licensed taxi company, all vehicles with liability and comprehensive insurance.'],
      ['Mercedes fleet', 'Well-kept Mercedes E-Class and V-Class – air-conditioned, with plenty of room for luggage.'],
    ],
    fleetEyebrow: 'Our fleet',
    fleetTitle: 'Travel in comfort – from estate car to large taxi',
    fleetText: 'For up to three people we drive an estate car, for families and groups of up to eight a van or large taxi. Child seats are available free of charge on request.',
    fleetCta: 'See our vehicles',
    areaCta: 'All services',
    ctaTitle: 'Here for you directly',
    ctaText: 'We are available 24 hours a day, 7 days a week – by phone, email or WhatsApp. Whether a single ride, a company account or a group transfer: we advise you personally.',
    ctaCall: 'Call now',
    ctaWhatsapp: 'Message on WhatsApp',
    contactExtra: ['Personal advice', 'Fast response', 'Competent & reliable'],
    areaMore: 'and many more …',
  },
  tr: {
    heroSub: 'Freising’den, sahiplerinin yönettiği taksi firmanız – 20 yılı aşkın süredir Münih Havalimanı’nda. Yolcuları, iş müşterilerini ve aileleri güvenle, dakik ve sabit fiyatla hedefe ulaştırıyoruz.',
    heroBook: 'Yolculuk ayırt',
    heroContact: 'İletişime geç',
    storyEyebrow: 'Hikâyemiz',
    storyTitle: 'Freising’den. Yolculuğunuz için.',
    storyP1: 'Flughafen-München.TAXI, Münih Havalimanı’na sadece birkaç dakika mesafedeki Freising’de bulunan ruhsatlı bir taksi firmasıdır. 20 yılı aşkın süredir yolcuları terminale götürüyor ve oradan alıyoruz: iş insanları, aileler, tatilciler ve fuar ziyaretçileri.',
    storyP2: 'Standardımız basit: Her yolculuk sizin istediğiniz gibi geçmeli. Bu yüzden fiyat rezervasyondan önce bellidir, her alışta uçuşunuzu takip ederiz ve şoförünüz sizi varış alanında isim tabelasıyla bekler. Buradan tüm Bavyera’ya, Avusturya’ya ve İsviçre’ye gidiyoruz.',
    quote: 'Amacımız her yolculuğu güvenli, dakik ve konforlu, keyifli bir deneyime dönüştürmek.',
    valuesEyebrow: 'Neyi temsil ediyoruz',
    valuesTitle: 'Bizden neler bekleyebilirsiniz',
    values: [
      ['Deneyim', '20 yılı aşkın süre ve Münih Havalimanı’nda 100.000’den fazla yolcu.'],
      ['Dakiklik', 'Uçuşunuzu takip eder, alışı uyarlarız – rötarda 60 dakikaya kadar ücretsiz bekleriz.'],
      ['Sabit fiyat', 'Fiyat rezervasyondan önce bellidir – taksimetre sürprizi ve gizli masraf yok.'],
      ['Çok dilli', 'Telefonda ve WhatsApp’ta Almanca, İngilizce ve Türkçe konuşuyoruz.'],
      ['Ruhsatlı & sigortalı', 'Resmi ruhsatlı taksi firması, tüm araçlar zorunlu sigorta ve kasko ile.'],
      ['Mercedes filosu', 'Bakımlı Mercedes E-Klasse ve V-Klasse – klimalı, bagaj için bol yer.'],
    ],
    fleetEyebrow: 'Filomuz',
    fleetTitle: 'Konforlu yolculuk – binekten büyük taksiye',
    fleetText: 'Üç kişiye kadar binek, aileler ve sekiz kişiye kadar gruplar için van ve büyük taksi. Çocuk koltuğu talep üzerine ücretsizdir.',
    fleetCta: 'Araçlarımız',
    areaCta: 'Tüm hizmetler',
    ctaTitle: 'Sizin için hazırız',
    ctaText: 'Günün 24 saati, haftanın 7 günü telefon, e-posta veya WhatsApp ile ulaşabilirsiniz. Tek yolculuk, firma hesabı veya grup transferi – sizi kişisel olarak bilgilendiririz.',
    ctaCall: 'Şimdi ara',
    ctaWhatsapp: "WhatsApp'tan yaz",
    contactExtra: ['Kişisel danışmanlık', 'Hızlı yanıt', 'Yetkin & güvenilir'],
    areaMore: 've daha fazlası …',
  },
};
