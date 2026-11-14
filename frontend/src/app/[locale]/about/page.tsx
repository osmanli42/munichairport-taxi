import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AboutGuide } from '@/components/PageGuide';
import type { Metadata } from 'next';
import { CONTACT_INFO } from '@/lib/utils';
import Link from 'next/link';
import {
  ShieldCheck, Clock, Tag, Globe, Phone, Mail, MapPin, Star, Users,
  Trophy, MessageCircle, ArrowRight, BadgeCheck, Car,
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

  const prefix = locale === 'de' ? '' : `/${locale}`;
  const valueIcons = [Trophy, Clock, Tag, Globe, BadgeCheck, Car];

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
    <div className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/about/hero-v2.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/80 to-primary-900/10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 md:pb-20 md:pt-24 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-gold-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-400 ring-1 ring-gold-400/40">{t('badge')}</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
              Flughafen-München<span className="text-gold-400">.TAXI</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/90 drop-shadow">{dz.heroSub}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={prefix || '/'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-3.5 font-bold text-primary-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-gold-300">{dz.heroBook} <ArrowRight size={18} /></Link>
              <Link href={`${prefix}/contact`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-7 py-3.5 font-bold ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">{dz.heroContact}</Link>
            </div>
          </div>
          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-4 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur md:grid-cols-4">
            {stats.map((s) => {
              const Ikon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/40"><Ikon size={18} className="text-gold-400" /></span>
                  <div className="leading-tight">
                    <dt className="text-lg font-extrabold">{s.value}</dt>
                    <dd className="text-xs text-white/75">{s.label}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/about/freising.webp" alt="" loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
            <div className="absolute -bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-xl ring-1 ring-gray-200">
              <MapPin size={22} className="text-gold-600" />
              <div className="leading-tight">
                <div className="text-sm font-extrabold text-gray-900">Freising</div>
                <div className="text-xs text-gray-500">{CONTACT_INFO.address.split(',')[0]}</div>
              </div>
            </div>
          </div>
          <div className="pt-6 lg:pt-0">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{dz.storyEyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{dz.storyTitle}</h2>
            <p className="mt-5 leading-relaxed text-gray-600">{dz.storyP1}</p>
            <p className="mt-4 leading-relaxed text-gray-600">{dz.storyP2}</p>
            <figure className="mt-8 rounded-2xl bg-gold-400/10 p-6 ring-1 ring-gold-400/30">
              <blockquote className="text-lg font-medium italic leading-relaxed text-gray-800">&ldquo;{dz.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-900 text-gold-400"><Users size={18} /></span>
                <div className="leading-tight">
                  <div className="text-sm font-bold text-gray-900">{CONTACT_INFO.owners}</div>
                  <div className="text-xs text-gray-500">{t('owner')}</div>
                </div>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-600">{dz.valuesEyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{dz.valuesTitle}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dz.values.map(([title, text], i) => {
              const Icon = valueIcons[i];
              return (
                <div key={title} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-300">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition group-hover:bg-gold-400 group-hover:text-primary-900"><Icon size={22} /></span>
                  <h3 className="mt-4 font-extrabold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Fleet */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{dz.fleetEyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{dz.fleetTitle}</h2>
            <p className="mt-4 leading-relaxed text-white/80">{dz.fleetText}</p>
            <Link href={`${prefix}/vehicles`} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-primary-900 hover:bg-gold-300">{dz.fleetCta} <ArrowRight size={18} /></Link>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/business/trust-fleet-v2.webp" alt="" loading="lazy" className="aspect-video w-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/10" />
        </div>
      </section>

      {/* Service area */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{t('section_area')}</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{t('area_title')}</h2>
              <p className="mt-4 leading-relaxed text-gray-600">{t('area_text')}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {cities.map((city) => (
                  <span key={city} className="rounded-full bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-800 ring-1 ring-primary-100">{city}</span>
                ))}
                <span className="rounded-full px-3.5 py-2 text-xs font-medium text-gray-500 ring-1 ring-dashed ring-gray-300">{dz.areaMore}</span>
              </div>
              <Link href={`${prefix}/leistungen`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-primary-700 hover:underline">{dz.areaCta} <ArrowRight size={15} /></Link>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sightseeing/hero.webp" alt="" loading="lazy" className="aspect-[16/10] w-full rounded-3xl object-cover shadow-xl" />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary-900 to-primary-800 p-8 text-white shadow-xl md:p-10">
            <span className="inline-block rounded-full bg-gold-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-400 ring-1 ring-gold-400/40">{t('contact')}</span>
            <h2 className="mt-4 text-3xl font-extrabold">{dz.ctaTitle}</h2>
            <p className="mt-3 leading-relaxed text-white/80">{dz.ctaText}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-bold text-primary-900 transition hover:-translate-y-0.5 hover:bg-gold-300"><Phone size={17} /> {dz.ctaCall}</a>
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-green-600"><MessageCircle size={17} /> {dz.ctaWhatsapp}</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {dz.contactExtra.map((c, i) => {
                const Ikon = contactExtraIcons[i] || contactExtraIcons[0];
                return <div key={c} className="flex items-center gap-2 text-xs font-medium text-white/75"><Ikon size={15} className="text-gold-400" /> {c}</div>;
              })}
            </div>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            {[
              { icon: Users, label: t('owner'), value: CONTACT_INFO.owners, href: undefined },
              { icon: Phone, label: t('label_phone'), value: CONTACT_INFO.phone, href: CONTACT_INFO.phoneHref },
              { icon: Mail, label: t('label_email'), value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}` },
              { icon: MapPin, label: t('label_address'), value: CONTACT_INFO.address, href: undefined },
              { icon: Clock, label: t('label_availability'), value: t('availability_value'), href: undefined },
            ].map((item, i, arr) => (
              <div key={item.label} className={`flex items-start gap-4 py-4 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''} ${i === 0 ? 'pt-0' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-600"><item.icon size={18} /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gold-600">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="text-sm font-semibold text-gray-900 hover:underline">{item.value}</a>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AboutGuide locale={locale} />
    </div>
  );
}
