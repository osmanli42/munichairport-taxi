import { useTranslations, useLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Phone, Mail, MapPin, Clock, MessageCircle, ClipboardList, HelpCircle,
  Calendar, Send, CheckCircle2, Plus, ArrowRight,
} from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { contactDesign, heroStatIcons } from './contactDesign';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.flughafen-muenchen.taxi';
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

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>

      {/* Hero — arka plan tasarim gorselinden kesildi: sagda taksi + M Flughafen
          München terminali + "Mehr als ein Taxi" el yazisi; diger sayfalarla
          (About/FAQ/Vehicles) tutarli olsun diye koyu lacivert */}
      <section className="relative overflow-hidden text-white py-16" style={{ background: '#0f1b2d' }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 right-0 h-full hidden xl:block" style={{ width: '46%', maxWidth: '560px' }}>
            <img src="/images/contact-bg-right.webp" alt="" width={554} height={348} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #0f1b2d 0%, rgba(15,27,45,0) 30%)' }} />
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:max-w-xl">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px w-8" style={{ background: '#c9a84c' }} />
            <span className="text-xs font-bold tracking-[.2em] uppercase" style={{ color: '#c9a84c' }}>{t('badge')}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-white">
            {dz.heroTitleA} <span style={{ color: '#c9a84c' }}>{dz.heroTitleB}</span>
          </h1>
          <p className="text-lg font-semibold mb-2" style={{ color: '#e2ebf5' }}>{dz.heroTagline}</p>
          <p className="text-sm max-w-md" style={{ color: '#a9bdd4' }}>{dz.heroText}</p>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {dz.heroStats.map((label, i) => {
              const Ikon = heroStatIcons[i] || heroStatIcons[0];
              return (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: '36px', height: '36px', border: '1.5px solid rgba(201,168,76,.5)', background: 'rgba(201,168,76,.12)' }}
                  >
                    <Ikon size={16} style={{ color: '#c9a84c' }} />
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#fff' }}>{label}</span>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Left — Contact info */}
          <div
            className="rounded-2xl px-7 py-7"
            style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#fdf3de' }}>
                <ClipboardList size={19} style={{ color: '#a07820' }} />
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>{t('direct_label')}</span>
                <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>{t('contact_info_title')}</h2>
              </div>
            </div>

            <div>
              {contactItems.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 sm:gap-4 py-4"
                  style={i > 0 ? { borderTop: '1px solid #f0f4f8' } : undefined}
                >
                  <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#fdf3de' }}>
                    <item.icon size={18} style={{ color: '#a07820' }} />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#a07820' }}>
                      {item.label}
                    </p>
                    {item.href ? (
                      <a href={item.href} className="text-base font-bold hover:underline" style={{ color: '#0f1b2d' }}>
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-base font-bold" style={{ color: '#0f1b2d' }}>{item.value}</p>
                    )}
                  </div>
                  {item.extra}
                </div>
              ))}
            </div>
          </div>

          {/* Right — Booking CTA */}
          <div
            className="rounded-2xl px-7 py-7"
            style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)', border: '1px solid rgba(201,168,76,.3)' }}
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)' }}>
                <Calendar size={19} style={{ color: '#c9a84c' }} />
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>{t('booking_badge')}</span>
                <h2 className="text-lg font-bold leading-tight text-white">{t('booking_title')}</h2>
              </div>
            </div>
            <p className="text-sm mb-6" style={{ color: '#a9bdd4' }}>{t('booking_text')}</p>

            <div className="space-y-3 mb-6">
              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full font-bold text-sm py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #c9a84c, #d4af6a)', color: '#0f1b2d', boxShadow: '0 4px 16px rgba(201,168,76,.3)' }}
              >
                {t('book_online')} <ArrowRight size={16} />
              </Link>
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2 w-full font-bold text-sm py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: 'transparent', border: '1.5px solid rgba(201,168,76,.5)', color: '#fff' }}
              >
                <Phone size={15} /> {t('call')}
              </a>
            </div>

            <div className="space-y-2.5">
              {dz.bookingChecklist.map((c) => (
                <div key={c} className="flex items-start gap-2.5 text-sm" style={{ color: '#c3d2e3' }}>
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: '#c9a84c' }} />
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ teaser */}
        <div
          className="rounded-2xl px-7 py-7 mb-8"
          style={{ background: '#fff', border: '1.5px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
        >
          <div className="flex flex-wrap items-center gap-4 justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: '#fdf3de' }}>
                <HelpCircle size={19} style={{ color: '#a07820' }} />
              </div>
              <div>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>{t('quick_answers_label')}</span>
                <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>{t('faq_title')}</h2>
              </div>
            </div>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 font-bold text-sm px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
              style={{ background: '#fff', border: '1.5px solid #d9e2ee', color: '#0f1b2d' }}
            >
              {dz.allQuestions} <ArrowRight size={15} />
            </Link>
          </div>

          <div>
            {faqs.map(({ q }, i) => (
              <Link
                key={i}
                href="/faq"
                className="flex items-center justify-between gap-3 py-3.5 group"
                style={i > 0 ? { borderTop: '1px solid #f0f4f8' } : undefined}
              >
                <span className="text-sm font-semibold" style={{ color: '#25344a' }}>{q}</span>
                <Plus size={16} className="shrink-0 transition-transform group-hover:rotate-90" style={{ color: '#a07820' }} />
              </Link>
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
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: '#fdf3de' }}>
                <MapPin size={19} style={{ color: '#a07820' }} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase block mb-1" style={{ color: '#c9a84c' }}>
                {dz.areaEyebrow}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight" style={{ color: '#0f1b2d' }}>{dz.areaTitle}</h2>
            </div>
            <p className="text-sm leading-relaxed lg:pt-14" style={{ color: '#4a6280' }}>
              {dz.areaText}
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

            {/* Decorative mini map: München merkez + 5 komsu sehir */}
            <svg viewBox="0 0 260 150" className="hidden lg:block shrink-0" style={{ width: '250px', height: '144px' }} aria-hidden="true">
              <defs>
                <pattern id="contactMapDots" width="7" height="7" patternUnits="userSpaceOnUse">
                  <circle cx="1.2" cy="1.2" r="1.2" fill="#c9d3e0" />
                </pattern>
              </defs>
              <path d="M35 20 C 90 2, 175 5, 220 35 C 250 55, 245 95, 210 120 C 170 145, 100 148, 55 128 C 15 110, 8 75, 12 50 C 15 35, 22 25, 35 20 Z" fill="url(#contactMapDots)" opacity="0.7" />

              {/* baglantilar */}
              <path d="M130 75 L 75 30" fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />
              <path d="M130 75 L 195 25" fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />
              <path d="M130 75 L 40 95" fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />
              <path d="M130 75 L 222 100" fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />
              <path d="M130 75 L 118 138" fill="none" stroke="#c9a84c" strokeWidth="1.6" strokeDasharray="3 3" />

              {/* uydu sehirler */}
              {[
                { x: 75, y: 30, label: 'Ingolstadt', anchor: 'middle', dy: -8 },
                { x: 195, y: 25, label: 'Regensburg', anchor: 'middle', dy: -8 },
                { x: 40, y: 95, label: 'Augsburg', anchor: 'end', dy: 4, dx: -8 },
                { x: 222, y: 100, label: 'Salzburg', anchor: 'start', dy: 4, dx: 8 },
                { x: 118, y: 138, label: 'Innsbruck', anchor: 'middle', dy: 14 },
              ].map((c) => (
                <g key={c.label}>
                  <circle cx={c.x} cy={c.y} r="4" fill="#c9a84c" />
                  <circle cx={c.x} cy={c.y} r="1.6" fill="#fff" />
                  <text x={c.x + (c.dx || 0)} y={c.y + c.dy} textAnchor={c.anchor as 'middle' | 'end' | 'start'} fontSize="9.5" fontWeight="700" fill="#5a6a80">
                    {c.label}
                  </text>
                </g>
              ))}

              {/* merkez: München */}
              <circle cx="130" cy="75" r="7" fill="#1e3a5f" />
              <circle cx="130" cy="75" r="2.6" fill="#fff" />
              <text x="130" y="60" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e3a5f">München</text>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
