'use client';

import { useState, useEffect } from 'react';
import { CarTaxiFront } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

type SocialItem = { name: string; dest: string; minsAgo: number };

// Only real, anonymised bookings from /bookings/recent-social are shown.
// If there are none (and no own recent booking), the toast never appears.
export default function SocialProofToast({ locale }: { locale: string }) {
  const [items, setItems] = useState<SocialItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hasOwn, setHasOwn] = useState(false);

  useEffect(() => {
    let own: SocialItem | null = null;
    try {
      const raw = localStorage.getItem('mt_last_booking');
      if (raw) {
        const lb = JSON.parse(raw);
        if (Date.now() - lb.ts < 48 * 60 * 60 * 1000) {
          own = { name: lb.name, dest: lb.dest, minsAgo: Math.max(1, Math.round((Date.now() - lb.ts) / 60000)) };
          setHasOwn(true);
        }
      }
    } catch {}

    fetch(`${API_BASE}/bookings/recent-social`)
      .then(r => r.json())
      .then((real: SocialItem[]) => {
        const realMapped = (Array.isArray(real) ? real : []).map(r => ({
          name: r.name, dest: r.dest, minsAgo: r.minsAgo,
        }));
        if (own) realMapped.unshift(own);
        setItems(realMapped.slice(0, 20));
      })
      .catch(() => {
        setItems(own ? [own] : []);
      });
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    // show immediately if user just booked, else 3s delay
    const delay = hasOwn ? 0 : 3000;
    const showDelay = setTimeout(() => setVisible(true), delay);
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrent(i => (i + 1) % items.length);
        setVisible(true);
      }, 600);
    }, 12000);
    return () => { clearTimeout(showDelay); clearInterval(cycle); };
  }, [items, hasOwn]);

  if (items.length === 0) return null;
  const b = items[current];
  const hours = Math.round(b.minsAgo / 60);
  const ago = b.minsAgo < 60
    ? (locale === 'tr' ? `${b.minsAgo} dk önce` : locale === 'en' ? `${b.minsAgo} min ago` : `Vor ${b.minsAgo} Min`)
    : (locale === 'tr' ? `${hours} sa önce` : locale === 'en' ? `${hours} h ago` : `Vor ${hours} Std.`);
  const label = locale === 'tr'
    ? `${ago}: ${b.name} rezervasyon yaptı ✓`
    : locale === 'en'
    ? `${ago}: ${b.name} booked a ride ✓`
    : `${ago}: ${b.name} hat Fahrt ${b.dest} gebucht ✓`;

  return (
    <div
      className="fixed bottom-6 left-4 z-50 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', pointerEvents: 'none' }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm">
        <CarTaxiFront size={24} className="text-gold-500 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">flughafen-muenchen.taxi</p>
        </div>
      </div>
    </div>
  );
}
