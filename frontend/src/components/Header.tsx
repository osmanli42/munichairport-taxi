'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Phone, ChevronDown, ArrowRight } from 'lucide-react';
import { cn, CONTACT_INFO } from '@/lib/utils';
import { SERVICES, serviceHref, lang } from '@/lib/services';
import FlagIcon from './FlagIcon';

const locales = ['de', 'en', 'tr'];
const localeLabels: Record<string, string> = {
  de: 'DE',
  en: 'EN',
  tr: 'TR',
};

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  function switchLocale(newLocale: string) {
    // Strip all known locale prefixes from pathname
    let cleanPath = pathname;
    for (const l of locales) {
      if (cleanPath.startsWith(`/${l}`)) {
        cleanPath = cleanPath.slice(`/${l}`.length) || '/';
        break;
      }
    }
    // 'de' is default (as-needed), others get prefix
    const finalPath = newLocale === 'de' ? cleanPath : `/${newLocale}${cleanPath}`;
    window.location.href = finalPath;
  }

  // Interne Links in der aktuellen Sprache (de ohne Präfix, as-needed)
  const lp = (href: string) => (locale === 'de' ? href : href === '/' ? `/${locale}` : `/${locale}${href}`);

  const l = lang(locale);
  const prefix = locale === 'de' ? '' : `/${locale}`;
  const allServices = { de: 'Alle Leistungen ansehen', en: 'See all services', tr: 'Tüm hizmetleri gör' }[l];
  // Close the hover/focus menu after a click (focus would keep it open)
  const closeMenus = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setMenuOpen(false);
    setServicesOpen(false);
  };

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/leistungen', label: t('services'), services: true },
    { href: '/vehicles', label: t('vehicles') },
    { href: '/business', label: 'Business' },
    { href: '/faq', label: t('faq') },
    { href: '/about', label: t('about') },
    { href: '/contact', label: t('contact') },
  ];

  return (
    <header className="bg-primary-600 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={lp('/')} className="flex items-center group min-w-0">
            <img
              src="/images/logo-wide.webp"
              srcSet="/images/logo-wide-320.webp 320w, /images/logo-wide-400.webp 400w, /images/logo-wide-640.webp 640w, /images/logo-wide.webp 823w"
              sizes="(min-width: 1024px) 300px, 200px"
              alt="Flughafen-muenchen.TAXI – Taxi zum & vom Flughafen München" width={823} height={132} className="h-8 lg:h-10 2xl:h-12 w-auto max-w-full object-contain object-left" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-0.5">
            {navLinks.map((link) => {
              const linkCls = cn(
                'px-2.5 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                pathname === lp(link.href)
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-100 hover:bg-primary-700 hover:text-white'
              );
              if (!link.services) {
                return <Link key={link.href} href={lp(link.href)} className={linkCls}>{link.label}</Link>;
              }
              return (
                <div key={link.href} className="relative group">
                  <Link href={lp(link.href)} aria-haspopup="true" className={cn(linkCls, 'inline-flex items-center gap-1')}>
                    {link.label}
                    <ChevronDown size={14} className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />
                  </Link>
                  <div className="absolute left-1/2 top-full z-50 w-[640px] -translate-x-1/2 pt-3 opacity-0 invisible transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
                      <ul className="grid grid-cols-2 gap-1 p-3">
                        {SERVICES.map((s) => {
                          const Icon = s.icon;
                          return (
                            <li key={s.key}>
                              <Link href={serviceHref(s, prefix)} onClick={closeMenus} className="group/item flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover/item:bg-gold-400 group-hover/item:text-primary-900">
                                  <Icon size={18} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-bold text-gray-900">{s.text[l].title}</span>
                                  <span className="block truncate text-xs text-gray-500">{s.text[l].short}</span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      <Link href={lp('/leistungen')} onClick={closeMenus} className="flex items-center justify-between bg-primary-600 px-5 py-3 text-sm font-bold text-white hover:bg-primary-700">
                        {allServices} <ArrowRight size={16} className="text-gold-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* Phone */}
            <a
              href={CONTACT_INFO.phoneHref}
              aria-label={CONTACT_INFO.phone}
              className="hidden lg:flex items-center space-x-2 whitespace-nowrap bg-gold-400 hover:bg-gold-500 text-primary-600 px-3 py-2 rounded-md text-sm font-bold transition-colors"
            >
              <Phone size={14} />
              <span className="hidden xl:inline">{CONTACT_INFO.phone}</span>
            </a>

            {/* Language Switcher */}
            <div className="relative group">
              <button className="flex items-center space-x-1 bg-primary-700 hover:bg-primary-800 text-white px-3 py-2 rounded-md text-sm transition-colors">
                <FlagIcon code={locale} />
                <span>{localeLabels[locale]}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 mt-1 w-28 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => switchLocale(l)}
                    className={cn(
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 first:rounded-t-md last:rounded-b-md',
                      l === locale ? 'text-primary-600 font-bold' : 'text-gray-700'
                    )}
                  >
                    <span className="inline-flex items-center gap-2"><FlagIcon code={l} /> {localeLabels[l]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden bg-primary-700 hover:bg-primary-800 text-white p-2 rounded-md"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="lg:hidden pb-4 animate-fade-in">
            <div className="flex flex-col space-y-1 pt-2">
              {navLinks.map((link) => link.services ? (
                <div key={link.href}>
                  <button
                    type="button"
                    onClick={() => setServicesOpen(!servicesOpen)}
                    aria-expanded={servicesOpen}
                    className="flex w-full items-center justify-between px-4 py-3 text-white hover:bg-primary-700 rounded-md font-medium"
                  >
                    {link.label}
                    <ChevronDown size={18} className={cn('transition-transform', servicesOpen && 'rotate-180')} />
                  </button>
                  {servicesOpen && (
                    <ul className="mx-2 mb-1 grid grid-cols-1 gap-0.5 rounded-lg bg-primary-700/60 p-2 sm:grid-cols-2">
                      {SERVICES.map((s) => {
                        const Icon = s.icon;
                        return (
                          <li key={s.key}>
                            <Link href={serviceHref(s, prefix)} onClick={closeMenus} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white hover:bg-primary-700">
                              <Icon size={17} className="shrink-0 text-gold-400" /> {s.text[l].title}
                            </Link>
                          </li>
                        );
                      })}
                      <li className="sm:col-span-2">
                        <Link href={lp('/leistungen')} onClick={closeMenus} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold text-gold-400 hover:bg-primary-700">
                          {allServices} <ArrowRight size={15} />
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={lp(link.href)}
                  className="px-4 py-3 text-white hover:bg-primary-700 rounded-md font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center space-x-2 bg-gold-400 text-primary-600 px-4 py-3 rounded-md font-bold mt-2"
              >
                <Phone size={16} />
                <span>{CONTACT_INFO.phone}</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
