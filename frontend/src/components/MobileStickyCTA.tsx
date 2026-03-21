'use client';

import { Phone } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export default function MobileStickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      {/* Trust line */}
      <div className="bg-green-700 text-white text-center py-1 text-xs font-medium px-4">
        🚫 Kostenloser Storno bis 3 Std. &nbsp;·&nbsp; 💰 Festpreis garantiert
      </div>
      {/* CTA buttons */}
      <div className="bg-white border-t border-gray-200 shadow-2xl px-4 py-3 flex gap-3">
        <a
          href="#booking"
          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-center py-3.5 rounded-xl font-bold text-sm transition-colors"
        >
          Jetzt Preis berechnen
        </a>
        <a
          href={CONTACT_INFO.phoneHref}
          className="flex items-center justify-center gap-1.5 bg-gold-400 hover:bg-gold-500 text-primary-600 px-4 py-3.5 rounded-xl font-bold text-sm transition-colors shrink-0"
        >
          <Phone size={16} />
          Anrufen
        </a>
      </div>
    </div>
  );
}
