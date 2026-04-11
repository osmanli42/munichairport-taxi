import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.munichairport.taxi';
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

  const contactItems = [
    {
      icon: Phone,
      emoji: '📞',
      label: t('phone'),
      value: CONTACT_INFO.phone,
      href: CONTACT_INFO.phoneHref,
      extra: (
        <a
          href={CONTACT_INFO.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
          style={{ background: '#25d366', color: '#fff', boxShadow: '0 4px 12px rgba(37,211,102,.25)' }}
        >
          <MessageCircle size={13} /> {t('whatsapp')}
        </a>
      ),
    },
    {
      icon: Mail,
      emoji: '✉️',
      label: t('email'),
      value: CONTACT_INFO.email,
      href: `mailto:${CONTACT_INFO.email}`,
      extra: null,
    },
    {
      icon: MapPin,
      emoji: '📍',
      label: t('address'),
      value: CONTACT_INFO.address,
      href: undefined,
      extra: null,
    },
    {
      icon: Clock,
      emoji: '🕐',
      label: t('hours'),
      value: t('hours_value'),
      href: undefined,
      extra: null,
    },
  ];

  const faqs = [
    { q: 'Wie früh kann ich buchen?', a: 'Sie können bis zu einem Jahr im Voraus buchen.' },
    { q: 'Was passiert bei Flugverspätung?', a: 'Wir überwachen Ihren Flug und warten kostenlos bis zu 60 Minuten.' },
    { q: 'Gibt es einen Kindersitz?', a: 'Ja, kostenlos auf Anfrage – bitte bei der Buchung angeben.' },
    { q: 'Kann ich mit Karte zahlen?', a: 'Ja, Kreditkarte vor Fahrtantritt oder Barzahlung am Ende der Fahrt.' },
  ];

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>

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
            Kontakt
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            {t('title')}
          </h1>
          <p className="text-lg" style={{ color: '#7a9ab8' }}>{t('subtitle')}</p>

          {/* Quick contact strip */}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={CONTACT_INFO.phoneHref}
              className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #c9a84c, #d4af6a)',
                color: '#0f1b2d',
                boxShadow: '0 4px 16px rgba(201,168,76,.3)',
              }}
            >
              <Phone size={17} /> {CONTACT_INFO.phone}
            </a>
            <a
              href={CONTACT_INFO.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
              style={{
                background: '#25d366',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(37,211,102,.25)',
              }}
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left — Contact info */}
          <div>
            {/* Header card */}
            <div
              className="rounded-2xl overflow-hidden mb-4"
              style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              <div
                className="flex items-center gap-4 px-7 py-5"
                style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)' }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)' }}
                >
                  📋
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>Direkt erreichen</span>
                  <h2 className="text-lg font-bold text-white leading-tight">Kontaktinformationen</h2>
                </div>
              </div>
            </div>

            {/* Contact cards */}
            <div className="space-y-3">
              {contactItems.map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
                >
                  <div className="flex items-start gap-4 px-6 py-5">
                    <div
                      className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)' }}
                    >
                      <item.icon size={18} style={{ color: '#c9a84c' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#c9a84c' }}>
                        {item.label}
                      </p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="text-base font-bold hover:underline block truncate"
                          style={{ color: '#0f1b2d' }}
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-base font-bold" style={{ color: '#0f1b2d' }}>{item.value}</p>
                      )}
                      {item.extra}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — CTA + FAQ */}
          <div className="space-y-4">

            {/* Booking CTA card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)',
                border: '1px solid rgba(201,168,76,.3)',
              }}
            >
              <div className="px-7 py-6 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                <div
                  className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-3"
                  style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
                >
                  Buchung
                </div>
                <h2 className="text-xl font-extrabold text-white mb-1">Schnell & einfach buchen</h2>
                <p className="text-sm" style={{ color: '#7a9ab8' }}>Buchen Sie online oder kontaktieren Sie uns direkt.</p>
              </div>
              <div className="px-7 py-6 space-y-3">
                <a
                  href="/"
                  className="flex items-center justify-center gap-2 w-full font-bold text-sm py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.15)',
                    color: '#fff',
                  }}
                >
                  Online buchen →
                </a>
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="flex items-center justify-center gap-2 w-full font-bold text-sm py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #c9a84c, #d4af6a)',
                    color: '#0f1b2d',
                    boxShadow: '0 4px 16px rgba(201,168,76,.3)',
                  }}
                >
                  <Phone size={15} /> Jetzt anrufen
                </a>
                <a
                  href={CONTACT_INFO.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full font-bold text-sm py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{
                    background: '#25d366',
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(37,211,102,.25)',
                  }}
                >
                  <MessageCircle size={15} /> WhatsApp schreiben
                </a>
              </div>
            </div>

            {/* FAQ card */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
            >
              <div
                className="flex items-center gap-4 px-7 py-5"
                style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)' }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)' }}
                >
                  ❓
                </div>
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>Schnellantworten</span>
                  <h3 className="text-lg font-bold text-white leading-tight">Häufige Fragen</h3>
                </div>
              </div>
              <div className="px-7 py-5 space-y-4 text-sm" style={{ color: '#4a6280' }}>
                {faqs.map(({ q, a }, i) => (
                  <div
                    key={i}
                    className={i > 0 ? 'pt-4' : ''}
                    style={i > 0 ? { borderTop: '1px solid #f0f4f8' } : {}}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full" style={{ background: '#c9a84c', marginTop: '6px' }} />
                      <p className="font-bold text-sm" style={{ color: '#0f1b2d' }}>{q}</p>
                    </div>
                    <p className="pl-3.5 text-sm" style={{ color: '#6b7c93' }}>{a}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
