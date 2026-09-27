'use client';

/**
 * Canlı Asistan — Sprechblase für Besucher, die gerade auf der Seite sind.
 *
 * Zwei Quellen:
 *  1. Der Admin schickt aus dem Live-Tab eine Nachricht (optional mit Aktionscode).
 *     Diese Komponente fragt alle 8 s /live-assist/inbox, solange der Tab sichtbar ist.
 *  2. Automatisch auf /ergebnisse: nach X Sekunden ohne Fahrzeugwahl oder bei
 *     Verlassen-Absicht — einmal pro Besuch, ohne Rabatt.
 *
 * Die Antwort läuft über WhatsApp (vorausgefüllter Text mit Strecke, Preis, Ref)
 * oder den bestehenden Rückruf. Es werden keine Formulareingaben ausgewertet.
 * Alles lässt sich im Admin (Live → Canlı Asistan) abschalten.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { X, MessageCircle, PhoneCall, ArrowRight, Gift } from 'lucide-react';
import CallbackRequest from '@/components/CallbackRequest';
import { buildWhatsAppLink } from '@/lib/utils';
import {
  useLiveAssistConfig, getSessionId, isPricePage, isBookingPage, readTripContext,
  draftPath, ackLiveAssist, LIVE_PROMO_KEY,
} from '@/lib/liveAssist';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const POLL_MS = 8_000;
const MAX_POLL_MS = 2 * 60 * 60 * 1000;
const AUTO_FLAG = 'mt_la_auto_shown';

interface Promo { code: string; type: 'fixed' | 'percent'; value: number }
interface Bubble { id: number | null; source: 'admin' | 'auto'; body: string; promo: Promo | null }

const T = {
  de: {
    online: 'jetzt online', team: 'Munich Airport Taxi',
    auto: 'Fragen zum Preis oder zur Fahrt? Schreiben Sie uns kurz auf WhatsApp – oder wir rufen Sie kostenlos zurück.',
    wa: 'Auf WhatsApp antworten', cb: 'Rückruf', book: 'Jetzt buchen', close: 'Schließen',
    code: 'Ihr Code', off: 'Rabatt', applied: 'wird bei der Buchung automatisch eingelöst',
  },
  en: {
    online: 'online now', team: 'Munich Airport Taxi',
    auto: "Questions about the price or your ride? Send us a quick WhatsApp – or we'll call you back for free.",
    wa: 'Reply on WhatsApp', cb: 'Callback', book: 'Book now', close: 'Close',
    code: 'Your code', off: 'off', applied: 'is applied automatically when you book',
  },
  tr: {
    online: 'şu an çevrimiçi', team: 'Munich Airport Taxi',
    auto: "Fiyat veya yolculuk hakkında sorunuz mu var? WhatsApp'tan kısaca yazın – ya da sizi ücretsiz geri arayalım.",
    wa: "WhatsApp'tan yanıtla", cb: 'Geri arama', book: 'Şimdi rezerve et', close: 'Kapat',
    code: 'Kodunuz', off: 'indirim', applied: 'rezervasyonda otomatik uygulanır',
  },
} as const;

export default function LiveAssist() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const locale = useLocale();
  const t = T[(locale as 'de' | 'en' | 'tr')] || T.de;
  const cfg = useLiveAssistConfig();

  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [showCallback, setShowCallback] = useState(false);
  const bubbleRef = useRef<Bubble | null>(null);
  bubbleRef.current = bubble;
  const adminShownRef = useRef(false);

  const show = useCallback((b: Bubble) => {
    setShowCallback(false);
    setBubble(b);
    if (b.promo) {
      try { sessionStorage.setItem(LIVE_PROMO_KEY, b.promo.code); } catch { /* ignore */ }
    }
  }, []);

  // 1) Admin-Nachrichten abholen
  useEffect(() => {
    if (!cfg?.enabled) return;
    const started = Date.now();
    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState !== 'visible' || Date.now() - started > MAX_POLL_MS) return;
      const sessionId = getSessionId();
      if (!sessionId) return;
      try {
        const r = await fetch(`${API_BASE}/live-assist/inbox?session_id=${encodeURIComponent(sessionId)}`);
        if (!r.ok) return;
        const j = await r.json();
        const m = Array.isArray(j.messages) ? j.messages[j.messages.length - 1] : null;
        if (m && !stopped) {
          adminShownRef.current = true;
          show({ id: m.id, source: 'admin', body: String(m.body || ''), promo: m.promo || null });
          ackLiveAssist('seen', m.id);
        }
      } catch { /* offline — nächster Versuch */ }
    };
    poll();
    const iv = setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearInterval(iv); document.removeEventListener('visibilitychange', onVisible); };
  }, [cfg?.enabled, show]);

  // 2) Automatische Hilfe auf der Preisseite
  useEffect(() => {
    if (!cfg?.auto_enabled || !isPricePage(pathname)) return;
    try { if (sessionStorage.getItem(AUTO_FLAG)) return; } catch { return; }

    const enteredAt = Date.now();
    let fired = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (fired || bubbleRef.current || adminShownRef.current) return;
      // Nicht unter dem Cookie-Dialog öffnen — sonst zählt es als "gesehen", obwohl verdeckt.
      let consent: string | null = null;
      try { consent = localStorage.getItem('cookie_consent'); } catch { /* ignore */ }
      if (!consent || document.visibilityState !== 'visible') {
        retry = setTimeout(fire, 3000);
        return;
      }
      fired = true;
      try { sessionStorage.setItem(AUTO_FLAG, '1'); } catch { /* ignore */ }
      show({ id: null, source: 'auto', body: '', promo: null });
      ackLiveAssist('auto_shown').then((id) => {
        if (id != null) setBubble((b) => (b && b.source === 'auto' ? { ...b, id } : b));
      });
    };

    const timer = setTimeout(fire, Math.max(10, cfg.auto_delay_sec) * 1000);

    // Desktop: Maus verlässt das Fenster nach oben (Tab schließen / zurück)
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0 && Date.now() - enteredAt > 8000) fire();
    };
    // Mobil: kommt nach einem Abstecher in einen anderen Tab/App zurück (Preisvergleich)
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5000) fire();
    };
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      if (retry) clearTimeout(retry);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cfg?.auto_enabled, cfg?.auto_delay_sec, pathname, show]);

  // Beim Seitenwechsel die automatische Blase schließen (Admin-Nachrichten bleiben)
  useEffect(() => {
    setBubble((b) => (b && b.source === 'auto' ? null : b));
  }, [pathname]);

  if (!cfg?.enabled || !bubble) return null;

  const ctx = readTripContext(pathname);
  const waHref = buildWhatsAppLink(ctx, locale);
  const onPrice = isPricePage(pathname);
  const bookTarget = onPrice ? 'scroll' : isBookingPage(pathname) ? null : draftPath();
  const agent = cfg.agent_name || 'Munich Airport Taxi';

  const close = () => {
    if (bubble.id != null) ackLiveAssist('dismiss', bubble.id);
    setBubble(null);
  };

  const onBook = () => {
    if (bubble.id != null) ackLiveAssist('book', bubble.id);
    setBubble(null);
    if (bookTarget === 'scroll') {
      const card = document.querySelector('[data-price][data-vehicle]') as HTMLElement | null;
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (bookTarget) {
      router.push(bookTarget);
    }
  };

  const promoLabel = bubble.promo
    ? bubble.promo.type === 'percent'
      ? `−${bubble.promo.value} %`
      : `−${bubble.promo.value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`
    : '';

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={agent}
      className="fixed z-[60] left-3 right-3 bottom-[96px] sm:left-auto sm:right-6 sm:w-[360px]"
      style={{ animation: 'laIn .28s ease-out' }}
    >
      <style>{'@keyframes laIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,27,45,.22)] border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary-800 text-gold-400 font-bold flex items-center justify-center">
              {agent.trim().charAt(0).toUpperCase()}
            </div>
            {bubble.source === 'admin' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{agent}</div>
            <div className="text-[11px] text-gray-500 truncate">
              {bubble.source === 'admin' ? <span className="text-green-600 font-semibold">● {t.online}</span> : t.team}
            </div>
          </div>
          <button type="button" onClick={close} aria-label={t.close} className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-3">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line break-words">
            {bubble.source === 'admin' ? bubble.body : t.auto}
          </p>

          {bubble.promo && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-gold-400 bg-gold-50 px-3 py-2">
              <Gift size={18} className="text-gold-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-gray-600">{t.code}</div>
                <div className="text-sm font-extrabold text-gray-900 tracking-wide">
                  {bubble.promo.code} <span className="text-green-700">{promoLabel} {t.off}</span>
                </div>
                <div className="text-[11px] text-gray-500">{t.applied}</div>
              </div>
            </div>
          )}

          {showCallback ? (
            <div className="mt-3">
              <CallbackRequest
                locale={locale}
                defaultOpen
                context={{
                  pickup: ctx.pickup || undefined,
                  dropoff: ctx.dropoff || undefined,
                  price: ctx.price ?? null,
                  vehicle: ctx.vehicle ?? null,
                  passengers: ctx.passengers ? Number(ctx.passengers) : null,
                  trip_datetime: ctx.date && ctx.time ? `${ctx.date} ${ctx.time}` : null,
                }}
                onSubmitted={() => { if (bubble.id != null) ackLiveAssist('callback', bubble.id); }}
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { if (bubble.id != null) ackLiveAssist('whatsapp', bubble.id); }}
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-3 py-3 rounded-xl text-sm transition-colors"
              >
                <MessageCircle size={17} /> {t.wa}
              </a>
              <div className={`grid gap-2 ${bookTarget ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  type="button"
                  onClick={() => setShowCallback(true)}
                  className="flex items-center justify-center gap-1.5 border-2 border-primary-800 text-primary-800 hover:bg-primary-50 font-bold px-3 py-2.5 rounded-xl text-sm transition-colors"
                >
                  <PhoneCall size={15} /> {t.cb}
                </button>
                {bookTarget && (
                  <button
                    type="button"
                    onClick={onBook}
                    className="flex items-center justify-center gap-1.5 bg-primary-800 hover:bg-primary-700 text-white font-bold px-3 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {t.book} <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
