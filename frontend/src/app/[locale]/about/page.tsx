import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';
import { Shield, Clock, Tag, Globe, Phone, Mail, MapPin } from 'lucide-react';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.munichairport.taxi';
  const path = '/about';
  return {
    title: t('about_title'),
    description: t('about_description'),
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

export default function AboutPage() {
  const t = useTranslations('about');

  const reasons = [
    { icon: Shield, title: t('reasons.experience.title'), text: t('reasons.experience.text') },
    { icon: Clock, title: t('reasons.punctual.title'), text: t('reasons.punctual.text') },
    { icon: Tag, title: t('reasons.fixed.title'), text: t('reasons.fixed.text') },
    { icon: Globe, title: t('reasons.multilingual.title'), text: t('reasons.multilingual.text') },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-primary-200 text-lg max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </section>

      {/* About Content */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary-600 mb-6">{t('why_us')}</h2>
              <p className="text-gray-700 leading-relaxed mb-8 text-lg">{t('description')}</p>

              <div className="grid grid-cols-1 gap-4">
                {reasons.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex items-start gap-4 bg-white rounded-xl p-4 shadow-sm">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{title}</h3>
                      <p className="text-sm text-gray-600">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Owner Card */}
            <div>
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="bg-primary-600 p-6 text-white text-center">
                  <div className="w-20 h-20 bg-gold-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary-600 font-bold text-3xl">M</span>
                  </div>
                  <h3 className="text-xl font-bold">Munich Airport Taxi</h3>
                  <p className="text-primary-200">Professioneller Flughafentransfer</p>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">{t('owner')}</p>
                    <p className="font-semibold text-gray-900 text-lg">{CONTACT_INFO.owners}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Phone size={16} className="text-primary-600 shrink-0" />
                      <a href={CONTACT_INFO.phoneHref} className="text-primary-600 hover:underline font-medium">
                        {CONTACT_INFO.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={16} className="text-primary-600 shrink-0" />
                      <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary-600 hover:underline">
                        {CONTACT_INFO.email}
                      </a>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-primary-600 shrink-0 mt-0.5" />
                      <span className="text-gray-700">{CONTACT_INFO.address}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">Verfügbar: 24 Stunden, 7 Tage die Woche</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-primary-600 mb-4">Unser Einzugsgebiet</h2>
          <p className="text-gray-600 mb-6">Wir fahren zu und von allen Adressen im Großraum München zum Flughafen München (MUC) und zurück.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['München', 'Freising', 'Erding', 'Landshut', 'Ingolstadt', 'Augsburg', 'Rosenheim', 'Dachau', 'Fürstenfeldbruck', 'Ebersberg'].map((city) => (
              <span key={city} className="bg-primary-50 text-primary-600 px-4 py-2 rounded-full text-sm font-medium">
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
