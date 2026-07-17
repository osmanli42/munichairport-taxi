'use client';

import { Phone, Ban, BadgeEuro } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { CONTACT_INFO } from '@/lib/utils';

const TEXTS: Record<string, { cancel: string; fixed: string; cta: string; call: string }> = {
  de: { cancel: 'Kostenloser Storno bis 3 Std.', fixed: 'Festpreis garantiert', cta: 'Jetzt Preis berechnen', call: 'Anrufen' },
  en: { cancel: 'Free cancellation up to 3 hrs', fixed: 'Fixed price guaranteed', cta: 'Get your price now', call: 'Call' },
  tr: { cancel: '3 saate kadar ücretsiz iptal', fixed: 'Sabit fiyat garantili', cta: 'Hemen fiyat hesapla', call: 'Ara' },
};

export default function MobileStickyCTA() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = TEXTS[locale] || TEXTS.de;
  const isBookingFlow = pathname?.includes('/ergebnisse') || pathname?.includes('/buchen') || pathname?.includes('/booking');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      {/* Trust line */}
      <div className="bg-green-700 text-white text-center py-1 text-xs font-medium px-4 flex items-center justify-center gap-1.5">
        <Ban size={11} className="shrink-0" /> {t.cancel}
        <span className="mx-1">·</span>
        <BadgeEuro size={11} className="shrink-0" /> {t.fixed}
      </div>
      {/* CTA buttons */}
      <div className="bg-white border-t border-gray-200 shadow-2xl px-4 py-3 flex gap-3 justify-center">
        {!isBookingFlow && (
          <a
            href="#booking"
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-center py-3.5 rounded-xl font-bold text-sm transition-colors"
          >
            {t.cta}
          </a>
        )}
        <a
          href={CONTACT_INFO.phoneHref}
          className={`flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 py-3.5 rounded-xl font-bold text-sm transition-colors ${isBookingFlow ? 'flex-1 max-w-xs' : 'px-5 shrink-0'}`}
        >
          <Phone size={18} />
          {t.call}
        </a>
      </div>
    </div>
  );
}
