import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Phone, Mail, MapPin, Clock, MessageCircle, HelpCircle,
  Calendar, Send, CheckCircle2, Plus, ArrowRight, CalendarCheck, PencilLine, Briefcase, Users, HeartPulse, Camera,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { contactDesign, heroStatIcons } from './contactDesign';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://flughafen-muenchen.taxi';
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
        'x-default': `${baseUrl}${path}`,
      },
    },
  };
}

export default function ContactPage() {
  const t = useTranslations('contact');
  const locale = useLocale();
  const dz = contactDesign[locale] || contactDesign.de;

  const contactItems = [
    {
      icon: Phone,
      label: t('phone'),
      value: CONTACT_INFO.phone,
      href: CONTACT_INFO.phoneHref,
      extra: (
        <a
          href={CONTACT_INFO.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-full transition-all hover:-translate-y-0.5"
          style={{ background: '#25d366', color: '#fff', boxShadow: '0 4px 12px rgba(37,211,102,.25)' }}
        >
          <MessageCircle size={13} /> {t('whatsapp')}
        </a>
      ),
    },
    { icon: Mail, label: t('email'), value: CONTACT_INFO.email, href: `mailto:${CONTACT_INFO.email}`, extra: null },
    {
      icon: MapPin,
      label: t('address'),
      value: CONTACT_INFO.address,
      href: undefined,
      extra: (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(CONTACT_INFO.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-full transition-all hover:-translate-y-0.5"
          style={{ background: '#fff', border: '1px solid #d9e2ee', color: '#1e3a5f' }}
        >
          {dz.routeLabel} <Send size={12} />
        </a>
      ),
    },
    { icon: Clock, label: t('hours'), value: t('hours_value'), href: undefined, extra: null },
  ];

  const faqs = t.raw('faqs') as { q: string; a: string }[];

  const cities = [
    'München', 'Freising', 'Erding', 'Landshut', 'Ingolstadt', 'Augsburg',
    'Rosenheim', 'Dachau', 'Fürstenfeldbruck', 'Ebersberg', 'Salzburg', 'Innsbruck',
  ];

  const prefix = locale === 'de' ? '' : `/${locale}`;
  const lp = (h: string) => (h === '/' ? prefix || '/' : `${prefix}${h}`);
  const quickHref: Record<string, string> = { call: CONTACT_INFO.phoneHref, wa: CONTACT_INFO.whatsapp, mail: `mailto:${CONTACT_INFO.email}` };
  const quickIcon = { call: Phone, wa: MessageCircle, mail: Mail } as const;
  const quickValue: Record<string, string> = { call: CONTACT_INFO.phone, wa: CONTACT_INFO.phone, mail: CONTACT_INFO.email };
  const helpIcons = [CalendarCheck, PencilLine, Briefcase, Users, HeartPulse, Camera];

  return (
    <div className="bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/contact/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/80 to-primary-900/10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-16 sm:px-6 md:pt-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{t('badge')}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">
              {dz.heroTitleA} <span className="text-gold-400">{dz.heroTitleB}</span>
            </h1>
            <p className="mt-4 text-xl font-semibold text-white/95 drop-shadow">{dz.heroTagline}</p>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-white/85 drop-shadow">{dz.heroText}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {dz.heroStats.map((label, i) => {
                const Ikon = heroStatIcons[i] || heroStatIcons[0];
                return (
                  <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
                    <Ikon size={14} className="text-gold-400" /> {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Quick contact cards */}
      <div className="relative z-10 mx-auto -mt-24 grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        {dz.quick.map(([title, text, key]) => {
          const Icon = quickIcon[key as keyof typeof quickIcon];
          const wa = key === 'wa';
          return (
            <a key={key} href={quickHref[key]} {...(wa ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="group flex flex-col rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-200 transition hover:-translate-y-1 hover:ring-gold-300">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${wa ? 'bg-green-500 text-white' : 'bg-gold-400 text-primary-900'}`}><Icon size={22} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 break-all text-sm font-bold text-primary-700 group-hover:underline">{quickValue[key]} <ArrowRight size={15} className="shrink-0" /></span>
            </a>
          );
        })}
      </div>

      {/* How can we help */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[.2em] text-gold-600">{dz.helpEyebrow}</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{dz.helpTitle}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dz.help.map(([title, text, href], i) => {
              const Icon = helpIcons[i];
              return (
                <Link key={title} href={lp(href)} className="group flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-gold-300">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition group-hover:bg-gold-400 group-hover:text-primary-900"><Icon size={20} /></span>
                  <div>
                    <h3 className="flex items-center gap-1.5 font-extrabold text-gray-900">{title} <ArrowRight size={15} className="text-gold-600 transition group-hover:translate-x-1" /></h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Details + booking */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-gray-200 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{t('direct_label')}</p>
            <h2 className="mt-1 text-2xl font-extrabold text-gray-900">{dz.detailsTitle}</h2>
            <div className="mt-4">
              {contactItems.map((item, i) => (
                <div key={i} className={`flex flex-wrap items-center gap-3 py-4 sm:gap-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-600"><item.icon size={19} /></span>
                  <div className="min-w-[140px] flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-gold-600">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-base font-bold text-gray-900 hover:underline">{item.value}</a>
                    ) : (
                      <p className="text-base font-bold text-gray-900">{item.value}</p>
                    )}
                  </div>
                  {item.extra}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-primary-900 to-primary-800 p-7 text-white shadow-xl md:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-primary-900"><Calendar size={20} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{t('booking_badge')}</p>
                <h2 className="text-2xl font-extrabold leading-tight">{t('booking_title')}</h2>
              </div>
            </div>
            <p className="mt-4 text-white/80">{t('booking_text')}</p>
            <div className="mt-6 space-y-3">
              <Link href={prefix || '/'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 py-3.5 font-bold text-primary-900 transition hover:-translate-y-0.5 hover:bg-gold-300">
                {t('book_online')} <ArrowRight size={17} />
              </Link>
              <a href={CONTACT_INFO.phoneHref} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold ring-1 ring-white/30 transition hover:bg-white/10">
                <Phone size={16} /> {t('call')}
              </a>
            </div>
            <ul className="mt-6 space-y-2.5">
              {dz.bookingChecklist.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-white/85"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-gold-400" /> {c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{t('quick_answers_label')}</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{t('faq_title')}</h2>
            </div>
            <Link href={`${prefix}/faq`} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-gray-200 hover:ring-gold-300">
              {dz.allQuestions} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {faqs.map(({ q }, i) => (
              <Link key={i} href={`${prefix}/faq`} className="group flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-200 transition hover:ring-gold-300">
                <span className="flex items-center gap-3 font-semibold text-gray-800"><HelpCircle size={18} className="shrink-0 text-gold-600" /> {q}</span>
                <Plus size={17} className="shrink-0 text-gold-600 transition-transform group-hover:rotate-90" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Service area */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-600">{dz.areaEyebrow}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">{dz.areaTitle}</h2>
            <p className="mt-4 leading-relaxed text-gray-600">{dz.areaText}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {cities.map((city) => <span key={city} className="rounded-full bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-800 ring-1 ring-primary-100">{city}</span>)}
              <span className="rounded-full px-3.5 py-2 text-xs font-medium text-gray-500 ring-1 ring-gray-300">{dz.areaMore}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-gray-50 p-6 ring-1 ring-gray-200">
            <svg viewBox="0 0 260 150" className="w-full" aria-hidden="true">
              <defs>
                <pattern id="contactMapDots" width="7" height="7" patternUnits="userSpaceOnUse">
                  <circle cx="1.2" cy="1.2" r="1.2" fill="#c9d3e0" />
                </pattern>
              </defs>
              <path d="M35 20 C 90 2, 175 5, 220 35 C 250 55, 245 95, 210 120 C 170 145, 100 148, 55 128 C 15 110, 8 75, 12 50 C 15 35, 22 25, 35 20 Z" fill="url(#contactMapDots)" opacity="0.7" />
              {[[75, 30], [195, 25], [40, 95], [222, 100], [118, 138]].map(([x, y]) => <path key={`${x}-${y}`} d={`M130 75 L ${x} ${y}`} fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />)}
              {[
                { x: 75, y: 30, label: 'Ingolstadt', anchor: 'middle', dy: -8 },
                { x: 195, y: 25, label: 'Regensburg', anchor: 'middle', dy: -8 },
                { x: 40, y: 95, label: 'Augsburg', anchor: 'start', dy: 14, dx: -14 },
                { x: 222, y: 100, label: 'Salzburg', anchor: 'end', dy: 16, dx: 6 },
                { x: 118, y: 138, label: 'Innsbruck', anchor: 'start', dy: 4, dx: 8 },
              ].map((c) => (
                <g key={c.label}>
                  <circle cx={c.x} cy={c.y} r="4" fill="#c9a84c" />
                  <circle cx={c.x} cy={c.y} r="1.6" fill="#fff" />
                  <text x={c.x + (c.dx || 0)} y={c.y + c.dy} textAnchor={c.anchor as 'middle' | 'end' | 'start'} fontSize="9.5" fontWeight="700" fill="#5a6a80">{c.label}</text>
                </g>
              ))}
              <circle cx="130" cy="75" r="7" fill="#1e3a5f" />
              <circle cx="130" cy="75" r="2.6" fill="#fff" />
              <text x="130" y="60" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e3a5f">München</text>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
