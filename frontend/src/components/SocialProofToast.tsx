'use client';

import { useState, useEffect } from 'react';
import { CarTaxiFront, X } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const DISMISS_KEY = 'mt_social_proof_dismissed';
const TOAST_HEIGHT = 64;

type SocialItem = { dest: string; minsAgo: number };

// Only real, confirmed bookings from /bookings/recent-social, without names (DSGVO, UWG).
// If there are none, the toast never appears. Each one is shown once, closable.
export default function SocialProofToast({ locale }: { locale: string }) {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mobilePos, setMobilePos] = useState<{ bottom: number; right: number } | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) { setDismissed(true); return; }
    } catch {}
    fetch(`${API_BASE}/bookings/recent-social`)
      .then(r => r.json())
      .then((real: SocialItem[]) => setItems(Array.isArray(real) ? real : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setVisible(true), 3000)];
    items.forEach((_, i) => {
      timers.push(setTimeout(() => setVisible(false), 3000 + (i + 1) * 12000 - 600));
      if (i + 1 < items.length) {
        timers.push(setTimeout(() => { setCurrent(i + 1); setVisible(true); }, 3000 + (i + 1) * 12000));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [items]);

  // Mobil: direkt über der Sticky-Leiste (Storno/Anrufen) — und neben Chat/WhatsApp, nie darüber
  useEffect(() => {
    if (!visible) return;
    const place = () => {
      if (window.innerWidth >= 768) { setMobilePos(null); return; }
      const bar = document.querySelector('[data-mobile-sticky]');
      const bottom = (bar ? window.innerHeight - bar.getBoundingClientRect().top : 16) + 8;
      const top = window.innerHeight - bottom - TOAST_HEIGHT;
      let right = 16;
      document.querySelectorAll('[data-floating-button]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > top && r.top < window.innerHeight - bottom) right = Math.max(right, window.innerWidth - r.left + 8);
      });
      setMobilePos({ bottom, right });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [visible]);

  if (dismissed || items.length === 0) return null;
  const b = items[current];
  const hours = Math.round(b.minsAgo / 60);
  const ago = hours <= 1
    ? (locale === 'tr' ? 'Son bir saatte' : locale === 'en' ? 'In the last hour' : 'In der letzten Stunde')
    : (locale === 'tr' ? `${hours} saat önce` : locale === 'en' ? `${hours} hours ago` : `Vor ${hours} Std.`);
  const label = locale === 'tr'
    ? `${ago}: ${b.dest} için yolculuk rezerve edildi`
    : locale === 'en'
    ? `${ago}: ride to ${b.dest} booked`
    : `${ago}: Fahrt nach ${b.dest} gebucht`;
  const source = locale === 'tr'
    ? 'Son 48 saatin gerçek rezervasyonları'
    : locale === 'en'
    ? 'Real bookings from the last 48 hours'
    : 'Echte Buchungen der letzten 48 Stunden';
  const closeLabel = locale === 'tr' ? 'Kapat' : locale === 'en' ? 'Close' : 'Schließen';

  const close = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  return (
    <div
      className="fixed bottom-6 left-4 md:right-auto z-30 transition-all duration-500"
      style={{ ...(mobilePos ?? {}), opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg pl-4 pr-1 py-2 flex items-center gap-3 md:max-w-sm">
        <CarTaxiFront size={24} className="hidden sm:block text-gold-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{source}</p>
        </div>
        <button type="button" onClick={close} aria-label={closeLabel} className="shrink-0 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
