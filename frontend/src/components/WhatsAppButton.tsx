'use client';

import { useEffect, useState } from 'react';
import { CONTACT_INFO } from '@/lib/utils';

const DISMISSED_KEY = 'mt_wa_bubble_dismissed';
const SHOW_DELAY = 30_000;
const AUTO_HIDE = 10_000;
const SUPPRESS_MS = 24 * 60 * 60 * 1000;

export default function WhatsAppButton() {
  const [bubble, setBubble] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw && Date.now() - Number(raw) < SUPPRESS_MS) return;
    } catch { /* ignore */ }

    const show = setTimeout(() => {
      setBubble(true);
      setTimeout(() => setBubble(false), AUTO_HIDE);
    }, SHOW_DELAY);

    return () => clearTimeout(show);
  }, []);

  function dismiss() {
    setBubble(false);
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2">
      {bubble && (
        <div
          className="bg-white rounded-2xl shadow-xl border border-gray-100 px-3 py-2 flex items-center gap-2 animate-fade-in"
          style={{ animation: 'fadeSlideIn 0.3s ease' }}
        >
          <p className="text-sm font-semibold text-gray-800 whitespace-nowrap">Fragen? Wir helfen gern!</p>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-xs leading-none">✕</button>
        </div>
      )}
      <a
        href={CONTACT_INFO.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className="w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 animate-pulse-slow shrink-0"
        aria-label="WhatsApp Chat"
      >
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  );
}
