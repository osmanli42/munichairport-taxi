'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Phone } from 'lucide-react';
import { cn, CONTACT_INFO } from '@/lib/utils';

const locales = ['de', 'en', 'tr'];
const localeLabels: Record<string, string> = {
  de: '🇩🇪 DE',
  en: '🇬🇧 EN',
  tr: '🇹🇷 TR',
};

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const navLinks = [
    { href: '/', label: t('home') },
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
          <Link href="/" className="flex items-center space-x-2 group">
            <img src="/images/logo.PNG" alt="Munich Airport Taxi" className="h-10 w-auto" />
            <span className="hidden sm:block text-white font-bold text-lg">Flughafen-muenchen.<span className="text-gold-400">TAXI</span></span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname === link.href || pathname === `/${locale}${link.href}`
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-100 hover:bg-primary-700 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* Phone */}
            <a
              href={CONTACT_INFO.phoneHref}
              className="hidden lg:flex items-center space-x-2 bg-gold-400 hover:bg-gold-500 text-primary-600 px-3 py-2 rounded-md text-sm font-bold transition-colors"
            >
              <Phone size={14} />
              <span>{CONTACT_INFO.phone}</span>
            </a>

            {/* Language Switcher */}
            <div className="relative group">
              <button className="flex items-center space-x-1 bg-primary-700 hover:bg-primary-800 text-white px-3 py-2 rounded-md text-sm transition-colors">
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
                    {localeLabels[l]}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden bg-primary-700 hover:bg-primary-800 text-white p-2 rounded-md"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden pb-4 animate-fade-in">
            <div className="flex flex-col space-y-1 pt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
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
