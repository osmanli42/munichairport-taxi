'use client';

/**
 * Canlı Asistan — Admin-Seite im Live-Tab.
 *  - useLiveAssistAdmin: Einstellungen, Codes, Übersicht (alle 5 s) und Alarm-Töne.
 *  - LiveAssistPanel: Schalter, Benachrichtigungs-Matrix (Ton / E-Mail), Tages-KPI.
 *  - LiveAssistRow: 💬-Button pro Besucher, Nachrichtenfenster, Status-Badges, Ref, Preis.
 * Besucherseite: components/LiveAssist.tsx. Backend: routes/liveAssist.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, MessageCircle, Settings2, Volume2, VolumeX, Send, X, ChevronDown, ChevronUp, Loader2, ImagePlus, Archive, Search } from 'lucide-react';
import { imageToDataUrl } from '@/lib/liveAssist';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

type Kind = 'chat' | 'reaction' | 'price_view' | 'hesitating';
const KINDS: Kind[] = ['chat', 'reaction', 'price_view', 'hesitating'];
// Chat-Alarme heißen in der DB "chat:<id>" (einer pro Nachricht)
const kindOf = (k: string): Kind => (k.startsWith('chat') ? 'chat' : (k as Kind));

interface Promo { code: string; type: 'fixed' | 'percent'; value: number; end_date: string }
interface SessionInfo {
  messages: number;
  auto_shown: boolean;
  unread?: number;
  visitor_msgs?: number;
  last: null | {
    id: number; source: 'admin' | 'auto'; template: string | null; promo_code: string | null;
    created_at: string; delivered_at: string | null; seen_at: string | null; action: string | null;
  };
  price_shown?: { price: number; km: number | null; vehicle: string | null };
}
interface Overview {
  enabled: boolean;
  sessions: Record<string, SessionInfo>;
  kpi: { sent: number; auto_shown: number; seen: number; clicks: number; bookings: number; chats?: number };
  alerts: { id: number; session_id: string; kind: string; detail: string; created_at: string }[];
  last_alert_id: number;
  sound: Record<Kind, boolean>;
}

export interface LiveAssistState {
  settings: Record<string, string> | null;
  adminEmailDefault: string;
  emailConfigured: boolean;
  aiConfigured: boolean;
  promos: Promo[];
  overview: Overview | null;
  soundReady: boolean;
  unlockSound: () => void;
  testSound: (kind: Kind) => void;
  save: (s: Record<string, string>) => Promise<string | null>;
  send: (sessionId: string, template: string, body: string, promo: string, image?: string) => Promise<string | null>;
  token: string;
}

// ── Töne (Web Audio, keine Datei nötig) ───────────────────────────────────
const TONES: Record<Kind, [number, number][]> = {
  chat: [[784, 0], [988, 0.12], [1319, 0.24]],   // drei Töne — Nachricht im Chat
  reaction: [[880, 0], [1320, 0.16]],           // aufsteigend — "jemand reagiert"
  price_view: [[660, 0]],                       // kurzer, leiser Ton
  hesitating: [[520, 0], [520, 0.22]],          // doppelt — "jetzt eingreifen"
};

function playTone(ctx: AudioContext, kind: Kind) {
  const now = ctx.currentTime;
  for (const [freq, at] of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const vol = kind === 'price_view' ? 0.12 : 0.22;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(vol, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.4);
  }
}

const ALERT_TITLE: Record<Kind, string> = {
  chat: '💬 Yeni chat mesajı',
  reaction: '💬 Ziyaretçi mesaja tepki verdi',
  price_view: '👀 Yeni ziyaretçi fiyat gördü',
  hesitating: '⏳ Ziyaretçi kararsız',
};

export function useLiveAssistAdmin(token: string, sessionIds: string[]): LiveAssistState {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [adminEmailDefault, setAdminEmailDefault] = useState('');
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [soundReady, setSoundReady] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastAlertRef = useRef<number | null>(null);
  const idsRef = useRef<string[]>(sessionIds);
  idsRef.current = sessionIds;
  const auth = { Authorization: `Bearer ${token}` };

  const getAudio = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioRef.current = new Ctor();
    }
    return audioRef.current;
  }, []);

  // Browser erlauben Ton erst nach einer Nutzeraktion — der Klick auf den Live-Tab zählt
  // meist schon; falls nicht, bleibt der Knopf "Sesi etkinleştir" sichtbar.
  useEffect(() => {
    const ctx = getAudio();
    if (!ctx) return;
    const sync = () => setSoundReady(ctx.state === 'running');
    ctx.resume().then(sync).catch(sync);
    ctx.onstatechange = sync;
  }, [getAudio]);

  const unlockSound = useCallback(() => {
    const ctx = getAudio();
    if (!ctx) return;
    ctx.resume().then(() => { setSoundReady(ctx.state === 'running'); playTone(ctx, 'price_view'); }).catch(() => {});
  }, [getAudio]);

  const testSound = useCallback((kind: Kind) => {
    const ctx = getAudio();
    if (!ctx) return;
    ctx.resume().then(() => { setSoundReady(ctx.state === 'running'); playTone(ctx, kind); }).catch(() => {});
  }, [getAudio]);

  const loadSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/settings`, { headers: auth });
      if (!r.ok) return;
      const j = await r.json();
      setSettings(j.settings);
      setAdminEmailDefault(j.admin_email_default || '');
      setEmailConfigured(!!j.email_configured);
      setAiConfigured(!!j.ai_configured);
    } catch { /* nächster Versuch beim Speichern */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadPromos = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/promos`, { headers: auth });
      if (r.ok) setPromos((await r.json()).promos || []);
    } catch { /* ohne Codes weiter */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadOverview = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ session_ids: idsRef.current.join(',') });
      if (lastAlertRef.current !== null) qs.set('since_alert_id', String(lastAlertRef.current));
      const r = await fetch(`${API_BASE}/admin/live-assist/overview?${qs}`, { headers: auth });
      if (!r.ok) return;
      const j: Overview = await r.json();
      setOverview(j);

      if (lastAlertRef.current === null) {
        lastAlertRef.current = j.last_alert_id; // erster Aufruf: alte Alarme nicht abspielen
        return;
      }
      if (!j.alerts.length) return;
      lastAlertRef.current = Math.max(lastAlertRef.current, ...j.alerts.map((a) => a.id));
      const played = new Set<Kind>();
      const ctx = audioRef.current;
      for (const a of j.alerts) {
        const kind = kindOf(a.kind);
        if (!j.sound[kind]) continue;
        if (ctx && ctx.state === 'running' && !played.has(kind)) {
          played.add(kind);
          playTone(ctx, kind);
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(ALERT_TITLE[kind], { body: a.detail || '', icon: '/favicon.ico', tag: `la-${a.id}` });
        }
      }
    } catch { /* nächster Versuch in 5 s */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadSettings(); loadPromos();
    // Serverseitige Änderungen (z. B. neu hinterlegter API-Schlüssel) ohne Neuladen übernehmen
    const iv = setInterval(loadSettings, 60_000);
    return () => clearInterval(iv);
  }, [loadSettings, loadPromos]);
  useEffect(() => {
    loadOverview();
    const iv = setInterval(loadOverview, 5000);
    const iv2 = setInterval(loadPromos, 5 * 60 * 1000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [loadOverview, loadPromos]);

  const save = useCallback(async (next: Record<string, string>): Promise<string | null> => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/settings`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (!r.ok) return j.error || 'Kaydedilemedi';
      setSettings(j.settings);
      loadOverview();
      return null;
    } catch {
      return 'Kaydedilemedi';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadOverview]);

  const send = useCallback(async (sessionId: string, template: string, body: string, promo: string, image?: string): Promise<string | null> => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/messages`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, template, body, promo_code: promo || undefined, image }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.error || 'Gönderilemedi';
      loadOverview();
      return null;
    } catch {
      return 'Gönderilemedi';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadOverview]);

  return { settings, adminEmailDefault, emailConfigured, aiConfigured, promos, overview, soundReady, unlockSound, testSound, save, send, token };
}

// ── Einstellungen + KPI ────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

const KIND_LABEL: Record<Kind, [string, string]> = {
  chat: ["Ziyaretçi chat'e yazdı", 'Her yeni mesaj / resim'],
  reaction: ['Ziyaretçi balona tepki verdi', "WhatsApp'a / geri aramaya / rezervasyona tıkladı"],
  price_view: ['Yeni ziyaretçi fiyat gördü', 'Mesaj atma fırsatı'],
  hesitating: ['Fiyat gören ziyaretçi kararsız', 'X dakikadır sitede, rezervasyon yok'],
};

export function LiveAssistPanel({ la }: { la: LiveAssistState }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (la.settings && !draft) setDraft(la.settings); }, [la.settings, draft]);

  const s = draft || la.settings;
  const enabled = la.settings?.enabled === '1';
  const kpi = la.overview?.kpi;
  const set = (k: string, v: string) => { setDraft((d) => ({ ...(d || la.settings || {}), [k]: v })); setMsg(null); };
  const dirty = !!draft && !!la.settings && Object.keys(draft).some((k) => draft[k] !== la.settings![k]);

  const saveAll = async (override?: Record<string, string>) => {
    if (!s) return;
    setSaving(true);
    const err = await la.save(override || s);
    setSaving(false);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Kaydedildi ✓' });
    if (!err) setDraft(null);
  };

  // Hauptschalter speichert sofort — der wichtigste Knopf soll ohne "Kaydet" wirken.
  const toggleMaster = async (v: boolean) => {
    const next = { ...(la.settings || {}), enabled: v ? '1' : '0' };
    setDraft(null);
    await saveAll(next);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-emerald-600" />
          <span className="font-semibold text-sm">Canlı Asistan</span>
        </div>
        {la.settings && (
          <Toggle checked={enabled} onChange={toggleMaster} label={enabled ? 'Açık' : 'Kapalı'} />
        )}
        {kpi && (
          <span className="text-xs text-gray-600">
            Bugün: <b>{kpi.chats ?? 0}</b> chat · <b>{kpi.sent}</b> mesaj · <b>{kpi.seen}</b> görüldü · <b>{kpi.clicks}</b> tıklama ·{' '}
            <b className="text-emerald-700">{kpi.bookings}</b> rezervasyon · 🤖 {kpi.auto_shown} otomatik balon
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={la.unlockSound}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border ${la.soundReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-800 animate-pulse'}`}
            title="Tarayıcılar sesi ancak bir tıklamadan sonra çalar"
          >
            {la.soundReady ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {la.soundReady ? 'Ses açık' : 'Sesi etkinleştir'}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            <Settings2 size={13} /> Ayarlar {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {open && s && (
        <div className="border-t px-5 py-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sitede</div>
            <Toggle checked={s.auto_enabled === '1'} onChange={(v) => set('auto_enabled', v ? '1' : '0')}
              label="Otomatik yardım balonu" hint="Fiyat sayfasında karar vermeyen ziyaretçiye WhatsApp / geri arama balonu (oturumda 1 kez, indirimsiz)" />
            <label className="flex items-center gap-2 text-sm text-gray-700 pl-12 py-1">
              Bekleme süresi
              <input type="number" min={10} max={600} value={s.auto_delay_sec}
                onChange={(e) => set('auto_delay_sec', e.target.value)}
                className="w-20 border rounded-lg px-2 py-1 text-sm" /> sn
            </label>
            <Toggle checked={s.wa_prefill_enabled === '1'} onChange={(v) => set('wa_prefill_enabled', v ? '1' : '0')}
              label="WhatsApp mesajı hazır dolu gelsin" hint="Fiyat / buchen sayfasında rota, tarih, araç, fiyat ve Ref kodu" />
            <Toggle checked={s.ai_draft_enabled === '1'} onChange={(v) => set('ai_draft_enabled', v ? '1' : '0')}
              label="Yapay zekâ cevap taslağı" hint={la.aiConfigured
                ? 'Müşteri yazınca cevap taslağı otomatik mesaj kutusuna yazılır — sen kontrol edip Gönder\'e basarsın'
                : 'Sunucuda ANTHROPIC_API_KEY yok — anahtar eklenince çalışır'} />
            <label className="block text-sm text-gray-700 py-1.5">
              Balonda görünen isim
              <input type="text" maxLength={40} value={s.agent_name}
                onChange={(e) => set('agent_name', e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 py-1">
              &quot;Kararsız&quot; sayılma süresi
              <input type="number" min={1} max={30} value={s.hesitate_min}
                onChange={(e) => set('hesitate_min', e.target.value)}
                className="w-16 border rounded-lg px-2 py-1 text-sm" /> dk
            </label>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bildirimler</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="text-left font-medium pb-1">Olay</th>
                  <th className="font-medium pb-1 w-20">🔊 Ses</th>
                  <th className="font-medium pb-1 w-20">✉️ E-posta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {KINDS.map((k) => (
                  <tr key={k}>
                    <td className="py-2 pr-2">
                      <div className="text-gray-800">{KIND_LABEL[k][0]}</div>
                      <div className="text-[11px] text-gray-500">{KIND_LABEL[k][1]}</div>
                    </td>
                    <td className="text-center">
                      <input type="checkbox" className="w-4 h-4" checked={s[`notify_${k}_sound`] === '1'}
                        onChange={(e) => set(`notify_${k}_sound`, e.target.checked ? '1' : '0')} />
                      <button type="button" onClick={() => la.testSound(k)} className="block mx-auto text-[10px] text-gray-400 hover:text-gray-700">dene</button>
                    </td>
                    <td className="text-center">
                      <input type="checkbox" className="w-4 h-4" checked={s[`notify_${k}_email`] === '1'}
                        onChange={(e) => set(`notify_${k}_email`, e.target.checked ? '1' : '0')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="block text-sm text-gray-700 pt-3">
              E-posta alıcısı
              <input type="email" value={s.email_to} placeholder={la.adminEmailDefault}
                onChange={(e) => set('email_to', e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 py-2">
              Saatte en fazla
              <input type="number" min={0} max={60} value={s.email_max_per_hour}
                onChange={(e) => set('email_max_per_hour', e.target.value)}
                className="w-16 border rounded-lg px-2 py-1 text-sm" /> e-posta
            </label>
            {!la.emailConfigured && (
              <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                Bu sunucuda RESEND_API_KEY yok — e-postalar gönderilmez, sadece ses çalışır.
              </p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              Ses bu sekme açıkken çalar (arka planda da). E-posta sunucudan gider, laptop kapalıyken de telefona düşer.
            </p>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => saveAll()}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {msg && <span className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pro Besucher: Button, Nachrichtenfenster, Status ──────────────────────

interface RowSession {
  session_id: string;
  current_path: string | null;
  page_history: string | null;
  landing_page: string | null;
  lang: string | null;
  is_bot: number;
}

function visitorLocale(s: RowSession): 'de' | 'en' | 'tr' {
  const p = s.current_path || s.landing_page || '';
  if (/^\/en(\/|\?|$)/.test(p)) return 'en';
  if (/^\/tr(\/|\?|$)/.test(p)) return 'tr';
  return 'de';
}

function routeFrom(s: RowSession): { pickup: string; dropoff: string } | null {
  const paths = [s.current_path, ...(s.page_history ? s.page_history.split('|||') : []), s.landing_page];
  for (const p of paths) {
    if (!p || !/\/(ergebnisse|buchen)/.test(p) || !p.includes('?')) continue;
    const qs = new URLSearchParams(p.slice(p.indexOf('?') + 1));
    const short = (a: string | null) => (a || '').split(',')[0].trim();
    const pickup = short(qs.get('pickup'));
    const dropoff = short(qs.get('dropoff'));
    if (pickup && dropoff) return { pickup, dropoff };
  }
  return null;
}

const fmtEur = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Hazır taslaklar — gruplu. {name} {route} {price} {code} {discount} tıklanınca doldurulur.
type Lang2 = 'de' | 'en';
interface Tpl { id: string; label: string; promo?: boolean; de: string; en: string }
const TEMPLATE_GROUPS: { id: string; label: string; items: Tpl[] }[] = [
  { id: 'greet', label: 'Karşılama', items: [
    { id: 'price', label: 'Selam + fiyat',
      de: 'Hallo 👋 Ich bin {name} von Munich Airport Taxi. Ihre Fahrt {route} kostet {price} Festpreis – inkl. Gepäck und Maut. Haben Sie Fragen?',
      en: "Hi 👋 I'm {name} from Munich Airport Taxi. Your ride {route} is a fixed price of {price} – luggage and tolls included. Any questions?" },
    { id: 'question', label: 'Sorunuz var mı?',
      de: 'Hallo! Kann ich Ihnen bei Ihrer Buchung helfen? Ich bin gerade online.',
      en: "Hi! Can I help you with your booking? I'm online right now." },
    { id: 'fixed', label: 'Sabit fiyat garantisi',
      de: 'Der Preis ist ein Festpreis – kein Taxameter, keine Zuschläge bei Stau oder Wartezeit am Flughafen.',
      en: 'This is a fixed price – no meter, no extra charge for traffic or waiting at the airport.' },
  ] },
  { id: 'promo', label: 'İndirim', items: [
    { id: 'promo_send', label: 'İndirim gönderiyorum', promo: true,
      de: 'Gute Nachricht: Ich schicke Ihnen einen Online-Rabatt von {discount}! Tippen Sie einfach unten auf „Rabatt sichern & buchen“.',
      en: 'Good news: I\'m sending you an online discount of {discount}! Just tap "Claim discount & book" below.' },
    { id: 'promo_today', label: 'Sadece bugün', promo: true,
      de: 'Nur heute für Sie: {discount} Rabatt mit dem Code {code}. Der Rabatt wird bei der Buchung automatisch abgezogen.',
      en: "Today only: {discount} off with code {code}. It's deducted automatically when you book." },
  ] },
  { id: 'info', label: 'Bilgi', items: [
    { id: 'luggage', label: 'Bagaj',
      de: 'Kein Problem – Gepäck ist im Preis inbegriffen. Bei viel Gepäck empfehle ich den Van.',
      en: "No problem – luggage is included. For a lot of luggage I'd recommend the van." },
    { id: 'childseat', label: 'Çocuk koltuğu',
      de: 'Kindersitze stellen wir kostenlos. Geben Sie bei der Buchung einfach Alter oder Größe des Kindes an.',
      en: "Child seats are free of charge. Just add your child's age or size when booking." },
    { id: 'meet', label: 'Buluşma',
      de: 'So treffen wir uns: Sobald Sie Ihr gesamtes Gepäck abgeholt haben, schreiben Sie uns bitte kurz per WhatsApp (+49 151 41620000). Unser Fahrer wartet dann direkt am Ausgang mit einem Abholschild auf Sie.',
      en: "Here's how we meet: once you've collected all your luggage, please send us a quick WhatsApp message (+49 151 41620000). Our driver will then be waiting for you right at the exit with a pickup sign." },
    { id: 'payment', label: 'Ödeme',
      de: 'Sie zahlen bequem bar beim Fahrer oder per Karte – keine Vorauszahlung nötig.',
      en: 'You can pay the driver in cash or by card – no prepayment needed.' },
    { id: 'cancel', label: 'Ücretsiz iptal',
      de: 'Sie können bis 3 Stunden vor der Abholung kostenlos stornieren.',
      en: 'You can cancel free of charge up to 3 hours before pickup.' },
    { id: 'group', label: 'Büyük grup',
      de: 'Für Ihre Gruppe passt unser Großraumtaxi mit bis zu 8 Plätzen und viel Gepäckraum.',
      en: 'Our large taxi fits your group – up to 8 seats and plenty of luggage space.' },
    { id: 'night', label: '7/24',
      de: 'Wir fahren rund um die Uhr – auch sehr früh morgens oder spät nachts.',
      en: 'We operate 24/7 – including very early mornings and late nights.' },
  ] },
  { id: 'book', label: 'Rezervasyon', items: [
    { id: 'howto', label: 'Nasıl rezerve edilir',
      de: 'Die Buchung dauert nur 1 Minute: Wählen Sie oben das Fahrzeug und klicken Sie auf „Dieses Fahrzeug buchen“.',
      en: 'Booking takes just a minute: choose your vehicle above and click "Book this vehicle".' },
    { id: 'form', label: 'Formda yardım',
      de: 'Ich sehe, Sie sind im Buchungsformular – kann ich bei einem Feld helfen?',
      en: "I see you're on the booking form – can I help with anything?" },
    { id: 'confirm', label: 'Onay e-postası',
      de: 'Nach der Buchung erhalten Sie sofort eine Bestätigung per E-Mail mit allen Details.',
      en: "Right after booking you'll get a confirmation email with all the details." },
    { id: 'callback', label: 'Geri arama',
      de: 'Lieber telefonisch? Hinterlassen Sie Ihre Nummer – ich rufe Sie in wenigen Minuten zurück.',
      en: "Prefer to talk? Leave your number – I'll call you back within a few minutes." },
  ] },
  { id: 'close', label: 'Kapanış', items: [
    { id: 'check', label: 'Kontrol ediyorum',
      de: 'Einen Moment bitte, ich prüfe das kurz für Sie.',
      en: 'One moment please, let me quickly check that for you.' },
    { id: 'thanks', label: 'Teşekkür',
      de: 'Vielen Dank für Ihre Buchung! Wir freuen uns, Sie zu fahren. Gute Reise!',
      en: 'Thank you for your booking! We look forward to driving you. Have a good trip!' },
    { id: 'bye', label: 'Veda',
      de: 'Gerne! Wenn noch etwas ist, schreiben Sie mir einfach hier. Schönen Tag noch!',
      en: "You're welcome! If anything comes up, just message me here. Have a great day!" },
  ] },
];

function fillTemplate(t: Tpl, lang: 'de' | 'en' | 'tr', name: string, route: { pickup: string; dropoff: string } | null, price: number | null, promo: Promo | null): string {
  const l: Lang2 = lang === 'de' ? 'de' : 'en'; // türkische Seite → Englisch
  let text = t[l];
  // "Selam + fiyat" ohne Route/Preis → allgemeine Begrüßung
  if (t.id === 'price' && !(route && price)) {
    text = l === 'de'
      ? `Hallo 👋 Ich bin ${name} von Munich Airport Taxi. Kann ich Ihnen bei Ihrer Buchung helfen? Ich bin gerade online.`
      : `Hi 👋 I'm ${name} from Munich Airport Taxi. Can I help you with your booking? I'm online right now.`;
  }
  const discount = promo ? (promo.type === 'percent' ? `${promo.value} %` : fmtEur(promo.value)) : '{discount}';
  return text
    .replace(/\{name\}/g, name)
    .replace(/\{route\}/g, route ? `${route.pickup} → ${route.dropoff}` : '')
    .replace(/\{price\}/g, price ? fmtEur(price) : '')
    .replace(/\{code\}/g, promo?.code || '{code}')
    .replace(/\{discount\}/g, discount);
}

function statusBadge(info: SessionInfo | undefined): { text: string; cls: string } | null {
  const m = info?.last;
  if (!m) return null;
  const auto = m.source === 'auto';
  const prefix = auto ? '🤖 ' : '';
  if (m.action === 'chat') return { text: `${prefix}💬 chat'e yazdı`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'whatsapp') return { text: `${prefix}💬 WhatsApp'a tıkladı`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'callback') return { text: `${prefix}📞 geri arama istedi`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'book') return { text: `${prefix}🛒 rezervasyona geçti`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'dismiss') return { text: `${prefix}✕ balonu kapattı`, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  if (auto) return { text: '🤖 otomatik balon gösterildi', cls: 'bg-sky-50 text-sky-700 border-sky-200' };
  if (m.seen_at) return { text: '👁 mesajı gördü', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (m.delivered_at) return { text: '📬 iletildi', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { text: '📨 gönderildi, bekleniyor', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
}

// Bild aus dem Chat mit Admin-Token laden (img-Tags können keinen Header senden)
function AdminImage({ id, token }: { id: number; token: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    fetch(`${API_BASE}/admin/live-assist/file/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b) { revoke = URL.createObjectURL(b); setUrl(revoke); } })
      .catch(() => {});
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [id, token]);
  if (!url) return <div className="w-40 h-28 rounded-lg bg-gray-200 animate-pulse" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="rounded-lg max-h-48 w-auto" />
    </a>
  );
}

interface ThreadMsg {
  id: number; source: 'admin' | 'auto' | 'visitor'; template: string | null; body: string | null;
  promo_code: string | null; attachment_id: number | null; created_at: string;
  delivered_at: string | null; seen_at: string | null; action: string | null;
}

const fmtTime = (v: string) => new Date(v).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

interface TripCtx {
  pickup: string | null; dropoff: string | null; date: string | null; time: string | null;
  passengers: number | null; trip_type: string | null; return_date: string | null; return_time: string | null;
  zwischenstopp: string | null; vehicle: string | null; distance_km: number | null; duration_min: number | null;
  prices: Record<string, number>; page: string | null; city: string | null; country: string | null;
  device: string | null; source: string | null; booking_number: string | null;
}

const VEHICLE_TR: Record<string, string> = { kombi: 'Kombi', van: 'Van', grossraumtaxi: 'Büyük taksi' };
const dmy = (d: string | null, t: string | null) => (d ? `${d.split('-').reverse().join('.')}${t ? ` ${t}` : ''}` : '');

/** Kopf des Admin-Chats: alles, was der Kunde gesucht/gesehen hat — vor der Antwort. */
function TripCard({ t }: { t: TripCtx }) {
  const hasRoute = t.pickup || t.dropoff;
  const priceEntries = Object.entries(t.prices || {});
  return (
    <div className="px-3 py-2.5 bg-amber-50 border-b border-amber-200 text-sm">
      {hasRoute ? (
        <div className="font-semibold text-gray-900 break-words">
          📍 {t.pickup || '?'} <span className="text-amber-600">→</span> {t.dropoff || '?'}
          {t.zwischenstopp && <span className="font-normal text-gray-600"> (ara durak: {t.zwischenstopp})</span>}
        </div>
      ) : (
        <div className="text-gray-500 text-xs">Müşteri henüz rota aramadı.</div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-700">
        {t.date && <span>📅 {dmy(t.date, t.time)}</span>}
        {t.passengers != null && <span>👥 {t.passengers} kişi</span>}
        {t.trip_type === 'roundtrip'
          ? <span>🔁 gidiş-dönüş{t.return_date ? ` · dönüş ${dmy(t.return_date, t.return_time)}` : ''}</span>
          : t.trip_type ? <span>➡️ tek yön</span> : null}
        {t.distance_km ? <span>🛣 {Number(t.distance_km).toFixed(1).replace('.', ',')} km{t.duration_min ? ` · ~${t.duration_min} dk` : ''}</span> : null}
        {t.page === 'buchen' && <span className="text-orange-700 font-semibold">🛒 rezervasyon formunda</span>}
        {t.booking_number && <span className="text-emerald-700 font-semibold">✅ rezervasyon {t.booking_number}</span>}
      </div>
      {priceEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {priceEntries.map(([v, p]) => (
            <span key={v} className={`text-xs px-2 py-0.5 rounded-full border ${t.vehicle === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-800 border-amber-300'}`}>
              {VEHICLE_TR[v] || v}: <b>{fmtEur(p)}</b>{t.vehicle === v ? ' · seçti' : ''}
            </span>
          ))}
        </div>
      )}
      <div className="text-[11px] text-gray-500 mt-1">
        {[t.city, t.device === 'mobile' ? '📱 mobil' : t.device === 'desktop' ? '💻 masaüstü' : t.device, t.source].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}

/** Gesprächsverlauf (Live und Archiv). `live` = Besucher ist gerade da → Senden möglich. */
export function ChatThread({ la, sessionId, live, lang, route, price }: {
  la: LiveAssistState; sessionId: string; live: boolean;
  lang: 'de' | 'en' | 'tr'; route: { pickup: string; dropoff: string } | null; price: number | null;
}) {
  const [msgs, setMsgs] = useState<ThreadMsg[]>([]);
  const [trip, setTrip] = useState<TripCtx | null>(null);
  const [body, setBody] = useState('');
  const [tpl, setTpl] = useState<string>('custom');
  const [group, setGroup] = useState<string | null>(null);
  const [promo, setPromo] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const name = la.settings?.agent_name || 'Osman';
  const [drafting, setDrafting] = useState(false);
  const aiOn = la.settings?.ai_draft_enabled === '1';
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const draftedForRef = useRef<number>(0);

  const draft = useCallback(async () => {
    setDrafting(true);
    setErr('');
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/suggest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${la.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Taslak oluşturulamadı'); return; }
      // Nur einsetzen, wenn der Admin inzwischen nichts selbst getippt hat
      if (!bodyRef.current.trim()) { setBody(j.text || ''); setTpl('custom'); }
    } finally {
      setDrafting(false);
    }
  }, [sessionId, la.token]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/thread?session_id=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${la.token}` },
      });
      if (r.ok) { const j = await r.json(); setMsgs(j.messages || []); setTrip(j.context || null); }
    } catch { /* nächster Versuch */ }
  }, [sessionId, la.token]);

  useEffect(() => {
    load();
    if (!live) return;
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load, live]);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs.length]);

  // Neue Kundennachricht → Entwurf automatisch vorbereiten (nur live, nur wenn Feld leer)
  useEffect(() => {
    if (!live || !aiOn || !la.aiConfigured || !msgs.length) return;
    const last = msgs[msgs.length - 1];
    if (last.source !== 'visitor' || draftedForRef.current >= last.id || bodyRef.current.trim()) return;
    draftedForRef.current = last.id;
    draft();
  }, [msgs, live, aiOn, la.aiConfigured, draft]);

  const submit = async (image?: string) => {
    if (!body.trim() && !image && !promo) return;
    setSending(true);
    const e = await la.send(sessionId, tpl, image ? '' : body.trim(), image ? '' : promo, image);
    setSending(false);
    if (e) { setErr(e); return; }
    setErr('');
    if (!image) { setBody(''); setPromo(''); setTpl('custom'); }
    load();
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try { await submit(await imageToDataUrl(f)); } catch { setErr('Resim okunamadı'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const promoText = (p: Promo) => `${p.code} (${p.type === 'percent' ? `−${p.value} %` : `−${fmtEur(p.value)}`})`;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
      {trip && <TripCard t={trip} />}
      <div ref={listRef} className="max-h-72 overflow-y-auto bg-gray-50 px-3 py-2 space-y-1.5">
        {msgs.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">Henüz mesaj yok — ilk mesajı sen yaz.</p>}
        {msgs.map((m) => {
          if (m.source === 'auto') {
            return <p key={m.id} className="text-[11px] text-center text-sky-600">🤖 otomatik yardım balonu gösterildi · {fmtTime(m.created_at)}</p>;
          }
          const mine = m.source === 'admin';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-line break-words ${mine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'}`}>
                {m.attachment_id && <AdminImage id={m.attachment_id} token={la.token} />}
                {m.body}
                {m.promo_code && <div className={`mt-1 text-xs font-bold ${mine ? 'text-yellow-200' : 'text-amber-700'}`}>🎁 {m.promo_code}{m.action === 'book' ? ' · ✓ müşteri aldı' : ''}</div>}
                <div className={`text-[10px] mt-0.5 ${mine ? 'text-emerald-100' : 'text-gray-400'}`}>
                  {fmtTime(m.created_at)}{mine ? (m.seen_at ? ' · ✓✓ görüldü' : m.delivered_at ? ' · ✓ iletildi' : ' · gönderildi') : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {live ? (
        <div className="border-t p-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_GROUPS.map((g) => (
              <button key={g.id} type="button" onClick={() => setGroup(group === g.id ? null : g.id)}
                className={`text-[11px] px-2 py-0.5 rounded-full border ${group === g.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                {g.label} {group === g.id ? '▴' : '▾'}
              </button>
            ))}
            {aiOn && (
              <button type="button" onClick={draft} disabled={drafting || !la.aiConfigured}
                title={la.aiConfigured ? 'Konuşmaya göre cevap taslağı yaz' : 'Sunucuda ANTHROPIC_API_KEY yok'}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                {drafting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Yapay zekâ taslağı
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto">dil: {lang.toUpperCase()}</span>
          </div>
          {group && (
            <div className="flex flex-wrap gap-1 bg-gray-50 rounded-lg p-1.5">
              {TEMPLATE_GROUPS.find((g) => g.id === group)!.items.map((t) => (
                <button key={t.id} type="button"
                  onClick={() => {
                    let chosen = la.promos.find((p) => p.code === promo) || null;
                    if (t.promo && !chosen) {
                      chosen = la.promos[0] || null;
                      if (chosen) setPromo(chosen.code);
                      else setErr('Şu an geçerli indirim kodu yok — önce Aktionen sekmesinden oluştur');
                    }
                    setTpl(t.id);
                    setBody(fillTemplate(t, lang, name, route, price, chosen));
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${tpl === t.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} title="Resim gönder" className="p-2 text-gray-500 hover:text-emerald-700">
              <ImagePlus size={18} />
            </button>
            <textarea value={body} maxLength={500} rows={2}
              onChange={(e) => { setBody(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={drafting ? "Yapay zekâ taslak yazıyor…" : "Mesaj yaz… (Enter = gönder)"}
              className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm resize-none" />
            <button type="button" onClick={() => submit()} disabled={sending || (!body.trim() && !promo)}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-lg">
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Gönder
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={promo} onChange={(e) => setPromo(e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white">
              <option value="">🎁 İndirim ekleme</option>
              {la.promos.map((p) => <option key={p.code} value={p.code}>{promoText(p)}</option>)}
            </select>
            <span className="text-[11px] text-gray-400">
              {la.promos.length === 0 ? '(şu an geçerli promo kodu yok — Aktionen sekmesinden oluştur)' : 'Müşteri "İndirimi al & rezerve et"e basınca rezervasyona otomatik eklenir'}
            </span>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      ) : (
        <p className="border-t text-[11px] text-gray-500 px-3 py-2">Ziyaretçi şu an sitede değil — kayıt sadece görüntüleniyor.</p>
      )}
    </div>
  );
}

export function LiveAssistRow({ la, s }: { la: LiveAssistState; s: RowSession }) {
  const [open, setOpen] = useState(false);
  const enabled = la.settings?.enabled === '1';
  const info = la.overview?.sessions?.[s.session_id];
  const price = info?.price_shown?.price ?? null;
  const unread = info?.unread || 0;
  const ref = s.session_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const badge = statusBadge(info);

  // Ziyaretçi yazınca chat kendiliğinden açılır
  useEffect(() => { if (unread > 0) setOpen(true); }, [unread]);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {enabled && s.is_bot === 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-white ${unread > 0 ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <MessageCircle size={12} /> {unread > 0 ? `${unread} yeni mesaj` : open ? 'Chat\'i kapat' : 'Chat'}
          </button>
        )}
        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title="Chat arşivinde bu kodla aranabilir">
          Ref {ref}
        </span>
        {price != null && (
          <span className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">
            💶 gördüğü fiyat {fmtEur(price)}{info?.price_shown?.vehicle ? ` · ${info.price_shown.vehicle}` : ''}
          </span>
        )}
        {badge && <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>}
      </div>
      {open && (
        <div className="mt-2">
          <ChatThread la={la} sessionId={s.session_id} live lang={visitorLocale(s)} route={routeFrom(s)} price={price} />
        </div>
      )}
    </div>
  );
}

// ── Chat-Archiv: alle gespeicherten Gespräche, durchsuchbar ─────────────────

interface Conversation {
  session_id: string; started_at: string; last_at: string; agent_msgs: number; visitor_msgs: number;
  images: number; promos: string | null; last_body: string | null; booking_number: string | null; visitor: string | null;
}

export function LiveAssistArchive({ la }: { la: LiveAssistState }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [days, setDays] = useState('30');
  const [rows, setRows] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ days, q });
      const r = await fetch(`${API_BASE}/admin/live-assist/conversations?${qs}`, { headers: { Authorization: `Bearer ${la.token}` } });
      if (r.ok) setRows((await r.json()).conversations || []);
    } finally { setLoading(false); }
  }, [days, q, la.token]);

  useEffect(() => { if (open) load(); }, [open, days]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full px-5 py-3 flex items-center gap-2 text-left">
        <Archive size={16} className="text-gray-500" />
        <span className="font-semibold text-sm">Chat arşivi</span>
        <span className="text-xs text-gray-500">— tüm konuşmalar resimleriyle kayıtlı, Ref / metin ile ara</span>
        <span className="ml-auto">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && (
        <div className="border-t px-5 py-4 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-1 border rounded-lg px-2">
                <Search size={14} className="text-gray-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                  placeholder="Ref (ör. 6757) veya kelime" className="flex-1 py-1.5 text-sm outline-none" />
              </div>
              <select value={days} onChange={(e) => setDays(e.target.value)} className="text-sm border rounded-lg px-2">
                <option value="7">7 gün</option><option value="30">30 gün</option><option value="365">1 yıl</option><option value="3650">Tümü</option>
              </select>
              <button type="button" onClick={load} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 rounded-lg">Ara</button>
            </div>
            <div className="divide-y border rounded-xl max-h-[420px] overflow-y-auto">
              {loading && <p className="text-xs text-gray-400 p-3">Yükleniyor…</p>}
              {!loading && rows.length === 0 && <p className="text-xs text-gray-400 p-3">Kayıt yok.</p>}
              {rows.map((c) => {
                const ref = c.session_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
                return (
                  <button key={c.session_id} type="button" onClick={() => setSel(c.session_id)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${sel === c.session_id ? 'bg-emerald-50' : ''}`}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono bg-gray-100 px-1 rounded">Ref {ref}</span>
                      <span className="text-gray-500">{fmtTime(c.last_at)}</span>
                      {c.booking_number && <span className="text-emerald-700 font-semibold">✅ {c.booking_number}</span>}
                    </div>
                    <div className="text-sm text-gray-800 truncate mt-0.5">{c.last_body || (Number(c.images) ? '📷 Resim' : '—')}</div>
                    <div className="text-[11px] text-gray-500">
                      {Number(c.visitor_msgs)} müşteri · {Number(c.agent_msgs)} sen{Number(c.images) ? ` · 📷 ${c.images}` : ''}{c.promos ? ` · 🎁 ${c.promos}` : ''}{c.visitor ? ` · ${c.visitor}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:col-span-3">
            {sel
              ? <ChatThread key={sel} la={la} sessionId={sel} live={false} lang="de" route={null} price={null} />
              : <p className="text-sm text-gray-400 pt-8 text-center">Soldan bir konuşma seç.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
