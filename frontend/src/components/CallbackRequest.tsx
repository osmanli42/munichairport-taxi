'use client';

/**
 * "Rückruf anfordern" — sekundäre CTA auf der Preisseite.
 *
 * Bewusst OHNE Zeitversprechen: die Benachrichtigung läuft per E-Mail, ein garantierter
 * Rückruf "in 2 Minuten" wäre nicht haltbar. Wer es eilig hat, bekommt stattdessen die
 * direkte Telefonnummer angeboten.
 *
 * Warum: die Session Replays zeigen Besucher, die den Preis sehen und dann auf die
 * Telefonnummer tippen (call_click) statt das Buchungsformular auszufüllen. Wer nicht
 * selbst anrufen will, war bisher verloren. Hier werden nur Telefonnummer und die
 * bereits eingegebene Strecke übergeben — kein zweites Formular.
 */

import { useState } from 'react';
import { PhoneCall, Check, Loader2, X, Phone } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

export interface CallbackContext {
  pickup?: string;
  dropoff?: string;
  price?: number | null;
  distance_km?: number | null;
  vehicle?: string | null;
  trip_datetime?: string | null;
  passengers?: number | null;
  duration_min?: number | null;
  trip_type?: string | null;
  return_datetime?: string | null;
}

/**
 * Die Preise, die der Kunde gerade sieht, direkt aus dem DOM lesen.
 *
 * Die Fahrzeugkarten tragen bereits data-price/data-vehicle (siehe ergebnisse/page.tsx).
 * Damit landet im Admin-Mail exakt der Preis, den der Kunde vor sich hatte — ohne die
 * Preislogik (Pflichttarif, Festpreisrouten, Rabatte) hier ein zweites Mal zu rechnen.
 */
/**
 * Auf 0,50 € aufrunden — genau wie formatPrice() in lib/utils.ts. Sonst stünde im
 * Admin-Mail 89,45 €, während der Kunde auf dem Bildschirm 89,50 € gesehen hat, und
 * am Telefon würden zwei verschiedene Zahlen genannt.
 */
function roundToDisplay(price: number): number {
  return Math.ceil(price * 2) / 2;
}

function readPricesSeen(): string | undefined {
  try {
    const cards = Array.from(document.querySelectorAll('[data-price][data-vehicle]')) as HTMLElement[];
    const parts = cards
      .map((c) => {
        const p = Number(c.getAttribute('data-price'));
        const v = c.getAttribute('data-vehicle') || '?';
        return Number.isFinite(p) && p > 0 ? `${v} ${roundToDisplay(p).toFixed(2)} €` : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join(' · ').slice(0, 250) : undefined;
  } catch {
    return undefined;
  }
}

/** Günstigster sichtbarer Preis — als "price" für Liste und Statistik. */
function readCheapestPrice(): number | undefined {
  try {
    const values = (Array.from(document.querySelectorAll('[data-price]')) as HTMLElement[])
      .map((c) => Number(c.getAttribute('data-price')))
      .filter((n) => Number.isFinite(n) && n > 0);
    return values.length ? roundToDisplay(Math.min(...values)) : undefined;
  } catch {
    return undefined;
  }
}

const T = {
  de: {
    cta: 'Rückruf anfordern',
    title: 'Wir rufen Sie zurück',
    sub: 'Nummer eingeben – kostenlos und unverbindlich. Ihre Strecke ist bereits hinterlegt.',
    phone: 'Telefonnummer',
    name: 'Name (optional)',
    send: 'Rückruf anfordern',
    okTitle: 'Danke! Wir rufen Sie zurück.',
    okSub: 'Ihre Strecke liegt uns vor – Sie müssen nichts weiter ausfüllen. Es ist eilig? Rufen Sie uns gerne direkt an.',
    errPhone: 'Bitte eine gültige Telefonnummer eingeben',
    errGeneric: 'Das hat nicht funktioniert. Bitte rufen Sie uns direkt an.',
    close: 'Schließen',
    urgent: 'Es ist eilig? Direkt anrufen:',
  },
  en: {
    cta: 'Request a callback',
    title: 'We will call you back',
    sub: 'Enter your number – free and without obligation. Your route is already saved.',
    phone: 'Phone number',
    name: 'Name (optional)',
    send: 'Request callback',
    okTitle: 'Thanks! We will call you back.',
    okSub: 'We have your route – nothing else to fill in. In a hurry? Feel free to call us directly.',
    errPhone: 'Please enter a valid phone number',
    errGeneric: 'That did not work. Please call us directly.',
    close: 'Close',
    urgent: 'In a hurry? Call us directly:',
  },
  tr: {
    cta: 'Geri arama isteyin',
    title: 'Sizi geri arayalım',
    sub: 'Numaranızı yazın – ücretsiz ve bağlayıcı değil. Güzergâhınız zaten kayıtlı.',
    phone: 'Telefon numarası',
    name: 'Ad (isteğe bağlı)',
    send: 'Geri arama isteği',
    okTitle: 'Teşekkürler! Sizi arayacağız.',
    okSub: 'Güzergâhınız elimizde – başka bir şey doldurmanız gerekmiyor. Acele mi? Bizi doğrudan da arayabilirsiniz.',
    errPhone: 'Geçerli bir telefon numarası girin',
    errGeneric: 'Bu işlem başarısız oldu. Lütfen bizi doğrudan arayın.',
    close: 'Kapat',
    urgent: 'Acele mi? Bizi doğrudan arayın:',
  },
} as const;

export default function CallbackRequest({
  locale,
  context,
  className = '',
}: {
  locale: string;
  context: CallbackContext;
  className?: string;
}) {
  const t = T[(locale as 'de' | 'en' | 'tr')] || T.de;
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (phone.replace(/\D/g, '').length < 6) {
      setError(t.errPhone);
      return;
    }
    setError('');
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/callback-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: name || undefined,
          locale,
          ...context,
          // Fahrtdetails automatisch mitschicken, damit der Kunde am Telefon nichts
          // wiederholen muss: gesehene Preise, günstigster Preis und die Seite selbst.
          price: context.price ?? readCheapestPrice(),
          prices_seen: readPricesSeen(),
          source_url: typeof window !== 'undefined' ? window.location.href : undefined,
          session_id: sessionStorage.getItem('mt_session_id') || undefined,
          visitor_id: localStorage.getItem('mt_visitor_id') || undefined,
        }),
      });
      if (!res.ok) {
        setError(res.status === 400 ? t.errPhone : t.errGeneric);
        return;
      }
      setDone(true);
    } catch {
      setError(t.errGeneric);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className={`rounded-xl border border-green-200 bg-green-50 px-4 py-3 ${className}`}>
        <div className="flex items-start gap-2">
          <Check size={16} className="shrink-0 mt-0.5 text-green-600" />
          <div>
            <div className="text-sm font-bold text-green-800">{t.okTitle}</div>
            <div className="text-xs text-green-700 mt-0.5">{t.okSub}</div>
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-1 text-xs font-bold text-green-800 hover:underline mt-1.5">
              <Phone size={12} /> {CONTACT_INFO.phone}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-center gap-2 border-2 border-primary-800 text-primary-800 hover:bg-primary-50 font-bold px-3 py-3 rounded-xl transition-colors text-sm ${className}`}
      >
        <PhoneCall size={16} /> {t.cta}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-gray-900">{t.title}</div>
          <p className="text-xs text-gray-500 mt-0.5">{t.sub}</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="text-gray-400 hover:text-gray-600 shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(''); }}
          placeholder={t.phone}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/30"
        />
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.name}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/30"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] text-gray-500 pt-0.5">
          {t.urgent}{' '}
          <a href={CONTACT_INFO.phoneHref} className="font-bold text-primary-800 hover:underline whitespace-nowrap">
            {CONTACT_INFO.phone}
          </a>
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 bg-primary-800 hover:bg-primary-700 disabled:opacity-60 text-white font-bold px-3 py-3 rounded-xl transition-colors text-sm"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <PhoneCall size={16} />} {t.send}
        </button>
      </div>
    </div>
  );
}
