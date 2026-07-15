'use client';

import { useState, useEffect } from 'react';
import {
  Phone, Mail, FileText, UserCheck, Users, Shield, Clock, Tag, Globe, CheckCircle, Star,
  Zap, Receipt, FileDown, PlaneTakeoff, BarChart3, Lock, Headphones,
  ArrowRight, LogIn, Building2, Briefcase, Plane, CalendarClock,
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

export default function BusinessPage() {
  const locale = useLocale();
  const d = content[locale as keyof typeof content] || content.de;
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
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: d.hero_title },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero */}
      <section className="bg-primary-600 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            <span className="bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full">{d.hero_badge1}</span>
            <span className="bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full">{d.hero_badge2}</span>
            <span className="bg-white/10 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full">{d.hero_badge3}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{d.hero_title}</h1>
          <p className="text-primary-200 text-lg md:text-xl max-w-2xl mx-auto mb-10">{d.hero_subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {applicationsEnabled && (
              <Link
                href="/portal/apply"
                className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 font-bold px-8 py-4 rounded-xl transition-colors text-lg shadow-lg"
              >
                {d.cta_apply} <ArrowRight size={20} />
              </Link>
            )}
            <Link
              href="/portal"
              className="flex items-center justify-center gap-2 bg-transparent border-2 border-white/40 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              <LogIn size={20} /> {d.cta_login}
            </Link>
          </div>
          {!applicationsEnabled && (
            <p className="text-primary-200 text-sm mt-4 max-w-lg mx-auto">{d.applications_closed}</p>
          )}
        </div>
      </section>

      {/* Feature showcase */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-primary-600 text-center mb-2">{d.features_title}</h2>
          <p className="text-gray-500 text-center mb-12">{d.features_subtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {d.features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex gap-4 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-gray-50/50">
                  <div className="w-12 h-12 shrink-0 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Icon size={22} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-primary-600 text-center mb-12">{d.how_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {d.steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="relative text-center">
                  <div className="w-16 h-16 mx-auto bg-primary-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg relative">
                    <Icon size={28} className="text-white" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-gold-400 text-primary-600 text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Audience strip */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-400 mb-6 uppercase tracking-wide">{d.audience_title}</p>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6">
            {d.audiences.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-center gap-2 text-gray-600">
                  <Icon size={20} className="text-primary-500" />
                  <span className="font-medium text-sm">{a.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services detail */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-primary-600 text-center mb-12">{d.services_title}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {d.services.map((service, i) => {
              const Icon = service.icon;
              return (
                <div key={i} className={`bg-white rounded-2xl border-2 ${service.color} shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                  <div className="p-8">
                    <div className={`w-16 h-16 ${service.iconBg} rounded-2xl flex items-center justify-center mb-6`}>
                      <Icon size={32} className={service.iconColor} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{service.title}</h3>
                    <p className="text-sm font-medium text-gray-500 mb-4">{service.subtitle}</p>
                    <p className="text-gray-600 text-sm leading-relaxed mb-6">{service.description}</p>
                    <ul className="space-y-2">
                      {service.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle size={16} className="text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-primary-600 text-center mb-12">{d.why_title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {d.advantages.map((adv, i) => {
              const Icon = adv.icon;
              return (
                <div key={i} className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-2xl hover:bg-primary-50 transition-colors">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-3">
                    <Icon size={22} className="text-primary-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">{adv.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{adv.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">{d.cta_title}</h2>
          <p className="text-primary-200 mb-8 text-lg">{d.cta_text}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 font-bold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              <Phone size={20} />
              {d.cta_call}
            </a>
            <a
              href={`mailto:${CONTACT_INFO.email}`}
              className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-primary-600 font-bold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              <Mail size={20} />
              {d.cta_email}
            </a>
            <a
              href={CONTACT_INFO.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-xl transition-colors text-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {d.cta_whatsapp}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
