'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Phone, X } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

const DISMISSED_KEY = 'mt_exit_intent_dismissed';
const DELAY_MS = 30_000; // show after 30s on the page
const SUPPRESS_MS = 24 * 60 * 60 * 1000; // don't re-show for 24h after dismiss

const T = {
  de: { msg: 'Fragen? Wir helfen gern!', wa: 'WhatsApp', call: 'Anrufen' },
  en: { msg: 'Questions? We\'re happy to help!', wa: 'WhatsApp', call: 'Call us' },
  tr: { msg: 'Sorunuz mu var? Yardımcı olalım!', wa: 'WhatsApp', call: 'Ara' },
};

export default function ExitIntentBar({ locale }: { locale: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw && Date.now() - Number(raw) < SUPPRESS_MS) return;
    } catch { /* ignore */ }

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  const t = T[locale as keyof typeof T] || T.de;

  return (
    <div className="fixed bottom-16 inset-x-0 z-50 md:bottom-6 md:left-auto md:right-6 md:inset-x-auto md:w-[340px] px-3 md:px-0 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
        <p className="flex-1 text-sm font-semibold text-gray-800 leading-snug">{t.msg}</p>
        <a
          href={CONTACT_INFO.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="shrink-0 flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
        >
          <MessageCircle size={14} /> {t.wa}
        </a>
        <a
          href={CONTACT_INFO.phoneHref}
          onClick={dismiss}
          className="shrink-0 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
        >
          <Phone size={14} /> {t.call}
        </a>
        <button onClick={dismiss} aria-label="Schließen" className="shrink-0 text-gray-400 hover:text-gray-600 p-1">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
