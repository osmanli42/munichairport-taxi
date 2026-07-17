import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, Phone, ArrowRight, Check, Users } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

interface RouteDetail {
  slug: string;
  city: string;
  distance_km: number;
  duration_min: number;
  prices: { kombi: number | null; van: number | null; grossraumtaxi: number | null };
}

async function fetchRoute(slug: string): Promise<RouteDetail | null> {
  try {
    const res = await fetch(`${API_URL}/popular-routes/${slug}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function fmtPrice(v: number | null): string {
  return v != null ? `${v.toFixed(2).replace('.', ',')} €` : '—';
}

type Props = { params: { routeSlug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const route = await fetchRoute(params.routeSlug);
  if (!route) return {};
  const t = await getTranslations({ locale: params.locale, namespace: 'routePage' });
  const priceRaw = route.prices.kombi != null ? route.prices.kombi.toFixed(2).replace('.', ',') : '?';
  const baseUrl = 'https://www.flughafen-muenchen.taxi';
  const path = `/${params.routeSlug}`;
  return {
    title: t('seoTitle', { city: route.city, price: priceRaw }),
    description: t('seoDescription', { city: route.city, distance: route.distance_km, duration: route.duration_min, price: priceRaw }),
    alternates: {
      canonical: params.locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${params.locale}${path}`,
      languages: {
        de: `${baseUrl}${path}`,
        en: `${baseUrl}/en${path}`,
        tr: `${baseUrl}/tr${path}`,
      },
    },
  };
}

const VEHICLE_KEYS = ['kombi', 'van', 'grossraumtaxi'] as const;
const FAQ_INDEXES = [0, 1, 2, 3] as const;

export default async function RouteLandingPage({ params }: Props) {
  const route = await fetchRoute(params.routeSlug);
  if (!route) notFound();

  const t = await getTranslations({ locale: params.locale, namespace: 'routePage' });
  const locale = params.locale;
  const prefix = locale === 'de' ? '' : `/${locale}`;
  const priceRaw = route.prices.kombi != null ? route.prices.kombi.toFixed(2).replace('.', ',') : '?';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_INDEXES.map((i) => ({
      '@type': 'Question',
      name: t(`faqs.${i}.q`, { city: route.city }),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`faqs.${i}.a`, { city: route.city, price: priceRaw, distance: route.distance_km, duration: route.duration_min }),
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14">
          <nav className="text-sm text-primary-200 mb-6 flex items-center gap-1 flex-wrap">
            <Link href={`${prefix}/`} className="hover:text-white transition-colors">{t('breadcrumbHome')}</Link>
            <ArrowRight size={12} />
            <span className="text-white">{route.city}</span>
          </nav>
          <span className="inline-block bg-white/10 text-gold-300 text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full mb-4">
            {t('badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">{t('heroTitle', { city: route.city })}</h1>
          <p className="text-xl text-primary-100">
            {t('heroSubtitle', { distance: route.distance_km, duration: route.duration_min, price: priceRaw })}
          </p>
        </div>
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <p className="text-gray-700 leading-relaxed mb-10 text-lg">
          {t('intro', { city: route.city, distance: route.distance_km, duration: route.duration_min })}
        </p>

        {/* Quick info cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <MapPin className="mx-auto mb-1 text-gold-500" size={22} />
            <div className="text-2xl font-bold text-gray-900">{route.distance_km} km</div>
            <div className="text-xs text-gray-500 mt-1">{t('cardDistance')}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <Clock className="mx-auto mb-1 text-gold-500" size={22} />
            <div className="text-2xl font-bold text-gray-900">~{route.duration_min} {locale === 'de' ? 'Min' : locale === 'tr' ? 'dk' : 'min'}</div>
            <div className="text-xs text-gray-500 mt-1">{t('cardDuration')}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center col-span-2 md:col-span-1">
            <Users className="mx-auto mb-1 text-gold-500" size={22} />
            <div className="text-2xl font-bold text-gray-900">{fmtPrice(route.prices.kombi)}</div>
            <div className="text-xs text-gray-500 mt-1">{t('cardFrom')}</div>
          </div>
        </div>

        {/* Price table */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('priceTableTitle')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  {[0, 1, 2, 3].map((i) => (
                    <th key={i} className={`p-3 ${i === 0 ? 'text-left rounded-tl-lg' : i === 3 ? 'text-right rounded-tr-lg' : 'text-center'}`}>
                      {t(`tableHeaders.${i}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VEHICLE_KEYS.map((v) => (
                  <tr key={v} className="border-b border-gray-100 hover:bg-yellow-50">
                    <td className="p-3 font-medium">{t(`vehicles.${v}.name`)}</td>
                    <td className="p-3 text-center">{t(`vehicles.${v}.pax`)}</td>
                    <td className="p-3 text-center">{t(`vehicles.${v}.luggage`)}</td>
                    <td className="p-3 text-right font-bold text-gold-600">{fmtPrice(route.prices[v])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Included */}
        <section className="mb-12 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="font-semibold text-blue-900 mb-3">{t('includedTitle')}</p>
          <ul className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-900">
                <Check size={16} className="text-blue-600 shrink-0 mt-0.5" />
                {t(`included.${i}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* Meeting point teaser */}
        <section className="mb-12 rounded-2xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('meetingTitle')}</h2>
            <p className="text-gray-600 text-sm">{t('meetingText')}</p>
          </div>
          <Link
            href={`${prefix}/treffpunkt-flughafen-muenchen`}
            className="shrink-0 inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            {t('meetingCta')} <ArrowRight size={16} />
          </Link>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('faqTitle', { city: route.city })}</h2>
          <div className="space-y-4">
            {FAQ_INDEXES.map((i) => (
              <details key={i} className="border border-gray-200 rounded-xl overflow-hidden group">
                <summary className="flex justify-between items-center cursor-pointer p-4 font-semibold text-gray-800 hover:bg-gray-50 select-none">
                  {t(`faqs.${i}.q`, { city: route.city })}
                  <span className="ml-4 text-gold-500 font-bold text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-gray-600 text-sm leading-relaxed">
                  {t(`faqs.${i}.a`, { city: route.city, price: priceRaw, distance: route.distance_km, duration: route.duration_min })}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="bg-gold-400 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('ctaTitle', { city: route.city })}</h3>
          <p className="text-gray-700 mb-6">{t('ctaSubtitle', { price: priceRaw })}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`${prefix}/#booking`}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl transition"
            >
              {t('ctaBook')}
            </Link>
            <a
              href={CONTACT_INFO.phoneHref}
              className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold px-8 py-3 rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Phone size={18} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
