import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Clock, PlaneTakeoff, UserCheck, MapPin, Phone, ArrowRight,
  Building2, DoorOpen, Milestone, PhoneCall,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.flughafen-muenchen.taxi';
  const path = '/treffpunkt-flughafen-muenchen';
  return {
    title: t('meeting_point_title'),
    description: t('meeting_point_description'),
    alternates: {
      canonical: locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`,
      languages: {
        de: `${baseUrl}${path}`,
        en: `${baseUrl}/en${path}`,
        tr: `${baseUrl}/tr${path}`,
      },
    },
  };
}

const MODULES = ['A', 'B', 'C', 'D', 'E', 'F'];
const STEP_ICONS = [PlaneTakeoff, DoorOpen, UserCheck, PhoneCall];
const FAQ_INDEXES = [0, 1, 2, 3] as const;

export default function MeetingPointPage() {
  const t = useTranslations('meetingPoint');
  const locale = useLocale();
  const prefix = locale === 'de' ? '' : `/${locale}`;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_INDEXES.map((i) => ({
      '@type': 'Question',
      name: t(`faqs.${i}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`faqs.${i}.a`) },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
          <span className="inline-block bg-white/10 text-gold-300 text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full mb-4">
            {t('badge')}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-primary-100 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </div>

      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <p className="text-gray-700 leading-relaxed mb-12 text-lg text-center max-w-3xl mx-auto">{t('intro')}</p>

        {/* Illustration placeholder — icon-based meet & greet diagram (no stock photo available) */}
        <div className="mb-14 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-primary-600 flex items-center justify-center">
                <PlaneTakeoff size={36} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-500">Terminal 1 / 2</span>
            </div>
            <ArrowRight size={28} className="text-gray-300 rotate-90 md:rotate-0" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-gold-400 flex items-center justify-center">
                <UserCheck size={36} className="text-gray-900" />
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {t('signTitle')}
              </span>
            </div>
            <ArrowRight size={28} className="text-gray-300 rotate-90 md:rotate-0" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-2xl bg-primary-600 flex items-center justify-center">
                <Milestone size={36} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {t('waitTitle')}
              </span>
            </div>
          </div>
        </div>

        {/* 3 highlight cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          <div className="rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Clock size={22} />
            </div>
            <h2 className="font-bold text-gray-900 mb-2">{t('waitTitle')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('waitText')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
              <PlaneTakeoff size={22} />
            </div>
            <h2 className="font-bold text-gray-900 mb-2">{t('trackingTitle')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('trackingText')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center mb-4">
              <UserCheck size={22} />
            </div>
            <h2 className="font-bold text-gray-900 mb-2">{t('signTitle')}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{t('signText')}</p>
          </div>
        </div>

        {/* Terminals */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('terminalsTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={20} className="text-primary-600" />
                <h3 className="font-bold text-gray-900">{t('terminal1Title')}</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('terminal1Text')}</p>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((m) => (
                  <span key={m} className="w-8 h-8 rounded-lg bg-primary-50 text-primary-700 text-xs font-bold flex items-center justify-center">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={20} className="text-gold-500" />
                <h3 className="font-bold text-gray-900">{t('terminal2Title')}</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{t('terminal2Text')}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={20} className="text-primary-600" />
              <h3 className="font-bold text-gray-900">{t('macTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('macText')}</p>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('howToTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {STEP_ICONS.map((Icon, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 p-5">
                <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mb-3">
                  {i + 1}
                </div>
                <Icon size={20} className="text-primary-600 mb-2" />
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{t(`steps.${i}.title`)}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{t(`steps.${i}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('faqTitle')}</h2>
          <div className="space-y-4">
            {FAQ_INDEXES.map((i) => (
              <details key={i} className="border border-gray-200 rounded-xl overflow-hidden group">
                <summary className="flex justify-between items-center cursor-pointer p-4 font-semibold text-gray-800 hover:bg-gray-50 select-none">
                  {t(`faqs.${i}.q`)}
                  <span className="ml-4 text-gold-500 font-bold text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-4 pb-4 pt-1 text-gray-600 text-sm leading-relaxed">{t(`faqs.${i}.a`)}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <div className="bg-gold-400 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('ctaTitle')}</h3>
          <p className="text-gray-700 mb-6">{t('ctaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/#booking" className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-8 py-3 rounded-xl transition">
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
