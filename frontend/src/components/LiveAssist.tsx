'use client';

/**
 * Canlı Asistan — Live-Chat für Besucher.
 *
 * - Ist der Admin erreichbar (Live-Tab offen), erscheint ein Chat-Button; Besucher und
 *   Admin schreiben direkt miteinander, beide können Bilder schicken.
 * - Der Admin kann ein Rabattangebot (bestehender Aktionscode) in den Chat legen. Klick auf
 *   "Rabatt sichern & buchen" merkt den Code; /buchen löst ihn automatisch ein.
 * - Automatische Hilfe auf /ergebnisse (einmal pro Besuch): online → Chat mit Begrüßung,
 *   offline → WhatsApp / Rückruf wie bisher.
 * Der Verlauf wird serverseitig gespeichert (Admin: Chat-Archiv). Alles im Admin abschaltbar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { X, MessageCircle, PhoneCall, Gift, Send, ImagePlus, Loader2, ArrowRight } from 'lucide-react';
import CallbackRequest from '@/components/CallbackRequest';
import { buildWhatsAppLink } from '@/lib/utils';
import {
  useLiveAssistConfig, getSessionId, isPricePage, isBookingPage, readTripContext,
  draftPath, ackLiveAssist, LIVE_PROMO_KEY, LA_ONLINE_EVENT, LA_PROMO_EVENT, imageToDataUrl,
} from '@/lib/liveAssist';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');
const POLL_OPEN_MS = 3_000;
const POLL_IDLE_MS = 8_000;
const MAX_POLL_MS = 2 * 60 * 60 * 1000;
const AUTO_FLAG = 'mt_la_auto_shown';

interface Promo { code: string; type: 'fixed' | 'percent'; value: number }
interface Msg { id: number; from: 'agent' | 'visitor'; body: string; promo: Promo | null; attachment_id: number | null; created_at?: string; pending?: boolean; localImage?: string }

const T = {
  de: {
    online: 'jetzt online', offline: 'gerade nicht im Chat', team: 'Munich Airport Taxi',
    greet: 'Hallo 👋 Haben Sie Fragen zum Preis oder zur Fahrt? Schreiben Sie mir einfach hier.',
    offlineText: 'Wir sind gerade nicht im Chat. Schreiben Sie uns auf WhatsApp – oder wir rufen Sie kostenlos zurück.',
    placeholder: 'Nachricht schreiben…', wa: 'WhatsApp', cb: 'Rückruf', close: 'Schließen', chat: 'Chat',
    offer: 'Online-Rabatt für Sie', take: 'Rabatt sichern & buchen', taken: 'Rabatt gespeichert – wird bei der Buchung eingelöst',
    img: 'Bild senden', imgErr: 'Bild konnte nicht gesendet werden', sendErr: 'Senden fehlgeschlagen – bitte erneut versuchen', you: 'Sie',
    privacy: 'Der Chatverlauf wird zur Bearbeitung Ihrer Anfrage gespeichert.',
  },
  en: {
    online: 'online now', offline: 'not in chat right now', team: 'Munich Airport Taxi',
    greet: 'Hi 👋 Any questions about the price or your ride? Just write to me here.',
    offlineText: "We're not in the chat right now. Message us on WhatsApp – or we'll call you back for free.",
    placeholder: 'Write a message…', wa: 'WhatsApp', cb: 'Callback', close: 'Close', chat: 'Chat',
    offer: 'Online discount for you', take: 'Claim discount & book', taken: 'Discount saved – applied when you book',
    img: 'Send image', imgErr: 'Image could not be sent', sendErr: 'Sending failed – please try again', you: 'You',
    privacy: 'The chat history is stored to handle your request.',
  },
  tr: {
    online: 'şu an çevrimiçi', offline: 'şu an chat\'te değiliz', team: 'Munich Airport Taxi',
    greet: 'Merhaba 👋 Fiyat veya yolculuk hakkında sorunuz var mı? Buraya yazmanız yeterli.',
    offlineText: "Şu an chat'te değiliz. WhatsApp'tan yazın – ya da sizi ücretsiz geri arayalım.",
    placeholder: 'Mesaj yazın…', wa: 'WhatsApp', cb: 'Geri arama', close: 'Kapat', chat: 'Chat',
    offer: 'Size özel online indirim', take: 'İndirimi al & rezerve et', taken: 'İndirim kaydedildi – rezervasyonda uygulanır',
    img: 'Resim gönder', imgErr: 'Resim gönderilemedi', sendErr: 'Gönderilemedi – lütfen tekrar deneyin', you: 'Siz',
    privacy: 'Talebinizi işleyebilmek için sohbet geçmişi kaydedilir.',
  },
} as const;

function promoLabel(p: Promo) {
  return p.type === 'percent' ? `−${p.value} %` : `−${p.value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`;
}

export default function LiveAssist() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const locale = useLocale();
  const t = T[(locale as 'de' | 'en' | 'tr')] || T.de;
  const cfg = useLiveAssistConfig();

  const [online, setOnline] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [autoMode, setAutoMode] = useState(false); // automatisch geöffnet (Begrüßung)
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showCallback, setShowCallback] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);

  const lastIdRef = useRef(0);
  const openRef = useRef(false);
  openRef.current = open;
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoIdRef = useRef<number | null>(null);

  useEffect(() => { if (cfg) setOnline(!!cfg.agent_online); }, [cfg]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(LA_ONLINE_EVENT, { detail: online && !!cfg?.enabled }));
  }, [online, cfg?.enabled]);
  useEffect(() => {
    try { setClaimed(sessionStorage.getItem(LIVE_PROMO_KEY)); } catch { /* ignore */ }
  }, []);

  // Neue Nachrichten abholen — offen schneller, zu langsamer
  const poll = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId || document.visibilityState !== 'visible') return;
    try {
      const r = await fetch(`${API_BASE}/live-assist/inbox?session_id=${encodeURIComponent(sessionId)}&after_id=${lastIdRef.current}`);
      if (!r.ok) return;
      const j = await r.json();
      if (typeof j.agent_online === 'boolean') setOnline(j.agent_online);
      const incoming: Msg[] = Array.isArray(j.messages) ? j.messages : [];
      if (!incoming.length) return;
      lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id));
      setMessages((prev) => {
        const known = new Set(prev.filter((m) => !m.pending).map((m) => m.id));
        const withoutPending = prev.filter((m) => !(m.pending && incoming.some((n) => n.from === 'visitor')));
        return [...withoutPending, ...incoming.filter((m) => !known.has(m.id))];
      });
      const fromAgent = incoming.filter((m) => m.from === 'agent');
      if (fromAgent.length) {
        for (const m of fromAgent) {
          if (m.promo) { try { sessionStorage.setItem(LIVE_PROMO_KEY, m.promo.code); } catch { /* ignore */ } }
        }
        if (openRef.current) fromAgent.forEach((m) => ackLiveAssist('seen', m.id));
        else {
          // Admin schreibt → Chat öffnet sich von selbst (proaktive Ansprache)
          setOpen(true);
          setAutoMode(false);
          fromAgent.forEach((m) => ackLiveAssist('seen', m.id));
        }
        setUnread(0);
      }
    } catch { /* offline — nächster Versuch */ }
  }, []);

  useEffect(() => {
    if (!cfg?.enabled) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (Date.now() - started > MAX_POLL_MS) return;
      await poll();
      timer = setTimeout(loop, openRef.current ? POLL_OPEN_MS : POLL_IDLE_MS);
    };
    loop();
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [cfg?.enabled, poll]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages, showCallback]);

  // Automatische Hilfe auf der Preisseite — einmal pro Besuch
  useEffect(() => {
    if (!cfg?.auto_enabled || !isPricePage(pathname)) return;
    try { if (sessionStorage.getItem(AUTO_FLAG)) return; } catch { return; }
    const enteredAt = Date.now();
    let fired = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (fired || openRef.current) return;
      let consent: string | null = null;
      try { consent = localStorage.getItem('cookie_consent'); } catch { /* ignore */ }
      if (!consent || document.visibilityState !== 'visible') { retry = setTimeout(fire, 3000); return; }
      fired = true;
      try { sessionStorage.setItem(AUTO_FLAG, '1'); } catch { /* ignore */ }
      setAutoMode(true);
      setOpen(true);
      ackLiveAssist('auto_shown').then((id) => { autoIdRef.current = id; });
    };
    const timer = setTimeout(fire, Math.max(10, cfg.auto_delay_sec) * 1000);
    const onMouseOut = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0 && Date.now() - enteredAt > 8000) fire(); };
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
  }, [cfg?.auto_enabled, cfg?.auto_delay_sec, pathname]);

  const lastAgentId = [...messages].reverse().find((m) => m.from === 'agent')?.id ?? autoIdRef.current;

  const send = async (image?: string) => {
    const body = text.trim();
    const sessionId = getSessionId();
    if ((!body && !image) || !sessionId || sending) return;
    setSending(true);
    setError('');
    const tempId = -Date.now();
    setMessages((m) => [...m, { id: tempId, from: 'visitor', body: image ? '' : body, promo: null, attachment_id: null, pending: true, localImage: image }]);
    if (!image) setText('');
    try {
      const r = await fetch(`${API_BASE}/live-assist/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, body: image ? '' : body, image }),
      });
      if (!r.ok) throw new Error('send');
      poll();
    } catch {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setError(t.sendErr);
      if (!image) setText(body);
    } finally {
      setSending(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { await send(await imageToDataUrl(f)); } catch { setError(t.imgErr); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const claim = (m: Msg) => {
    if (!m.promo) return;
    try { sessionStorage.setItem(LIVE_PROMO_KEY, m.promo.code); } catch { /* ignore */ }
    setClaimed(m.promo.code);
    ackLiveAssist('book', m.id);
    window.dispatchEvent(new Event(LA_PROMO_EVENT));
    if (isPricePage(pathname)) {
      setOpen(false);
      (document.querySelector('[data-price][data-vehicle]') as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (!isBookingPage(pathname)) {
      const path = draftPath();
      if (path) router.push(path);
    }
  };

  if (!cfg?.enabled) return null;

  const hasThread = messages.length > 0;
  const showLauncher = !open && (online || hasThread);
  if (!open && !showLauncher) return null;

  const agent = cfg.agent_name || 'Munich Airport Taxi';
  const ctx = readTripContext(pathname);
  const waHref = buildWhatsAppLink(ctx, locale);
  const canChat = online || hasThread;
  const sessionId = getSessionId() || '';

  if (showLauncher) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setAutoMode(false); setUnread(0); }}
        className="fixed z-[60] bottom-[100px] right-4 md:bottom-6 md:right-6 flex items-center gap-2 bg-primary-800 hover:bg-primary-700 text-white pl-4 pr-5 h-14 rounded-full shadow-xl"
        aria-label={t.chat}
      >
        <span className="relative">
          <MessageCircle size={22} />
          {online && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-primary-800" />}
        </span>
        <span className="font-bold text-sm">{t.chat}</span>
        {unread > 0 && <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5">{unread}</span>}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={agent}
      className="fixed z-[60] left-3 right-3 bottom-[100px] md:left-auto md:right-6 md:bottom-6 md:w-[370px]"
      style={{ animation: 'laIn .25s ease-out' }}
    >
      <style>{'@keyframes laIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>
      <div className="bg-white rounded-2xl shadow-[0_16px_48px_rgba(15,27,45,.25)] border border-gray-100 overflow-hidden flex flex-col max-h-[70vh] sm:max-h-[560px]">
        {/* Kopf */}
        <div className="flex items-center gap-3 px-4 py-3 bg-primary-800 text-white">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gold-400 text-primary-900 font-extrabold flex items-center justify-center">
              {agent.trim().charAt(0).toUpperCase()}
            </div>
            {online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-primary-800" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{agent} · {t.team}</div>
            <div className="text-[11px] opacity-80">{online ? `● ${t.online}` : t.offline}</div>
          </div>
          <button type="button" onClick={() => { setOpen(false); if (autoMode && autoIdRef.current != null) ackLiveAssist('dismiss', autoIdRef.current); }} aria-label={t.close} className="p-1.5 -mr-1.5 opacity-80 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        {/* Verlauf */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50 min-h-[140px]">
          {canChat ? (
            !hasThread && <Bubble from="agent" body={t.greet} />
          ) : (
            <Bubble from="agent" body={t.offlineText} />
          )}
          {messages.map((m) => (
            <div key={m.id}>
              {(m.body || m.attachment_id || m.localImage) && (
                <Bubble
                  from={m.from}
                  body={m.body}
                  pending={m.pending}
                  image={m.localImage || (m.attachment_id ? `${API_BASE}/live-assist/file/${m.attachment_id}?session_id=${encodeURIComponent(sessionId)}` : undefined)}
                />
              )}
              {m.promo && (
                <div className="mt-1.5 mr-8 rounded-xl border-2 border-dashed border-gold-400 bg-gold-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gold-800"><Gift size={14} /> {t.offer}</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">
                    {m.promo.code} <span className="text-green-700">{promoLabel(m.promo)}</span>
                  </div>
                  {claimed === m.promo.code ? (
                    <div className="mt-1.5 text-xs text-green-700 font-semibold">✓ {t.taken}</div>
                  ) : (
                    <button type="button" onClick={() => claim(m)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 bg-primary-800 hover:bg-primary-700 text-white text-sm font-bold py-2.5 rounded-xl">
                      {t.take} <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {showCallback && (
            <CallbackRequest
              locale={locale}
              defaultOpen
              context={{
                pickup: ctx.pickup || undefined, dropoff: ctx.dropoff || undefined,
                price: ctx.price ?? null, vehicle: ctx.vehicle ?? null,
                passengers: ctx.passengers ? Number(ctx.passengers) : null,
                trip_datetime: ctx.date && ctx.time ? `${ctx.date} ${ctx.time}` : null,
              }}
              onSubmitted={() => { if (lastAgentId != null) ackLiveAssist('callback', lastAgentId); }}
            />
          )}
        </div>

        {/* Eingabe */}
        {canChat ? (
          <div className="border-t bg-white px-2 py-2">
            {error && <p className="text-[11px] text-red-600 px-2 pb-1">{error}</p>}
            <div className="flex items-end gap-1.5">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} aria-label={t.img}
                className="p-2.5 text-gray-500 hover:text-primary-800 disabled:opacity-40">
                <ImagePlus size={20} />
              </button>
              <textarea
                value={text}
                rows={1}
                maxLength={1000}
                onChange={(e) => { setText(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={t.placeholder}
                className="flex-1 resize-none max-h-28 border border-gray-200 rounded-xl px-3 py-2.5 text-[16px] sm:text-sm outline-none focus:border-primary-400"
              />
              <button type="button" onClick={() => send()} disabled={sending || !text.trim()} aria-label="Send"
                className="p-2.5 rounded-xl bg-primary-800 text-white disabled:opacity-40">
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 px-2 pt-1">{t.privacy}</p>
          </div>
        ) : (
          <div className="border-t bg-white p-3 grid grid-cols-2 gap-2">
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              onClick={() => { if (autoIdRef.current != null) ackLiveAssist('whatsapp', autoIdRef.current); }}
              className="flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm">
              <MessageCircle size={16} /> {t.wa}
            </a>
            <button type="button" onClick={() => setShowCallback(true)}
              className="flex items-center justify-center gap-1.5 border-2 border-primary-800 text-primary-800 font-bold py-2 rounded-xl text-sm">
              <PhoneCall size={15} /> {t.cb}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ from, body, image, pending }: { from: 'agent' | 'visitor'; body: string; image?: string; pending?: boolean }) {
  const mine = from === 'visitor';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line break-words ${
        mine ? 'bg-primary-800 text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'
      } ${pending ? 'opacity-60' : ''}`}>
        {image && (
          <a href={image} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="rounded-lg max-h-56 w-auto mb-1" />
          </a>
        )}
        {body}
      </div>
    </div>
  );
}
