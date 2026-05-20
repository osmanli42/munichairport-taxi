'use client';

/**
 * Abandoned-booking recovery — first-party, no contact data, no server call.
 * On the results/booking pages it saves the visitor's in-progress route + price
 * into localStorage. On the home page, if a fresh draft exists and no booking
 * has been completed since, it shows a "resume" card so the visitor can pick up
 * where they left off without re-typing the route.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowRight, X, RotateCcw } from 'lucide-react';

const DRAFT_KEY = 'mt_booking_draft';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // drafts expire after 7 days

interface Draft {
  path: string; // pathname + search, e.g. "/buchen?pickup=..."
  pickup: string;
  dropoff: string;
  price: number | null;
  savedAt: number;
}

const T: Record<string, { title: string; cont: string }> = {
  de: { title: 'Buchung fortsetzen', cont: 'Weiter' },
  en: { title: 'Resume your booking', cont: 'Continue' },
  tr: { title: 'Rezervasyona devam et', cont: 'Devam et' },
};

function shortAddr(a: string): string {
  const first = a.split(',')[0].trim();
  return first.length > 26 ? first.slice(0, 25) + '…' : first;
}

function isHome(pathname: string): boolean {
  return /^\/(de|en|tr)?\/?$/.test(pathname);
}

function isBookingPage(pathname: string): boolean {
  return pathname.includes('/buchen') || pathname.includes('/ergebnisse');
}

export default function BookingDraftRecovery() {
  const pathname = usePathname() || '/';
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    // Save the draft when on a results/booking page.
    if (isBookingPage(pathname)) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const pickup = sp.get('pickup') || '';
        const dropoff = sp.get('dropoff') || '';
        if (pickup && dropoff) {
          const priceRaw = Number(sp.get('price'));
          const d: Draft = {
            path: window.location.pathname + window.location.search,
            pickup,
            dropoff,
            price: Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : null,
            savedAt: Date.now(),
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
        }
      } catch {
        /* localStorage unavailable — skip silently */
      }
      return;
    }

    // Show the resume card only on the home page.
    if (!isHome(pathname)) {
      setDraft(null);
      return;
    }

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (!d?.savedAt || Date.now() - d.savedAt > MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Hide if a booking was completed after this draft was saved.
      const lastRaw = localStorage.getItem('mt_last_booking');
      if (lastRaw) {
        const last = JSON.parse(lastRaw);
        if (last?.ts && last.ts >= d.savedAt) {
          localStorage.removeItem(DRAFT_KEY);
          return;
        }
      }
      setDraft(d);
    } catch {
      /* malformed draft — ignore */
    }
  }, [pathname]);

  function dismiss() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDraft(null);
  }

  if (!draft) return null;

  const t = T[locale] || T.de;

  return (
    <div className="fixed left-4 right-4 bottom-24 z-40 md:left-6 md:right-auto md:bottom-6 md:w-[340px]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <RotateCcw size={18} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900">{t.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
              <span className="truncate">{shortAddr(draft.pickup)}</span>
              <ArrowRight size={12} className="shrink-0 text-gray-400" />
              <span className="truncate">{shortAddr(draft.dropoff)}</span>
            </div>
            {draft.price !== null && (
              <div className="mt-1 text-sm font-bold text-primary-600">
                {(Math.ceil(draft.price * 2) / 2).toFixed(2).replace('.', ',')} €
              </div>
            )}
            <a
              href={draft.path}
              className="mt-2.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              {t.cont}
              <ArrowRight size={15} />
            </a>
          </div>
          <button
            onClick={dismiss}
            aria-label="Schließen"
            className="shrink-0 p-1 -m-1 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
