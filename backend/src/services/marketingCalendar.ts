// Marketing-Kampagnenkalender (Admin → Marketing): Anlässe, zu denen wir Kunden schreiben —
// Schulferien Bayern (Flughafenfahrten), Feiertage/Grüße, Black Week, Oktoberfest, große Messen,
// ruhige Monate. Jeder Anlass hat ein Erinnerungsfenster; offene Anlässe erscheinen im Dashboard
// unter „Handlungsbedarf“ und als Zahl am Marketing-Tab, bis sie versendet oder übersprungen sind.
//
// Texte DE/EN/TR mit Platzhaltern: {p} = Rabatt (wird im Admin ersetzt), {jahr}, {messe}, {datum}.

import { query } from '../db';
import { berlinDateSql } from '../utils/berlinTime';
import { easter } from '../utils/holidays';
import { sourcedEvents, SourcedEvent } from './eventSources';

export type Lang = 'de' | 'en' | 'tr';
export type Segment = 'all' | 'privat' | 'business' | 'stamm' | 'business_stamm';
export type Mode = 'greeting' | 'discount';

export interface OccasionText { subject: string; message: string; badge: string; button?: string; url?: string }

export interface OccasionDefaults {
  enabled: boolean;
  leadDays: number;      // so viele Tage vor dem Anlass erinnern
  afterDays: number;     // Fenster bleibt so lange nach dem Datum offen (z. B. Neujahr)
  segment: Segment;
  mode: Mode;
  percent: number;
  validDays: number;     // Gutschein gültig ab Versand
  maxAmount: number | null;
}

export interface Occasion extends OccasionDefaults {
  id: string;
  key: string;           // id + Jahr — eine Kampagne pro Anlass und Jahr
  year: number;
  name: string;          // Anzeige im Admin (Türkisch/Deutsch)
  group: 'ferien' | 'fest' | 'business' | 'season' | 'custom';
  date: string;          // Anlass (z. B. Ferienbeginn)
  end: string | null;
  remindFrom: string;
  remindUntil: string;
  status: 'due' | 'upcoming' | 'sent' | 'skipped' | 'missed';
  sentAt: string | null;
  campaignId: number | null;
  daysLeft: number;
  texts: Record<Lang, OccasionText>;
  isDefault: boolean;    // Einstellungen = Vorschlag (nicht angepasst)
}

/** Zusatz, wenn die Kampagne einen Gutschein enthält. */
export const OFFER_TEXT: Record<Lang, { subject: string; message: string }> = {
  de: { subject: ' – {p} Rabatt für Sie', message: 'Als kleines Extra schenken wir Ihnen {p} Rabatt auf Ihre nächste Fahrt – einfach über den Button unten buchen, der Rabatt wird automatisch abgezogen.' },
  en: { subject: ' – {p} off for you', message: 'As a little extra, we are giving you {p} off your next ride – simply book via the button below, the discount is deducted automatically.' },
  tr: { subject: ' – size özel {p} indirim', message: 'Küçük bir jest olarak bir sonraki yolculuğunuzda size {p} indirim hediye ediyoruz – aşağıdaki butondan rezervasyon yapmanız yeterli, indirim otomatik düşülür.' },
};

// ---- Texte ----------------------------------------------------------------------------------

function ferienTexts(de: string, en: string, tr: string, emoji: string): Record<Lang, OccasionText> {
  return {
    de: {
      badge: `${emoji} ${de}`,
      subject: `${de}: Ihr Taxi zum Flughafen München zum Festpreis`,
      message: `die ${de} stehen vor der Tür – und mit ihnen viele Flüge ab München. Buchen Sie Ihre Fahrt zum Flughafen schon jetzt: zum garantierten Festpreis, pünktlich und ohne Stress mit Parkplatz und Gepäck.\n\nNach dem Urlaub holen wir Sie gern wieder am Terminal ab – buchen Sie die Rückfahrt einfach gleich mit.`,
    },
    en: {
      badge: `${emoji} ${en[0].toUpperCase()}${en.slice(1)}`,
      subject: `${en[0].toUpperCase()}${en.slice(1)}: your taxi to Munich Airport at a fixed price`,
      message: `The ${en} are coming up – and with them plenty of flights from Munich. Book your ride to the airport now: guaranteed fixed price, on time and no stress with parking or luggage.\n\nWe will gladly pick you up at the terminal after your trip, too – simply add the return ride to your booking.`,
    },
    tr: {
      badge: `${emoji} ${tr}`,
      subject: `${tr}: Münih Havalimanı'na sabit fiyatlı taksiniz`,
      message: `${tr} yaklaşıyor ve Münih'ten pek çok uçuş var. Havalimanı transferinizi şimdiden ayırtın: garantili sabit fiyat, dakik ve park yeri ya da bagaj derdi olmadan.\n\nTatil dönüşünde de sizi terminalden memnuniyetle alıyoruz – dönüş yolculuğunu hemen birlikte rezerve edin.`,
    },
  };
}

const TXT: Record<string, Record<Lang, OccasionText>> = {
  black_friday: {
    de: { badge: '🖤 Black Week', subject: 'Black Week bei Flughafen-München.TAXI', message: 'diese Woche ist Black Week – und bei uns gibt es dazu ein kleines Extra. Planen Sie jetzt Ihre nächste Fahrt zum oder vom Flughafen München, zum Beispiel für die Reise über Weihnachten und Neujahr.' },
    en: { badge: '🖤 Black Week', subject: 'Black Week at Flughafen-München.TAXI', message: 'It is Black Week – and we have a little extra for you. Plan your next ride to or from Munich Airport now, for example for your trip over Christmas and New Year.' },
    tr: { badge: '🖤 Black Week', subject: "Flughafen-München.TAXI'de Black Week", message: "Bu hafta Black Week – ve size küçük bir sürprizimiz var. Münih Havalimanı'na ya da havalimanından bir sonraki yolculuğunuzu şimdi planlayın, örneğin Noel ve yılbaşı seyahatiniz için." },
  },
  weihnachtsgruesse: {
    de: { badge: '🎄 Frohe Weihnachten', subject: 'Frohe Weihnachten und herzlichen Dank für Ihr Vertrauen', message: 'das Jahr neigt sich dem Ende zu – Zeit, Danke zu sagen. Vielen Dank, dass Sie uns {jahr} Ihr Vertrauen geschenkt haben und mit uns gefahren sind.\n\nWir wünschen Ihnen und Ihren Lieben frohe Weihnachten, erholsame Feiertage und einen guten Start ins neue Jahr. Auch über die Feiertage sind wir rund um die Uhr für Sie da.' },
    en: { badge: '🎄 Merry Christmas', subject: 'Merry Christmas and thank you for your trust', message: 'As the year draws to a close, it is time to say thank you. Many thanks for placing your trust in us in {jahr} and riding with us.\n\nWe wish you and your loved ones a merry Christmas, relaxing holidays and a great start to the new year. We are available around the clock over the holidays, too.' },
    tr: { badge: '🎄 Mutlu Noeller', subject: 'Mutlu Noeller ve güveniniz için teşekkürler', message: 'Yıl sona ererken teşekkür etme zamanı. {jahr} yılında bize güvendiğiniz ve bizimle yolculuk ettiğiniz için çok teşekkür ederiz.\n\nSize ve sevdiklerinize mutlu Noeller, huzurlu bayramlar ve yeni yıla güzel bir başlangıç dileriz. Bayram günlerinde de 7/24 hizmetinizdeyiz.' },
  },
  neujahr: {
    de: { badge: '🥂 Frohes neues Jahr', subject: 'Ein gutes neues Jahr {jahr} von Flughafen-München.TAXI', message: 'wir wünschen Ihnen ein gesundes und erfolgreiches neues Jahr {jahr}! Danke, dass Sie mit uns unterwegs waren.\n\nOb Geschäftsreise oder Winterurlaub: Wir bringen Sie auch in diesem Jahr pünktlich und zum Festpreis zum Flughafen München – und holen Sie wieder ab.' },
    en: { badge: '🥂 Happy New Year', subject: 'Happy New Year {jahr} from Flughafen-München.TAXI', message: 'We wish you a healthy and successful new year {jahr}! Thank you for travelling with us.\n\nWhether business trip or winter holiday: this year, too, we will take you to Munich Airport on time and at a fixed price – and pick you up again.' },
    tr: { badge: '🥂 Mutlu yıllar', subject: "Flughafen-München.TAXI'den mutlu yıllar {jahr}", message: "Sağlıklı ve başarılı bir {jahr} yılı dileriz! Bizimle yolculuk ettiğiniz için teşekkür ederiz.\n\nİş seyahati ya da kış tatili: Bu yıl da sizi Münih Havalimanı'na dakik ve sabit fiyatla götürüyor, dönüşte yeniden alıyoruz." },
  },
  oktoberfest: {
    de: { badge: '🥨 Oktoberfest', subject: "O'zapft is: Ihr Taxi zur Wiesn und zum Flughafen", message: 'bald beginnt das Oktoberfest – München ist voller Gäste, Taxis und Hotels sind knapp. Planen Sie Ihre Fahrten jetzt: vom Flughafen zum Hotel, zur Theresienwiese oder nach dem Wiesn-Besuch sicher zurück.\n\nAuch für Firmengäste und Gruppen bis 8 Personen – zum garantierten Festpreis.' },
    en: { badge: '🥨 Oktoberfest', subject: "O'zapft is: your taxi to the Oktoberfest and the airport", message: 'Oktoberfest starts soon – Munich is full of visitors and taxis and hotels are scarce. Plan your rides now: from the airport to your hotel, to the Theresienwiese or safely back after your visit.\n\nAlso for business guests and groups of up to 8 – at a guaranteed fixed price.' },
    tr: { badge: '🥨 Oktoberfest', subject: "O'zapft is: Oktoberfest'e ve havalimanına taksiniz", message: "Oktoberfest yakında başlıyor – Münih misafirlerle dolu, taksi ve otel bulmak zor. Yolculuklarınızı şimdi planlayın: havalimanından otele, Theresienwiese'ye ya da ziyaret sonrası güvenle geri.\n\nFirma misafirleri ve 8 kişiye kadar gruplar için de – garantili sabit fiyatla." },
  },
  messe: {
    de: { badge: '🏢 {messe}', subject: '{messe} in München: Transfers für Ihr Team zum Festpreis', message: 'ab dem {datum} findet die {messe} in München statt. Wir übernehmen die Fahrten für Sie und Ihr Team: Flughafen ⇄ Messe München ⇄ Hotel – pünktlich, zum Festpreis und auf Wunsch mit Sammelrechnung.\n\nBuchen Sie frühzeitig – während der Messe sind Taxis in München knapp.' },
    en: { badge: '🏢 {messe}', subject: '{messe} in Munich: transfers for your team at a fixed price', message: '{messe} takes place in Munich from {datum}. We take care of the rides for you and your team: airport ⇄ Messe München ⇄ hotel – on time, at a fixed price and with a monthly invoice if you like.\n\nBook early – taxis in Munich are scarce during the fair.' },
    tr: { badge: '🏢 {messe}', subject: "{messe} Münih'te: ekibiniz için sabit fiyatlı transfer", message: "{messe} {datum} tarihinden itibaren Münih'te. Siz ve ekibiniz için yolculukları üstleniyoruz: havalimanı ⇄ Messe München ⇄ otel – dakik, sabit fiyatlı ve istenirse toplu faturayla.\n\nErken rezervasyon yapın – fuar süresince Münih'te taksi bulmak zor." },
  },
  ruhiger_november: {
    de: { badge: '🍁 November', subject: 'Im November entspannt zum Flughafen', message: 'der November ist die ruhige Zeit vor dem Weihnachtstrubel – ideal für einen Städtetrip, den Besuch bei der Familie oder die nächste Geschäftsreise. Wir bringen Sie pünktlich und zum Festpreis zum Flughafen München.' },
    en: { badge: '🍁 November', subject: 'Travel relaxed to the airport in November', message: 'November is the quiet time before the Christmas rush – perfect for a city break, a family visit or your next business trip. We will take you to Munich Airport on time and at a fixed price.' },
    tr: { badge: '🍁 Kasım', subject: 'Kasım ayında havalimanına rahatça', message: "Kasım, Noel telaşından önceki sakin dönem – şehir gezisi, aile ziyareti ya da bir sonraki iş seyahatiniz için ideal. Sizi Münih Havalimanı'na dakik ve sabit fiyatla götürüyoruz." },
  },
};

// ---- Vorlagen ohne Datum (Admin → Marketing → „Hazır şablonlar“) ---------------------------------
// Nur Funktionen, die es auf der Website wirklich gibt (Stand 23.10.2026).

export interface MarketingTemplate { id: string; name: string; defaults: OccasionDefaults; texts: Record<Lang, OccasionText> }

export const TEMPLATES: Array<Omit<MarketingTemplate, 'defaults'> & { defaults: Partial<OccasionDefaults> }> = [
  {
    id: 'tpl-neue-website',
    name: 'Yeni sitemize davet (eski müşteriler)',
    defaults: { segment: 'all', mode: 'discount', percent: 10, validDays: 60 },
    texts: {
      de: {
        badge: '🌐 Unsere neue Website',
        subject: 'Unsere neue Website ist online – Ihr Flughafentaxi in 60 Sekunden gebucht',
        message: `wir haben uns für Sie neu aufgestellt: Auf **flughafen-muenchen.taxi** buchen Sie Ihre Fahrt jetzt in weniger als einer Minute – rund um die Uhr, auch nachts und an Feiertagen. Mit über 20 Jahren Erfahrung, konzessioniert und vollversichert.

# Online buchen in 60 Sekunden
- **Festpreis sofort:** Adresse eingeben, Preis sehen – kein Taxameter, keine Überraschungen
- **Sofortige Bestätigung** per E-Mail, kurz darauf die endgültige Bestätigung Ihrer Fahrt
- **Bezahlen, wie Sie möchten:** bar beim Fahrer, mit Kreditkarte oder auf Rechnung
- **Rechnung automatisch** als PDF direkt nach der Fahrt in Ihrem Postfach
- **Buchung online verwalten** und bis 3 Stunden vorher kostenlos stornieren
- **Live-Tracking:** Sie sehen, wo Ihr Fahrer gerade ist

# Abholung am Flughafen
- **Persönlicher Empfang mit Namensschild** im Ankunftsbereich
- **Flugüberwachung und 60 Minuten kostenlose Wartezeit** – landet Ihr Flug später, warten wir
- **Kombi, Van oder Großraumtaxi bis 8 Personen**, Kindersitz und Fahrradmitnahme auf Wunsch
- **Mehrsprachige Fahrer** (Deutsch, Englisch, Türkisch)

# Für Firmen
- **Firmenkundenportal:** Fahrten für Mitarbeiter und Gäste in Sekunden buchen, mit mehreren Nutzern
- **Monatliche Sammelrechnung** mit Kostenstelle und Referenz pro Fahrt, alle Rechnungen als PDF

# Mehr als ein Flughafentaxi
- **Messe-Transfer** zur Messe München und zum ICM – auch für ganze Teams
- **Ski-Transfer** nach Kitzbühel, Ischgl, Sölden & Co. – mit Platz für die ganze Ausrüstung
- **Fernfahrten** in ganz Bayern, nach Österreich und in die Schweiz
- **Gruppen & Events:** Hochzeiten, Firmenfeiern, Oktoberfest, Allianz Arena
- **Hotel- und Bahnhofstransfer, Kurierfahrten und sitzende Krankenfahrten**

Natürlich erreichen Sie uns weiterhin rund um die Uhr telefonisch und per WhatsApp – ganz wie gewohnt.`,
        button: 'Jetzt neue Website ansehen',
      },
      en: {
        badge: '🌐 Our new website',
        subject: 'Our new website is live – book your airport taxi in 60 seconds',
        message: `We have made things easier for you: on **flughafen-muenchen.taxi** you can now book your ride in under a minute – around the clock, at night and on public holidays too. With more than 20 years of experience, fully licensed and fully insured.

# Book online in 60 seconds
- **Fixed price instantly:** enter your address, see the price – no meter, no surprises
- **Instant confirmation** by e-mail, followed shortly by the final confirmation of your ride
- **Pay the way you like:** cash to the driver, by credit card or on invoice
- **Automatic invoice** as a PDF in your inbox right after the ride
- **Manage your booking online** and cancel free of charge up to 3 hours before
- **Live tracking:** see where your driver is right now

# Airport pick-up
- **Personal welcome with a name sign** in the arrivals hall
- **Flight monitoring and 60 minutes of free waiting time** – if your flight is late, we wait
- **Estate car, van or minibus for up to 8 people**, child seats and bikes on request
- **Multilingual drivers** (German, English, Turkish)

# For companies
- **Business portal:** book rides for staff and guests in seconds, with several users
- **Monthly invoice** with cost centre and reference per ride, every invoice as a PDF

# More than an airport taxi
- **Trade fair transfers** to Messe München and the ICM – for whole teams too
- **Ski transfers** to Kitzbühel, Ischgl, Sölden & more – with room for all your gear
- **Long-distance rides** across Bavaria, to Austria and Switzerland
- **Groups & events:** weddings, company parties, Oktoberfest, Allianz Arena
- **Hotel and station transfers, courier rides and seated patient transport**

Of course you can still reach us around the clock by phone and WhatsApp – just as before.`,
        button: 'Visit the new website',
      },
      tr: {
        badge: '🌐 Yeni web sitemiz',
        subject: 'Yeni web sitemiz yayında – havalimanı taksinizi 60 saniyede ayırtın',
        message: `Sizin için yeniledik: **flughafen-muenchen.taxi** adresinden yolculuğunuzu artık bir dakikadan kısa sürede ayırtabilirsiniz – günün her saati, gece ve bayramlarda da. 20 yılı aşkın tecrübe, ruhsatlı ve tam sigortalı.

# 60 saniyede online rezervasyon
- **Anında sabit fiyat:** adresi girin, fiyatı görün – taksimetre yok, sürpriz yok
- **Anında onay** e-postayla, kısa süre sonra yolculuğunuzun kesin onayı
- **Dilediğiniz gibi ödeyin:** şoföre nakit, kredi kartıyla ya da faturayla
- **Otomatik fatura:** yolculuktan hemen sonra PDF olarak e-postanızda
- **Rezervasyonu online yönetin**, 3 saat öncesine kadar ücretsiz iptal edin
- **Canlı takip:** şoförünüzün nerede olduğunu görün

# Havalimanında karşılama
- **İsim tabelasıyla kişisel karşılama** varış salonunda
- **Uçuş takibi ve 60 dakika ücretsiz bekleme** – uçağınız gecikirse bekliyoruz
- **Binek, van ya da 8 kişiye kadar büyük taksi**, istenirse çocuk koltuğu ve bisiklet taşıma
- **Çok dilli şoförler** (Almanca, İngilizce, Türkçe)

# Firmalar için
- **Firma portalı:** çalışanlarınız ve misafirleriniz için saniyeler içinde rezervasyon, birden fazla kullanıcı
- **Aylık toplu fatura**, her yolculukta masraf yeri ve referans, tüm faturalar PDF

# Havalimanı taksisinden fazlası
- **Fuar transferi** Messe München ve ICM'e – ekipler için de
- **Kayak transferi** Kitzbühel, Ischgl, Sölden ve daha fazlasına – tüm ekipmanınıza yer var
- **Uzun mesafe** tüm Bavyera, Avusturya ve İsviçre
- **Gruplar ve etkinlikler:** düğün, firma partisi, Oktoberfest, Allianz Arena
- **Otel ve tren istasyonu transferi, kurye ve oturarak hasta taşıma**

Bize her zamanki gibi telefon ve WhatsApp üzerinden 7/24 ulaşabilirsiniz.`,
        button: 'Yeni siteyi incele',
      },
    },
  },
  {
    id: 'tpl-firmenportal',
    name: 'Firmalara: Firmenportal & Sammelrechnung',
    defaults: { segment: 'business', mode: 'greeting', percent: 10, validDays: 60 },
    texts: {
      de: {
        badge: '🏢 Für Firmenkunden',
        subject: 'Firmenkundenportal: Fahrten in Sekunden buchen, monatlich eine Rechnung',
        message: `vielen Dank für die Zusammenarbeit. Für Unternehmen, Hotels und Agenturen gibt es jetzt unser **Firmenkundenportal** – Buchung, Abrechnung und Überblick an einem Ort.

# Ihre Vorteile
- **60-Sekunden-Buchung** für Mitarbeiter und Gäste
- **Zahlung auf Rechnung:** eine monatliche Sammelrechnung statt Einzelzahlung pro Fahrt
- **PDF-Rechnungen** für jede Fahrt und jede Sammelrechnung mit einem Klick
- **Mehrere Nutzer:** Rezeption, Assistenz und Kollegen mit eigenem Zugang
- **Kostenstelle & Referenz:** jede Fahrt einer Abteilung oder einem Gast zuordnen
- **CSV-Export & Statistik** für Ihre Buchhaltung, **Favoriten-Strecken** mit einem Klick
- **Abholung mit Namensschild**, Flugüberwachung und 60 Minuten kostenlose Wartezeit
- **Persönlicher Ansprechpartner** rund um die Uhr

# So einfach geht's
- Firmenkonto auf flughafen-muenchen.taxi/business beantragen – dauert 2 Minuten
- Nach der Prüfung erhalten Sie Ihre Zugangsdaten per E-Mail
- Erste Fahrt für Ihre Gäste direkt buchen

Gern erstellen wir Ihnen auch ein individuelles Angebot für regelmäßige Fahrten oder Messen.`,
        button: 'Firmenkonto beantragen',
        url: 'https://flughafen-muenchen.taxi/business',
      },
      en: {
        badge: '🏢 For business customers',
        subject: 'Business portal: book rides in seconds, one invoice per month',
        message: `Thank you for working with us. For companies, hotels and agencies we now offer our **business portal** – booking, billing and overview in one place.

# Your benefits
- **60-second booking** for staff and guests
- **Pay on invoice:** one monthly invoice instead of paying per ride
- **PDF invoices** for every ride and every monthly invoice with one click
- **Several users:** reception, assistants and colleagues with their own login
- **Cost centre & reference:** assign every ride to a department or guest
- **CSV export & statistics** for your accounting, **favourite routes** with one click
- **Name-sign pick-up**, flight monitoring and 60 minutes of free waiting time
- **Personal contact** around the clock

# How it works
- Apply for a business account at flughafen-muenchen.taxi/business – takes 2 minutes
- After review you receive your login details by e-mail
- Book the first ride for your guests right away

We are also happy to prepare an individual offer for regular rides or trade fairs.`,
        button: 'Apply for a business account',
        url: 'https://flughafen-muenchen.taxi/en/business',
      },
      tr: {
        badge: '🏢 Kurumsal müşteriler için',
        subject: 'Firma portalı: saniyeler içinde rezervasyon, ayda tek fatura',
        message: `İş birliğiniz için teşekkür ederiz. Firmalar, oteller ve acenteler için artık **firma portalımız** var – rezervasyon, faturalama ve genel bakış tek yerde.

# Avantajlarınız
- Çalışanlar ve misafirler için **60 saniyede rezervasyon**
- **Faturayla ödeme:** her yolculuk için ayrı ödeme yerine aylık toplu fatura
- Her yolculuk ve her toplu fatura için tek tıkla **PDF fatura**
- **Birden fazla kullanıcı:** resepsiyon, asistan ve çalışma arkadaşları için ayrı giriş
- **Masraf yeri ve referans:** her yolculuğu bir departmana ya da misafire atayın
- Muhasebeniz için **CSV dışa aktarım ve istatistik**, tek tıkla **favori güzergâhlar**
- **İsim tabelasıyla karşılama**, uçuş takibi ve 60 dakika ücretsiz bekleme
- 7/24 **kişisel muhatap**

# Nasıl çalışır
- flughafen-muenchen.taxi/business adresinden firma hesabı başvurusu yapın – 2 dakika sürer
- İnceleme sonrası giriş bilgileriniz e-postayla gelir
- Misafirleriniz için ilk yolculuğu hemen ayırtın

Düzenli yolculuklar ya da fuarlar için size özel teklif de hazırlayabiliriz.`,
        button: 'Firma hesabı başvurusu',
        url: 'https://flughafen-muenchen.taxi/tr/business',
      },
    },
  },
];

// ---- Anlässe ---------------------------------------------------------------------------------

interface Def {
  id: string;
  name: string;
  group: Occasion['group'];
  defaults: OccasionDefaults;
  texts: Record<Lang, OccasionText>;
  /** Datum des Anlasses im Jahr (bzw. Schulferien aus der API). */
  dates: (year: number, school: SourcedEvent[]) => { date: string; end?: string } | null;
}

const d = (o: Partial<OccasionDefaults>): OccasionDefaults => ({
  enabled: true, leadDays: 14, afterDays: 0, segment: 'privat', mode: 'discount', percent: 10, validDays: 45, maxAmount: null, ...o,
});

const school = (re: RegExp) => (year: number, list: SourcedEvent[]) => {
  const h = list.filter(e => re.test(e.name) && +e.start.slice(0, 4) === year).sort((a, b) => a.start.localeCompare(b.start))[0];
  return h ? { date: h.start, end: h.end } : null;
};
const ymd = (dt: Date) => dt.toISOString().slice(0, 10);

const DEFS: Def[] = [
  { id: 'herbstferien', name: 'Herbstferien (sonbahar tatili)', group: 'ferien', defaults: d({ leadDays: 14, percent: 10 }),
    texts: ferienTexts('Herbstferien', 'autumn school holidays', 'Sonbahar tatili', '🍂'), dates: school(/herbst/i) },
  { id: 'weihnachtsferien', name: 'Weihnachtsferien (Noel tatili)', group: 'ferien', defaults: d({ leadDays: 21, percent: 10 }),
    texts: ferienTexts('Weihnachtsferien', 'Christmas holidays', 'Noel tatili', '🎄'), dates: school(/weihnacht/i) },
  { id: 'winterferien', name: 'Faschings-/Winterferien', group: 'ferien', defaults: d({ leadDays: 14, percent: 7 }),
    texts: ferienTexts('Faschingsferien', 'winter school holidays', 'Kış tatili', '⛷️'), dates: school(/frühjahr|winter|fasching/i) },
  { id: 'osterferien', name: 'Osterferien (Paskalya tatili)', group: 'ferien', defaults: d({ leadDays: 21, percent: 10 }),
    texts: ferienTexts('Osterferien', 'Easter holidays', 'Paskalya tatili', '🐣'), dates: school(/oster/i) },
  { id: 'pfingstferien', name: 'Pfingstferien', group: 'ferien', defaults: d({ leadDays: 14, percent: 7 }),
    texts: ferienTexts('Pfingstferien', 'Whitsun holidays', 'Pentekost tatili', '🌿'), dates: school(/pfingst/i) },
  { id: 'sommerferien', name: 'Sommerferien (yaz tatili)', group: 'ferien', defaults: d({ leadDays: 28, percent: 5 }),
    texts: ferienTexts('Sommerferien', 'summer holidays', 'Yaz tatili', '☀️'), dates: school(/sommer/i) },
  { id: 'black_friday', name: 'Black Friday / Black Week', group: 'season', defaults: d({ leadDays: 7, afterDays: 3, percent: 10, validDays: 45 }),
    texts: TXT.black_friday,
    dates: (y) => { // Freitag nach dem 4. Donnerstag im November
      const first = new Date(Date.UTC(y, 10, 1)).getUTCDay();
      const thu = 1 + ((4 - first + 7) % 7) + 21;
      return { date: ymd(new Date(Date.UTC(y, 10, thu + 1))) };
    } },
  { id: 'ruhiger_november', name: 'Sakin Kasım (boş günleri doldur)', group: 'season', defaults: d({ leadDays: 2, afterDays: 7, segment: 'all', percent: 10, validDays: 30 }),
    texts: TXT.ruhiger_november, dates: (y) => ({ date: `${y}-11-03` }) },
  { id: 'weihnachtsgruesse', name: 'Weihnachts- & Jahresendgrüße', group: 'fest', defaults: d({ leadDays: 10, segment: 'business_stamm', mode: 'greeting', percent: 10 }),
    texts: TXT.weihnachtsgruesse, dates: (y) => ({ date: `${y}-12-24` }) },
  { id: 'neujahr', name: 'Neujahr (sakin Ocak)', group: 'fest', defaults: d({ leadDays: 0, afterDays: 8, segment: 'all', percent: 10, validDays: 30 }),
    texts: TXT.neujahr, dates: (y) => ({ date: `${y}-01-02` }) },
  { id: 'oktoberfest', name: 'Oktoberfest', group: 'fest', defaults: d({ leadDays: 21, segment: 'all', mode: 'greeting' }),
    texts: TXT.oktoberfest,
    dates: (y) => { // erster Samstag ab dem 16. September
      const dt = new Date(Date.UTC(y, 8, 16));
      while (dt.getUTCDay() !== 6) dt.setUTCDate(dt.getUTCDate() + 1);
      const end = new Date(dt.getTime() + 15 * 86_400_000);
      return { date: ymd(dt), end: ymd(end) };
    } },
];

// Große Messen in München, bei denen Firmenkunden Transfers brauchen
const BIG_MESSE = /bauma|ispo|expo real|iaa|electronica|productronica|analytica|transport logistic|automatica|drinktec|laser world|inhorgenta|f\.re\.e|\bbau\b|intersolar|the smarter e|ifat|light \+ building|eurobike|heim\s*\+\s*handwerk/i;

// Begleitkonferenzen u. Ä. — keine eigene Kampagne
const MESSE_SIDE = /conference|konferenz|kongress|congress|forum|summit|beyond|award/i;

export interface CustomOccasion {
  id: string; name: string; monthDay: string; // MM-DD
  leadDays?: number; segment?: Segment; mode?: Mode; percent?: number;
  subject?: string; message?: string;
}

async function getSetting(key: string): Promise<string | null> {
  const [r] = await query<{ setting_value: string }>('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
  return r ? r.setting_value : null;
}
const json = <T>(raw: string | null, fb: T): T => { try { return raw ? JSON.parse(raw) as T : fb; } catch { return fb; } };

export async function occasionOverrides(): Promise<Record<string, Partial<OccasionDefaults>>> {
  return json(await getSetting('marketing_occasion_settings'), {});
}
/** Alle Marketing-Einstellungen in einer Abfrage (Kalender wird bei jedem Dashboard-Aufruf gebaut). */
async function allSettings(): Promise<{ overrides: Record<string, Partial<OccasionDefaults>>; custom: CustomOccasion[]; reminders: boolean }> {
  const rows = await query<{ setting_key: string; setting_value: string }>(
    `SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('marketing_occasion_settings', 'marketing_custom_occasions', 'marketing_reminders_enabled')`);
  const v = (k: string) => rows.find(r => r.setting_key === k)?.setting_value ?? null;
  const custom = json<CustomOccasion[]>(v('marketing_custom_occasions'), []);
  return { overrides: json(v('marketing_occasion_settings'), {}), custom: Array.isArray(custom) ? custom : [], reminders: v('marketing_reminders_enabled') !== '0' };
}
export async function customOccasions(): Promise<CustomOccasion[]> {
  const list = json<CustomOccasion[]>(await getSetting('marketing_custom_occasions'), []);
  return Array.isArray(list) ? list : [];
}
export async function remindersEnabled(): Promise<boolean> {
  return (await getSetting('marketing_reminders_enabled')) !== '0';
}

const fill = (t: OccasionText, vars: Record<string, string>): OccasionText => {
  const r = (s?: string) => (s || '').replace(/\{(jahr|messe|datum)\}/g, (_, k) => vars[k] ?? '');
  return { subject: r(t.subject), message: r(t.message), badge: r(t.badge), button: t.button, url: t.url };
};
const dmy = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const shift = (s: string, n: number) => ymd(new Date(Date.parse(`${s}T12:00:00Z`) + n * 86_400_000));

/**
 * Anlässe der nächsten 12 Monate (plus die gerade offenen), mit Status aus marketing_campaigns.
 * Pro Anlass nur das nächste Vorkommen, dessen Fenster noch nicht vorbei ist.
 */
export async function marketingCalendar(): Promise<{ occasions: Occasion[]; templates: MarketingTemplate[]; remindersEnabled: boolean; sourceErrors: string[] }> {
  const today = berlinDateSql(0);
  const horizon = berlinDateSql(366);
  const y = +today.slice(0, 4);
  const sourceErrors: string[] = [];
  const [{ overrides, custom, reminders }, sourcedRes, done] = await Promise.all([
    allSettings(),
    sourcedEvents({ messe: true, school: true, football: false }).catch((e: any) => { sourceErrors.push(e?.message || String(e)); return null; }),
    query<{ id: number; occasion_id: string; occasion_year: number; status: string; created_at: string }>(
      `SELECT id, occasion_id, occasion_year, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at FROM marketing_campaigns
        WHERE occasion_id IS NOT NULL AND status IN ('sent','skipped') ORDER BY created_at DESC`),
  ]);
  const sourced: SourcedEvent[] = sourcedRes?.events || [];
  for (const [k, v] of Object.entries(sourcedRes?.errors || {})) if (v) sourceErrors.push(`${k}: ${v}`);
  const schoolList = sourced.filter(e => e.kind === 'school');

  type Raw = { id: string; name: string; group: Occasion['group']; defaults: OccasionDefaults; texts: Record<Lang, OccasionText>; date: string; end: string | null; vars: Record<string, string> };
  const raws: Raw[] = [];
  for (const def of DEFS) {
    for (const year of [y, y + 1]) {
      const dt = def.dates(year, schoolList);
      if (!dt) continue;
      raws.push({ id: def.id, name: def.name, group: def.group, defaults: def.defaults, texts: def.texts, date: dt.date, end: dt.end || null, vars: { jahr: String(year) } });
    }
  }
  // Messen: jede große Messe ein eigener Anlass (Firmenkunden)
  const seenMesse = new Set<string>();
  const multiDay = (e: SourcedEvent) => daysBetween(e.start, e.end) >= 2;
  for (const m of sourced.filter(e => e.kind === 'messe' && BIG_MESSE.test(e.name) && !MESSE_SIDE.test(e.name) && multiDay(e))) {
    // ohne Jahreszahl, damit Einstellungen für „bauma“ auch beim nächsten Mal gelten
    const slug = m.name.toLowerCase().replace(/\b20\d\d\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const id = `messe-${slug}`;
    if (seenMesse.has(`${id}|${m.start.slice(0, 4)}`)) continue;
    seenMesse.add(`${id}|${m.start.slice(0, 4)}`);
    raws.push({ id, name: `Messe: ${m.name}`, group: 'business', defaults: d({ leadDays: 21, segment: 'business', mode: 'greeting' }),
      texts: TXT.messe, date: m.start, end: m.end, vars: { messe: m.name, datum: dmy(m.start), jahr: m.start.slice(0, 4) } });
  }
  // Eigene Anlässe (jährlich wiederkehrend)
  for (const c of custom) {
    if (!/^\d{2}-\d{2}$/.test(c.monthDay)) continue;
    for (const year of [y, y + 1]) {
      const t: OccasionText = { badge: `🎉 ${c.name}`, subject: c.subject || c.name, message: c.message || '' };
      raws.push({ id: c.id, name: c.name, group: 'custom',
        defaults: d({ leadDays: c.leadDays ?? 7, segment: c.segment || 'all', mode: c.mode || 'greeting', percent: c.percent ?? 10 }),
        texts: { de: t, en: t, tr: t }, date: `${year}-${c.monthDay}`, end: null, vars: { jahr: String(year) } });
    }
  }

  // Status aus versendeten/übersprungenen Kampagnen
  const doneMap = new Map<string, typeof done[number]>();
  for (const r of done) { const k = `${r.occasion_id}|${r.occasion_year}`; if (!doneMap.has(k)) doneMap.set(k, r); }

  const byId = new Map<string, Occasion>();
  for (const r of raws.sort((a, b) => a.date.localeCompare(b.date))) {
    const ov = overrides[r.id] || {};
    const set: OccasionDefaults = { ...r.defaults, ...ov };
    const remindFrom = shift(r.date, -set.leadDays);
    const remindUntil = shift(r.date, set.afterDays);
    if (remindUntil < today || r.date > horizon) continue;
    if (byId.has(r.id)) continue; // nur das nächste Vorkommen
    const year = +r.date.slice(0, 4);
    const doneRow = doneMap.get(`${r.id}|${year}`);
    const status: Occasion['status'] = doneRow ? (doneRow.status === 'sent' ? 'sent' : 'skipped')
      : today >= remindFrom ? 'due' : 'upcoming';
    byId.set(r.id, {
      id: r.id, key: `${r.id}|${year}`, year, name: r.name, group: r.group, ...set,
      date: r.date, end: r.end, remindFrom, remindUntil, status,
      sentAt: doneRow ? String(doneRow.created_at) : null, campaignId: doneRow?.id ?? null,
      daysLeft: daysBetween(today, r.date),
      texts: { de: fill(r.texts.de, r.vars), en: fill(r.texts.en, r.vars), tr: fill(r.texts.tr, r.vars) },
      isDefault: Object.keys(ov).length === 0,
    });
  }
  const occasions = [...byId.values()].sort((a, b) => a.remindFrom.localeCompare(b.remindFrom));
  const templates = TEMPLATES.map(t => ({ ...t, defaults: { ...d(t.defaults), ...(overrides[t.id] || {}) } }));
  return { occasions, templates, remindersEnabled: reminders, sourceErrors };
}

/** Offene Anlässe (Fenster offen, nicht versendet/übersprungen) — Dashboard „Handlungsbedarf“. */
export async function marketingReminders(): Promise<Array<{ id: string; name: string; date: string; daysLeft: number; urgent: boolean }> | null> {
  const { occasions, remindersEnabled: on } = await marketingCalendar();
  if (!on) return null;
  const due = occasions.filter(o => o.enabled && o.status === 'due')
    .map(o => ({ id: o.id, name: o.name, date: o.date, daysLeft: o.daysLeft, urgent: o.group === 'ferien' ? o.daysLeft <= 7 : o.daysLeft <= 2 }));
  return due.length ? due : null;
}
