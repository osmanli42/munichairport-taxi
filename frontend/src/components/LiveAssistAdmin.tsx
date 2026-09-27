'use client';

/**
 * Canlı Asistan — Admin-Seite im Live-Tab.
 *  - useLiveAssistAdmin: Einstellungen, Codes, Übersicht (alle 5 s) und Alarm-Töne.
 *  - LiveAssistPanel: Schalter, Benachrichtigungs-Matrix (Ton / E-Mail), Tages-KPI.
 *  - LiveAssistRow: 💬-Button pro Besucher, Nachrichtenfenster, Status-Badges, Ref, Preis.
 * Besucherseite: components/LiveAssist.tsx. Backend: routes/liveAssist.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Settings2, Volume2, VolumeX, Send, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

type Kind = 'reaction' | 'price_view' | 'hesitating';
const KINDS: Kind[] = ['reaction', 'price_view', 'hesitating'];

interface Promo { code: string; type: 'fixed' | 'percent'; value: number; end_date: string }
interface SessionInfo {
  messages: number;
  auto_shown: boolean;
  last: null | {
    id: number; source: 'admin' | 'auto'; template: string | null; promo_code: string | null;
    created_at: string; delivered_at: string | null; seen_at: string | null; action: string | null;
  };
  price_shown?: { price: number; km: number | null; vehicle: string | null };
}
interface Overview {
  enabled: boolean;
  sessions: Record<string, SessionInfo>;
  kpi: { sent: number; auto_shown: number; seen: number; clicks: number; bookings: number };
  alerts: { id: number; session_id: string; kind: Kind; detail: string; created_at: string }[];
  last_alert_id: number;
  sound: Record<Kind, boolean>;
}

export interface LiveAssistState {
  settings: Record<string, string> | null;
  adminEmailDefault: string;
  emailConfigured: boolean;
  promos: Promo[];
  overview: Overview | null;
  soundReady: boolean;
  unlockSound: () => void;
  testSound: (kind: Kind) => void;
  save: (s: Record<string, string>) => Promise<string | null>;
  send: (sessionId: string, template: string, body: string, promo: string) => Promise<string | null>;
}

// ── Töne (Web Audio, keine Datei nötig) ───────────────────────────────────
const TONES: Record<Kind, [number, number][]> = {
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
  reaction: '💬 Ziyaretçi mesaja tepki verdi',
  price_view: '👀 Yeni ziyaretçi fiyat gördü',
  hesitating: '⏳ Ziyaretçi kararsız',
};

export function useLiveAssistAdmin(token: string, sessionIds: string[]): LiveAssistState {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [adminEmailDefault, setAdminEmailDefault] = useState('');
  const [emailConfigured, setEmailConfigured] = useState(true);
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
        if (!j.sound[a.kind]) continue;
        if (ctx && ctx.state === 'running' && !played.has(a.kind)) {
          played.add(a.kind);
          playTone(ctx, a.kind);
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(ALERT_TITLE[a.kind], { body: a.detail || '', icon: '/favicon.ico', tag: `la-${a.id}` });
        }
      }
    } catch { /* nächster Versuch in 5 s */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { loadSettings(); loadPromos(); }, [loadSettings, loadPromos]);
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

  const send = useCallback(async (sessionId: string, template: string, body: string, promo: string): Promise<string | null> => {
    try {
      const r = await fetch(`${API_BASE}/admin/live-assist/messages`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, template, body, promo_code: promo || undefined }),
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

  return { settings, adminEmailDefault, emailConfigured, promos, overview, soundReady, unlockSound, testSound, save, send };
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
            Bugün: <b>{kpi.sent}</b> mesaj · <b>{kpi.seen}</b> görüldü · <b>{kpi.clicks}</b> tıklama ·{' '}
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

type TemplateId = 'price' | 'question' | 'whatsapp' | 'callback';
const TEMPLATE_LABEL: Record<TemplateId, string> = {
  price: 'Selam + fiyat',
  question: 'Sorunuz var mı?',
  whatsapp: "WhatsApp'a davet",
  callback: 'Geri arama teklifi',
};

function templateText(id: TemplateId, lang: 'de' | 'en' | 'tr', name: string, route: { pickup: string; dropoff: string } | null, price: number | null): string {
  const r = route ? `${route.pickup} → ${route.dropoff}` : '';
  const p = price ? fmtEur(price) : '';
  const T = {
    de: {
      price: route && p
        ? `Hallo 👋 Ich bin ${name} von Munich Airport Taxi. Ihre Fahrt ${r} kostet ${p} Festpreis – inkl. Gepäck und Maut, ohne versteckte Kosten. Haben Sie noch Fragen? Ich bin gerade online.`
        : `Hallo 👋 Ich bin ${name} von Munich Airport Taxi. Kann ich Ihnen bei Ihrer Buchung helfen? Ich bin gerade online.`,
      question: 'Hallo 👋 Haben Sie Fragen zu Ihrer Fahrt oder zum Preis? Schreiben Sie mir einfach – ich antworte sofort.',
      whatsapp: 'Hallo! Am schnellsten geht es per WhatsApp: Tippen Sie unten auf „Auf WhatsApp antworten“ – Ihre Strecke ist schon eingetragen.',
      callback: 'Hallo! Lieber telefonisch? Hinterlassen Sie unten Ihre Nummer – ich rufe Sie in wenigen Minuten zurück.',
    },
    en: {
      price: route && p
        ? `Hi 👋 I'm ${name} from Munich Airport Taxi. Your ride ${r} is a fixed price of ${p} – luggage and tolls included, no hidden costs. Any questions? I'm online right now.`
        : `Hi 👋 I'm ${name} from Munich Airport Taxi. Can I help you with your booking? I'm online right now.`,
      question: 'Hi 👋 Any questions about your ride or the price? Just message me – I reply right away.',
      whatsapp: 'Hi! The fastest way is WhatsApp: tap "Reply on WhatsApp" below – your route is already filled in.',
      callback: "Hi! Prefer to talk? Leave your number below – I'll call you back within a few minutes.",
    },
    tr: {
      price: route && p
        ? `Merhaba 👋 Ben Munich Airport Taxi'den ${name}. ${r} yolculuğunuz ${p} sabit fiyat – bagaj ve otoyol ücreti dahil, gizli maliyet yok. Sorunuz var mı? Şu an çevrimiçiyim.`
        : `Merhaba 👋 Ben Munich Airport Taxi'den ${name}. Rezervasyonunuzda yardımcı olabilir miyim? Şu an çevrimiçiyim.`,
      question: 'Merhaba 👋 Yolculuğunuz ya da fiyat hakkında sorunuz var mı? Yazmanız yeterli – hemen cevaplıyorum.',
      whatsapp: "Merhaba! En hızlısı WhatsApp: aşağıdaki \"WhatsApp'tan yanıtla\"ya dokunun – güzergâhınız zaten yazılı.",
      callback: 'Merhaba! Telefonla mı konuşmak istersiniz? Aşağıya numaranızı bırakın – birkaç dakika içinde sizi arıyorum.',
    },
  } as const;
  return T[lang][id];
}

function statusBadge(info: SessionInfo | undefined): { text: string; cls: string } | null {
  const m = info?.last;
  if (!m) return null;
  const auto = m.source === 'auto';
  const prefix = auto ? '🤖 ' : '';
  if (m.action === 'whatsapp') return { text: `${prefix}💬 WhatsApp'a tıkladı`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'callback') return { text: `${prefix}📞 geri arama istedi`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'book') return { text: `${prefix}🛒 rezervasyona geçti`, cls: 'bg-green-100 text-green-800 border-green-300' };
  if (m.action === 'dismiss') return { text: `${prefix}✕ balonu kapattı`, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  if (auto) return { text: '🤖 otomatik balon gösterildi', cls: 'bg-sky-50 text-sky-700 border-sky-200' };
  if (m.seen_at) return { text: '👁 mesajı gördü', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (m.delivered_at) return { text: '📬 iletildi', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return { text: '📨 gönderildi, bekleniyor', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
}

export function LiveAssistRow({ la, s }: { la: LiveAssistState; s: RowSession }) {
  const [open, setOpen] = useState(false);
  const [tpl, setTpl] = useState<TemplateId>('price');
  const [body, setBody] = useState('');
  const [promo, setPromo] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const enabled = la.settings?.enabled === '1';
  const info = la.overview?.sessions?.[s.session_id];
  const price = info?.price_shown?.price ?? null;
  const lang = visitorLocale(s);
  const route = routeFrom(s);
  const ref = s.session_id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const badge = statusBadge(info);
  const name = la.settings?.agent_name || 'Osman';

  const pick = (id: TemplateId) => {
    setTpl(id);
    setBody(templateText(id, lang, name, route, price));
    setErr('');
  };

  const openComposer = () => {
    setOpen(true);
    setPromo('');
    pick('price');
  };

  const submit = async () => {
    setSending(true);
    const e = await la.send(s.session_id, tpl, body.trim(), promo);
    setSending(false);
    if (e) { setErr(e); return; }
    setOpen(false);
  };

  const promoText = (p: Promo) => `${p.code} (${p.type === 'percent' ? `−${p.value} %` : `−${fmtEur(p.value)}`})`;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {enabled && s.is_bot === 0 && (
          <button
            type="button"
            onClick={() => (open ? setOpen(false) : openComposer())}
            className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg"
          >
            <MessageCircle size={12} /> Mesaj
          </button>
        )}
        <span className="text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded" title="Müşterinin WhatsApp mesajında (Ref: …) olarak görünür">
          Ref {ref}
        </span>
        {price != null && (
          <span className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full">
            💶 gördüğü fiyat {fmtEur(price)}{info?.price_shown?.vehicle ? ` · ${info.price_shown.vehicle}` : ''}
          </span>
        )}
        {badge && <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>}
        {info && info.messages > 1 && <span className="text-[11px] text-gray-400">{info.messages} mesaj</span>}
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">
              Ziyaretçinin dili: <b>{lang.toUpperCase()}</b> · balon ≤10 sn içinde açılır
            </span>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(Object.keys(TEMPLATE_LABEL) as TemplateId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className={`text-xs px-2.5 py-1 rounded-full border ${tpl === id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400'}`}
              >
                {TEMPLATE_LABEL[id]}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            maxLength={500}
            rows={3}
            onChange={(e) => { setBody(e.target.value); setErr(''); }}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <select value={promo} onChange={(e) => setPromo(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
              <option value="">🎁 Promo kodu yok</option>
              {la.promos.map((p) => <option key={p.code} value={p.code}>{promoText(p)}</option>)}
            </select>
            {la.promos.length === 0 && <span className="text-[11px] text-gray-400">(şu an geçerli promo kodu yok)</span>}
            <span className="text-[11px] text-gray-400 ml-auto">{body.length}/500</span>
            <button
              type="button"
              disabled={sending || !body.trim()}
              onClick={submit}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Gönder
            </button>
          </div>
          {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}
        </div>
      )}
    </div>
  );
}
