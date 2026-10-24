// Marketing-Tab: kleine Helfer (Kontakte aus .ics/CSV, Textformat, Segmente).
import type { MkCustomer, MkLang, MkSegment } from '@/lib/api';

export const CONTACTS_KEY = 'marketing_ics_contacts'; // gleicher Schlüssel wie die alte Seite
export interface Contact { email: string; name?: string; source: 'ics' }

export const LANG_LABEL: Record<MkLang, string> = { de: 'Deutsch', en: 'English', tr: 'Türkçe' };
export const LANG_FLAG: Record<MkLang, string> = { de: '🇩🇪', en: '🇬🇧', tr: '🇹🇷' };

export type SegmentKey = MkSegment | 'recent' | 'lapsed' | 'none';
export const SEGMENTS: Array<{ key: SegmentKey; label: string; hint: string }> = [
  { key: 'all', label: 'Tüm web müşterileri', hint: 'Siteden rezervasyon yapmış herkes' },
  { key: 'privat', label: 'Özel müşteriler', hint: 'Firma/Rechnung olmayanlar' },
  { key: 'business', label: 'Firma / Rechnung', hint: 'Firma hesabı, Rechnung veya Überweisung' },
  { key: 'stamm', label: 'Stammkunde (2+)', hint: 'En az 2 rezervasyon' },
  { key: 'business_stamm', label: 'Firma + Stammkunde', hint: 'Kurumsal tebrikler için' },
  { key: 'recent', label: 'Son 12 ayda gelen', hint: 'Son yolculuğu 12 aydan yeni' },
  { key: 'lapsed', label: '12+ aydır gelmeyen', hint: 'Geri kazanım' },
  // Kein Web-Kunde automatisch — nur, wer unten einzeln angehakt ist (z. B. nur ausgewählte „Eski site“-Kontakte)
  { key: 'none', label: 'Sadece tek tek seçtiklerim', hint: 'Web müşterileri otomatik eklenmez — sadece aşağıda işaretlediklerin' },
];
export const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map(s => [s.key, s.label])) as Record<SegmentKey, string>;

export function inSegment(c: MkCustomer, seg: SegmentKey, yearAgo: string): boolean {
  switch (seg) {
    case 'privat': return !c.isBusiness;
    case 'business': return c.isBusiness;
    case 'stamm': return c.bookingCount >= 2;
    case 'business_stamm': return c.isBusiness || c.bookingCount >= 2;
    case 'recent': return !!c.lastBooking && c.lastBooking >= yearAgo;
    case 'lapsed': return !c.lastBooking || c.lastBooking < yearAgo;
    case 'none': return false;
    default: return true;
  }
}

export const pct = (p: number, lang: MkLang) => {
  const n = Number.isInteger(p) ? String(p) : String(p).replace('.', lang === 'en' ? '.' : ',');
  return lang === 'tr' ? `%${n}` : lang === 'en' ? `${n}%` : `${n} %`;
};
export const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
export const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
export const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c: any) => c?.email).map((c: any) => ({ email: String(c.email).toLowerCase(), name: c.name || '', source: 'ics' as const })) : [];
  } catch { return []; }
}
export function saveContacts(list: Contact[]): void {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

const OWN = new Set(['info@flughafen-muenchen.taxi', 'info@flughafen-muenchen-taxi.de', 'freisingtaxi@gmail.com']);

/** E-Mails aus einer Google-Kalender-Datei (.ics): Teilnehmer, Organisator, Beschreibung. */
export function parseIcs(text: string): Contact[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const re = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
  const map = new Map<string, Contact>();
  const add = (email: string, name?: string) => {
    const key = email.trim().toLowerCase();
    if (!key.includes('@') || key.includes('example.') || key.startsWith('noreply') || key.startsWith('no-reply') || OWN.has(key)) return;
    const ex = map.get(key);
    if (!ex || (!ex.name && name)) map.set(key, { email: key, name: name?.trim() || ex?.name || '', source: 'ics' });
  };
  let inEvent = false, desc = '';
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { inEvent = true; desc = ''; }
    else if (line.startsWith('END:VEVENT')) { (desc.match(re) || []).forEach(e => add(e)); inEvent = false; }
    else if (inEvent) {
      if (line.startsWith('ATTENDEE') || line.startsWith('ORGANIZER')) {
        const mail = line.match(/mailto:([^\r\n;>\s]+)/i);
        const cn = line.match(/CN=([^;:]+)/i);
        if (mail) add(mail[1], cn?.[1]);
      } else if (line.startsWith('DESCRIPTION')) {
        const i = line.indexOf(':');
        if (i > -1) desc = line.slice(i + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\;/g, ';');
      }
    }
  }
  return Array.from(map.values());
}

/** CSV/Textliste: jede Zeile mit einer E-Mail, optional „Name, E-Mail“. */
export function parseCsv(text: string): Contact[] {
  const out = new Map<string, Contact>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i);
    if (!m) continue;
    const email = m[0].toLowerCase();
    if (OWN.has(email)) continue;
    const name = line.replace(m[0], '').replace(/[;,"\t]+/g, ' ').trim();
    out.set(email, { email, name, source: 'ics' });
  }
  return Array.from(out.values());
}

/** UTF-8-Text, der als MacRoman eingefügt wurde (ü → √º), zurückverwandeln. */
export function fixMacRoman(text: string): string {
  try {
    const all = new Uint8Array(256); for (let i = 0; i < 256; i++) all[i] = i;
    const mac = new TextDecoder('macintosh').decode(all);
    const map = new Map<string, number>(); for (let i = 128; i < 256; i++) map.set(mac[i], i);
    const bytes: number[] = [];
    for (const ch of Array.from(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp < 128) bytes.push(cp);
      else if (map.has(ch)) bytes.push(map.get(ch)!);
      else new TextEncoder().encode(ch).forEach(b => bytes.push(b));
    }
    const fixed = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    const sus = /[√∂∫≈Ω∞±≤÷∑∏πƒ∆◊™®©≠µ˚¬]/g;
    return (fixed.match(sus) || []).length < (text.match(sus) || []).length && (fixed.match(/�/g) || []).length <= (text.match(/�/g) || []).length ? fixed : text;
  } catch { return text; }
}

// Freemail-Anbieter → Privatperson; alles andere (eigene Domain) gilt als Firma
const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'gmx.com', 'web.de', 't-online.de', 'yahoo.com', 'yahoo.de',
  'yahoo.co.uk', 'yahoo.fr', 'hotmail.com', 'hotmail.de', 'hotmail.co.uk', 'outlook.com', 'outlook.de', 'live.com', 'live.de', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aol.de', 'freenet.de', 'mail.de', 'posteo.de', 'arcor.de', 'online.de', 'email.de',
  'vodafone.de', 'kabelmail.de', 'yandex.com', 'yandex.ru', 'mail.ru', 'protonmail.com', 'proton.me', 'gmx.ch', 'bluewin.ch', 'a1.net',
  'aon.at', 'chello.at', 'magenta.de', 'unitybox.de', 'icloud.de', 'hotmail.fr', 'orange.fr', 'libero.it', 'mailbox.org', 't-mobile.de',
]);
export const emailDomain = (email: string) => email.split('@')[1]?.toLowerCase() || '';
export const isCompanyDomain = (email: string) => { const d = emailDomain(email); return !!d && !FREEMAIL.has(d); };
