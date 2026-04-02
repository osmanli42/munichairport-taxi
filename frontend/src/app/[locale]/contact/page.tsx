import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.munichairport.taxi';
  const path = '/contact';
  return {
    title: t('contact_title'),
    description: t('contact_description'),
    alternates: {
      canonical: locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`,
      languages: {
        'de': `${baseUrl}${path}`,
        'en': `${baseUrl}/en${path}`,
        'tr': `${baseUrl}/tr${path}`,
      },
    },
  };
}

export default function ContactPage() {
  const t = useTranslations('contact');

  return (
    <>
      {/* Hero */}
      <section className="bg-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-primary-200 text-lg">{t('subtitle')}</p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-bold text-primary-600 mb-8">Kontaktinformationen</h2>

              <div className="space-y-6">
                {/* Phone */}
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                      <Phone size={22} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t('phone')}</h3>
                      <a href={CONTACT_INFO.phoneHref} className="text-xl font-bold text-primary-600 hover:underline block">
                        {CONTACT_INFO.phone}
                      </a>
                      <a
                        href={CONTACT_INFO.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-2 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-xl transition-colors"
                      >
                        <MessageCircle size={14} />
                        {t('whatsapp')}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                      <Mail size={22} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t('email')}</h3>
                      <a href={`mailto:${CONTACT_INFO.email}`} className="text-xl font-bold text-primary-600 hover:underline">
                        {CONTACT_INFO.email}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                      <MapPin size={22} className="text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t('address')}</h3>
                      <p className="text-gray-700">{CONTACT_INFO.address}</p>
                    </div>
                  </div>
                </div>

                {/* Hours */}
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
                      <Clock size={22} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t('hours')}</h3>
                      <p className="text-gray-700 font-medium">{t('hours_value')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Map / CTA */}
            <div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-primary-600 p-6 text-white text-center">
                  <h2 className="text-2xl font-bold mb-2">Schnell & einfach buchen</h2>
                  <p className="text-primary-200 text-sm">Buchen Sie online oder kontaktieren Sie uns direkt.</p>
                </div>
                <div className="p-6 space-y-4">
                  <a
                    href="/"
                    className="block w-full bg-primary-600 hover:bg-primary-700 text-white text-center py-4 rounded-xl font-bold text-lg transition-colors"
                  >
                    Online buchen →
                  </a>
                  <a
                    href={CONTACT_INFO.phoneHref}
                    className="flex items-center justify-center gap-2 w-full bg-gold-400 hover:bg-gold-500 text-primary-600 py-4 rounded-xl font-bold text-lg transition-colors"
                  >
                    <Phone size={20} />
                    {t('call')}
                  </a>
                  <a
                    href={CONTACT_INFO.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg transition-colors"
                  >
                    <MessageCircle size={20} />
                    {t('whatsapp')}
                  </a>
                </div>
              </div>

              {/* FAQ */}
              <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-gray-900 mb-4">Häufige Fragen</h3>
                <div className="space-y-4">
                  {[
                    { q: 'Wie früh kann ich buchen?', a: 'Sie können bis zu einem Jahr im Voraus buchen.' },
                    { q: 'Was passiert bei Flugverspätung?', a: 'Wir überwachen Ihren Flug und warten, bis Sie ankommen.' },
                    { q: 'Gibt es einen Kindersitz?', a: 'Ja, kostenlos auf Anfrage.' },
                    { q: 'Kann ich mit Karte zahlen?', a: 'Ja, wir akzeptieren Barzahlung und Kartenzahlung.' },
                  ].map(({ q, a }) => (
                    <div key={q} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <p className="font-medium text-gray-900 text-sm">{q}</p>
                      <p className="text-gray-600 text-sm mt-1">{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
