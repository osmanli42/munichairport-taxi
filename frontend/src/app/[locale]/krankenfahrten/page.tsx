import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Building2, CalendarClock, Check, ClipboardList, FileText, HeartPulse, Hospital,
  MessageCircle, Phone, Plane, ShieldCheck, Star, Stethoscope, UserRound, Users, X,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

// Krankenfahrten (seated patient transport): for patients, statutory health insurers (Muster 4),
// Berufsgenossenschaften / Unfallkassen, Rentenversicherung (rehab) and private insurers.
// Billing facts confirmed by the owner (14 Nov 2026): own IK number, direct billing with GKV, BG and
// private insurers. Insurance rules below are general information (Krankentransport-Richtlinie,
// § 60/61 SGB V), not legal advice. No wheelchair-seated or stretcher transports.

const BASE = 'https://flughafen-muenchen.taxi';
const PATH = '/krankenfahrten';
type Lang = 'de' | 'en' | 'tr';
type Props = { params: { locale: string } };
const lang = (l: string): Lang => (l === 'en' || l === 'tr' ? l : 'de');

const META: Record<Lang, { title: string; description: string }> = {
  de: { title: 'Krankenfahrten (sitzend) München & Freising – Abrechnung mit Krankenkasse & BG', description: 'Sitzende Krankenfahrten zu Dialyse, Chemo, Reha, Klinik und Arzt. Direktabrechnung mit Krankenkassen (Muster 4), Berufsgenossenschaften und privaten Versicherungen – eigenes IK, 24/7.' },
  en: { title: 'Seated Patient Transport Munich & Freising – Billing with Health & Accident Insurers', description: 'Seated patient transport to dialysis, chemotherapy, rehab, hospital and doctor. Direct billing with statutory health insurers, Berufsgenossenschaften and private insurers – own IK number, 24/7.' },
  tr: { title: 'Hasta Yolculukları (oturarak) Münih & Freising – Krankenkasse & BG ile faturalama', description: 'Diyaliz, kemoterapi, rehabilitasyon, klinik ve doktora oturarak hasta yolculukları. Krankenkasse, Berufsgenossenschaft ve özel sigortalarla doğrudan faturalama – kendi IK numaramız, 7/24.' },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = lang(params.locale);
  return {
    title: { absolute: META[l].title },
    description: META[l].description,
    alternates: {
      canonical: l === 'de' ? `${BASE}${PATH}` : `${BASE}/${l}${PATH}`,
      languages: { de: `${BASE}${PATH}`, en: `${BASE}/en${PATH}`, tr: `${BASE}/tr${PATH}`, 'x-default': `${BASE}${PATH}` },
    },
    openGraph: { title: META[l].title, description: META[l].description, type: 'article', images: [`${BASE}/images/krankenfahrten/hero.webp`] },
  };
}

const AUD_ICONS = [UserRound, HeartPulse, ShieldCheck, BadgeCheck, Building2, Hospital];
const USE_IMG = ['/images/krankenfahrten/dialyse.webp', '/images/krankenfahrten/rollstuhl.webp', '/images/krankenfahrten/arbeitsunfall.webp', '/images/krankenfahrten/flughafen-klinik.webp'];

function texts(l: Lang) {
  if (l === 'en') return {
    home: 'Home', services: 'Services', crumb: 'Patient transport',
    eyebrow: 'Seated patient transport',
    h1a: 'Patient transport', h1b: 'with time and care',
    sub: 'To dialysis, chemotherapy, rehab, hospital or doctor – we pick you up at your door, help you get in and out and bill directly with your health insurer, Berufsgenossenschaft or private insurance.',
    badges: ['Own IK number', 'Direct billing', 'Help getting in & out', 'Available 24/7'],
    ctaCall: 'Request a ride', ctaWa: 'WhatsApp',
    stats: [['20+', 'years of experience'], ['4.7 ★', 'avg. rating'], ['IK', 'registered for billing'], ['24/7', 'reachable']] as [string, string][],
    audEyebrow: 'Who we drive for', audTitle: 'For patients and payers',
    aud: [
      ['Patients & relatives', 'Regular or one-off rides – door to door, with help and without rush.'],
      ['Statutory health insurers', 'Rides with a doctor’s prescription (Muster 4), billed directly with the insurer.'],
      ['Berufsgenossenschaften & Unfallkassen', 'Rides after a recognised accident at work or on the way to work – to the D-doctor, clinic or therapy.'],
      ['Private insurers & assistance', 'Experience with rides on behalf of private insurers – billing by cost approval or invoice.'],
      ['Hospitals, practices & care homes', 'Discharges, admissions and series rides – we coordinate times with your ward or practice.'],
      ['Rentenversicherung (rehab)', 'Arrival at and return from rehab, also from or to the airport.'],
    ] as [string, string][],
    useEyebrow: 'Typical rides', useTitle: 'What we drive for you',
    uses: [
      ['Dialysis, chemo & radiotherapy', 'Series rides at fixed times – ideally with the same driver.'],
      ['Wheelchair users who can transfer', 'We push you to the car, help you onto the seat and take the folding wheelchair along.'],
      ['After an accident at work', 'Rides to the D-doctor, the clinic or physiotherapy – billed with the Berufsgenossenschaft.'],
      ['Airport ↔ clinic', 'For patients from abroad and their relatives – pickup at the terminal with luggage.'],
    ] as [string, string][],
    billEyebrow: 'Billing', billTitle: 'Who pays – and what you need',
    bills: [
      { title: 'Statutory health insurance', points: ['Doctor’s prescription on Muster 4 (Verordnung einer Krankenbeförderung).', 'Outpatient rides usually need prior approval by your insurer.', 'Usually deemed approved with disability card aG, Bl or H, care level 4 or 5, or care level 3 with permanently impaired mobility.', 'Co-payment by law: 10 % of the fare, min. €5, max. €10 per ride (unless exempt).'] },
      { title: 'Berufsgenossenschaft / Unfallkasse', points: ['Accident at work or on the way to work, recognised by the BG.', 'Please have the name of the BG and, if available, the claim number or cost approval ready.', 'Rides to the D-doctor, the clinic and therapy appointments.', 'We bill directly with the BG or Unfallkasse.'] },
      { title: 'Private insurance & self-payers', points: ['Cover depends on your tariff.', 'With a cost approval we bill the insurer directly.', 'Otherwise you receive an invoice to submit to your insurer.', 'Fixed price agreed before the ride.'] },
    ],
    billNote: 'General information without guarantee. What counts is the decision of your health insurer or payer – if in doubt, ask them before the ride, or call us and we will help.',
    stepsTitle: 'How it works',
    steps: [['Prescription or approval', 'Muster 4 from your doctor, cost approval of the BG or of your private insurer.'], ['Book the ride', 'By phone or WhatsApp – also several dates at once.'], ['Pickup at your door', 'Help getting in and out, waiting or return trip by arrangement.'], ['Billing', 'Directly with the payer – you only pay the statutory co-payment if applicable.']] as [string, string][],
    b2bEyebrow: 'For payers & clinics', b2bTitle: 'A reliable partner for your patients',
    b2b: ['Own IK number for billing with payers', 'Fixed contact person, reachable 24/7', 'Series rides planned in advance', 'Invoice per ride or monthly collective invoice', 'Drivers with experience in caring for patients', 'Experience with rides on behalf of private insurers'],
    b2bCta: 'Discuss cooperation',
    notTitle: 'What we do not offer',
    not: ['Transport while seated in the wheelchair (ramp vehicles)', 'Stretcher transport', 'Ambulance with medical care (KTW) – please contact the rescue service'],
    emergency: 'In an emergency always call 112.',
    faqTitle: 'Frequently asked questions',
    faqs: [
      { q: 'Does my health insurer pay for the taxi?', a: 'Statutory insurers pay for medically necessary rides with a doctor’s prescription (Muster 4). For outpatient treatment prior approval is usually required – except e.g. with disability card aG, Bl or H or care level 4/5. You pay the statutory co-payment of 10 % (min. €5, max. €10).' },
      { q: 'Do I have to pay in advance?', a: 'No, if the prescription or cost approval is valid: we bill directly with the payer. You only pay the statutory co-payment, if any.' },
      { q: 'Who pays after an accident at work?', a: 'If the accident is recognised as an accident at work or on the way to work, the Berufsgenossenschaft or Unfallkasse usually pays the rides. We bill directly with them.' },
      { q: 'Can I take my wheelchair?', a: 'Yes, a folding wheelchair, as long as you can move onto a seat with help. We do not offer transport while seated in the wheelchair.' },
      { q: 'Does the driver wait during treatment?', a: 'For short appointments by arrangement; for longer treatments we pick you up again at the agreed time.' },
      { q: 'Can relatives come along?', a: 'Yes, an accompanying person can usually travel with you – please mention it when booking.' },
    ],
    ctaTitle: 'Request a patient transport', ctaSub: 'Tell us the date, address and payer – we will take care of the rest.',
    waText: 'Hello, I would like to request a patient transport.\nDate & time:\nPickup address:\nDestination (clinic/practice):\nPayer (health insurer / BG / private / self-payer):',
  };
  if (l === 'tr') return {
    home: 'Ana sayfa', services: 'Hizmetler', crumb: 'Hasta yolculukları',
    eyebrow: 'Oturarak hasta yolculukları',
    h1a: 'Hasta yolculukları', h1b: 'özenle ve acele etmeden',
    sub: 'Diyaliz, kemoterapi, rehabilitasyon, klinik veya doktora – sizi kapınızdan alır, binip inerken yardım eder ve Krankenkasse, Berufsgenossenschaft veya özel sigortanızla doğrudan faturalarız.',
    badges: ['Kendi IK numaramız', 'Doğrudan faturalama', 'Binip inerken yardım', '7/24 ulaşılabilir'],
    ctaCall: 'Yolculuk iste', ctaWa: 'WhatsApp',
    stats: [['20+', 'yıllık deneyim'], ['4,7 ★', 'ortalama puan'], ['IK', 'faturalama için kayıtlı'], ['7/24', 'ulaşılabilir']] as [string, string][],
    audEyebrow: 'Kimler için', audTitle: 'Hastalar ve ödeme yapan kurumlar için',
    aud: [
      ['Hastalar & yakınları', 'Düzenli veya tek seferlik yolculuklar – kapıdan kapıya, yardımla ve acele etmeden.'],
      ['Yasal sağlık sigortaları', 'Doktor reçetesiyle (Muster 4) yolculuklar, doğrudan sigortaya faturalanır.'],
      ['Berufsgenossenschaft & Unfallkasse', 'Kabul edilmiş iş veya yol kazası sonrası D-doktora, kliniğe veya terapiye.'],
      ['Özel sigortalar & assistance', 'Özel sigortalar adına yolculuk deneyimi – Kostenzusage veya fatura ile.'],
      ['Klinikler, muayenehaneler & bakım evleri', 'Taburcu, yatış ve seri yolculuklar – saatleri servisinizle koordine ederiz.'],
      ['Rentenversicherung (rehabilitasyon)', 'Rehabilitasyona gidiş ve dönüş, havalimanından veya havalimanına da.'],
    ] as [string, string][],
    useEyebrow: 'Tipik yolculuklar', useTitle: 'Sizin için neler yapıyoruz',
    uses: [
      ['Diyaliz, kemoterapi & radyoterapi', 'Sabit saatlerde seri yolculuklar – mümkünse aynı şoförle.'],
      ['Koltuğa geçebilen tekerlekli sandalye kullanıcıları', 'Sizi araca kadar iter, koltuğa geçmenize yardım eder, katlanır sandalyeyi yanımıza alırız.'],
      ['İş kazası sonrası', 'D-doktora, kliniğe veya fizyoterapiye – Berufsgenossenschaft ile faturalanır.'],
      ['Havalimanı ↔ klinik', 'Yurt dışından gelen hastalar ve yakınları için – terminalden bagajla alış.'],
    ] as [string, string][],
    billEyebrow: 'Faturalama', billTitle: 'Kim öder – ve neye ihtiyacınız var',
    bills: [
      { title: 'Yasal sağlık sigortası', points: ['Doktor reçetesi: Muster 4 (Verordnung einer Krankenbeförderung).', 'Ayakta tedavi yolculukları genelde sigortanın ön onayını gerektirir.', 'aG, Bl veya H işaretli engelli kartı, bakım derecesi 4 veya 5 ya da kalıcı hareket kısıtlılığıyla bakım derecesi 3’te genelde onaylı sayılır.', 'Yasal katkı payı: ücretin %10’u, yolculuk başına en az 5 €, en fazla 10 € (muafiyet yoksa).'] },
      { title: 'Berufsgenossenschaft / Unfallkasse', points: ['BG tarafından kabul edilmiş iş veya yol kazası.', 'BG’nin adını ve varsa dosya numarasını veya Kostenzusage’yi hazır bulundurun.', 'D-doktora, kliniğe ve terapi randevularına yolculuklar.', 'Doğrudan BG veya Unfallkasse’ye faturalarız.'] },
      { title: 'Özel sigorta & kendi ödeyenler', points: ['Kapsam tarifenize bağlıdır.', 'Kostenzusage varsa doğrudan sigortaya faturalarız.', 'Yoksa sigortanıza sunmanız için fatura alırsınız.', 'Sabit fiyat yolculuktan önce belli.'] },
    ],
    billNote: 'Genel bilgidir, garanti değildir. Geçerli olan sigortanızın veya ödeme yapan kurumun kararıdır – emin değilseniz yolculuktan önce onlara sorun ya da bizi arayın, yardımcı olalım.',
    stepsTitle: 'Nasıl işler',
    steps: [['Reçete veya onay', 'Doktorunuzdan Muster 4, BG’nin veya özel sigortanızın Kostenzusage’si.'], ['Yolculuğu ayırtın', 'Telefon veya WhatsApp ile – birden fazla tarih de olur.'], ['Kapıdan alış', 'Binip inerken yardım, anlaşmaya göre bekleme veya dönüş.'], ['Faturalama', 'Doğrudan ödeme yapan kuruma – siz varsa sadece yasal katkı payını ödersiniz.']] as [string, string][],
    b2bEyebrow: 'Kurumlar & klinikler için', b2bTitle: 'Hastalarınız için güvenilir ortak',
    b2b: ['Kurumlarla faturalama için kendi IK numaramız', 'Sabit irtibat kişisi, 7/24 ulaşılabilir', 'Önceden planlanan seri yolculuklar', 'Yolculuk başına fatura veya aylık toplu fatura', 'Hasta bakımında deneyimli şoförler', 'Özel sigortalar adına yolculuk deneyimi'],
    b2bCta: 'İşbirliğini konuşalım',
    notTitle: 'Sunmadıklarımız',
    not: ['Tekerlekli sandalyede oturarak taşıma (rampalı araç)', 'Sedye ile taşıma', 'Tıbbi refakatli hasta nakli (KTW) – lütfen kurtarma servisine başvurun'],
    emergency: 'Acil durumda her zaman 112’yi arayın.',
    faqTitle: 'Sık sorulan sorular',
    faqs: [
      { q: 'Taksiyi sağlık sigortam öder mi?', a: 'Yasal sigortalar tıbben gerekli yolculukları doktor reçetesiyle (Muster 4) öder. Ayakta tedavi için genelde ön onay gerekir – örneğin aG, Bl veya H işaretli engelli kartı ya da bakım derecesi 4/5’te gerekmez. Yasal %10 katkı payını (en az 5 €, en fazla 10 €) siz ödersiniz.' },
      { q: 'Önceden ödeme yapmam gerekiyor mu?', a: 'Reçete veya Kostenzusage geçerliyse hayır: doğrudan ödeme yapan kuruma faturalarız. Siz varsa sadece yasal katkı payını ödersiniz.' },
      { q: 'İş kazasından sonra kim öder?', a: 'Kaza iş veya yol kazası olarak kabul edilirse yolculukları genelde Berufsgenossenschaft veya Unfallkasse öder. Doğrudan onlara faturalarız.' },
      { q: 'Tekerlekli sandalyemi alabilir miyim?', a: 'Evet, katlanır sandalyeyi – yardımla koltuğa geçebildiğiniz sürece. Sandalyede oturarak taşıma sunmuyoruz.' },
      { q: 'Şoför tedavi sırasında bekliyor mu?', a: 'Kısa randevularda anlaşmaya göre; uzun tedavilerde sizi kararlaştırılan saatte tekrar alırız.' },
      { q: 'Yakınlarım gelebilir mi?', a: 'Evet, bir refakatçi genelde birlikte gelebilir – lütfen rezervasyonda belirtin.' },
    ],
    ctaTitle: 'Hasta yolculuğu isteyin', ctaSub: 'Tarihi, adresi ve ödeme yapan kurumu söyleyin – gerisini biz hallederiz.',
    waText: 'Merhaba, hasta yolculuğu istiyorum.\nTarih & saat:\nAlış adresi:\nHedef (klinik/muayenehane):\nÖdeyen (Krankenkasse / BG / özel / kendim):',
  };
  return {
    home: 'Startseite', services: 'Leistungen', crumb: 'Krankenfahrten',
    eyebrow: 'Krankenfahrten (sitzend)',
    h1a: 'Krankenfahrten', h1b: 'mit Zeit und Fürsorge',
    sub: 'Zur Dialyse, Chemo, Reha, in die Klinik oder zum Arzt – wir holen Sie an der Haustür ab, helfen beim Ein- und Aussteigen und rechnen direkt mit Ihrer Krankenkasse, Berufsgenossenschaft oder privaten Versicherung ab.',
    badges: ['Eigenes IK', 'Direktabrechnung', 'Hilfe beim Ein- & Aussteigen', '24/7 erreichbar'],
    ctaCall: 'Fahrt anfragen', ctaWa: 'WhatsApp',
    stats: [['20+', 'Jahre Erfahrung'], ['4,7 ★', 'Ø Bewertung'], ['IK', 'Institutionskennzeichen'], ['24/7', 'erreichbar']] as [string, string][],
    audEyebrow: 'Für wen wir fahren', audTitle: 'Für Patienten und Kostenträger',
    aud: [
      ['Patientinnen, Patienten & Angehörige', 'Regelmäßige oder einmalige Fahrten – von Tür zu Tür, mit Hilfe und ohne Zeitdruck.'],
      ['Gesetzliche Krankenkassen', 'Fahrten mit ärztlicher Verordnung (Muster 4), direkt mit der Kasse abgerechnet.'],
      ['Berufsgenossenschaften & Unfallkassen', 'Fahrten nach anerkanntem Arbeits- oder Wegeunfall – zum D-Arzt, in die Klinik oder zur Therapie.'],
      ['Private Versicherungen & Assistance', 'Erfahrung mit Fahrten im Auftrag privater Versicherer – Abrechnung per Kostenzusage oder Rechnung.'],
      ['Kliniken, Praxen & Pflegeeinrichtungen', 'Entlassungen, Aufnahmen und Serienfahrten – wir stimmen die Zeiten mit Station oder Praxis ab.'],
      ['Rentenversicherung (Reha)', 'An- und Abreise zur Reha, auch vom oder zum Flughafen.'],
    ] as [string, string][],
    useEyebrow: 'Typische Fahrten', useTitle: 'Was wir für Sie fahren',
    uses: [
      ['Dialyse, Chemo- & Strahlentherapie', 'Serienfahrten zu festen Zeiten – möglichst mit demselben Fahrer.'],
      ['Rollstuhlfahrer, die umsetzen können', 'Wir schieben Sie zum Fahrzeug, helfen beim Umsetzen auf den Sitz und nehmen den Faltrollstuhl mit.'],
      ['Nach einem Arbeitsunfall', 'Fahrten zum D-Arzt, in die Klinik oder zur Physiotherapie – Abrechnung mit der Berufsgenossenschaft.'],
      ['Flughafen ↔ Klinik', 'Für Patienten aus dem Ausland und ihre Angehörigen – Abholung am Terminal mit Gepäck.'],
    ] as [string, string][],
    billEyebrow: 'Abrechnung', billTitle: 'Wer zahlt – und was Sie brauchen',
    bills: [
      { title: 'Gesetzliche Krankenkasse', points: ['Ärztliche Verordnung auf Muster 4 (Verordnung einer Krankenbeförderung).', 'Fahrten zur ambulanten Behandlung brauchen in der Regel eine vorherige Genehmigung der Kasse.', 'Als genehmigt gelten sie meist bei Merkzeichen aG, Bl oder H, Pflegegrad 4 oder 5 oder Pflegegrad 3 mit dauerhaft eingeschränkter Mobilität.', 'Gesetzliche Zuzahlung: 10 % des Fahrpreises, mind. 5 €, höchstens 10 € pro Fahrt (sofern keine Befreiung).'] },
      { title: 'Berufsgenossenschaft / Unfallkasse', points: ['Arbeits- oder Wegeunfall, von der BG anerkannt.', 'Bitte Name der BG und – falls vorhanden – Aktenzeichen oder Kostenübernahme bereithalten.', 'Fahrten zum D-Arzt, in die Klinik und zu Therapieterminen.', 'Wir rechnen direkt mit der BG bzw. Unfallkasse ab.'] },
      { title: 'Private Versicherung & Selbstzahler', points: ['Die Erstattung richtet sich nach Ihrem Tarif.', 'Mit Kostenzusage rechnen wir direkt mit dem Versicherer ab.', 'Sonst erhalten Sie eine Rechnung zur Einreichung.', 'Festpreis vor der Fahrt.'] },
    ],
    billNote: 'Allgemeine Informationen ohne Gewähr. Maßgeblich ist die Entscheidung Ihrer Krankenkasse bzw. Ihres Kostenträgers – fragen Sie im Zweifel vor der Fahrt dort nach oder rufen Sie uns an, wir helfen Ihnen gerne.',
    stepsTitle: 'So läuft es ab',
    steps: [['Verordnung oder Zusage', 'Muster 4 vom Arzt, Kostenübernahme der BG oder Zusage Ihrer privaten Versicherung.'], ['Fahrt buchen', 'Telefonisch oder per WhatsApp – auch mehrere Termine auf einmal.'], ['Abholung an der Haustür', 'Hilfe beim Ein- und Aussteigen, Wartezeit oder Rückfahrt nach Absprache.'], ['Abrechnung', 'Direkt mit dem Kostenträger – Sie zahlen höchstens die gesetzliche Zuzahlung.']] as [string, string][],
    b2bEyebrow: 'Für Kostenträger & Kliniken', b2bTitle: 'Ein verlässlicher Partner für Ihre Patienten',
    b2b: ['Eigenes Institutionskennzeichen (IK) für die Abrechnung mit Kostenträgern', 'Fester Ansprechpartner, 24/7 erreichbar', 'Serienfahrten vorausschauend geplant', 'Rechnung pro Fahrt oder monatliche Sammelrechnung', 'Fahrer mit Erfahrung im Umgang mit Patienten', 'Erfahrung mit Fahrten im Auftrag privater Versicherer'],
    b2bCta: 'Zusammenarbeit besprechen',
    notTitle: 'Was wir nicht anbieten',
    not: ['Beförderung im Rollstuhl sitzend (Rampenfahrzeug)', 'Liegendtransporte', 'Krankentransport mit medizinischer Betreuung (KTW) – bitte an den Rettungsdienst wenden'],
    emergency: 'Im Notfall immer 112 wählen.',
    faqTitle: 'Häufige Fragen',
    faqs: [
      { q: 'Zahlt die Krankenkasse das Taxi?', a: 'Gesetzliche Kassen übernehmen medizinisch notwendige Fahrten mit ärztlicher Verordnung (Muster 4). Für ambulante Behandlungen ist meist eine vorherige Genehmigung nötig – nicht z. B. bei Merkzeichen aG, Bl oder H oder Pflegegrad 4/5. Sie zahlen die gesetzliche Zuzahlung von 10 % (mind. 5 €, höchstens 10 €).' },
      { q: 'Muss ich in Vorleistung gehen?', a: 'Nein, wenn Verordnung oder Kostenzusage gültig sind: Wir rechnen direkt mit dem Kostenträger ab. Sie zahlen höchstens die gesetzliche Zuzahlung.' },
      { q: 'Wer zahlt nach einem Arbeitsunfall?', a: 'Ist der Unfall als Arbeits- oder Wegeunfall anerkannt, übernimmt in der Regel die Berufsgenossenschaft bzw. Unfallkasse die Fahrten. Wir rechnen direkt mit ihr ab.' },
      { q: 'Kann ich meinen Rollstuhl mitnehmen?', a: 'Ja, einen Faltrollstuhl – sofern Sie sich mit Hilfe auf einen Sitz umsetzen können. Beförderungen im Rollstuhl sitzend bieten wir nicht an.' },
      { q: 'Wartet der Fahrer während der Behandlung?', a: 'Bei kurzen Terminen nach Absprache; bei längeren Behandlungen holen wir Sie zur vereinbarten Zeit wieder ab.' },
      { q: 'Dürfen Angehörige mitfahren?', a: 'Ja, eine Begleitperson kann in der Regel mitfahren – bitte bei der Buchung angeben.' },
    ],
    ctaTitle: 'Krankenfahrt anfragen', ctaSub: 'Nennen Sie uns Termin, Adresse und Kostenträger – um den Rest kümmern wir uns.',
    waText: 'Hallo, ich möchte eine Krankenfahrt anfragen.\nDatum & Uhrzeit:\nAbholadresse:\nZiel (Klinik/Praxis):\nKostenträger (Krankenkasse / BG / privat / Selbstzahler):',
  };
}

export default function KrankenfahrtenPage({ params }: Props) {
  const l = lang(params.locale);
  const prefix = l === 'de' ? '' : `/${l}`;
  const t = texts(l);
  const url = `${BASE}${prefix}${PATH}`;
  const wa = `${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(t.waText)}`;
  const BILL_ICONS = [HeartPulse, ShieldCheck, FileText];
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org', '@type': 'Service', serviceType: t.eyebrow, name: t.crumb, url,
      provider: { '@type': 'LocalBusiness', name: 'Flughafen-München.TAXI', telephone: CONTACT_INFO.phone, url: BASE },
      areaServed: [{ '@type': 'City', name: 'München' }, { '@type': 'City', name: 'Freising' }, { '@type': 'State', name: 'Bayern' }],
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${BASE}${prefix}` },
      { '@type': 'ListItem', position: 2, name: t.services, item: `${BASE}${prefix}/leistungen` },
      { '@type': 'ListItem', position: 3, name: t.crumb, item: url },
    ] },
  ];

  return (
    <div className="bg-white">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/krankenfahrten/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[78%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/75 to-primary-900/5" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:pb-24 lg:px-8">
          <nav className="mb-10 flex flex-wrap items-center gap-1.5 text-xs text-white/75">
            <Link href={prefix || '/'} className="hover:text-white">{t.home}</Link><ArrowRight size={12} />
            <Link href={`${prefix}/leistungen`} className="hover:text-white">{t.services}</Link><ArrowRight size={12} />
            <span className="text-white">{t.crumb}</span>
          </nav>
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{t.eyebrow}</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
              {t.h1a} <span className="text-gold-400">{t.h1b}</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/90 drop-shadow">{t.sub}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.badges.map((b) => (
                <li key={b} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
                  <Check size={13} className="text-gold-400" /> {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-4 text-lg font-bold text-primary-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-gold-300"><Phone size={20} /> {t.ctaCall}</a>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-7 py-4 text-lg font-bold text-white transition hover:bg-green-600"><MessageCircle size={20} /> {t.ctaWa}</a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-gray-100 bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
          {t.stats.map(([big, small]) => (
            <div key={small} className="text-center">
              <dt className="text-3xl font-extrabold text-primary-800">{big}</dt>
              <dd className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{small}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Audiences */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-600">{t.audEyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{t.audTitle}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.aud.map(([title, text], i) => {
              const Icon = AUD_ICONS[i];
              return (
                <div key={title} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-300">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition group-hover:bg-gold-400 group-hover:text-primary-900"><Icon size={22} /></span>
                  <h3 className="mt-4 font-extrabold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases with photos */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-600">{t.useEyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{t.useTitle}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.uses.map(([title, text], i) => (
              <div key={title} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-xl">
                <div className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={USE_IMG[i]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                </div>
                <div className="p-5">
                  <h3 className="font-extrabold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Billing */}
      <section className="bg-primary-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-400">{t.billEyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{t.billTitle}</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {t.bills.map((b, i) => {
              const Icon = BILL_ICONS[i];
              return (
                <div key={b.title} className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/15">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-primary-900"><Icon size={21} /></span>
                    <h3 className="text-lg font-extrabold">{b.title}</h3>
                  </div>
                  <ul className="mt-5 space-y-3">
                    {b.points.map((p) => <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-white/85"><Check size={16} className="mt-0.5 shrink-0 text-gold-400" /> {p}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-white/60">{t.billNote}</p>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{t.stepsTitle}</h2>
          <ol className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-5">
            <span className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-0.5 bg-gradient-to-r from-gold-400/20 via-gold-400 to-gold-400/20 md:block" aria-hidden="true" />
            {t.steps.map(([title, text], i) => {
              const Icon = [ClipboardList, CalendarClock, UserRound, FileText][i];
              return (
                <li key={title} className="relative text-center">
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-900 text-gold-400 shadow-lg">
                    <Icon size={24} />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-xs font-extrabold text-primary-900">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-bold text-gray-900">{title}</h3>
                  <p className="mx-auto mt-1 max-w-[16rem] text-sm text-gray-600">{text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* For payers & clinics + not offered */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary-900 to-primary-800 p-8 text-white shadow-xl md:p-10">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{t.b2bEyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{t.b2bTitle}</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {t.b2b.map((x, i) => {
                const Icon = [BadgeCheck, Phone, CalendarClock, FileText, Stethoscope, Users][i];
                return <li key={x} className="flex gap-3 text-sm text-white/90"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon size={16} className="text-gold-400" /></span>{x}</li>;
              })}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={`mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(t.b2bCta)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-primary-900 hover:bg-gold-300">{t.b2bCta} <ArrowRight size={18} /></a>
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold ring-1 ring-white/30 hover:bg-white/10"><Phone size={18} /> {CONTACT_INFO.phone}</a>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl bg-gray-50 p-7 ring-1 ring-gray-200">
              <h3 className="text-lg font-extrabold text-gray-900">{t.notTitle}</h3>
              <ul className="mt-4 space-y-3">
                {t.not.map((x) => <li key={x} className="flex gap-2.5 text-sm text-gray-700"><X size={17} className="mt-0.5 shrink-0 text-red-500" /> {x}</li>)}
              </ul>
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t.emergency}</p>
            </div>
            <div className="flex items-center gap-4 rounded-3xl bg-gold-400/10 p-6 ring-1 ring-gold-400/30">
              <span className="text-4xl font-extrabold text-primary-900">4,7</span>
              <div>
                <div className="flex text-gold-500">{[0, 1, 2, 3, 4].map((k) => <Star key={k} size={16} fill="currentColor" />)}</div>
                <p className="text-xs text-gray-600">{t.stats[1][1]}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{t.faqTitle}</h2>
          <div className="mt-10 space-y-3">
            {t.faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 open:ring-gold-300">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-gray-900">
                  {f.q}<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg leading-none text-gray-500 transition group-open:rotate-45 group-open:bg-gold-400 group-open:text-primary-900">+</span>
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/krankenfahrten/rollstuhl.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/90 to-primary-900/60" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.ctaTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-white/85">{t.ctaSub}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-4 text-lg font-bold text-primary-900 hover:bg-gold-300"><Phone size={20} /> {CONTACT_INFO.phone}</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-7 py-4 text-lg font-bold text-white hover:bg-green-600"><MessageCircle size={20} /> {t.ctaWa}</a>
          </div>
          <p className="mt-6 text-sm text-white/70">{CONTACT_INFO.email}</p>
        </div>
      </section>
    </div>
  );
}
