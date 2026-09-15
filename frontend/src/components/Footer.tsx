import Link from 'next/link';
import { Caveat } from 'next/font/google';
import { useTranslations, useLocale } from 'next-intl';
import { Phone, Mail, ShieldCheck } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

const caveat = Caveat({ subsets: ['latin'], weight: ['600'], display: 'swap' });

const TEXT = {
  de: { quick: 'Schnellzugriff', badgeA: 'Sicher. Pünktlich.', badgeB: 'Professionell.', signature: 'Mehr als ein Taxi.', business: 'Business Service' },
  en: { quick: 'Quick links', badgeA: 'Safe. Punctual.', badgeB: 'Professional.', signature: 'More than a taxi.', business: 'Business Service' },
  tr: { quick: 'Hızlı erişim', badgeA: 'Güvenli. Dakik.', badgeB: 'Profesyonel.', signature: 'Taksiden fazlası.', business: 'Kurumsal Hizmet' },
} as const;

export default function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const tx = TEXT[locale as keyof typeof TEXT] || TEXT.de;
  const year = new Date().getFullYear();

  const linkCls = 'hover:text-gold-400 transition-colors';
  const iconCls = 'flex items-center justify-center w-9 h-9 rounded-full text-white hover:text-gold-400 transition-colors';

  return (
    <footer className="text-white mt-auto" style={{ background: '#0b1a2e' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.15fr_1.5fr_0.7fr_1.15fr] gap-10 lg:gap-8">
          {/* Brand */}
          <div>
            <Link href="/" aria-label={t('company')}>
              <img src="/images/logo-wide.webp" alt="Flughafen-muenchen.TAXI" width={823} height={132} loading="lazy" className="h-11 w-auto max-w-full object-contain object-left" />
            </Link>
            <p className="mt-4 text-sm text-white/85">{t('tagline')}.</p>
            <div className="flex items-center gap-2 mt-4 -ml-2">
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className={iconCls} aria-label="WhatsApp">
                <svg className="w-[22px] h-[22px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a href={CONTACT_INFO.phoneHref} className={iconCls} aria-label="Telefon">
                <Phone size={21} />
              </a>
              <a href={`mailto:${CONTACT_INFO.email}`} className={iconCls} aria-label="E-Mail">
                <Mail size={21} />
              </a>
            </div>
          </div>

          {/* Quick links — two columns */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4">{tx.quick}</h3>
            <div className="grid grid-cols-2 gap-x-6 whitespace-nowrap">
              <ul className="space-y-2.5 text-sm text-white/80">
                <li><Link href="/" className={linkCls}>{nav('home')}</Link></li>
                <li><Link href="/vehicles" className={linkCls}>{nav('vehicles')}</Link></li>
                <li><Link href="/business" className={linkCls}>{tx.business}</Link></li>
                <li><Link href="/faq" className={linkCls}>{nav('faq')}</Link></li>
              </ul>
              <ul className="space-y-2.5 text-sm text-white/80">
                <li><Link href="/about" className={linkCls}>{nav('about')}</Link></li>
                <li><Link href="/contact" className={linkCls}>{nav('contact')}</Link></li>
                <li><Link href="/treffpunkt-flughafen-muenchen" className={linkCls}>{t('meetingPoint')}</Link></li>
                <li><Link href="/buchung-verwalten" className={linkCls}>{t('manageBooking')}</Link></li>
              </ul>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4">{t('legal')}</h3>
            <ul className="space-y-2.5 text-sm text-white/80 whitespace-nowrap">
              <li><Link href="/impressum" className={linkCls}>{t('impressum')}</Link></li>
              <li><Link href="/datenschutz" className={linkCls}>{t('datenschutz')}</Link></li>
              <li><Link href="/agb" className={linkCls}>{t('agb')}</Link></li>
            </ul>
          </div>

          {/* Badge + signature */}
          <div className="flex flex-col items-start lg:items-end">
            <div className="flex items-center gap-3 rounded-xl px-5 py-3.5 border border-gold-400/60 bg-white/[.02]">
              <ShieldCheck size={34} strokeWidth={1.6} className="text-gold-400 shrink-0" />
              <div className="text-[15px] font-bold leading-snug text-gold-400 whitespace-nowrap">
                {tx.badgeA}<br />{tx.badgeB}
              </div>
            </div>
            <div className="relative mt-6 lg:mr-1 select-none" aria-hidden="true">
              <span className="absolute -top-3 left-3 text-gold-400 text-[10px] tracking-[.25em] -rotate-12">• • • • •</span>
              <span className={`${caveat.className} block text-[34px] leading-none text-white -rotate-[10deg]`}>{tx.signature}</span>
              <svg className="absolute -bottom-4 left-0 w-full h-5" viewBox="0 0 200 20" fill="none" preserveAspectRatio="none">
                <path d="M4 17 C 60 12, 130 4, 196 2" stroke="#f6c644" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-white/60">
          <span>{t('copyright', { year })}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={CONTACT_INFO.phoneHref} className="hover:text-white">{CONTACT_INFO.phone}</a>
            <a href={`mailto:${CONTACT_INFO.email}`} className="hover:text-white">{CONTACT_INFO.email}</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
