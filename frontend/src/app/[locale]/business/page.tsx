'use client';

import { useState, useEffect } from 'react';
import {
  Phone, Mail, FileText, UserCheck, Users, Shield, Clock, Tag, Globe, CheckCircle, Star,
  Zap, Receipt, FileDown, PlaneTakeoff, BarChart3, Lock, Headphones,
  ArrowRight, LogIn, Building2, Briefcase, Plane, CalendarClock, MessageCircle,
} from 'lucide-react';
import Link from 'next/link';
import { CONTACT_INFO } from '@/lib/utils';
import { useLocale } from 'next-intl';

const content = {
  de: {
    hero_badge1: '20+ Jahre Erfahrung',
    hero_badge2: 'TÜV-geprüft',
    hero_badge3: 'Behördlich konzessioniert',
    hero_title: 'Firmenkundenportal',
    hero_subtitle: 'Buchen Sie Fahrten für Ihre Gäste in Sekunden, zahlen Sie bequem auf Rechnung und behalten Sie mit dem Sammelrechnungs-Portal jederzeit den Überblick.',
    cta_apply: 'Jetzt Firmenkonto beantragen',
    cta_login: 'Portal-Login',
    applications_closed: 'Aktuell nehmen wir keine neuen Firmenanmeldungen an. Bestehende Firmenkunden können sich wie gewohnt einloggen.',

    features_title: 'Alles, was Ihr Unternehmen braucht',
    features_subtitle: 'Ein Portal für Buchung, Abrechnung und Kontrolle',
    features: [
      { icon: Zap, title: '60-Sekunden-Buchung', text: 'Buchung für Ihre Gäste in weniger als einer Minute erledigt' },
      { icon: Receipt, title: 'Zahlung auf Rechnung', text: 'Monatliche Sammelrechnung statt Einzelzahlung pro Fahrt' },
      { icon: FileDown, title: 'PDF-Rechnungen', text: 'Jede Fahrt und jede Sammelrechnung als PDF mit einem Klick' },
      { icon: Users, title: 'Mehrere Nutzer', text: 'Rezeption, Assistenz und Kollegen mit eigenem Zugang' },
      { icon: Tag, title: 'Kostenstelle & Referenz', text: 'Jede Fahrt einer Abteilung oder einem Gast zuordnen' },
      { icon: PlaneTakeoff, title: 'Automatische Flugüberwachung', text: 'Verspätungen werden automatisch erkannt und berücksichtigt' },
      { icon: BarChart3, title: 'CSV-Export & Statistik', text: 'Monatliche Auswertungen für Ihre Buchhaltung' },
      { icon: Star, title: 'Favoriten-Strecken', text: 'Häufige Fahrten mit einem Klick erneut buchen' },
      { icon: Lock, title: 'SSL & DSGVO', text: 'Verschlüsselte Datenübertragung, volle Datenschutz-Konformität' },
      { icon: Headphones, title: '24/7 Priority-Support', text: 'Persönlicher Ansprechpartner rund um die Uhr' },
    ],

    how_title: 'So einfach geht\'s',
    steps: [
      { icon: Briefcase, title: 'Antrag stellen', text: 'Firmendaten in 2 Minuten übermitteln' },
      { icon: CheckCircle, title: 'Freischaltung erhalten', text: 'Nach Prüfung erhalten Sie Ihre Zugangsdaten per E-Mail' },
      { icon: Zap, title: 'Direkt buchen', text: 'Erste Fahrt für Ihre Gäste in Sekunden reservieren' },
    ],

    audience_title: 'Für wen sich das Portal lohnt',
    audiences: [
      { icon: Building2, label: 'Hotels' },
      { icon: Briefcase, label: 'Unternehmen' },
      { icon: Plane, label: 'Reisebüros' },
      { icon: CalendarClock, label: 'Eventagenturen' },
    ],

    services_title: 'Unsere Business-Leistungen im Detail',
    services_eyebrow: 'Business Travel · Airport Transfers · Premium Service',
    services_title_1: 'Unsere Business-Leistungen',
    services_title_2: 'im Detail',
    services_subtitle: 'Drei Lösungen – ein Ziel: Ihre Mobilität. Einfach. Professionell. Zuverlässig.',
    services_popular: 'Am beliebtesten',
    services_cta_primary: 'Jetzt anfragen',
    services_cta_secondary: 'Mehr erfahren',
    services_tags: [
      ['Effizient', 'Transparent', 'Planbar'],
      ['Persönlich', 'Professionell', 'Starker erster Eindruck'],
      ['Zuverlässig', 'Diskret', 'Flexibel', 'Deutschlandweit'],
    ],
    services_trust: [
      { icon: Shield, big: '100%', small: 'Zuverlässigkeit' },
      { icon: Clock, big: '24/7', small: 'Für Sie im Einsatz' },
      { icon: Plane, big: 'Echtzeit-', small: 'Flugverfolgung' },
      { icon: Users, big: 'Firmenkunden', small: 'willkommen' },
    ],
    services: [
      {
        icon: FileText,
        title: 'Sammelrechnung',
        subtitle: 'Einfache Abrechnung für Ihr Unternehmen',
        description: 'Alle Fahrten Ihrer Mitarbeiter werden auf einer übersichtlichen Sammelrechnung zusammengefasst. Monatliche Abrechnung, keine versteckten Kosten – perfekt für die Buchhaltung.',
        features: ['Monatliche Gesamtrechnung', 'Detaillierte Fahrtenaufstellung', 'Steuerlich absetzbar', 'Keine versteckten Gebühren'],
        color: 'bg-blue-50 border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'Abholung mit Abholschild',
        subtitle: 'Professionelle Begrüßung im Terminal',
        description: 'Unser Fahrer erwartet Ihre Gäste persönlich im Ankunftsbereich mit einem Schild mit dem Namen des Gastes. Ein professioneller erster Eindruck für Ihre Geschäftspartner.',
        features: ['Namentliches Abholschild', 'Direkter Empfang im Terminal', 'Echtzeit-Flugverfolgung', '60 Min. kostenlose Wartezeit'],
        color: 'bg-gold-50 border-yellow-200', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'Geschäftspartner & Mitarbeiter',
        subtitle: 'Zuverlässige Abholung Ihrer Gäste',
        description: 'Wir holen Ihre Geschäftspartner, Kunden und Mitarbeiter pünktlich ab und bringen sie sicher ans Ziel. Diskreter, professioneller Service – der beste erste Eindruck für Ihr Unternehmen.',
        features: ['Mehrsprachige Fahrer (DE/EN/TR)', 'Diskret und professionell', 'Pünktliche Abholung garantiert', 'Fahrt in ganz Bayern & Österreich'],
        color: 'bg-green-50 border-green-200', iconBg: 'bg-green-100', iconColor: 'text-green-600',
      },
    ],
    why_title: 'Warum Unternehmen uns vertrauen',
    advantages: [
      { icon: Shield, title: 'Vollversichert', text: 'Alle Fahrzeuge mit Haftpflicht & Vollkasko' },
      { icon: Clock, title: '24/7 Verfügbar', text: 'Auch nachts und an Feiertagen' },
      { icon: Tag, title: 'Festpreise', text: 'Transparente Festpreise – vorab kalkuliert' },
      { icon: Globe, title: 'Mehrsprachig', text: 'Deutsch, Englisch und Türkisch' },
      { icon: Star, title: '20 Jahre Erfahrung', text: 'Erfahrener Flughafentransfer-Service' },
      { icon: CheckCircle, title: 'Pünktlichkeit', text: 'Flugverfolgung & garantierte Pünktlichkeit' },
    ],
    cta_title: 'Business-Anfrage stellen',
    cta_text: 'Kontaktieren Sie uns für ein individuelles Angebot oder regelmäßige Buchungen. Wir erstellen Ihnen gerne ein maßgeschneidertes Business-Paket.',
    cta_call: 'Jetzt anrufen',
    cta_email: 'E-Mail senden',
    cta_whatsapp: 'WhatsApp',
  },
  en: {
    hero_badge1: '20+ years of experience',
    hero_badge2: 'TÜV-inspected',
    hero_badge3: 'Officially licensed',
    hero_title: 'Corporate Client Portal',
    hero_subtitle: 'Book rides for your guests in seconds, pay conveniently by invoice, and keep full control with the collective-invoice portal.',
    cta_apply: 'Apply for a company account',
    cta_login: 'Portal login',
    applications_closed: 'We are currently not accepting new company applications. Existing corporate clients can log in as usual.',

    features_title: 'Everything your company needs',
    features_subtitle: 'One portal for booking, billing and control',
    features: [
      { icon: Zap, title: '60-second booking', text: 'Book a ride for your guests in under a minute' },
      { icon: Receipt, title: 'Pay by invoice', text: 'Monthly collective invoice instead of paying per ride' },
      { icon: FileDown, title: 'PDF invoices', text: 'Every ride and every collective invoice as PDF with one click' },
      { icon: Users, title: 'Multiple users', text: 'Reception, assistants and colleagues each get their own login' },
      { icon: Tag, title: 'Cost center & reference', text: 'Assign every ride to a department or guest' },
      { icon: PlaneTakeoff, title: 'Automatic flight tracking', text: 'Delays are automatically detected and factored in' },
      { icon: BarChart3, title: 'CSV export & stats', text: 'Monthly reports for your accounting' },
      { icon: Star, title: 'Favorite routes', text: 'Rebook frequent trips with a single click' },
      { icon: Lock, title: 'SSL & GDPR', text: 'Encrypted data transfer, full data protection compliance' },
      { icon: Headphones, title: '24/7 priority support', text: 'A personal contact around the clock' },
    ],

    how_title: 'It\'s that simple',
    steps: [
      { icon: Briefcase, title: 'Submit application', text: 'Share your company details in 2 minutes' },
      { icon: CheckCircle, title: 'Get approved', text: 'Receive your login details by email after review' },
      { icon: Zap, title: 'Book right away', text: 'Reserve your first guest ride in seconds' },
    ],

    audience_title: 'Who benefits from the portal',
    audiences: [
      { icon: Building2, label: 'Hotels' },
      { icon: Briefcase, label: 'Companies' },
      { icon: Plane, label: 'Travel agencies' },
      { icon: CalendarClock, label: 'Event agencies' },
    ],

    services_title: 'Our business services in detail',
    services_eyebrow: 'Business Travel · Airport Transfers · Premium Service',
    services_title_1: 'Our business services',
    services_title_2: 'in detail',
    services_subtitle: 'Three solutions – one goal: your mobility. Simple. Professional. Reliable.',
    services_popular: 'Most popular',
    services_cta_primary: 'Request now',
    services_cta_secondary: 'Learn more',
    services_tags: [
      ['Efficient', 'Transparent', 'Plannable'],
      ['Personal', 'Professional', 'Strong first impression'],
      ['Reliable', 'Discreet', 'Flexible', 'Nationwide'],
    ],
    services_trust: [
      { icon: Shield, big: '100%', small: 'Reliability' },
      { icon: Clock, big: '24/7', small: 'At your service' },
      { icon: Plane, big: 'Real-time', small: 'flight tracking' },
      { icon: Users, big: 'Corporate clients', small: 'welcome' },
    ],
    services: [
      {
        icon: FileText,
        title: 'Collective Invoice',
        subtitle: 'Simple billing for your company',
        description: 'All rides of your employees are summarized on one clear collective invoice. Monthly billing, no hidden costs – perfect for accounting.',
        features: ['Monthly collective invoice', 'Detailed ride breakdown', 'Tax deductible', 'No hidden fees'],
        color: 'bg-blue-50 border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'Pickup with Name Sign',
        subtitle: 'Professional greeting at the terminal',
        description: 'Our driver personally awaits your guests in the arrivals area with a sign bearing the guest\'s name. A professional first impression for your business partners.',
        features: ['Personal name sign', 'Direct reception at terminal', 'Real-time flight tracking', '60 min. free waiting time'],
        color: 'bg-gold-50 border-yellow-200', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'Business Partners & Employees',
        subtitle: 'Reliable pickup of your guests',
        description: 'We pick up your business partners, clients and employees punctually and bring them safely to their destination. Discreet, professional service – the best first impression for your company.',
        features: ['Multilingual drivers (DE/EN/TR)', 'Discreet and professional', 'Punctual pickup guaranteed', 'Travel throughout Bavaria & Austria'],
        color: 'bg-green-50 border-green-200', iconBg: 'bg-green-100', iconColor: 'text-green-600',
      },
    ],
    why_title: 'Why Companies Trust Us',
    advantages: [
      { icon: Shield, title: 'Fully Insured', text: 'All vehicles with liability & comprehensive' },
      { icon: Clock, title: '24/7 Available', text: 'Also at night and on holidays' },
      { icon: Tag, title: 'Fixed Prices', text: 'Transparent fixed prices – calculated in advance' },
      { icon: Globe, title: 'Multilingual', text: 'German, English and Turkish' },
      { icon: Star, title: '20 Years Experience', text: 'Experienced airport transfer service' },
      { icon: CheckCircle, title: 'Punctuality', text: 'Flight tracking & guaranteed punctuality' },
    ],
    cta_title: 'Submit Business Inquiry',
    cta_text: 'Contact us for a custom offer or regular bookings. We are happy to create a tailored business package for you.',
    cta_call: 'Call now',
    cta_email: 'Send email',
    cta_whatsapp: 'WhatsApp',
  },
  tr: {
    hero_badge1: '20+ Yıllık Deneyim',
    hero_badge2: 'TÜV Onaylı',
    hero_badge3: 'Resmi Lisanslı',
    hero_title: 'Firmenkundenportal',
    hero_subtitle: 'Misafirleriniz için saniyeler içinde rezervasyon yapın, faturalı ödeyin ve toplu fatura portalıyla her zaman kontrolü elinizde tutun.',
    cta_apply: 'Firma Hesabı Başvurusu Yap',
    cta_login: 'Portal Girişi',
    applications_closed: 'Şu anda yeni firma başvurusu kabul etmiyoruz. Mevcut firma müşterileri her zamanki gibi giriş yapabilir.',

    features_title: 'Firmanızın ihtiyaç duyduğu her şey',
    features_subtitle: 'Rezervasyon, faturalama ve kontrol için tek portal',
    features: [
      { icon: Zap, title: '60 Saniyede Rezervasyon', text: 'Misafirleriniz için bir dakikadan kısa sürede rezervasyon' },
      { icon: Receipt, title: 'Faturalı Ödeme', text: 'Yolculuk başına ödeme yerine aylık toplu fatura' },
      { icon: FileDown, title: 'PDF Faturalar', text: 'Her yolculuk ve her toplu fatura tek tıkla PDF olarak' },
      { icon: Users, title: 'Çoklu Kullanıcı', text: 'Resepsiyon, asistan ve meslektaşlar için ayrı girişler' },
      { icon: Tag, title: 'Kostenstelle/Referans', text: 'Her yolculuğu bir departmana veya misafire atayın' },
      { icon: PlaneTakeoff, title: 'Otomatik Uçuş Takibi', text: 'Rötarlar otomatik tespit edilir ve dikkate alınır' },
      { icon: BarChart3, title: 'CSV Dışa Aktarma & İstatistik', text: 'Muhasebeniz için aylık raporlar' },
      { icon: Star, title: 'Favori Güzergahlar', text: 'Sık yapılan yolculukları tek tıkla yeniden rezerve edin' },
      { icon: Lock, title: 'SSL & KVKK/DSGVO', text: 'Şifreli veri aktarımı, tam veri koruma uyumu' },
      { icon: Headphones, title: '7/24 Öncelikli Destek', text: 'Her an ulaşabileceğiniz kişisel bir iletişim noktası' },
    ],

    how_title: 'Bu kadar kolay',
    steps: [
      { icon: Briefcase, title: 'Başvuru Yapın', text: 'Firma bilgilerinizi 2 dakikada iletin' },
      { icon: CheckCircle, title: 'Onay Alın', text: 'İnceleme sonrası giriş bilgileriniz e-posta ile gelir' },
      { icon: Zap, title: 'Hemen Rezervasyon Yapın', text: 'İlk misafir yolculuğunuzu saniyeler içinde ayırtın' },
    ],

    audience_title: 'Portal kimler için avantajlı',
    audiences: [
      { icon: Building2, label: 'Oteller' },
      { icon: Briefcase, label: 'Şirketler' },
      { icon: Plane, label: 'Seyahat Acenteleri' },
      { icon: CalendarClock, label: 'Etkinlik Ajansları' },
    ],

    services_title: 'Business hizmetlerimizin detayları',
    services_eyebrow: 'İş Seyahati · Havalimanı Transferi · Premium Hizmet',
    services_title_1: 'Business hizmetlerimizin',
    services_title_2: 'detayları',
    services_subtitle: 'Üç çözüm – tek hedef: mobiliteniz. Basit. Profesyonel. Güvenilir.',
    services_popular: 'En çok tercih edilen',
    services_cta_primary: 'Hemen talep edin',
    services_cta_secondary: 'Detaylı bilgi',
    services_tags: [
      ['Verimli', 'Şeffaf', 'Planlanabilir'],
      ['Kişisel', 'Profesyonel', 'Güçlü ilk izlenim'],
      ['Güvenilir', 'Gizlilik', 'Esnek', 'Tüm Almanya'],
    ],
    services_trust: [
      { icon: Shield, big: '100%', small: 'Güvenilirlik' },
      { icon: Clock, big: '24/7', small: 'Hizmetinizde' },
      { icon: Plane, big: 'Gerçek zamanlı', small: 'uçuş takibi' },
      { icon: Users, big: 'Kurumsal müşteriler', small: 'hoş geldiniz' },
    ],
    services: [
      {
        icon: FileText,
        title: 'Toplu Fatura (Sammelrechnung)',
        subtitle: 'Firmanız için kolay faturalama',
        description: 'Çalışanlarınızın tüm yolculukları tek bir düzenli toplu faturada toplanır. Aylık faturalama, gizli maliyet yok – muhasebe için mükemmel.',
        features: ['Aylık toplu fatura', 'Detaylı yolculuk dökümü', 'Vergiden düşülebilir', 'Gizli ücret yok'],
        color: 'bg-blue-50 border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'İsim Tabelasıyla Karşılama',
        subtitle: 'Terminalde profesyonel karşılama',
        description: 'Sürücümüz misafirlerinizi varış alanında isimlerinin yazılı olduğu bir tabelayla kişisel olarak karşılar. İş ortaklarınıza profesyonel bir ilk izlenim.',
        features: ['Kişisel isim tabelası', 'Terminalde doğrudan karşılama', 'Gerçek zamanlı uçuş takibi', '60 dak. ücretsiz bekleme'],
        color: 'bg-gold-50 border-yellow-200', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'İş Ortakları & Çalışanlar',
        subtitle: 'Misafirlerinizin güvenilir transferi',
        description: 'İş ortaklarınızı, müşterilerinizi ve çalışanlarınızı zamanında alır, güvenle hedefe ulaştırırız. Diskreet, profesyonel hizmet – firmanız için en iyi ilk izlenim.',
        features: ['Çok dilli sürücüler (DE/EN/TR)', 'Diskreet ve profesyonel', 'Dakik karşılama garantili', 'Tüm Bavyera & Avusturya'],
        color: 'bg-green-50 border-green-200', iconBg: 'bg-green-100', iconColor: 'text-green-600',
      },
    ],
    why_title: 'Firmalar Neden Bize Güveniyor',
    advantages: [
      { icon: Shield, title: 'Tam Sigortalı', text: 'Tüm araçlar sorumluluk & kasko sigortası' },
      { icon: Clock, title: '7/24 Hizmet', text: 'Geceleri ve tatil günlerinde de' },
      { icon: Tag, title: 'Sabit Fiyat', text: 'Şeffaf sabit fiyatlar – önceden hesaplanır' },
      { icon: Globe, title: 'Çok Dilli', text: 'Almanca, İngilizce ve Türkçe' },
      { icon: Star, title: '20 Yıl Deneyim', text: 'Deneyimli havalimanı transfer hizmeti' },
      { icon: CheckCircle, title: 'Dakiklik', text: 'Uçuş takibi & garantili dakiklik' },
    ],
    cta_title: 'Business Teklif Alın',
    cta_text: 'Özel teklif veya düzenli rezervasyonlar için bizimle iletişime geçin. Size özel bir business paketi oluşturmaktan memnuniyet duyarız.',
    cta_call: 'Şimdi ara',
    cta_email: 'E-posta gönder',
    cta_whatsapp: 'WhatsApp',
  },
};

// Additional texts for the redesigned lower part of the page (portal groups, audiences, trust, FAQ).
const extra = {
  de: {
    portal_eyebrow: 'Das Firmenkundenportal',
    groups: ['Buchen', 'Abrechnen', 'Sicherheit & Service'],
    portal_note: 'Lieber ohne Portal? Buchungen per Telefon, WhatsApp oder E-Mail laufen genauso über Ihr Firmenkonto.',
    how_eyebrow: 'In drei Schritten',
    audience_eyebrow: 'Für wen',
    audience_texts: [
      'Gäste-Transfers direkt von der Rezeption buchen – mit Namensschild am Terminal und Abrechnung über das Hotel.',
      'Dienstreisen von Mitarbeitern, Besuch von Kunden und Bewerbern – alles auf einer monatlichen Sammelrechnung.',
      'Flughafentransfers für Ihre Reisenden zum Festpreis – auch für Familien und Gruppen im Van.',
      'Mehrere Fahrzeuge für Gäste und Referenten, abgestimmt auf Ihren Ablaufplan – von der Ankunft bis zur Rückfahrt.',
    ],
    trust_eyebrow: 'Vertrauen',
    trust_text: 'Wir sind ein konzessioniertes Taxiunternehmen aus der Flughafenregion München. Unsere Fahrer kennen den Flughafen, die Messe und die Hotels der Stadt – und behandeln Ihre Gäste so, wie Sie es selbst tun würden.',
    rating: 'Ø Bewertung unserer Fahrgäste',
    faq_title: 'Häufige Fragen von Firmenkunden',
    faqs: [
      { q: 'Wer kann ein Firmenkonto beantragen?', a: 'Unternehmen, Hotels, Reisebüros und Agenturen. Nach dem Antrag prüfen wir Ihre Firmendaten und schicken Ihnen die Zugangsdaten per E-Mail.' },
      { q: 'Wie wird abgerechnet?', a: 'Alle Fahrten eines Monats werden auf einer Sammelrechnung zusammengefasst. Jede Fahrt und jede Sammelrechnung können Sie als PDF herunterladen.' },
      { q: 'Können mehrere Mitarbeiter buchen?', a: 'Ja. Rezeption, Assistenz und Kollegen erhalten eigene Zugänge, und jede Fahrt lässt sich einer Kostenstelle oder Referenz zuordnen.' },
      { q: 'Was passiert, wenn ein Flug Verspätung hat?', a: 'Wir verfolgen den Flug automatisch und passen die Abholung an. Ab der Landung sind 60 Minuten Wartezeit kostenlos.' },
      { q: 'Können wir auch ohne Portal buchen?', a: 'Natürlich – per Telefon, WhatsApp oder E-Mail. Die Fahrt wird trotzdem Ihrem Firmenkonto zugeordnet.' },
    ],
    cta_eyebrow: 'Persönlicher Ansprechpartner',
  },
  en: {
    portal_eyebrow: 'The corporate client portal',
    groups: ['Booking', 'Billing', 'Security & service'],
    portal_note: 'Prefer not to use the portal? Bookings by phone, WhatsApp or e-mail are charged to your company account just the same.',
    how_eyebrow: 'In three steps',
    audience_eyebrow: 'Who it is for',
    audience_texts: [
      'Book guest transfers straight from the front desk – with a name sign at the terminal and billing via the hotel.',
      'Business trips of employees, visits of clients and applicants – all on one monthly collective invoice.',
      'Airport transfers for your travellers at a fixed price – also for families and groups in a van.',
      'Several vehicles for guests and speakers, matched to your schedule – from arrival to the return trip.',
    ],
    trust_eyebrow: 'Trust',
    trust_text: 'We are a licensed taxi company from the Munich Airport region. Our drivers know the airport, the trade fair and the city’s hotels – and treat your guests the way you would yourself.',
    rating: 'avg. rating from our passengers',
    faq_title: 'FAQ for corporate clients',
    faqs: [
      { q: 'Who can apply for a company account?', a: 'Companies, hotels, travel agencies and agencies. After your application we check your company details and send you your login by e-mail.' },
      { q: 'How is billing done?', a: 'All rides of a month are combined on one collective invoice. You can download every ride and every collective invoice as a PDF.' },
      { q: 'Can several employees book?', a: 'Yes. Reception, assistants and colleagues get their own logins, and every ride can be assigned to a cost centre or reference.' },
      { q: 'What happens if a flight is delayed?', a: 'We track the flight automatically and adjust the pickup. From landing, 60 minutes of waiting time are free.' },
      { q: 'Can we book without the portal?', a: 'Of course – by phone, WhatsApp or e-mail. The ride is still assigned to your company account.' },
    ],
    cta_eyebrow: 'Personal contact',
  },
  tr: {
    portal_eyebrow: 'Firma müşteri portalı',
    groups: ['Rezervasyon', 'Faturalama', 'Güvenlik & hizmet'],
    portal_note: 'Portal kullanmak istemiyor musunuz? Telefon, WhatsApp veya e-postayla yapılan rezervasyonlar da firma hesabınıza işlenir.',
    how_eyebrow: 'Üç adımda',
    audience_eyebrow: 'Kimler için',
    audience_texts: [
      'Misafir transferlerini doğrudan resepsiyondan ayırtın – terminalde isim tabelası, faturalama otel üzerinden.',
      'Çalışanların iş seyahatleri, müşteri ve aday ziyaretleri – hepsi tek aylık toplu faturada.',
      'Yolcularınız için sabit fiyatlı havalimanı transferi – aileler ve gruplar için van ile de.',
      'Misafir ve konuşmacılar için programınıza göre birden fazla araç – varıştan dönüşe kadar.',
    ],
    trust_eyebrow: 'Güven',
    trust_text: 'Münih Havalimanı bölgesinden ruhsatlı bir taksi firmasıyız. Şoförlerimiz havalimanını, fuarı ve şehrin otellerini tanır – misafirlerinize sizin davranacağınız gibi davranır.',
    rating: 'yolcularımızın ortalama puanı',
    faq_title: 'Firma müşterilerinden sık sorular',
    faqs: [
      { q: 'Kimler firma hesabı açabilir?', a: 'Şirketler, oteller, seyahat acenteleri ve ajanslar. Başvurudan sonra firma bilgilerinizi kontrol eder, giriş bilgilerinizi e-postayla göndeririz.' },
      { q: 'Faturalama nasıl yapılır?', a: 'Bir aydaki tüm yolculuklar tek toplu faturada birleştirilir. Her yolculuğu ve her toplu faturayı PDF olarak indirebilirsiniz.' },
      { q: 'Birden fazla çalışan rezervasyon yapabilir mi?', a: 'Evet. Resepsiyon, asistan ve meslektaşlar kendi girişlerini alır; her yolculuk bir masraf yerine veya referansa atanabilir.' },
      { q: 'Uçuş rötar yaparsa ne olur?', a: 'Uçuşu otomatik takip eder ve alış saatini uyarlarız. İnişten itibaren 60 dakika bekleme ücretsizdir.' },
      { q: 'Portal olmadan da rezervasyon yapabilir miyiz?', a: 'Elbette – telefon, WhatsApp veya e-postayla. Yolculuk yine firma hesabınıza işlenir.' },
    ],
    cta_eyebrow: 'Kişisel irtibat',
  },
};

const FEATURE_GROUPS = [[0, 3, 7, 5], [1, 2, 4, 6], [8, 9]];
const AUD_IMG = ['/images/business/aud-hotel.webp', '/images/business/aud-company.webp', '/images/business/aud-travel.webp', '/images/business/aud-event.webp'];

export default function BusinessPage() {
  const locale = useLocale();
  const d = content[locale as keyof typeof content] || content.de;
  const x = extra[locale as keyof typeof extra] || extra.de;
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    fetch(`${API}/settings`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setApplicationsEnabled(data.b2b_applications_enabled !== '0'); })
      .catch(() => {});
  }, []);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: d.hero_title },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        <img src="/images/business/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[72%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/75 to-primary-900/10" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary-900/60 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 md:pb-24 md:pt-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-6 flex flex-wrap gap-2">
              {[d.hero_badge1, d.hero_badge2, d.hero_badge3].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
                  <CheckCircle size={13} className="text-gold-400" /> {b}
                </span>
              ))}
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">{d.hero_title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90 drop-shadow md:text-xl">{d.hero_subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {applicationsEnabled && (
                <Link
                  href="/portal/apply"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-4 text-lg font-bold text-primary-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-gold-300"
                >
                  {d.cta_apply} <ArrowRight size={20} />
                </Link>
              )}
              <Link
                href="/portal"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-7 py-4 text-lg font-bold text-white ring-1 ring-white/35 backdrop-blur transition hover:bg-white/20"
              >
                <LogIn size={20} /> {d.cta_login}
              </Link>
            </div>
            {!applicationsEnabled && (
              <p className="mt-4 max-w-lg text-sm text-white/75">{d.applications_closed}</p>
            )}
          </div>
          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 border-t border-white/15 pt-6 md:grid-cols-4">
            {d.services_trust.map((t) => {
              const Ikon = t.icon;
              return (
                <div key={t.small} className="flex items-center gap-2.5">
                  <Ikon size={22} className="shrink-0 text-gold-400" strokeWidth={1.75} />
                  <div className="leading-tight">
                    <dt className="text-sm font-extrabold">{t.big}</dt>
                    <dd className="text-xs text-white/75">{t.small}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* Services detail — yeni tasarim */}
      <section className="relative overflow-hidden py-16" style={{ background: '#f7f9fc' }}>
        {/* Dekoratif arka plan: solda ve sagda havalimani kulesi, kenardan bolum rengine soluyor */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-0 hidden md:block" style={{ width: '430px' }}>
            <img src="/images/biz-bg-left.webp" alt="" width={430} height={168} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(247,249,252,.15), #f7f9fc 88%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(247,249,252,0) 30%, #f7f9fc 100%)' }} />
          </div>
          <div className="absolute top-0 right-0 hidden md:block" style={{ width: '444px' }}>
            <img src="/images/biz-bg-right.webp" alt="" width={444} height={178} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(247,249,252,0) 55%, #f7f9fc 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(247,249,252,0) 35%, #f7f9fc 100%)' }} />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Baslik */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="hidden sm:block h-px w-10" style={{ background: '#c9a84c' }} />
              <span className="text-[11px] font-bold tracking-[.18em] uppercase" style={{ color: '#c9a84c' }}>
                {d.services_eyebrow}
              </span>
              <span className="hidden sm:block h-px w-10" style={{ background: '#c9a84c' }} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>
              {d.services_title_1} <span style={{ color: '#c9a84c' }}>{d.services_title_2}</span>
            </h2>
            <p className="mt-3 text-base sm:text-lg" style={{ color: '#6b7c93' }}>{d.services_subtitle}</p>
          </div>

          {/* Kartlar */}
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {d.services.map((service, i) => {
              const foto = ['/images/business/sammelrechnung.webp', '/images/business/abholschild.webp', '/images/business/partner.webp'][i];
                            const oneCikan = i === 1;
              return (
                <div
                  key={i}
                  className={`bg-white rounded-2xl overflow-hidden flex flex-col h-full ${oneCikan ? 'lg:-mt-4' : ''}`}
                  style={{
                    border: oneCikan ? '2px solid #c9a84c' : '1px solid #e8eef6',
                    boxShadow: oneCikan ? '0 12px 36px rgba(201,168,76,.20)' : '0 4px 20px rgba(15,27,45,.06)',
                  }}
                >
                  {/* Foto + ustundeki rozet ve anahtar kelimeler */}
                  <div className="relative m-3 rounded-xl overflow-hidden">
                    <img src={foto} alt={service.title} loading="lazy" width={393} height={214} className="w-full aspect-[16/9] object-cover block transition duration-500 hover:scale-[1.03]" />
                    {oneCikan && (
                      <span
                        className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
                        style={{ background: '#c9a84c', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}
                      >
                        <Star size={12} fill="currentColor" /> {d.services_popular}
                      </span>
                    )}
                  </div>

                  <div className="px-6 pb-6 pt-2 flex flex-col flex-1">
                    <h3 className="text-xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>{service.title}</h3>
                    <p className="text-sm font-medium mt-0.5 mb-3" style={{ color: '#6b7c93' }}>{service.subtitle}</p>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#6b7c93' }}>{service.description}</p>

                    <ul className="space-y-2 mb-6">
                      {service.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm" style={{ color: '#25344a' }}>
                          <span className="mt-0.5 flex items-center justify-center rounded-full shrink-0" style={{ width: '18px', height: '18px', background: '#c9a84c' }}>
                            <CheckCircle size={12} className="text-white" strokeWidth={3} />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={oneCikan ? '/portal/apply' : '#features'}
                      className="mt-auto flex items-center justify-center gap-2 rounded-xl font-bold text-sm uppercase tracking-wider py-3.5 transition-all hover:-translate-y-0.5"
                      style={oneCikan
                        ? { background: '#c9a84c', color: '#fff', boxShadow: '0 4px 16px rgba(201,168,76,.35)' }
                        : { background: '#fff', color: '#0f1b2d', border: '1.5px solid #d9e2ee' }}
                    >
                      {oneCikan ? d.services_cta_primary : d.services_cta_secondary}
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Portal: photo + grouped features */}
      <section id="features" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8">
          <div className="relative">
            <img src="/images/business/portal.webp" alt="" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
            <div className="absolute -bottom-6 left-6 right-6 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-gray-200 sm:left-auto sm:right-6 sm:w-72">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-primary-900"><Zap size={22} /></span>
                <div className="leading-tight">
                  <div className="font-extrabold text-gray-900">{d.features[0].title}</div>
                  <div className="text-xs text-gray-500">{d.features[0].text}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-6 lg:pt-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{x.portal_eyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: '#0f1b2d' }}>{d.features_title}</h2>
            <p className="mt-2 text-gray-500">{d.features_subtitle}</p>
            <div className="mt-8 space-y-6">
              {FEATURE_GROUPS.map((idx, g) => (
                <div key={g}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary-700">
                    <span className="h-px w-6 bg-gold-400" /> {x.groups[g]}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {idx.map((i) => {
                      const f = d.features[i];
                      const Icon = f.icon;
                      return (
                        <div key={i} className="group flex gap-3 rounded-xl p-3 transition hover:bg-gray-50">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition group-hover:bg-gold-400 group-hover:text-primary-900"><Icon size={19} /></span>
                          <div>
                            <div className="text-sm font-bold text-gray-900">{f.title}</div>
                            <div className="text-xs leading-relaxed text-gray-500">{f.text}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 flex gap-2 rounded-xl bg-gold-400/10 p-4 text-sm text-gray-700 ring-1 ring-gold-400/30"><Headphones size={18} className="mt-0.5 shrink-0 text-gold-600" /> {x.portal_note}</p>
          </div>
        </div>
      </section>

      {/* How it works: timeline */}
      <section className="relative overflow-hidden bg-primary-900 py-20 text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-2xl" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-400">{x.how_eyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{d.how_title}</h2>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            <span className="absolute left-[16.6%] right-[16.6%] top-8 hidden h-0.5 bg-gradient-to-r from-gold-400/20 via-gold-400 to-gold-400/20 md:block" aria-hidden="true" />
            {d.steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="relative text-center">
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-400 text-primary-900 shadow-lg shadow-gold-400/20">
                    <Icon size={28} />
                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-extrabold text-primary-900 ring-2 ring-primary-900">{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-white/70">{s.text}</p>
                </li>
              );
            })}
          </ol>
          {applicationsEnabled && (
            <div className="mt-12 text-center">
              <Link href="/portal/apply" className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-7 py-3.5 font-bold text-primary-900 transition hover:-translate-y-0.5 hover:bg-gold-300">{d.cta_apply} <ArrowRight size={18} /></Link>
            </div>
          )}
        </div>
      </section>

      {/* Audiences: photo cards */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-600">{x.audience_eyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: '#0f1b2d' }}>{d.audience_title}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {d.audiences.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative overflow-hidden">
                    <img src={AUD_IMG[i]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-primary-900 shadow backdrop-blur"><Icon size={16} className="text-gold-600" /> {a.label}</span>
                  </div>
                  <p className="p-5 text-sm leading-relaxed text-gray-600">{x.audience_texts[i]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust: fleet photo + advantages */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="order-2 lg:order-1">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{x.trust_eyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: '#0f1b2d' }}>{d.why_title}</h2>
            <p className="mt-3 leading-relaxed text-gray-600">{x.trust_text}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {d.advantages.map((adv, i) => {
                const Icon = adv.icon;
                return (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-600"><Icon size={19} /></span>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{adv.title}</div>
                      <div className="text-xs leading-relaxed text-gray-500">{adv.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative order-1 lg:order-2">
            <img src="/images/business/trust-fleet.webp" alt="" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
            <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-2xl bg-primary-900 px-5 py-4 text-white shadow-xl">
              <span className="text-3xl font-extrabold text-gold-400">4,7</span>
              <div className="leading-tight">
                <div className="flex text-gold-400">{[0, 1, 2, 3, 4].map((k) => <Star key={k} size={14} fill="currentColor" />)}</div>
                <div className="text-xs text-white/80">{x.rating}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: '#0f1b2d' }}>{x.faq_title}</h2>
          <div className="mt-10 space-y-3">
            {x.faqs.map((f) => (
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

      {/* CTA with photo */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        <img src="/images/business/hero.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[72%_center] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/90 to-primary-900/60" />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{x.cta_eyebrow}</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{d.cta_title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">{d.cta_text}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={CONTACT_INFO.phoneHref} className="flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-4 text-lg font-bold text-primary-900 transition hover:bg-gold-300">
              <Phone size={20} /> {d.cta_call}
            </a>
            <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-7 py-4 text-lg font-bold ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">
              <Mail size={20} /> {d.cta_email}
            </a>
            <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-green-500 px-7 py-4 text-lg font-bold text-white transition hover:bg-green-600">
              <MessageCircle size={20} /> {d.cta_whatsapp}
            </a>
          </div>
          <p className="mt-6 text-sm text-white/70">{CONTACT_INFO.phone} · {CONTACT_INFO.email}</p>
        </div>
      </section>
    </>
  );
}
