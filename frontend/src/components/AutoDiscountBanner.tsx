'use client';

import { useEffect, useState } from 'react';
import { X, Tag } from 'lucide-react';
import Countdown from '@/components/discount/Countdown';
import { formatDiscountValue, formatRemainingSpots } from '@/components/discount/format';

const API_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return base.endsWith('/api') ? base : `${base}/api`;
})();

interface BannerDiscount {
  label: string;
  type: 'percent' | 'fixed';
  value: number;
  ends_at: string | null;
  remaining?: number | null;
}

const DISMISS_KEY = 'auto_discount_banner_dismissed';

// Startseiten-Hinweis auf eine automatische Aktion (Rabatte-Tab → "Im Startseiten-Banner zeigen").
// Ob der Rabatt für die konkrete Fahrt gilt, entscheidet erst die Preisberechnung.
export default function AutoDiscountBanner({ locale }: { locale: string }) {
  const [discount, setDiscount] = useState<BannerDiscount | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch { /* Storage blockiert → Banner trotzdem zeigen */ }
    fetch(`${API_URL}/auto-discounts/public/banner?locale=${locale}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setDiscount(d?.label ? d : null))
      .catch(() => {});
  }, [locale]);

  if (!discount) return null;

  const dismiss = () => {
    setDiscount(null);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto w-fit max-w-full mb-3 sm:mb-0 flex items-center gap-2 sm:gap-3 bg-red-600 text-white rounded-full pl-2 pr-2 sm:pr-3 py-1.5 shadow-lg shadow-red-900/30 ring-1 ring-white/20">
      <span className="inline-flex items-center gap-1 bg-white text-red-600 font-extrabold text-sm px-2.5 py-0.5 rounded-full shrink-0">
        <Tag size={13} /> {formatDiscountValue(discount.type, discount.value, locale)}
      </span>
      <span className="font-bold text-sm truncate min-w-0">{discount.label}</span>
      {formatRemainingSpots(discount.remaining, locale) && (
        <span className="text-xs font-semibold bg-white/15 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
          {formatRemainingSpots(discount.remaining, locale)}
        </span>
      )}
      <Countdown endsAt={discount.ends_at} locale={locale} onExpire={() => setDiscount(null)}
        className="hidden sm:inline-flex text-xs font-semibold bg-white/15 rounded-full px-2 py-0.5 shrink-0" />
      <button onClick={dismiss} className="opacity-70 hover:opacity-100 shrink-0 p-0.5" aria-label={locale === 'en' ? 'Close' : locale === 'tr' ? 'Kapat' : 'Schließen'}>
        <X size={15} />
      </button>
    </div>
  );
}
