'use client';

import { Phone, Mail, FileText, UserCheck, Users, Shield, Clock, Tag, Globe, CheckCircle, Star } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { useLocale } from 'next-intl';

const content = {
  de: {
    hero_title: 'Business Transfer Service',
    hero_subtitle: 'Professioneller Flughafentransfer für Unternehmen – zuverlässig, diskret und immer pünktlich.',
    services_title: 'Unsere Business-Leistungen',
    services: [
      {
        icon: FileText,
        title: 'Sammelrechnung',
        subtitle: 'Einfache Abrechnung für Ihr Unternehmen',
        description: 'Alle Fahrten Ihrer Mitarbeiter werden auf einer übersichtlichen Sammelrechnung zusammengefasst. Monatliche Abrechnung, keine versteckten Kosten – perfekt für die Buchhaltung.',
        features: [
          'Monatliche Gesamtrechnung',
          'Detaillierte Fahrtenaufstellung',
          'Steuerlich absetzbar',
          'Keine versteckten Gebühren',
        ],
        color: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'Abholung mit Abholschild',
        subtitle: 'Professionelle Begrüßung im Terminal',
        description: 'Unser Fahrer erwartet Ihre Gäste persönlich im Ankunftsbereich mit einem Schild mit dem Namen des Gastes. Ein professioneller erster Eindruck für Ihre Geschäftspartner.',
        features: [
          'Namentliches Abholschild',
          'Direkter Empfang im Terminal',
          'Echtzeit-Flugverfolgung',
          '60 Min. kostenlose Wartezeit',
        ],
        color: 'bg-gold-50 border-yellow-200',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'Geschäftspartner & Mitarbeiter',
        subtitle: 'Zuverlässige Abholung Ihrer Gäste',
        description: 'Wir holen Ihre Geschäftspartner, Kunden und Mitarbeiter pünktlich ab und bringen sie sicher ans Ziel. Diskreter, professioneller Service – der beste erste Eindruck für Ihr Unternehmen.',
        features: [
          'Mehrsprachige Fahrer (DE/EN/TR)',
          'Diskret und professionell',
          'Pünktliche Abholung garantiert',
          'Fahrt in ganz Bayern & Österreich',
        ],
        color: 'bg-green-50 border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
      },
    ],
    why_title: 'Warum Unternehmen uns vertrauen',
    advantages: [
      { icon: Shield, title: 'Vollversichert', text: 'Alle Fahrzeuge mit Haftpflicht & Vollkasko' },
      { icon: Clock, title: '24/7 Verfügbar', text: 'Auch nachts und an Feiertagen' },
      { icon: Tag, title: 'Festpreise', text: 'Transparente Preise ohne Taxameter' },
      { icon: Globe, title: 'Mehrsprachig', text: 'Deutsch, Englisch und Türkisch' },
      { icon: Star, title: '20 Jahre Erfahrung', text: 'Erfahrener Flughafentransfer-Service' },
      { icon: CheckCircle, title: 'Pünktlichkeit', text: 'Flugverfolgung & garantierte Pünktlichkeit' },
    ],
    cta_title: 'Business-Anfrage stellen',
    cta_text: 'Kontaktieren Sie uns für ein individuelles Angebot oder regelmäßige Buchungen. Wir erstellen Ihnen gerne ein maßgeschneidertes Business-Paket.',
    cta_call: 'Jetzt anrufen',
    cta_email: 'E-Mail senden',
    cta_whatsapp: 'WhatsApp',
    badge1: 'Firmenkunden',
    badge2: 'Sammelrechnung',
    badge3: 'Professionell',
  },
  en: {
    hero_title: 'Business Transfer Service',
    hero_subtitle: 'Professional airport transfer for companies – reliable, discreet and always punctual.',
    services_title: 'Our Business Services',
    services: [
      {
        icon: FileText,
        title: 'Collective Invoice',
        subtitle: 'Simple billing for your company',
        description: 'All rides of your employees are summarized on one clear collective invoice. Monthly billing, no hidden costs – perfect for accounting.',
        features: [
          'Monthly collective invoice',
          'Detailed ride breakdown',
          'Tax deductible',
          'No hidden fees',
        ],
        color: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'Pickup with Name Sign',
        subtitle: 'Professional greeting at the terminal',
        description: 'Our driver personally awaits your guests in the arrivals area with a sign bearing the guest\'s name. A professional first impression for your business partners.',
        features: [
          'Personal name sign',
          'Direct reception at terminal',
          'Real-time flight tracking',
          '60 min. free waiting time',
        ],
        color: 'bg-gold-50 border-yellow-200',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'Business Partners & Employees',
        subtitle: 'Reliable pickup of your guests',
        description: 'We pick up your business partners, clients and employees punctually and bring them safely to their destination. Discreet, professional service – the best first impression for your company.',
        features: [
          'Multilingual drivers (DE/EN/TR)',
          'Discreet and professional',
          'Punctual pickup guaranteed',
          'Travel throughout Bavaria & Austria',
        ],
        color: 'bg-green-50 border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
      },
    ],
    why_title: 'Why Companies Trust Us',
    advantages: [
      { icon: Shield, title: 'Fully Insured', text: 'All vehicles with liability & comprehensive' },
      { icon: Clock, title: '24/7 Available', text: 'Also at night and on holidays' },
      { icon: Tag, title: 'Fixed Prices', text: 'Transparent prices without taximeter' },
      { icon: Globe, title: 'Multilingual', text: 'German, English and Turkish' },
      { icon: Star, title: '20 Years Experience', text: 'Experienced airport transfer service' },
      { icon: CheckCircle, title: 'Punctuality', text: 'Flight tracking & guaranteed punctuality' },
    ],
    cta_title: 'Submit Business Inquiry',
    cta_text: 'Contact us for a custom offer or regular bookings. We are happy to create a tailored business package for you.',
    cta_call: 'Call now',
    cta_email: 'Send email',
    cta_whatsapp: 'WhatsApp',
    badge1: 'Corporate Clients',
    badge2: 'Collective Invoice',
    badge3: 'Professional',
  },
  tr: {
    hero_title: 'Business Transfer Hizmeti',
    hero_subtitle: 'Firmalar için profesyonel havalimanı transferi – güvenilir, diskreet ve her zaman dakik.',
    services_title: 'Business Hizmetlerimiz',
    services: [
      {
        icon: FileText,
        title: 'Toplu Fatura (Sammelrechnung)',
        subtitle: 'Firmanız için kolay faturalama',
        description: 'Çalışanlarınızın tüm yolculukları tek bir düzenli toplu faturada toplanır. Aylık faturalama, gizli maliyet yok – muhasebe için mükemmel.',
        features: [
          'Aylık toplu fatura',
          'Detaylı yolculuk dökümü',
          'Vergiden düşülebilir',
          'Gizli ücret yok',
        ],
        color: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
      },
      {
        icon: UserCheck,
        title: 'İsim Tabelasıyla Karşılama',
        subtitle: 'Terminalde profesyonel karşılama',
        description: 'Sürücümüz misafirlerinizi varış alanında isimlerinin yazılı olduğu bir tabelayla kişisel olarak karşılar. İş ortaklarınıza profesyonel bir ilk izlenim.',
        features: [
          'Kişisel isim tabelası',
          'Terminalde doğrudan karşılama',
          'Gerçek zamanlı uçuş takibi',
          '60 dak. ücretsiz bekleme',
        ],
        color: 'bg-gold-50 border-yellow-200',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
      },
      {
        icon: Users,
        title: 'İş Ortakları & Çalışanlar',
        subtitle: 'Misafirlerinizin güvenilir transferi',
        description: 'İş ortaklarınızı, müşterilerinizi ve çalışanlarınızı zamanında alır, güvenle hedefe ulaştırırız. Diskreet, profesyonel hizmet – firmanız için en iyi ilk izlenim.',
        features: [
          'Çok dilli sürücüler (DE/EN/TR)',
          'Diskreet ve profesyonel',
          'Dakik karşılama garantili',
          'Tüm Bavyera & Avusturya',
        ],
        color: 'bg-green-50 border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
      },
    ],
    why_title: 'Firmalar Neden Bize Güveniyor',
    advantages: [
      { icon: Shield, title: 'Tam Sigortalı', text: 'Tüm araçlar sorumluluk & kasko sigortası' },
      { icon: Clock, title: '7/24 Hizmet', text: 'Geceleri ve tatil günlerinde de' },
      { icon: Tag, title: 'Sabit Fiyat', text: 'Taksimetre yok, şeffaf fiyatlar' },
      { icon: Globe, title: 'Çok Dilli', text: 'Almanca, İngilizce ve Türkçe' },
      { icon: Star, title: '20 Yıl Deneyim', text: 'Deneyimli havalimanı transfer hizmeti' },
      { icon: CheckCircle, title: 'Dakiklik', text: 'Uçuş takibi & garantili dakiklik' },
    ],
    cta_title: 'Business Teklif Alın',
    cta_text: 'Özel teklif veya düzenli rezervasyonlar için bizimle iletişime geçin. Size özel bir business paketi oluşturmaktan memnuniyet duyarız.',
    cta_call: 'Şimdi ara',
    cta_email: 'E-posta gönder',
    cta_whatsapp: 'WhatsApp',
    badge1: 'Kurumsal Müşteriler',
    badge2: 'Toplu Fatura',
    badge3: 'Profesyonel',
  },
};

export default function BusinessPage() {
  const locale = useLocale();
  const d = content[locale as keyof typeof content] || content.de;

  return (
    <>
      {/* Hero */}
      <section className="bg-primary-600 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-400 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center gap-2 mb-6 flex-wrap">
            <span className="bg-gold-400 text-primary-600 text-xs font-bold px-3 py-1 rounded-full">{d.badge1}</span>
            <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">{d.badge2}</span>
            <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full">{d.badge3}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{d.hero_title}</h1>
          <p className="text-primary-200 text-lg md:text-xl max-w-2xl mx-auto">{d.hero_subtitle}</p>
        </div>
      </section>

      {/* Services */}
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
