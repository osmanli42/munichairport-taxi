import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Clock, PlaneLanding, UserCheck, MapPin, Phone, ArrowRight, Building2,
  Luggage, MessageCircle, Coffee, CornerUpRight, Timer, Radar,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://flughafen-muenchen.taxi';
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
        'x-default': `${baseUrl}${path}`,
      },
    },
  };
}

const MODULES = ['A', 'B', 'C', 'D', 'E'];
const PROCESS_ICONS = [Luggage, MessageCircle, UserCheck];
const FAQ_INDEXES = [0, 1, 2, 3] as const;

const eyebrowCls = 'text-xs font-bold uppercase tracking-[0.2em] text-gold-600';
const h2Cls = 'mt-2 text-3xl font-extrabold tracking-tight text-primary-900 md:text-4xl';

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

  const contactButtons = (dark = false) => (
    <div className="flex flex-wrap gap-2">
      <a
        href={CONTACT_INFO.whatsapp}
        className="inline-flex items-center gap-2 rounded-xl bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-95"
      >
        <MessageCircle size={17} /> {t('whatsapp')}
      </a>
      <a
        href={CONTACT_INFO.phoneHref}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
          dark ? 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20' : 'bg-primary-900 text-white hover:bg-primary-800'}`}
      >
        <Phone size={16} /> {CONTACT_INFO.phone}
      </a>
    </div>
  );

  // A schematic path, not a floor plan: luggage → let us know → meeting point.
  const flow = (last: string, LastIcon: typeof Coffee) => (
    <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-3 text-[11px] font-semibold text-gray-600 sm:gap-3 sm:text-xs">
      <span className="flex flex-col items-center gap-1 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-700 ring-1 ring-gray-200"><Luggage size={18} /></span>
        {t('flowBaggage')}
      </span>
      <span className="h-0.5 flex-1 rounded bg-gradient-to-r from-gray-200 to-gold-300" />
      <span className="flex flex-col items-center gap-1 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25d366] text-white"><MessageCircle size={18} /></span>
        {t('flowNotify')}
      </span>
      <span className="h-0.5 flex-1 rounded bg-gradient-to-r from-gold-300 to-gold-500" />
      <span className="flex flex-col items-center gap-1 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400 text-primary-900 shadow"><LastIcon size={18} /></span>
        {last}
      </span>
    </div>
  );

  const terminalCard = (id: string, title: string, spot: string, steps: string[], flowLast: string, FlowIcon: typeof Coffee, photo: string, caption: string, extra?: ReactNode) => (
    <div id={id} className="scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-gray-100">
      <div className="bg-primary-900 px-6 py-5 text-white">
        <div className="flex items-center gap-2 text-gold-300">
          <Building2 size={18} />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400 text-primary-900"><MapPin size={18} /></span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{t('meetingSpot')}</div>
            <div className="text-lg font-extrabold leading-snug">{spot}</div>
          </div>
        </div>
      </div>
      <figure className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={caption} loading="lazy" width={960} height={720} className="aspect-[4/3] w-full object-cover" />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-3 pt-10 text-sm font-semibold text-white">
          {caption}
        </figcaption>
      </figure>
      <div className="space-y-5 p-6">
        {flow(flowLast, FlowIcon)}
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-900 text-xs font-bold text-white">{i + 1}</span>
              <span className="pt-0.5 text-[15px] leading-relaxed text-gray-800">{s}</span>
            </li>
          ))}
        </ol>
        {extra}
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          <Timer size={17} /> {t('maxFive')}
        </div>
      </div>
    </div>
  );

  const t1Steps = [0, 1, 2].map((i) => t(`t1Steps.${i}`));
  const t2Steps = [0, 1, 2].map((i) => t(`t2Steps.${i}`));

  return (
    <div className="bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero-airport.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[30%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/80 to-primary-900/35" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 md:pb-20 md:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold-300 ring-1 ring-white/20 backdrop-blur">
            <PlaneLanding size={14} /> {t('badge')}
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/90 drop-shadow">{t('subtitle')}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[['#terminal-1', t('quickT1')], ['#terminal-2', t('quickT2')]].map(([href, label]) => (
              <a key={href} href={href} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-gold-400 hover:text-primary-900 hover:ring-gold-400">
                <MapPin size={15} /> {label}
              </a>
            ))}
          </div>
          <div className="mt-6">{contactButtons(true)}</div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Process */}
        <section className="pt-14">
          <div className="text-center">
            <h2 className={h2Cls}>{t('processTitle')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">{t('processSubtitle')}</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PROCESS_ICONS.map((Icon, i) => (
              <div key={i} className={`relative rounded-3xl p-6 shadow-sm ring-1 ${i === 1 ? 'bg-primary-900 text-white ring-primary-900' : 'bg-white ring-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${i === 1 ? 'bg-[#25d366] text-white' : 'bg-gold-400 text-primary-900'}`}><Icon size={22} /></span>
                  <span className={`text-5xl font-extrabold ${i === 1 ? 'text-white/15' : 'text-gray-100'}`}>{i + 1}</span>
                </div>
                <h3 className="mt-4 text-xl font-extrabold">{t(`process.${i}.title`)}</h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${i === 1 ? 'text-white/85' : 'text-gray-600'}`}>{t(`process.${i}.text`)}</p>
                {i === 1 && (
                  <div className="mt-4 space-y-2">
                    {contactButtons(true)}
                    <p className="text-xs text-white/70">{t('notifyHint')}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Terminals */}
        <section className="pt-16">
          <div className="text-center">
            <h2 className={h2Cls}>{t('terminalsTitle')}</h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {terminalCard('terminal-1', t('quickT1'), t('t1Spot'), t1Steps, t('flowOutsideRight'), CornerUpRight, '/images/treffpunkt/terminal-1.webp', t('photoT1'), (
              <div className="flex flex-wrap items-center gap-2">
                {MODULES.map((m) => (
                  <span key={m} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700">{m}</span>
                ))}
              </div>
            ))}
            {terminalCard('terminal-2', t('quickT2'), t('t2Spot'), t2Steps, t('flowStarbucks'), Coffee, '/images/treffpunkt/terminal-2-starbucks.webp', t('photoT2'))}
          </div>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><MapPin size={18} /></span>
            <div>
              <h3 className="font-bold text-gray-900">{t('macTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('macText')}</p>
            </div>
          </div>
        </section>

        {/* Promises */}
        <section className="pt-16">
          <h2 className={`${h2Cls} text-center`}>{t('promiseTitle')}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {([[UserCheck, 'signTitle', 'signText'], [Radar, 'trackingTitle', 'trackingText'], [Clock, 'waitTitle', 'waitText']] as const).map(([Icon, title, text], i) => (
              <div key={title} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
                {i === 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/images/biz-2-abholschild.webp" alt={t('signTitle')} loading="lazy" width={335} height={206} className="h-40 w-full object-cover" />
                )}
                <div className="flex-1 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-400 text-primary-900"><Icon size={20} /></span>
                  <h3 className="mt-4 text-lg font-extrabold text-gray-900">{t(title)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{t(text)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl pt-16">
          <h2 className={`${h2Cls} text-center`}>{t('faqTitle')}</h2>
          <div className="mt-8 space-y-3">
            {FAQ_INDEXES.map((i) => (
              <details key={i} className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <summary className="flex cursor-pointer select-none items-center justify-between p-5 font-semibold text-gray-900">
                  {t(`faqs.${i}.q`)}
                  <span className="ml-4 text-xl font-bold text-gold-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{t(`faqs.${i}.a`)}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="relative overflow-hidden rounded-3xl bg-gold-400 p-8 text-center md:p-12">
            <h2 className="text-2xl font-extrabold text-primary-900 md:text-3xl">{t('ctaTitle')}</h2>
            <p className="mt-2 text-primary-900/80">{t('ctaSubtitle')}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={`${prefix}/#booking`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-900 px-8 py-3 font-bold text-white transition hover:bg-primary-800">
                {t('ctaBook')} <ArrowRight size={18} />
              </Link>
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary-900 px-8 py-3 font-bold text-primary-900 transition hover:bg-primary-900 hover:text-white">
                <Phone size={18} /> {CONTACT_INFO.phone}
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
