import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';
import {
  ShieldCheck, Clock, Tag, Globe, Phone, Mail, MapPin, Star, Users,
  Trophy, MessageCircle,
} from 'lucide-react';
import { aboutDesign, contactExtraIcons } from './aboutDesign';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://flughafen-muenchen.taxi';
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
        'x-default': `${baseUrl}${path}`,
      },
    },
  };
}

export default function AboutPage() {
  const t = useTranslations('about');
  const locale = useLocale();
  const dz = aboutDesign[locale] || aboutDesign.de;

  const reasons = [
    { icon: ShieldCheck, title: t('reasons.experience.title'), text: t('reasons.experience.text') },
    { icon: Clock, title: t('reasons.punctual.title'), text: t('reasons.punctual.text') },
    { icon: Tag, title: t('reasons.fixed.title'), text: t('reasons.fixed.text') },
    { icon: Globe, title: t('reasons.multilingual.title'), text: t('reasons.multilingual.text') },
  ];

  const statIcons = [Trophy, Users, Star, Clock];
  const stats = (t.raw('stats') as { value: string; label: string }[]).map((s, i) => ({ ...s, icon: statIcons[i] }));

  const cities = [
    'München', 'Freising', 'Erding', 'Landshut', 'Ingolstadt', 'Augsburg',
    'Rosenheim', 'Dachau', 'Fürstenfeldbruck', 'Ebersberg', 'Salzburg', 'Innsbruck',
  ];

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: t('title') },
    ],
  };

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero — arka plan: Munih Havalimani M terminali (ust) + taksi sirasi/kule/ucak (sag),
          tasarim gorselinden kesildi, sol/alt (metin alani) koyu laciverte (#0f1b2d) soluyor */}
      <section className="relative overflow-hidden text-white py-16" style={{ background: '#0f1b2d' }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-0 w-full hidden sm:block" style={{ height: '110px' }}>
            <img src="/images/about-bg-top.webp" alt="" width={1024} height={168} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,27,45,.15) 0%, #0f1b2d 96%)' }} />
          </div>
          <div className="absolute top-0 right-0 h-full hidden md:block" style={{ width: '360px' }}>
            <img src="/images/about-bg-right.webp" alt="" width={354} height={448} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(15,27,45,.10) 0%, #0f1b2d 88%)' }} />
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
          >
            {t('badge')}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            Flughafen-München<span style={{ color: '#c9a84c' }}>.TAXI</span>
          </h1>
          <p className="text-lg max-w-xl" style={{ color: '#a9bdd4' }}>
            {t('subtitle')}
          </p>

          {/* Stats row */}
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
            {stats.map(s => {
              const Ikon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: '38px', height: '38px', border: '1.5px solid rgba(201,168,76,.5)', background: 'rgba(201,168,76,.12)' }}
                  >
                    <Ikon size={17} style={{ color: '#c9a84c' }} />
                  </span>
                  <div>
                    <div className="text-base font-extrabold leading-tight" style={{ color: '#fff' }}>{s.value}</div>
                    <div className="text-xs font-medium" style={{ color: '#a9bdd4' }}>{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Why us + reasons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Why us card */}
          <div
            className="rounded-2xl px-7 py-7"
            style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
          >
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
              {t('section_company')}
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight mt-1 mb-4" style={{ color: '#0f1b2d' }}>
              {t('why_us')}
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#4a6280' }}>
              {t('description')}
            </p>

            <div className="rounded-xl px-5 py-5" style={{ background: '#fdf8ec', border: '1px solid #f3e7c4' }}>
              <span className="block text-3xl font-extrabold leading-none mb-1" style={{ color: '#e0c268', fontFamily: 'Georgia, serif' }}>&ldquo;</span>
              <p className="italic text-sm leading-relaxed mb-4" style={{ color: '#5a4a24' }}>{dz.quote}</p>
              <p className="font-bold text-sm" style={{ color: '#0f1b2d' }}>{CONTACT_INFO.owners}</p>
              <p className="text-xs" style={{ color: '#8a7550' }}>{t('owner')}</p>
            </div>
          </div>

          {/* Reasons */}
          <div className="space-y-3">
            {reasons.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl px-6 py-4 flex items-center gap-4"
                style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
              >
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: '#fdf3de' }}
                >
                  <Icon size={19} style={{ color: '#a07820' }} />
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-0.5" style={{ color: '#0f1b2d' }}>{title}</h3>
                  <p className="text-sm" style={{ color: '#6b7c93' }}>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact: dark CTA card + detail card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div
            className="rounded-2xl overflow-hidden px-7 py-8"
            style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)', border: '1px solid rgba(201,168,76,.3)' }}
          >
            <div
              className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
            >
              {t('contact')}
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-2">{dz.ctaTitle}</h3>
            <p className="text-sm mb-6" style={{ color: '#7a9ab8' }}>{dz.ctaText}</p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2.5 font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #c9a84c, #d4af6a)', color: '#0f1b2d', boxShadow: '0 4px 16px rgba(201,168,76,.3)' }}
              >
                <Phone size={16} /> {dz.ctaCall}
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 font-bold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: '#25d366', color: '#fff', boxShadow: '0 4px 16px rgba(37,211,102,.25)' }}
              >
                <MessageCircle size={16} /> {dz.ctaWhatsapp}
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
              {dz.contactExtra.map((c, i) => {
                const Ikon = contactExtraIcons[i] || contactExtraIcons[0];
                return (
                  <div key={c} className="flex items-center gap-2 text-xs font-medium" style={{ color: '#a9bdd4' }}>
                    <Ikon size={15} style={{ color: '#c9a84c' }} />
                    {c}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact details */}
          <div
            className="rounded-2xl px-7 py-7 space-y-4"
            style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
          >
            {[
              { icon: Users, label: t('owner'), value: CONTACT_INFO.owners, href: undefined },
              { icon: Phone, label: t('label_phone'), value: CONTACT_INFO.phone, href: CONTACT_INFO.phoneHref },
              { icon: Mail, label: t('label_email'), value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
              { icon: MapPin, label: t('label_address'), value: CONTACT_INFO.address, href: undefined },
              { icon: Clock, label: t('label_availability'), value: t('availability_value'), href: undefined },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                className="flex items-start gap-3.5"
                style={i < arr.length - 1 ? { paddingBottom: '1rem', borderBottom: '1px solid #f0f4f8' } : undefined}
              >
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: '#fdf3de' }}
                >
                  <item.icon size={16} style={{ color: '#a07820' }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#a07820' }}>
                    {item.label}
                  </p>
                  {item.href ? (
                    <a href={item.href} className="text-sm font-semibold hover:underline" style={{ color: '#0f1b2d' }}>
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold" style={{ color: '#0f1b2d' }}>{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Service area */}
        <div
          className="rounded-2xl px-7 py-7"
          style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10 mb-6">
            <div className="shrink-0 lg:w-56">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: '#fdf3de' }}
              >
                <MapPin size={19} style={{ color: '#a07820' }} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase block mb-1" style={{ color: '#c9a84c' }}>
                {t('section_area')}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>{t('area_title')}</h2>
            </div>
            <p className="text-sm leading-relaxed lg:pt-14" style={{ color: '#4a6280' }}>
              {t('area_text')}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex flex-wrap gap-2 flex-1">
              {cities.map(city => (
                <span
                  key={city}
                  className="text-xs font-semibold px-3.5 py-2 rounded-full"
                  style={{ background: '#eef3f9', color: '#1e3a5f', border: '1px solid #c8d8ec' }}
                >
                  {city}
                </span>
              ))}
              <span
                className="text-xs font-medium px-3.5 py-2 rounded-full"
                style={{ background: '#fff', color: '#8a9bb0', border: '1.5px dashed #c8d3e0' }}
              >
                {dz.areaMore}
              </span>
            </div>

            {/* Decorative mini map: Munchen -> Salzburg */}
            <svg viewBox="0 0 220 110" className="hidden lg:block shrink-0" style={{ width: '190px', height: '95px' }} aria-hidden="true">
              <defs>
                <pattern id="aboutMapDots" width="7" height="7" patternUnits="userSpaceOnUse">
                  <circle cx="1.2" cy="1.2" r="1.2" fill="#c9d3e0" />
                </pattern>
              </defs>
              <path d="M12 15 C 40 5, 70 10, 85 30 C 100 50, 90 75, 65 85 C 40 95, 15 85, 10 60 C 6 40, 4 25, 12 15 Z" fill="url(#aboutMapDots)" opacity="0.7" />
              <path d="M115 20 C 145 10, 180 18, 200 40 C 212 55, 205 78, 180 90 C 155 100, 125 92, 115 68 C 108 50, 100 32, 115 20 Z" fill="url(#aboutMapDots)" opacity="0.7" />
              <path d="M55 45 Q 110 25 165 55" fill="none" stroke="#c9a84c" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="55" cy="45" r="6" fill="#1e3a5f" />
              <circle cx="55" cy="45" r="2.2" fill="#fff" />
              <circle cx="165" cy="55" r="6" fill="#c9a84c" />
              <circle cx="165" cy="55" r="2.2" fill="#fff" />
              <text x="55" y="70" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1e3a5f">München</text>
              <text x="165" y="80" textAnchor="middle" fontSize="11" fontWeight="700" fill="#a07820">Salzburg</text>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
