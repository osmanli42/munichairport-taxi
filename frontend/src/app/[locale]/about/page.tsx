import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';
import { Shield, Clock, Tag, Globe, Phone, Mail, MapPin, Star, Award, Users, CheckCircle, Trophy, MessageCircle } from 'lucide-react';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.flughafen-muenchen.taxi';
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

  const statIcons = [Award, CheckCircle, Star, Clock];
  const stats = (t.raw('stats') as { value: string; label: string }[]).map((s, i) => ({ ...s, icon: statIcons[i] }));

  const cities = [
    'München', 'Freising', 'Erding', 'Landshut', 'Ingolstadt', 'Augsburg',
    'Rosenheim', 'Dachau', 'Fürstenfeldbruck', 'Ebersberg', 'Salzburg', 'Innsbruck',
  ];

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: t('title') },
    ],
  };

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero */}
      <section
        className="py-16 text-white text-center"
        style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
          >
            {t('badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            {t('title')}
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#7a9ab8' }}>
            {t('subtitle')}
          </p>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-extrabold" style={{ color: '#c9a84c' }}>{s.value}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: '#5a7a99' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Why us + Owner card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Why us */}
          <div>
            {/* Header card */}
            <div
              className="rounded-2xl overflow-hidden mb-4"
              style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              <div className="flex items-center gap-4 px-7 py-5" style={{ background: '#eef3f9', borderBottom: '1px solid #dce8f5' }}>
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: '#fff', border: '1px solid #c8d8ec' }}
                >
                  <Trophy size={20} style={{ color: '#1e3a5f' }} />
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#185FA5' }}>
                    {t('section_company')}
                  </span>
                  <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>{t('why_us')}</h2>
                </div>
              </div>
              <div className="px-7 py-5 text-sm leading-relaxed" style={{ color: '#4a6280' }}>
                {t('description')}
              </div>
            </div>

            {/* Reasons */}
            <div className="space-y-3">
              {reasons.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
                >
                  <div className="flex items-start gap-4 px-6 py-4">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#eef3f9', border: '1px solid #c8d8ec' }}
                    >
                      <Icon size={18} style={{ color: '#1e3a5f' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm mb-0.5" style={{ color: '#0f1b2d' }}>{title}</h3>
                      <p className="text-sm" style={{ color: '#6b7c93' }}>{text}</p>
                    </div>
                    <span
                      className="ml-auto flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full self-start"
                      style={{ background: '#eef3f9', color: '#1e3a5f', border: '1px solid #c8d8ec' }}
                    >
                      ✓
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Owner / contact card */}
          <div>
            <div
              className="rounded-2xl overflow-hidden h-full"
              style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              {/* Card header */}
              <div className="px-7 py-8 text-center" style={{ background: '#eef3f9', borderBottom: '1px solid #dce8f5' }}>
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-extrabold"
                  style={{ background: '#fff', color: '#1e3a5f', border: '2px solid #c8d8ec' }}
                >
                  F
                </div>
                <h3 className="text-xl font-extrabold mb-1" style={{ color: '#0f1b2d' }}>Flughafen-München.TAXI</h3>
                <p style={{ color: '#6b7c93' }} className="text-sm">{t('owner_subtitle')}</p>

                <div className="flex justify-center gap-3 mt-4">
                  {['DE', 'EN', 'TR'].map(lang => (
                    <span
                      key={lang}
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fff', border: '1px solid #c8d8ec', color: '#1e3a5f' }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact details */}
              <div className="px-7 py-6 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#185FA5' }}>
                    {t('owner')}
                  </p>
                  <p className="font-bold text-lg" style={{ color: '#0f1b2d' }}>{CONTACT_INFO.owners}</p>
                </div>

                <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #f0f4f8' }}>
                  {[
                    { icon: Phone, label: t('label_phone'), value: CONTACT_INFO.phone, href: CONTACT_INFO.phoneHref },
                    { icon: Mail, label: t('label_email'), value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
                    { icon: MapPin, label: t('label_address'), value: CONTACT_INFO.address, href: undefined },
                    { icon: Users, label: t('label_availability'), value: t('availability_value'), href: undefined },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: '#eef3f9', border: '1px solid #c8d8ec' }}
                      >
                        <item.icon size={15} style={{ color: '#1e3a5f' }} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#185FA5' }}>
                          {item.label}
                        </p>
                        {item.href ? (
                          <a href={item.href} className="text-sm font-medium hover:underline" style={{ color: '#0f1b2d' }}>
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-sm font-medium" style={{ color: '#0f1b2d' }}>{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA buttons */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3" style={{ borderTop: '1px solid #f0f4f8' }}>
                  <a
                    href={CONTACT_INFO.phoneHref}
                    className="flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl flex-1 transition-all hover:-translate-y-0.5"
                    style={{ background: '#1e3a5f', color: '#fff' }}
                  >
                    <Phone size={15} /> {CONTACT_INFO.phone}
                  </a>
                  <a
                    href={CONTACT_INFO.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 font-bold text-sm px-5 py-3 rounded-xl flex-1 transition-all hover:-translate-y-0.5"
                    style={{ background: '#25d366', color: '#fff' }}
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Service area */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
        >
          <div className="flex items-center gap-4 px-7 py-5" style={{ background: '#eef3f9', borderBottom: '1px solid #dce8f5' }}>
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#fff', border: '1px solid #c8d8ec' }}
            >
              <MapPin size={20} style={{ color: '#1e3a5f' }} />
            </div>
            <div>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#185FA5' }}>{t('section_area')}</span>
              <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>{t('area_title')}</h2>
            </div>
          </div>
          <div className="px-7 py-6">
            <p className="text-sm mb-5" style={{ color: '#4a6280' }}>
              {t('area_text')}
            </p>
            <div className="flex flex-wrap gap-2">
              {cities.map(city => (
                <span
                  key={city}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: '#eef3f9', color: '#1e3a5f', border: '1px solid #c8d8ec' }}
                >
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
