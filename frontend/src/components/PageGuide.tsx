// Extra explanatory text for /about and /vehicles (DE/EN/TR): how a ride works and which
// vehicle fits. Only facts that the rest of the site already states (booking flow, flight
// monitoring, tracking link, payment, child seats, capacities).

import Link from 'next/link';

type Block = { h3: string; p: string };
type Guide = { eyebrow: string; h2: string; intro: string; blocks: Block[]; note?: string; link?: { href: string; text: string } };
type Lang = 'de' | 'en' | 'tr';

const ABOUT: Record<Lang, Guide> = {
  de: {
    eyebrow: 'So arbeiten wir',
    h2: 'Ihr Taxi am Flughafen München: vom Buchen bis zur Ankunft',
    intro:
      'Flughafen-München.TAXI ist ein Taxiunternehmen aus Freising und seit über 20 Jahren am Flughafen München tätig. Seitdem haben wir mehr als 100.000 Fahrgäste zum Flughafen gebracht oder dort abgeholt: Geschäftsreisende, Familien, Urlauber und Messegäste. So läuft eine Fahrt mit uns ab:',
    blocks: [
      { h3: '1. Buchen mit Festpreis', p: 'Sie geben Abholadresse, Ziel, Datum und Uhrzeit ein und sehen sofort den Preis für Kombi, Van und Großraumtaxi. Der Preis steht bei der Buchung fest. Danach erhalten Sie eine Bestätigung mit Buchungsnummer per E-Mail.' },
      { h3: '2. Ansehen oder stornieren', p: 'Unter „Buchung verwalten“ sehen Sie Ihre Fahrt mit Buchungsnummer und E-Mail-Adresse. Bis 3 Stunden vor der Abholung stornieren Sie kostenlos.' },
      { h3: '3. Abholung am Flughafen', p: 'Bei Ankünften verfolgen wir Ihren Flug. Ihr Fahrer wartet mit Namensschild im Ankunftsbereich von Terminal 1 oder Terminal 2 und bei Verspätung bis zu 60 Minuten kostenlos.' },
      { h3: '4. Fahrer live verfolgen', p: 'Vor der Abholung bekommen Sie einen Link, über den Sie auf der Karte sehen, wo Ihr Fahrer gerade ist. So wissen Sie genau, wann er vor der Tür steht.' },
      { h3: '5. Bezahlen und Rechnung', p: 'Sie zahlen bar oder mit Kreditkarte. Firmen erhalten eine Rechnung, auf Wunsch gesammelt als monatliche Sammelrechnung.' },
      { h3: 'Rund um die Uhr, in drei Sprachen', p: 'Wir fahren 24 Stunden am Tag, auch an Sonn- und Feiertagen und zu Frühflügen. Am Telefon und per WhatsApp sprechen wir Deutsch, Englisch und Türkisch.' },
    ],
    link: { href: '/treffpunkt-flughafen-muenchen', text: 'Treffpunkte am Flughafen München ansehen' },
  },
  en: {
    eyebrow: 'How we work',
    h2: 'Your taxi at Munich Airport: from booking to arrival',
    intro:
      'Flughafen-München.TAXI is a taxi company from Freising and has been working at Munich Airport for more than 20 years. Since then we have driven more than 100,000 passengers to and from the airport: business travellers, families, holidaymakers and trade fair visitors. This is how a ride with us works:',
    blocks: [
      { h3: '1. Book at a fixed price', p: 'Enter pickup address, destination, date and time and you see the price for estate car, van and large taxi straight away. The price is fixed when you book. You then receive a confirmation with your booking number by e-mail.' },
      { h3: '2. View or cancel', p: 'Under “Manage booking” you see your ride with booking number and e-mail address. Cancellation is free of charge up to 3 hours before pickup.' },
      { h3: '3. Pickup at the airport', p: 'For arrivals we track your flight. Your driver waits with a name sign in the arrivals area of Terminal 1 or Terminal 2, up to 60 minutes free of charge if your flight is late.' },
      { h3: '4. Follow your driver live', p: 'Before pickup you receive a link that shows on a map where your driver is right now, so you know exactly when the car is at the door.' },
      { h3: '5. Payment and invoice', p: 'You pay in cash or by credit card. Companies receive an invoice, on request as a monthly collective invoice.' },
      { h3: 'Around the clock, in three languages', p: 'We drive 24 hours a day, including Sundays, public holidays and early flights. On the phone and on WhatsApp we speak German, English and Turkish.' },
    ],
    link: { href: '/en/treffpunkt-flughafen-muenchen', text: 'See the meeting points at Munich Airport' },
  },
  tr: {
    eyebrow: 'Nasıl çalışıyoruz',
    h2: 'Münih Havalimanı taksiniz: rezervasyondan varışa',
    intro:
      'Flughafen-München.TAXI, Freising merkezli bir taksi firmasıdır ve 20 yılı aşkın süredir Münih Havalimanı’nda hizmet vermektedir. Bu sürede 100.000’den fazla yolcuyu havalimanına götürdük veya oradan aldık: iş seyahatindekiler, aileler, tatilciler ve fuar ziyaretçileri. Bizimle bir yolculuk şöyle işler:',
    blocks: [
      { h3: '1. Sabit fiyatla rezervasyon', p: 'Alış adresini, varış noktasını, tarih ve saati girersiniz; Kombi, Van ve büyük taksi fiyatını hemen görürsünüz. Fiyat rezervasyon anında sabitlenir. Ardından rezervasyon numaranızla bir onay e-postası alırsınız.' },
      { h3: '2. Görüntüleme veya iptal', p: '“Rezervasyonu yönet” bölümünde rezervasyon numarası ve e-posta adresinizle yolculuğunuzu görürsünüz. Alıştan 3 saat öncesine kadar iptal ücretsizdir.' },
      { h3: '3. Havalimanında karşılama', p: 'Varışlarda uçuşunuzu takip ederiz. Şoförünüz Terminal 1 veya Terminal 2 geliş salonunda isim tabelasıyla bekler; uçuş gecikirse 60 dakikaya kadar ücretsiz.' },
      { h3: '4. Şoförünüzü canlı takip edin', p: 'Alıştan önce bir bağlantı alırsınız; haritada şoförünüzün o an nerede olduğunu görür, aracın kapıda ne zaman olacağını tam olarak bilirsiniz.' },
      { h3: '5. Ödeme ve fatura', p: 'Nakit veya kredi kartıyla ödersiniz. Firmalar fatura alır; istenirse aylık toplu fatura olarak.' },
      { h3: 'Günün her saati, üç dilde', p: 'Pazar günleri, resmi tatiller ve erken uçuşlar dahil günün 24 saati çalışıyoruz. Telefonda ve WhatsApp’ta Almanca, İngilizce ve Türkçe konuşuyoruz.' },
    ],
    link: { href: '/tr/treffpunkt-flughafen-muenchen', text: 'Münih Havalimanı’ndaki buluşma noktalarını görün' },
  },
};

const VEHICLES: Record<Lang, Guide> = {
  de: {
    eyebrow: 'Fahrzeugwahl',
    h2: 'Welches Fahrzeug passt zu Ihrer Reise?',
    intro:
      'Zählen Sie nicht nur die Personen, sondern auch die Koffer. Vier Erwachsene mit vier großen Koffern sitzen im Van deutlich bequemer als im Kombi. Den Preis für alle drei Fahrzeuge sehen Sie bei der Buchung nebeneinander.',
    blocks: [
      { h3: 'Kombi / Limousine (Mercedes E-Klasse)', p: 'Für 1 bis 3 Personen mit bis zu 3 Koffern und Handgepäck. Die passende Wahl für Einzelreisende, Paare und Geschäftsreisen.' },
      { h3: 'Van (Mercedes Viano)', p: 'Für 4 bis 7 Personen mit bis zu 8 Koffern. Ideal für Familien mit Kinderwagen, kleine Gruppen und Reisende mit Skigepäck.' },
      { h3: 'Großraumtaxi (Mercedes Vito)', p: 'Für Gruppen bis 8 Personen mit bis zu 10 Koffern, zum Beispiel Vereine, Firmengruppen oder Messebesucher. Alle reisen gemeinsam in einem Fahrzeug.' },
      { h3: 'Kindersitze kostenlos', p: 'Babyschale (0 bis 12 Monate), Kindersitz (1 bis 4 Jahre, bis 18 kg) und Sitzerhöhung (4 bis 12 Jahre, bis 36 kg) bringen wir kostenlos mit. Bitte Anzahl und Art bei der Buchung angeben.' },
      { h3: 'Ski, Fahrräder und Sondergepäck', p: 'Skier, Snowboards, Fahrräder oder sperriges Gepäck geben Sie bitte bei der Buchung an, damit wir das passende Fahrzeug einplanen.' },
      { h3: 'Haustiere', p: 'Haustiere fahren in einer geschlossenen Transportbox mit. Bitte bei der Buchung unter Extras angeben. Assistenzhunde sind davon ausgenommen.' },
    ],
    note: 'Alle Fahrzeuge sind voll versichert (Haftpflicht und Vollkasko) und klimatisiert.',
  },
  en: {
    eyebrow: 'Choosing a vehicle',
    h2: 'Which vehicle suits your trip?',
    intro:
      'Count the suitcases as well as the people. Four adults with four large suitcases travel much more comfortably in the van than in the estate car. When you book you see the price of all three vehicles side by side.',
    blocks: [
      { h3: 'Estate car / sedan (Mercedes E-Class)', p: 'For 1 to 3 passengers with up to 3 suitcases plus hand luggage. The right choice for solo travellers, couples and business trips.' },
      { h3: 'Van (Mercedes Viano)', p: 'For 4 to 7 passengers with up to 8 suitcases. Ideal for families with a pushchair, small groups and travellers with ski equipment.' },
      { h3: 'Large taxi (Mercedes Vito)', p: 'For groups of up to 8 passengers with up to 10 suitcases, for example clubs, company groups or trade fair visitors. Everyone travels together in one vehicle.' },
      { h3: 'Free child seats', p: 'Infant carrier (0 to 12 months), child seat (1 to 4 years, up to 18 kg) and booster seat (4 to 12 years, up to 36 kg) are free of charge. Please state number and type when booking.' },
      { h3: 'Skis, bicycles and bulky luggage', p: 'Please mention skis, snowboards, bicycles or bulky luggage when booking so that we can plan the right vehicle.' },
      { h3: 'Pets', p: 'Pets travel in a closed transport box. Please add this under extras when booking. Assistance dogs are exempt.' },
    ],
    note: 'All vehicles are fully insured (liability and comprehensive) and air-conditioned.',
  },
  tr: {
    eyebrow: 'Araç seçimi',
    h2: 'Yolculuğunuza hangi araç uygun?',
    intro:
      'Sadece kişileri değil valizleri de sayın. Dört büyük valizli dört yetişkin, Kombi yerine Van’da çok daha rahat eder. Rezervasyonda üç aracın fiyatını yan yana görürsünüz.',
    blocks: [
      { h3: 'Kombi / Limuzin (Mercedes E-Serisi)', p: '1 ile 3 kişi, en fazla 3 valiz ve el bagajı için. Tek başına seyahat edenler, çiftler ve iş seyahatleri için doğru seçim.' },
      { h3: 'Van (Mercedes Viano)', p: '4 ile 7 kişi, en fazla 8 valiz için. Bebek arabalı aileler, küçük gruplar ve kayak ekipmanıyla seyahat edenler için ideal.' },
      { h3: 'Büyük taksi (Mercedes Vito)', p: '8 kişiye kadar gruplar ve en fazla 10 valiz için; örneğin dernekler, firma grupları veya fuar ziyaretçileri. Herkes tek araçta birlikte gider.' },
      { h3: 'Ücretsiz çocuk koltuğu', p: 'Bebek koltuğu (0–12 ay), çocuk koltuğu (1–4 yaş, 18 kg’a kadar) ve yükseltici (4–12 yaş, 36 kg’a kadar) ücretsizdir. Lütfen rezervasyonda sayısını ve türünü belirtin.' },
      { h3: 'Kayak, bisiklet ve büyük bagaj', p: 'Kayak, snowboard, bisiklet veya hacimli bagajı rezervasyonda belirtin; uygun aracı ona göre planlayalım.' },
      { h3: 'Evcil hayvanlar', p: 'Evcil hayvanlar kapalı bir taşıma kutusunda seyahat eder. Lütfen rezervasyonda ekstralar bölümünde belirtin. Yardımcı köpekler bu kuralın dışındadır.' },
    ],
    note: 'Tüm araçlar tam sigortalıdır (zorunlu ve kasko) ve klimalıdır.',
  },
};

function GuideSection({ g }: { g: Guide }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <span className="text-xs font-bold tracking-widest uppercase block mb-2" style={{ color: '#c9a84c' }}>{g.eyebrow}</span>
      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>{g.h2}</h2>
      <p className="mt-4 max-w-3xl text-sm md:text-base leading-relaxed" style={{ color: '#4a6280' }}>{g.intro}</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        {g.blocks.map((b) => (
          <div key={b.h3} className="border-l-4 pl-5" style={{ borderColor: '#c9a84c' }}>
            <h3 className="text-base font-bold" style={{ color: '#0f1b2d' }}>{b.h3}</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: '#4a6280' }}>{b.p}</p>
          </div>
        ))}
      </div>
      {g.note && <p className="mt-8 text-sm" style={{ color: '#6b7c93' }}>{g.note}</p>}
      {g.link && (
        <Link href={g.link.href} className="mt-6 inline-block text-sm font-semibold underline underline-offset-4" style={{ color: '#1e3a5f' }}>
          {g.link.text}
        </Link>
      )}
    </section>
  );
}

const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

export function AboutGuide({ locale }: { locale: string }) {
  return <GuideSection g={ABOUT[lang(locale)]} />;
}

export function VehiclesGuide({ locale }: { locale: string }) {
  return <GuideSection g={VEHICLES[lang(locale)]} />;
}
