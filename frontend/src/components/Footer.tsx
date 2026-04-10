import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export default function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary-600 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gold-400 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-bold text-lg">M</span>
              </div>
              <div>
                <div className="font-bold text-lg">{t('company')}</div>
              </div>
            </div>
            <p className="text-primary-200 text-sm">{t('tagline')}</p>
            <div className="flex space-x-3 mt-4">
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-colors"
                aria-label="WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="font-semibold text-gold-400 mb-4">{t('links')}</h3>
            <ul className="space-y-2 text-sm text-primary-200">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/vehicles" className="hover:text-white transition-colors">Fahrzeuge & Preise</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">Business Service</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">Über uns</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Kontakt</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-gold-400 mb-4">{t('legal')}</h3>
            <ul className="space-y-2 text-sm text-primary-200">
              <li><Link href="/impressum" className="hover:text-white transition-colors">{t('impressum')}</Link></li>
              <li><Link href="/datenschutz" className="hover:text-white transition-colors">{t('datenschutz')}</Link></li>
              <li><Link href="/agb" className="hover:text-white transition-colors">{t('agb')}</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-gold-400 mb-4">Kontakt</h3>
            <ul className="space-y-3 text-sm text-primary-200">
              <li className="flex items-start space-x-2">
                <Phone size={14} className="mt-1 shrink-0 text-gold-400" />
                <a href={CONTACT_INFO.phoneHref} className="hover:text-white">{CONTACT_INFO.phone}</a>
              </li>
              <li className="flex items-start space-x-2">
                <Mail size={14} className="mt-1 shrink-0 text-gold-400" />
                <a href={`mailto:${CONTACT_INFO.email}`} className="hover:text-white">{CONTACT_INFO.email}</a>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin size={14} className="mt-1 shrink-0 text-gold-400" />
                <span>{CONTACT_INFO.address}</span>
              </li>
              <li className="flex items-start space-x-2">
                <Clock size={14} className="mt-1 shrink-0 text-gold-400" />
                <span>24/7</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-500 mt-8 pt-6">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-primary-300 mb-4">
            <span>🏆 20 Jahre Erfahrung</span>
            <span>🚫 Kostenloser Storno bis 3 Std.</span>
            <span>💰 Festpreisgarantie</span>
            <span>✈️ 60 Min. Gratis-Wartezeit</span>
            <span>🛡️ Vollversicherte Fahrzeuge</span>
            <span>📱 24/7 Telefon & WhatsApp</span>
          </div>
          <div className="text-center text-sm text-primary-300">
            {t('copyright', { year })}
          </div>
        </div>
      </div>
    </footer>
  );
}
