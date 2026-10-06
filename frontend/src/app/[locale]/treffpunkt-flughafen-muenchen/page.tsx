import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Clock, Plane, UserCheck, MapPin, Phone, ArrowRight, Building2, Luggage, MessageCircle,
  CheckCircle2, ChevronRight, ShieldCheck, Star, User, CircleDot,
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

  const whatsappBtn = (small = false) => (
    <a
      href={CONTACT_INFO.whatsapp}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#25d366] font-bold text-white shadow-sm transition hover:brightness-95 ${small ? 'px-3 py-2 text-xs' : 'px-5 py-3 text-sm'}`}
    >
      <MessageCircle size={small ? 15 : 18} /> {t('whatsapp')} {small && <ArrowRight size={14} className="ml-auto" />}
    </a>
  );

  const terminal = (n: 1 | 2) => {
    const steps = [0, 1, 2].map((i) => t(`t${n}Steps.${i}`));
    const photo = n === 1 ? '/images/treffpunkt/terminal-1.webp' : '/images/treffpunkt/terminal-2-starbucks.webp';
    return (
      <div id={`terminal-${n}`} className="scroll-mt-24 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-gray-100">
        <div className="relative grid bg-primary-900 text-white sm:grid-cols-5">
          {/* Photo: on top on phones, on the right with a fade on wider screens */}
          <div className="relative h-52 sm:order-2 sm:col-span-2 sm:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={t(n === 1 ? 'photoT1' : 'photoT2')} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/10 to-transparent sm:bg-gradient-to-r sm:from-primary-900 sm:via-primary-900/30 sm:to-transparent" />
          </div>
          <div className="relative p-6 sm:order-1 sm:col-span-3">
            <div className="flex items-center gap-2.5 text-gold-400">
              <Plane size={22} className="-rotate-45" />
              <span className="text-xl font-extrabold">{t(n === 1 ? 'quickT1' : 'quickT2')}</span>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-primary-900"><MapPin size={15} /></span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">{t('meetingSpot')}</div>
                <div className="font-extrabold leading-snug">{t(n === 1 ? 't1Spot' : 't2Spot')}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/85">{t(n === 1 ? 't1Desc' : 't2Desc')}</p>
            <details className="group mt-5">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-bold text-primary-900 transition hover:bg-gold-300 [&::-webkit-details-marker]:hidden">
                {t('directions')} <ArrowRight size={16} className="transition-transform group-open:rotate-90" />
              </summary>
              <ol className="mt-4 space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{i + 1}</span>
                    <span className="text-sm leading-relaxed text-white/90">{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gold-300"><Clock size={16} /> {t('maxFive')}</div>
            </details>
          </div>
        </div>

        {/* Schematic path (not a floor plan): terminal → exit → meeting point */}
        <div className="relative flex items-center gap-3 bg-[linear-gradient(#f3f4f6_1px,transparent_1px),linear-gradient(90deg,#f3f4f6_1px,transparent_1px)] bg-[size:22px_22px] px-5 py-5">
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary-900 shadow-sm ring-1 ring-gray-200">
            <Building2 size={15} /> {t(n === 1 ? 'quickT1' : 'quickT2')}
          </span>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="h-10 min-w-0 flex-1" aria-hidden="true">
            <path d="M4 30 C 60 30, 70 8, 120 10 S 180 20, 196 18" fill="none" stroke="#e5b23b" strokeWidth="2.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
            <circle cx="4" cy="30" r="4" fill="#2563eb" />
            <circle cx="120" cy="10" r="3.5" fill="#2563eb" />
          </svg>
          <span className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-md ring-1 ring-gray-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-primary-900"><MapPin size={17} /></span>
            <span className="leading-tight">
              <span className="block text-xs font-extrabold text-gray-900">{t('meetingSpot')}</span>
              <span className="block max-w-[150px] text-[11px] text-gray-600">{t(n === 1 ? 'mapSpotT1' : 'mapSpotT2')}</span>
            </span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Hero — driver with name sign on the right, same scene blurred behind the text */}
      <section className="relative overflow-hidden bg-[#0b1324] text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/treffpunkt/hero-driver.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/treffpunkt/hero-driver.webp" alt={t('signTitle')} className="absolute inset-y-0 right-0 hidden h-full w-[62%] object-cover [mask-image:linear-gradient(to_right,transparent,black_22%)] md:block" fetchPriority="high" />
        <div className="absolute inset-0 bg-[#0b1324]/75 md:bg-transparent md:bg-[linear-gradient(90deg,#0b1324_0%,rgba(11,19,36,0.9)_34%,rgba(11,19,36,0.35)_46%,transparent_58%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 md:pb-12 md:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/60 bg-primary-900/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold-400 backdrop-blur">
            <Plane size={14} className="-rotate-45" /> {t('badge')}
          </div>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight drop-shadow md:text-7xl">
            {t('titleA')}<br /><span className="text-gold-400">{t('titleB')}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/90 drop-shadow">
            {t('subtitle')}<br />{t('subtitle2')}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {(['#terminal-1', '#terminal-2'] as const).map((href, i) => (
              <a key={href} href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-gold-400 hover:text-primary-900">
                <MapPin size={15} /> {t(i === 0 ? 'quickT1' : 'quickT2')}
              </a>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {whatsappBtn()}
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold ring-1 ring-white/40 backdrop-blur transition hover:bg-white/10">
              <Phone size={17} /> {CONTACT_INFO.phone}
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm font-semibold text-white/90">
            {[t('trackingTitle'), t('waitTitle'), t('trustPersonal')].map((s) => (
              <li key={s} className="flex items-center gap-2"><CheckCircle2 size={18} className="text-gold-400" /> {s}</li>
            ))}
          </ul>
        </div>
        {/* Phones: the photo below the text instead of behind it */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/treffpunkt/hero-driver.webp" alt="" aria-hidden="true" className="relative block h-64 w-full object-cover object-[55%_center] md:hidden" />
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* How it works */}
        <section className="pt-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-900">
              {t('eyebrowHow')} <span className="h-0.5 w-8 rounded bg-gold-400" />
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-primary-900 md:text-4xl">{t('processTitle')}</h2>
            <p className="mt-2 text-gray-600">{t('processSubtitle')}</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
            {[0, 1, 2].map((i) => (
              <div key={i} className="contents">
                <div className="flex overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-gray-100">
                  <div className="flex min-w-0 flex-1 flex-col p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-extrabold text-primary-900">{i + 1}</span>
                      <h3 className="font-extrabold leading-tight text-gray-900">{t(`process.${i}.title`)}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">{t(`process.${i}.text`)}</p>
                    {i === 0 && (
                      <div className="mt-auto flex items-center gap-2.5 pt-4 text-sm text-gray-700">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-900"><Luggage size={17} /></span>
                        {t('step1Bullet')}
                      </div>
                    )}
                    {i === 1 && (
                      <div className="mt-auto flex flex-col gap-2 pt-4">
                        {whatsappBtn(true)}
                        <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold text-primary-900 ring-1 ring-gray-300 transition hover:bg-gray-50">
                          <Phone size={14} /> {CONTACT_INFO.phone} <ArrowRight size={14} className="ml-auto" />
                        </a>
                      </div>
                    )}
                    {i === 2 && (
                      <div className="mt-auto space-y-2 pt-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-900"><UserCheck size={16} /></span>{t('step3Bullet')}</div>
                        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-900"><Clock size={16} /></span>{t('maxFive')}</div>
                      </div>
                    )}
                  </div>
                  <div className="relative hidden w-[32%] shrink-0 sm:block">
                    {i === 1 ? (
                      // Stylised phone with WhatsApp — no photo needed
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <div className="flex h-32 w-[72px] rotate-[-8deg] flex-col items-center justify-center rounded-[18px] border-4 border-gray-800 bg-gray-900 shadow-xl">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-white"><MessageCircle size={24} /></span>
                          <span className="mt-1.5 text-[9px] font-semibold text-white/80">WhatsApp</span>
                        </div>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/images/hero-airport.webp" alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover ${i === 0 ? 'object-[14%_center]' : 'object-[51%_center]'}`} />
                    )}
                  </div>
                </div>
                {i < 2 && <ArrowRight className="hidden self-center text-gold-400 lg:block" size={24} />}
              </div>
            ))}
          </div>
        </section>

        {/* Terminals */}
        <section className="pt-14">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-primary-900 md:text-3xl">{t('terminalsTitle')}</h2>
            <span className="h-0.5 w-10 rounded bg-gold-400" />
          </div>
          <p className="mt-2 text-gray-600">{t('terminalsSubtitle')}</p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {terminal(1)}
            {terminal(2)}
          </div>
        </section>

        {/* MAC */}
        <section className="pt-6">
          <div className="grid overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-gray-100 md:grid-cols-[1.2fr_2fr]">
            {/* Stylised direction sign */}
            <div className="relative flex min-h-[130px] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#1e3a8a] to-primary-900 px-6 py-5 text-white">
              <div className="absolute inset-x-0 top-0 h-6 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.25)_0_2px,transparent_2px_18px)]" />
              <div className="text-lg font-semibold italic text-white/90">München Airport Center</div>
              <div className="mt-2 flex items-center gap-4 text-2xl font-extrabold">
                <span>← T1</span><span className="text-gold-400">MAC</span><span>T2 →</span>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <div className="flex flex-1 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-primary-900"><MapPin size={18} /></span>
                <div>
                  <h3 className="font-extrabold text-gray-900">{t('macTitle')}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('macText')}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
                <Building2 size={22} className="text-primary-700" />
                <div className="leading-tight">
                  <div className="text-sm font-extrabold text-gray-900">{t('macCentral')}</div>
                  <div className="text-xs text-gray-600">{t('macCentralSub')}</div>
                </div>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Promises */}
        <section className="pt-12">
          <div className="grid gap-6 md:grid-cols-3">
            {([[Plane, 'trackingTitle', 'trackingShort'], [Clock, 'waitTitle', 'waitShort'], [User, 'trustPersonal', 'signShort']] as const).map(([Icon, title, text]) => (
              <div key={title} className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold-100 text-primary-900"><Icon size={24} /></span>
                <div>
                  <h3 className="font-extrabold text-gray-900">{t(title)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{t(text)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="grid gap-8 pt-14 lg:grid-cols-[1fr_1.7fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-primary-900">{t('faqTitle')}</h2>
            <p className="mt-2 text-gray-600">{t('faqSubtitle')}</p>
            <span className="mt-4 block h-0.5 w-10 rounded bg-gold-400" />
            <Link href={`${prefix}/faq`} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-5 py-3 text-sm font-bold text-primary-900 transition hover:bg-gold-300">
              {t('faqAll')} <ArrowRight size={16} />
            </Link>
          </div>
          <div className="space-y-3">
            {FAQ_INDEXES.map((i) => (
              <details key={i} className="group rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  <CircleDot size={15} className="shrink-0 text-primary-700" />
                  <span className="flex-1">{t(`faqs.${i}.q`)}</span>
                  <span className="text-xl font-bold text-gold-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="px-4 pb-4 pl-11 text-sm leading-relaxed text-gray-600">{t(`faqs.${i}.a`)}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-14">
          <div className="relative overflow-hidden rounded-3xl bg-primary-900 text-white shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/hero-airport.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-right opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/90 to-primary-900/40" />
            <div className="relative flex flex-col gap-8 p-8 md:p-10 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-extrabold md:text-4xl">{t('ctaTitleA')} <span className="text-gold-400">{t('ctaTitleB')}</span></h2>
                <p className="mt-2 text-white/85">{t('ctaSubtitle')}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href={`${prefix}/#booking`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-7 py-3 font-bold text-primary-900 transition hover:bg-gold-300">
                    {t('ctaBook')} <ArrowRight size={18} />
                  </Link>
                  <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-lg px-7 py-3 font-bold ring-1 ring-white/50 transition hover:bg-white/10">
                    <Phone size={18} /> {CONTACT_INFO.phone}
                  </a>
                </div>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
                {([[ShieldCheck, 'badgeFixed'], [Clock, 'badgePunctual'], [Star, 'badgePersonal']] as const).map(([Icon, k]) => (
                  <li key={k} className="flex items-center gap-2"><Icon size={18} className="text-gold-400" /> {t(k)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
