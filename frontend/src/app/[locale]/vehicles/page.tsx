import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, ArrowRight, Plane, Check } from 'lucide-react';
import { design, incIcons, trustIcons, featureIcons } from './design';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://flughafen-muenchen.taxi';
  const path = '/vehicles';
  return {
    title: t('vehicles_title'),
    description: t('vehicles_description'),
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

export default function VehiclesPage() {
  const t = useTranslations('vehicles');
  const locale = useLocale();
  const dz = design[locale] || design.de;

  const vehicles = [
    {
      type: 'kombi' as const,
      name: t('kombi.name'),
      persons: t('kombi.persons'),
      description: t('kombi.description'),
      features: [t('kombi.features.0'), t('kombi.features.1'), t('kombi.features.2')],
      basePrice: 8.0,
      pricePerKm: 2.1,
    },
    {
      type: 'van' as const,
      name: t('van.name'),
      persons: t('van.persons'),
      description: t('van.description'),
      features: [t('van.features.0'), t('van.features.1'), t('van.features.2')],
      basePrice: 10.0,
      pricePerKm: 2.2,
      featured: true,
    },
    {
      type: 'grossraumtaxi' as const,
      name: t('grossraumtaxi.name'),
      persons: t('grossraumtaxi.persons'),
      description: t('grossraumtaxi.description'),
      features: [t('grossraumtaxi.features.0'), t('grossraumtaxi.features.1'), t('grossraumtaxi.features.2')],
      basePrice: 15.0,
      pricePerKm: 2.4,
    },
  ];

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://flughafen-muenchen.taxi' },
      { '@type': 'ListItem', position: 2, name: t('title') },
    ],
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Flughafentransfer München',
    provider: { '@type': 'TaxiService', name: 'Munich Airport Taxi', url: 'https://flughafen-muenchen.taxi' },
    areaServed: 'München, Bavaria',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Fahrzeugkategorien',
      itemListElement: vehicles.map((v) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: v.name, description: v.description },
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />

      {/* Hero — diger sayfalarla ayni mavi bant, arkasinda silik havalimani fotografi */}
      <section className="relative overflow-hidden bg-primary-600 text-white py-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-0 hidden md:block" style={{ width: '320px', opacity: 0.22 }}>
            <img src="/images/veh-bg-left.webp" alt="" width={260} height={240} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(30,58,95,0) 30%, #1e3a5f 95%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(30,58,95,0) 40%, #1e3a5f 100%)' }} />
          </div>
          <div className="absolute top-0 right-0 hidden md:block" style={{ width: '300px', opacity: 0.28 }}>
            <img src="/images/veh-bg-right.webp" alt="" width={234} height={130} className="w-full block" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(30,58,95,0) 40%, #1e3a5f 95%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(30,58,95,0) 45%, #1e3a5f 100%)' }} />
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="hidden sm:block h-px w-10 bg-gold-400" />
            <span className="text-[11px] font-bold tracking-[.2em] uppercase text-gold-400">{dz.eyebrow}</span>
            <span className="hidden sm:block h-px w-10 bg-gold-400" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            {dz.h1a}<br className="hidden sm:block" />{' '}
            <span className="text-gold-400">{dz.h1b}</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-primary-200 max-w-2xl mx-auto">{dz.sub}</p>
        </div>
      </section>

      {/* Festpreis bandi */}
      <section className="bg-gold-50 border-b border-gold-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-primary-600 font-semibold flex items-center justify-center gap-2">
            <Check size={18} className="text-green-500" />
            {t('fixed_price_info')}
          </p>
        </div>
      </section>

      {/* Arac kartlari */}
      <section className="py-16" style={{ background: '#f7f9fc' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            {vehicles.map((v, i) => {
              const foto = ['/images/kombi.webp', '/images/van.webp', '/images/grossraumtaxi.webp'][i];
              const oneCikan = !!v.featured;
              return (
                <div
                  key={v.type}
                  className={`relative bg-white rounded-2xl p-4 flex flex-col h-full ${oneCikan ? 'lg:-mt-4' : ''}`}
                  style={{
                    border: oneCikan ? '2px solid #c9a84c' : '1px solid #e8eef6',
                    boxShadow: oneCikan ? '0 12px 36px rgba(201,168,76,.20)' : '0 4px 20px rgba(15,27,45,.06)',
                  }}
                >
                  {oneCikan && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 rounded-full px-4 py-1 text-xs font-bold text-white whitespace-nowrap"
                      style={{ background: '#c9a84c', boxShadow: '0 3px 10px rgba(201,168,76,.45)' }}
                    >
                      ★ {dz.popular}
                    </span>
                  )}

                  <img
                    src={foto}
                    alt={v.name}
                    loading="lazy"
                    width={800}
                    height={344}
                    className="w-full aspect-[800/344] object-cover object-[35%_center] rounded-xl"
                  />

                  <div className="px-2 pt-5 pb-1 flex flex-col flex-1">
                    <span
                      className="self-start inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold mb-3"
                      style={{ background: '#fdf8ec', color: '#8a6d1f', border: '1px solid #f3e7c4' }}
                    >
                      <Users size={14} /> {v.persons}
                    </span>

                    <h2 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: '#0f1b2d' }}>{v.name}</h2>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: '#6b7c93' }}>{v.description}</p>

                    <ul className="space-y-2.5 mb-6">
                      {v.features.map((f, j) => {
                        const Ikon = featureIcons[j] || featureIcons[0];
                        return (
                          <li key={f} className="flex items-center gap-3 text-sm font-medium" style={{ color: '#25344a' }}>
                            <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: '28px', height: '28px', background: '#fdf8ec', border: '1px solid #f3e7c4' }}>
                              <Ikon size={14} style={{ color: '#c9a84c' }} />
                            </span>
                            {f}
                          </li>
                        );
                      })}
                    </ul>

                    <Link
                      href="/#booking"
                      className="mt-auto flex items-center justify-center gap-2 rounded-xl font-bold text-sm py-3.5 transition-all hover:-translate-y-0.5"
                      style={oneCikan
                        ? { background: '#c9a84c', color: '#0f1b2d', boxShadow: '0 4px 16px rgba(201,168,76,.35)' }
                        : { background: '#0f1b2d', color: '#fff' }}
                    >
                      {t('book_now')} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Inklusive */}
      <section className="py-16" style={{ background: '#eef2f7' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/70 rounded-3xl px-5 sm:px-10 py-10" style={{ boxShadow: '0 6px 30px rgba(15,27,45,.06)' }}>
            <div className="text-center mb-9">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="hidden sm:block h-px w-8" style={{ background: '#c9a84c' }} />
                <span className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: '#c9a84c' }}>{dz.incEyebrow}</span>
                <span className="hidden sm:block h-px w-8" style={{ background: '#c9a84c' }} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>
                <span style={{ color: '#c9a84c' }}>{dz.incTitleA}</span> {dz.incTitleB}
              </h2>
              <p className="mt-3 text-sm sm:text-base" style={{ color: '#6b7c93' }}>{dz.incSub}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {dz.items.map((it, i) => {
                const Ikon = incIcons[i] || incIcons[0];
                return (
                  <div key={it.title} className="flex items-start gap-3.5 bg-white rounded-xl px-4 py-3.5" style={{ boxShadow: '0 2px 10px rgba(15,27,45,.05)' }}>
                    <span className="flex items-center justify-center rounded-full shrink-0 mt-0.5" style={{ width: '38px', height: '38px', background: '#fdf8ec', border: '1px solid #f3e7c4' }}>
                      <Ikon size={18} style={{ color: '#c9a84c' }} />
                    </span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#0f1b2d' }}>{it.title}</div>
                      <div className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6b7c93' }}>{it.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guven seridi */}
            <div className="mt-9 pt-7 grid grid-cols-2 lg:grid-cols-4 gap-y-6" style={{ borderTop: '1px solid #e3eaf3' }}>
              {dz.trust.map((tr, i) => {
                const Ikon = trustIcons[i] || trustIcons[0];
                return (
                  <div key={tr.small} className={`flex items-center justify-center gap-3 ${i > 0 ? 'lg:border-l' : ''}`} style={{ borderColor: '#e3eaf3' }}>
                    <Ikon size={26} strokeWidth={1.75} style={{ color: '#0f1b2d' }} />
                    <div className="leading-tight">
                      <div className="font-extrabold text-sm" style={{ color: '#0f1b2d' }}>{tr.big}</div>
                      <div className="text-xs" style={{ color: '#6b7c93' }}>{tr.small}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Koyu CTA seridi */}
      <section style={{ background: '#0f1b2d' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
          <Link
            href="/#booking"
            className="flex items-center justify-center gap-2 rounded-xl font-bold text-sm px-7 py-3.5 transition-all hover:-translate-y-0.5 w-full sm:w-auto"
            style={{ background: '#c9a84c', color: '#0f1b2d', boxShadow: '0 4px 18px rgba(201,168,76,.35)' }}
          >
            <Plane size={18} /> {dz.ctaButton} <ArrowRight size={16} />
          </Link>
          <p className="text-sm text-center" style={{ color: '#9fb0c6' }}>{dz.ctaText}</p>
        </div>
      </section>
    </>
  );
}
