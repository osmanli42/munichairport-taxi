import {
  Plane, Presentation, MountainSnow, Route, Users, Beer, TrainFront, Briefcase, Package, HeartPulse,
  type LucideIcon,
} from 'lucide-react';

// Services offered (Leistungen) – shared by the header menu and the /leistungen page.
// `href` is without locale prefix; links starting with '#' point to a section of /leistungen.
// No hourly chauffeur service on purpose (not offered).

export type Lang = 'de' | 'en' | 'tr';
export const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

export type ServiceKey =
  | 'airport' | 'messe' | 'ski' | 'longDistance' | 'groups'
  | 'oktoberfest' | 'city' | 'business' | 'courier' | 'medical';

type ServiceText = { title: string; short: string; text: string; bullets: [string, string, string]; cta: string };

export type Service = { key: ServiceKey; icon: LucideIcon; href: string; text: Record<Lang, ServiceText> };

export const SERVICES: Service[] = [
  {
    key: 'airport', icon: Plane, href: '/',
    text: {
      de: { title: 'Flughafentransfer', short: 'Zum & vom Flughafen München', text: 'Abholung an Ihrer Adresse oder am Terminal – zum Festpreis, der vor der Buchung feststeht.', bullets: ['Namensschild im Ankunftsbereich', 'Flugüberwachung & 60 Min. Gratis-Wartezeit', 'Kombi, Van oder Großraumtaxi bis 8 Personen'], cta: 'Preis berechnen' },
      en: { title: 'Airport transfer', short: 'To & from Munich Airport', text: 'Pickup at your address or at the terminal – at a fixed price that is set before you book.', bullets: ['Name sign in the arrivals hall', 'Flight monitoring & 60 min. free waiting', 'Saloon, van or large taxi for up to 8'], cta: 'Calculate price' },
      tr: { title: 'Havalimanı transferi', short: 'Münih Havalimanı’na gidiş & dönüş', text: 'Adresinizden veya terminalden alış – rezervasyondan önce belli olan sabit fiyatla.', bullets: ['Varış salonunda isim tabelası', 'Uçuş takibi & 60 dk. ücretsiz bekleme', '8 kişiye kadar binek, van veya büyük taksi'], cta: 'Fiyat hesapla' },
    },
  },
  {
    key: 'messe', icon: Presentation, href: '/messe-muenchen-transfer',
    text: {
      de: { title: 'Messe-Transfer', short: 'Messe München & ICM', text: 'Für Besucher und Aussteller: vom Terminal direkt zum Messeeingang – auch zur bauma, IFAT oder EXPO REAL.', bullets: ['Eingänge West, Nord, Ost & ICM', 'Mehrere Fahrzeuge für Ihr Team', 'Rechnung für Ihre Firma'], cta: 'Zum Messe-Transfer' },
      en: { title: 'Trade fair transfer', short: 'Messe München & ICM', text: 'For visitors and exhibitors: from the terminal straight to the fair entrance – also for bauma, IFAT or EXPO REAL.', bullets: ['Entrances West, North, East & ICM', 'Several vehicles for your team', 'Invoice for your company'], cta: 'Trade fair transfer' },
      tr: { title: 'Fuar transferi', short: 'Messe München & ICM', text: 'Ziyaretçi ve katılımcılar için: terminalden doğrudan fuar girişine – bauma, IFAT veya EXPO REAL’de de.', bullets: ['Batı, Kuzey, Doğu girişleri & ICM', 'Ekibiniz için birden fazla araç', 'Firmanıza fatura'], cta: 'Fuar transferi' },
    },
  },
  {
    key: 'ski', icon: MountainSnow, href: '#ski',
    text: {
      de: { title: 'Ski-Transfer', short: 'Kitzbühel, Ischgl, Sölden …', text: 'Vom Flughafen direkt vor Ihr Hotel im Skigebiet – ohne Umsteigen, mit Platz für die ganze Ausrüstung.', bullets: ['Platz für Ski, Snowboard & Skischuhe', 'Winterreifen & alpenerfahrene Fahrer', 'Festpreis pro Fahrzeug, nicht pro Person'], cta: 'Skigebiete ansehen' },
      en: { title: 'Ski transfer', short: 'Kitzbühel, Ischgl, Sölden …', text: 'From the airport straight to your hotel in the ski resort – no changes, with room for all your gear.', bullets: ['Room for skis, snowboards & boots', 'Winter tyres & drivers used to Alpine roads', 'Fixed price per vehicle, not per person'], cta: 'See ski resorts' },
      tr: { title: 'Kayak transferi', short: 'Kitzbühel, Ischgl, Sölden …', text: 'Havalimanından doğrudan kayak merkezindeki otelinize – aktarmasız, tüm ekipmanınıza yer var.', bullets: ['Kayak, snowboard & botlar için yer', 'Kış lastiği & Alp yollarını bilen şoförler', 'Kişi başı değil, araç başı sabit fiyat'], cta: 'Kayak merkezleri' },
    },
  },
  {
    key: 'longDistance', icon: Route, href: '#fernfahrten',
    text: {
      de: { title: 'Fernfahrten & Österreich', short: 'Bayern, Österreich, Schweiz', text: 'Salzburg, Innsbruck, Zürich oder Nürnberg: Tür-zu-Tür-Fahrten über lange Strecken zum Festpreis.', bullets: ['Ganz Bayern, Österreich & Schweiz', 'Kein Umsteigen, kein Zugausfall', 'Pausen nach Wunsch'], cta: 'Ziele ansehen' },
      en: { title: 'Long distance & Austria', short: 'Bavaria, Austria, Switzerland', text: 'Salzburg, Innsbruck, Zurich or Nuremberg: door-to-door rides over long distances at a fixed price.', bullets: ['All of Bavaria, Austria & Switzerland', 'No changes, no cancelled trains', 'Breaks whenever you like'], cta: 'See destinations' },
      tr: { title: 'Uzun mesafe & Avusturya', short: 'Bavyera, Avusturya, İsviçre', text: 'Salzburg, Innsbruck, Zürih veya Nürnberg: uzun mesafede kapıdan kapıya, sabit fiyatla.', bullets: ['Tüm Bavyera, Avusturya & İsviçre', 'Aktarma yok, iptal edilen tren yok', 'İstediğiniz zaman mola'], cta: 'Hedefler' },
    },
  },
  {
    key: 'groups', icon: Users, href: '#gruppen',
    text: {
      de: { title: 'Shuttle, Gruppen & Events', short: 'Hochzeit, Firmenevent, Stadion', text: 'Für Gruppen stimmen wir mehrere Fahrzeuge aufeinander ab – für Hochzeiten, Firmenfeiern, Konzerte und Spiele.', bullets: ['Großraumtaxi bis 8 Personen', 'Mehrere Fahrzeuge zur gleichen Zeit', 'Hin- und Rückfahrt vorab geplant'], cta: 'Gruppenfahrt anfragen' },
      en: { title: 'Shuttle, groups & events', short: 'Weddings, company events, stadium', text: 'For groups we coordinate several vehicles – for weddings, company parties, concerts and matches.', bullets: ['Large taxi for up to 8 people', 'Several vehicles at the same time', 'Outward and return trip planned ahead'], cta: 'Request a group ride' },
      tr: { title: 'Shuttle, grup & etkinlik', short: 'Düğün, firma etkinliği, stadyum', text: 'Gruplar için birden fazla aracı koordine ediyoruz – düğün, firma kutlaması, konser ve maçlar için.', bullets: ['8 kişiye kadar büyük taksi', 'Aynı anda birden fazla araç', 'Gidiş ve dönüş önceden planlanır'], cta: 'Grup yolculuğu iste' },
    },
  },
  {
    key: 'oktoberfest', icon: Beer, href: '/oktoberfest',
    text: {
      de: { title: 'Oktoberfest-Shuttle', short: 'Flughafen ↔ Wiesn', text: 'Vom Flughafen zur Theresienwiese und nach dem Festzelt sicher zurück ins Hotel.', bullets: ['Abholung am Wiesn-Rand', 'Für Gruppen im Großraumtaxi', 'Frühzeitig buchen – Taxis sind knapp'], cta: 'Zum Oktoberfest' },
      en: { title: 'Oktoberfest shuttle', short: 'Airport ↔ Wiesn', text: 'From the airport to the Theresienwiese and safely back to your hotel after the beer tent.', bullets: ['Pickup at the edge of the Wiesn', 'Groups in a large taxi', 'Book early – taxis are scarce'], cta: 'Oktoberfest' },
      tr: { title: 'Oktoberfest shuttle', short: 'Havalimanı ↔ Wiesn', text: 'Havalimanından Theresienwiese’ye, çadırdan sonra güvenle otelinize.', bullets: ['Wiesn kenarından alış', 'Gruplar için büyük taksi', 'Erken ayırtın – taksi az bulunur'], cta: 'Oktoberfest' },
    },
  },
  {
    key: 'city', icon: TrainFront, href: '/munich-airport-to-city-centre',
    text: {
      de: { title: 'Hotel- & Bahnhofstransfer', short: 'Innenstadt, Hauptbahnhof, Hotels', text: 'Vom Flughafen zum Hotel, zum Hauptbahnhof oder in die Altstadt – ohne S-Bahn-Umstieg mit Gepäck.', bullets: ['Hauptbahnhof, Marienplatz, Schwabing', 'Direkt vor den Hoteleingang', 'Auch früh morgens & spät nachts'], cta: 'Ratgeber Innenstadt' },
      en: { title: 'Hotel & station transfer', short: 'City centre, central station, hotels', text: 'From the airport to your hotel, the central station or the old town – no S-Bahn changes with luggage.', bullets: ['Central station, Marienplatz, Schwabing', 'Right to the hotel entrance', 'Early mornings & late nights too'], cta: 'City centre guide' },
      tr: { title: 'Otel & istasyon transferi', short: 'Şehir merkezi, Hbf, oteller', text: 'Havalimanından otele, ana istasyona veya eski şehre – valizle S-Bahn aktarması yok.', bullets: ['Hauptbahnhof, Marienplatz, Schwabing', 'Doğrudan otel girişine', 'Sabah erken & gece geç saatte de'], cta: 'Şehir merkezi rehberi' },
    },
  },
  {
    key: 'business', icon: Briefcase, href: '/business',
    text: {
      de: { title: 'Business & Firmenkunden', short: 'Sammelrechnung & Firmenportal', text: 'Für Unternehmen, Hotels und Agenturen: Fahrten für Mitarbeiter und Gäste über ein Konto.', bullets: ['Monatliche Sammelrechnung', 'Gäste-Abholung mit Namensschild', 'Fester Ansprechpartner'], cta: 'Business-Angebot' },
      en: { title: 'Business & companies', short: 'Monthly invoice & company portal', text: 'For companies, hotels and agencies: rides for staff and guests on one account.', bullets: ['Monthly collective invoice', 'Guest pickup with name sign', 'Personal contact person'], cta: 'Business offer' },
      tr: { title: 'Business & kurumsal', short: 'Toplu fatura & firma portalı', text: 'Firmalar, oteller ve ajanslar için: çalışan ve misafir yolculukları tek hesapta.', bullets: ['Aylık toplu fatura', 'İsim tabelalı misafir karşılama', 'Sabit irtibat kişisi'], cta: 'Business teklifi' },
    },
  },
  {
    key: 'courier', icon: Package, href: '#kurier',
    text: {
      de: { title: 'Kurierfahrten', short: 'Dokumente & Pakete am selben Tag', text: 'Eilige Dokumente, Ersatzteile oder vergessenes Gepäck – wir fahren direkt, ohne Umweg über ein Depot.', bullets: ['Direktfahrt noch am selben Tag', 'Persönliche Übergabe', 'Zum & vom Flughafen, in ganz Bayern'], cta: 'Kurier anfragen' },
      en: { title: 'Courier rides', short: 'Documents & parcels same day', text: 'Urgent documents, spare parts or forgotten luggage – we drive directly, without a detour via a depot.', bullets: ['Direct ride on the same day', 'Personal handover', 'To & from the airport, all over Bavaria'], cta: 'Request a courier' },
      tr: { title: 'Kurye yolculukları', short: 'Aynı gün evrak & paket', text: 'Acil evrak, yedek parça veya unutulan bagaj – depo üzerinden değil, doğrudan götürüyoruz.', bullets: ['Aynı gün doğrudan teslim', 'Elden teslim', 'Havalimanına & havalimanından, tüm Bavyera'], cta: 'Kurye iste' },
    },
  },
  {
    key: 'medical', icon: HeartPulse, href: '#krankenfahrten',
    text: {
      de: { title: 'Krankenfahrten (sitzend)', short: 'Klinik, Arzt & Reha', text: 'Sitzende Fahrten zu Klinik, Arztpraxis, Dialyse oder Reha – mit Zeit und Hilfe beim Ein- und Aussteigen.', bullets: ['Hilfe beim Ein- & Aussteigen', 'Wartezeit nach Absprache', 'Abrechnung bitte vorab telefonisch klären'], cta: 'Fahrt anfragen' },
      en: { title: 'Patient transport (seated)', short: 'Hospital, doctor & rehab', text: 'Seated rides to hospital, doctor’s practice, dialysis or rehab – with time and help getting in and out.', bullets: ['Help getting in & out', 'Waiting time by arrangement', 'Please clarify billing by phone beforehand'], cta: 'Request a ride' },
      tr: { title: 'Hasta yolculukları (oturarak)', short: 'Klinik, doktor & rehabilitasyon', text: 'Klinik, muayenehane, diyaliz veya rehabilitasyona oturarak yolculuk – acele etmeden, binip inerken yardımla.', bullets: ['Binip inerken yardım', 'Anlaşmaya göre bekleme', 'Ödeme şeklini önceden telefonla netleştirin'], cta: 'Yolculuk iste' },
    },
  },
];

/** Locale-aware link for a service (anchors point into /leistungen). */
export const serviceHref = (s: Service, prefix: string) =>
  s.href.startsWith('#') ? `${prefix}/leistungen${s.href}` : s.href === '/' ? prefix || '/' : `${prefix}${s.href}`;
