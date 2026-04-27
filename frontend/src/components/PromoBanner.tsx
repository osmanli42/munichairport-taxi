'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface PromoData {
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  end_date: string;
}

const API_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return base.endsWith('/api') ? base : `${base}/api`;
})();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(endDate: string): TimeLeft {
  const end = new Date(endDate + 'T23:59:59').getTime();
  const diff = Math.max(0, end - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function PromoBanner({ locale = 'de' }: { locale?: string }) {
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('promo_banner_dismissed')) {
      setDismissed(true);
      return;
    }
    fetch(`${API_URL}/promotions/active`)
      .then(r => r.json())
      .then(data => {
        if (data?.code) {
          setPromo(data);
          setTimeLeft(calcTimeLeft(data.end_date));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!promo) return;
    const timer = setInterval(() => {
      const t = calcTimeLeft(promo.end_date);
      setTimeLeft(t);
      if (t.days === 0 && t.hours === 0 && t.minutes === 0 && t.seconds === 0) {
        setPromo(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [promo]);

  if (!promo || dismissed) return null;

  const discount = promo.type === 'fixed'
    ? `${promo.value} €`
    : `${promo.value}%`;

  const labels: Record<string, { msg: string; book: string; left: string; days: string; hrs: string; min: string; sec: string }> = {
    de: { msg: `Jetzt ${discount} sparen mit Code`, book: 'Jetzt buchen →', left: 'Noch:', days: 'Tage', hrs: 'Std', min: 'Min', sec: 'Sek' },
    en: { msg: `Save ${discount} with code`, book: 'Book now →', left: 'Left:', days: 'days', hrs: 'hrs', min: 'min', sec: 'sec' },
    tr: { msg: `Kod ile ${discount} tasarruf edin`, book: 'Hemen rezervasyon →', left: 'Kalan:', days: 'gün', hrs: 'saat', min: 'dk', sec: 'sn' },
  };
  const l = labels[locale] ?? labels['de'];

  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left: message + code */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg">🎉</span>
          <span className="font-medium text-sm sm:text-base">
            {l.msg}{' '}
            <strong className="bg-white text-amber-700 px-2 py-0.5 rounded font-bold tracking-wider text-sm mx-1">
              {promo.code}
            </strong>
          </span>
        </div>

        {/* Center: countdown */}
        {timeLeft && (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="opacity-80">{l.left}</span>
            {[
              { v: timeLeft.days, label: l.days },
              { v: timeLeft.hours, label: l.hrs },
              { v: timeLeft.minutes, label: l.min },
              { v: timeLeft.seconds, label: l.sec },
            ].map(({ v, label }) => (
              <span key={label} className="bg-white/20 rounded px-1.5 py-0.5 tabular-nums">
                {pad(v)}<span className="opacity-70 ml-0.5">{label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Right: CTA + close */}
        <div className="flex items-center gap-2">
          <a
            href={locale === 'de' ? '/#search' : `/${locale}#search`}
            className="bg-white text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg font-semibold text-sm transition-colors"
          >
            {l.book}
          </a>
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem('promo_banner_dismissed', '1');
            }}
            className="opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Schließen"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
