// ─── Kalender → Rechnung (Eingangskorb) ──────────────────────────────────────
// Der Betreiber markiert Rechnungsfahrten im Google Kalender über das Ort-Feld:
//   "Sprachcaffe Rechnung 121,90€ M.ALi"   → offen (Kürzel, Preis, Fahrer)
//   "Bohr.de Rechnung gön 116,60€ Zeki"    → Rechnung bereits gesendet ("gön" = gönderildi)
//   "Bus6 Akar Rechnung M.ALi"             → offen, Preis steht in der Beschreibung
//   "Bohr.de Rechnung iptaaaal"            → storniert ("iptal")
// Die Beschreibung enthält die Buchungsbestätigung (Abholort/Ziel/Fahrgast/Preis,
// oft auch "Rechnungsadresse:"). Dieser Service erkennt offene Rechnungsfahrten
// und füllt daraus einen Rechnungsentwurf vor — der Admin prüft nur noch.

export interface CalEvent {
  uid: string; // iCalUID || id — identisch zu bookings.calendar_event_uid (Duplikatschutz)
  htmlLink: string | null;
  start: string | null; // 'YYYY-MM-DDTHH:mm' (Europe/Berlin)
  summary: string;
  description: string;
  location: string;
}

export type EventState = 'open' | 'sent' | 'paid' | 'cancelled' | 'none';

export interface CompanyRef {
  id: number;
  company_name: string;
}

export interface AliasRef {
  company_id: number;
  alias: string;
}

export interface BillingInfo {
  name: string;
  address: string;
  email: string | null;
  ust_idnr: string | null;
  project: string | null;
}

export interface ParsedRide {
  uid: string;
  html_link: string | null;
  pickup_datetime: string | null;
  month: string | null;
  summary: string;
  location: string;
  description: string;
  tag: string | null; // Kürzel aus dem Ort-Feld, z.B. "Sprachcaffe", "Bohr.de"
  company_id: number | null;
  company_via: 'kuerzel' | 'alias' | 'name' | 'rechnungsadresse' | null;
  billing: BillingInfo | null;
  /** Sprache der Terminbeschreibung (unsere Bestätigung an den Kunden) → Sprache der Rechnung */
  lang: 'de' | 'en';
  email_candidates: string[];
  pickup_address: string | null;
  dropoff_address: string | null;
  guest_name: string | null;
  price: number | null;
  price_source: string | null;
  price_conflict: number | null; // abweichender Preis in der Beschreibung
  round_trip_hint: boolean; // "(H+R)" — Preis gilt evtl. für Hin- und Rückfahrt
  via: string[]; // Zwischenstopps in Fahrtreihenfolge (ohne Start und Ziel)
}

const BERLIN_TZ = 'Europe/Berlin';

function toBerlinLocal(date: Date): string {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BERLIN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
  return s.replace(' ', 'T');
}

// ─── Google Calendar: frei wählbarer Zeitraum in einem Durchgang ────────────

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
}

// Adresse, mit der der Kalender geteilt sein muss (für die Anleitung im Admin)
export function serviceAccountEmail(): string | null {
  try { return serviceAccount().client_email || null; } catch { return null; }
}

async function calendarApi(write = false) {
  const sa = serviceAccount();
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: [write ? 'https://www.googleapis.com/auth/calendar.events' : 'https://www.googleapis.com/auth/calendar.readonly'],
  });
  return google.calendar({ version: 'v3', auth });
}

// fromDate/toDate: 'YYYY-MM-DD' (Europe/Berlin, beide Tage einschließlich).
// accessRole = Recht des Service-Accounts auf den Kalender ("reader" | "writer" | "owner" …)
export async function fetchEventsRange(
  calendarId: string, fromDate: string, toDate: string
): Promise<{ events: CalEvent[]; accessRole: string | null }> {
  const calendar = await calendarApi();

  // ±1 Tag Puffer wegen Zeitzonen, danach exakt auf Berliner Tage filtern
  const day = 24 * 3600 * 1000;
  const timeMin = new Date(Date.parse(`${fromDate}T00:00:00Z`) - day).toISOString();
  const timeMax = new Date(Date.parse(`${toDate}T00:00:00Z`) + 2 * day).toISOString();

  const events: CalEvent[] = [];
  let accessRole: string | null = null;
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId, timeMin, timeMax,
      singleEvents: true, orderBy: 'startTime', maxResults: 2500, pageToken,
    });
    accessRole = accessRole ?? res.data.accessRole ?? null;
    for (const ev of res.data.items || []) {
      if (ev.status === 'cancelled') continue;
      let start: string | null = null;
      if (ev.start?.dateTime) start = toBerlinLocal(new Date(ev.start.dateTime));
      else if (ev.start?.date) start = `${ev.start.date}T00:00`;
      events.push({
        uid: ev.iCalUID || ev.id || '',
        htmlLink: ev.htmlLink || null,
        start,
        summary: ev.summary || '',
        description: ev.description || '',
        location: ev.location || '',
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return {
    events: events.filter((e) => e.uid && e.start && e.start >= `${fromDate}T00:00` && e.start <= `${toDate}T23:59`),
    accessRole,
  };
}

// ─── Status aus Ort/Titel ────────────────────────────────────────────────────

// "Rechnung" als eigenes Wort — "Abrechnung" (Fahrer-Abrechnung) zählt nicht
const RE_RECHNUNG = /(?<![\p{L}])rechnung/iu;
const RE_CANCELLED = /❌|ipta+l+|an+ul+iert|storn|cancel|abgesagt/iu;
const RE_PAID = /ödendi|ödedi|ödeme\s*yapt|bezahlt|[çc]ekildi|quittung/iu;
const RE_SENT = /(?<![\p{L}])g[öo]n(?![\p{L}]*[üu]l)|rechnung\s*\(?\s*e-?mail|e-?mail\s+ile/iu;
// "gönderilecek" / "gönderilmedi" / "gönderemedim" = noch NICHT gesendet
const RE_NOT_SENT = /g[öo]nder(ilecek|ilme|eme|meyi)/iu;

export function classifyEvent(ev: CalEvent): EventState {
  const markers = `${ev.summary}\n${ev.location}`;
  if (!RE_RECHNUNG.test(markers)) return 'none';
  if (RE_CANCELLED.test(markers)) return 'cancelled';
  if (RE_PAID.test(markers)) return 'paid';
  if (RE_SENT.test(markers) && !RE_NOT_SENT.test(markers)) return 'sent';
  return 'open';
}

// ─── "gön" nach der Rechnung zurück in den Kalender schreiben ────────────────
// Der Betreiber hat bisher nach dem Versand von Hand "gön" ins Ort-Feld geschrieben
// ("Bohr.de Rechnung gön 116,60€ Zeki"). Das übernimmt jetzt das System.

// Nur in Produktion: lokal läuft die Test-DB gegen den ECHTEN Kalender — ein "gön" aus
// einem Test würde die Fahrt im Live-Korb verschwinden lassen, ohne dass es dort eine
// Rechnung gibt. CALENDAR_WRITEBACK=1/0 übersteuert das bei Bedarf.
export function calendarWriteEnabled(): boolean {
  if (process.env.CALENDAR_WRITEBACK === '0') return false;
  return process.env.CALENDAR_WRITEBACK === '1' || process.env.NODE_ENV === 'production';
}

export function isMarkedSent(summary: string, location: string): boolean {
  const markers = `${summary}\n${location}`;
  return RE_SENT.test(markers) && !RE_NOT_SENT.test(markers);
}

// "Sprachcaffe Rechnung 121,90€ M.ALi" → "Sprachcaffe Rechnung gön 121,90€ M.ALi"
export function withSentMarker(text: string): string | null {
  const m = text.match(/(?<![\p{L}])rechnung(?![\p{L}])/iu);
  if (!m || m.index === undefined) return null;
  const end = m.index + m[0].length;
  return `${text.slice(0, end)} gön${text.slice(end)}`;
}

export class CalendarPermissionError extends Error {}

export type MarkResult = 'marked' | 'already' | 'not_found';

// calendarId: Kalender des Betreibers; uid = bookings.calendar_event_uid (iCalUID)
export async function markEventsInvoiced(calendarId: string, uids: string[]): Promise<Record<string, MarkResult>> {
  const out: Record<string, MarkResult> = {};
  if (!uids.length) return out;
  const api = await calendarApi(true);
  for (const uid of uids) {
    const res = await api.events.list({ calendarId, iCalUID: uid, maxResults: 5 });
    const ev = (res.data.items || []).find((e) => e.status !== 'cancelled');
    if (!ev?.id) { out[uid] = 'not_found'; continue; }
    const summary = ev.summary || '';
    const location = ev.location || '';
    if (isMarkedSent(summary, location)) { out[uid] = 'already'; continue; }
    const loc = withSentMarker(location);
    const sum = loc ? null : withSentMarker(summary);
    const requestBody = loc ? { location: loc } : sum ? { summary: sum } : { location: `${location} Rechnung gön`.trim() };
    try {
      // sendUpdates 'none': Gäste des Termins bekommen keine Änderungsmail
      await api.events.patch({ calendarId, eventId: ev.id, sendUpdates: 'none', requestBody });
    } catch (e: any) {
      if (e?.code === 403 || e?.response?.status === 403) throw new CalendarPermissionError('Keine Schreibrechte auf den Kalender');
      throw e;
    }
    out[uid] = 'marked';
  }
  return out;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const RE_AMOUNT = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,5}(?:[.,]\d{1,2})?)`;

export function parseAmount(s: string): number | null {
  let v = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Wortgrenzen-Suche (unicode-fähig): "SySt" soll nicht in "System" treffen
function containsWord(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (n.length < 2) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n)}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
}

function stripLegalForm(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|ag|gbr|ug|ohg|se|kg|inc|ltd|llc|e\.?\s?v\.?|e\.?\s?k\.?)\b\.?/g, '')
    .replace(/[,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanValue(s: string): string {
  return s
    .replace(/[\u202A-\u202E\u200B-\u200F\u2060]/g, '') // Richtungszeichen aus kopierten Telefonnummern
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–-]+|[\s,;:|–-]+$/g, '')
    .trim();
}

function looksLikeAddress(s: string): boolean {
  return /\b\d{4,5}\b/.test(s) || /(stra(ß|ss)e|str\.|weg\b|platz|allee|ring\b|gasse|bogen|damm)/i.test(s);
}

function isTime(s: string): boolean {
  return /^(ca\.?\s*)?\d{1,2}[:.]\d{2}(\s*uhr)?\b/i.test(s.trim());
}

// Flugnummer als Titel ("LH 1831", "UA 9135", "5Y8780 GAT", "VF 041") → Abholung am Flughafen
const RE_FLIGHT_TITLE = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}[A-Z]?\b/;

function lines(text: string): string[] {
  return text.replace(/\r/g, '').split('\n').map((l) => l.replace(/[\u202A-\u202E\u200B-\u200F]/g, ''));
}

// Beschreibung enthält oft den ganzen Mailverlauf. Fahrtdaten nur aus unserem eigenen
// Bestätigungstext davor lesen — zitierte Kundenmails nennen oft andere Ziele/Namen.
const RE_QUOTE_START = /^\s*(am\s.{3,120}schrieb.{0,120}:|on\s.{3,120}wrote:|-{3,}\s*(original|ursprüngliche).*|von:\s.*@.*|from:\s.*@.*)\s*$/im;

export function ownPart(desc: string): string {
  const m = desc.match(RE_QUOTE_START);
  return m && m.index !== undefined && m.index > 0 ? desc.slice(0, m.index) : desc;
}

// ─── Kürzel aus dem Ort-Feld ─────────────────────────────────────────────────

const NOISE_TOKEN = /^(bus\d*|taxi|kombi|van|sitz\S*|kk|ok|x|\d+x\S*|fs-nr|nr|\d+|gön\S*|gon\S*|rechnung\S*|kein|email|e-mail|ile)$/i;

export function extractTag(location: string): string | null {
  const cleaned = location
    .replace(/\([^)]*\)/g, ' ')
    .replace(new RegExp(`${RE_AMOUNT}\\s*€|€\\s*${RE_AMOUNT}`, 'g'), ' ')
    .replace(/[^\p{L}\p{N}.&\-\s]/gu, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const idx = tokens.findIndex((t) => /^rechnung/i.test(t));
  if (idx < 0) return null;
  const before = tokens[idx - 1];
  if (before && !NOISE_TOKEN.test(before)) return before;
  // Nach "Rechnung": erstes sinnvolles Wort, aber nicht das letzte (dort steht der Fahrer)
  for (let i = idx + 1; i < tokens.length - 1; i++) {
    if (!NOISE_TOKEN.test(tokens[i])) return tokens[i];
  }
  return null;
}

// ─── Preis ───────────────────────────────────────────────────────────────────

function priceFromLocation(location: string): number | null {
  const m = location.match(new RegExp(`${RE_AMOUNT}\\s*€|€\\s*${RE_AMOUNT}`));
  return m ? parseAmount(m[1] || m[2]) : null;
}

function priceFromDescription(desc: string): { value: number; label: string } | null {
  const patterns: [RegExp, string][] = [
    [new RegExp(`RechnungFahrt\\s*:?\\s*${RE_AMOUNT}`, 'i'), 'RechnungFahrt'],
    [new RegExp(`(Fahrpreis|Gesamtpreis|Festpreis|Preis|Price|Betrag)\\s*:?\\s*(?:€|EUR)?\\s*${RE_AMOUNT}`, 'i'), ''],
  ];
  for (const [re, label] of patterns) {
    const m = desc.match(re);
    if (!m) continue;
    const amount = m[m.length - 1];
    const value = parseAmount(amount);
    if (value) return { value, label: label || m[1] };
  }
  return null;
}

// ─── Adressen ────────────────────────────────────────────────────────────────

// Eindeutige Labels dürfen ohne Doppelpunkt stehen ("Abhol-OrtAirport Munich"), kurze
// Wörter wie "Von"/"Ziel" nur mit Doppelpunkt — sonst wird "Von-Puech-Straße 10" zum Label.
const PICKUP_LABEL = /^\s*(?:\d+\.\s*)?(?:(abholadresse|abholort|abhol-?ort|pickup location)\s*\.?\s*:?|(abholung|abfahrt|from|von)\s*\.?\s*:)\s*(.*)$/i;
const DROPOFF_LABEL = /^\s*(?:(\d+)\.\s*)?(?:(zieladresse|fahrtziel|drop-?off location)\s*\.?\s*:?|(ziel|to|nach)\s*\.?\s*:)\s*(.*)$/i;
const NUMBERED_ZIEL = /^\s*(\d+)\.\s*ziel\s*\.?\s*:?\s*(.*)$/i; // Akar: "1. Ziel AKAR GmbH …", "2. Ziel.: …"

const RE_AIRPORT = /flughafen\s+m(ü|ue|u)nchen|m(ü|ue|u)nchen[\s,–-]+flughafen|munich airport|airport munich|\bMUC\b|franz[- ]josef[- ]strau/i;

// Einheitliche, gut lesbare Adressen auf der Rechnung ("Strecke"-Spalte ist schmal)
export function normalizeAddress(s: string | null): string | null {
  if (!s) return s;
  let v = cleanValue(
    s
      .replace(/\s*\([^)]*\)/g, '') // "(Hinterhaus, Eingang am Stahltor)", "(Gastfamilie …, Tel: …)"
      .replace(/,\s*(deutschland|germany)\s*$/i, '')
      .replace(/,(?=\S)/g, ', ')
      .replace(/^(herr|frau|hr\.|fr\.|familie|gastfamilie)\s+[^,]+,\s*/i, '') // "Herr Pflügel, Kastenseestr. 5"
  );
  const airportByPlz = /\bterminal\s*[12]\b/i.test(v) && /(oberding|8535[46]|85445|m(ü|ue)nchen-flughafen)/i.test(v);
  if ((RE_AIRPORT.test(v) || airportByPlz) && !/hotel|hilton|marriott|courtyard|ibis|novotel/i.test(v)) {
    if (/\bGAT\b|allgemeine luftfahrt/i.test(v)) return 'Flughafen München, GAT';
    const t = v.match(/terminal\s*(\d)/i);
    return t ? `Flughafen München, Terminal ${t[1]}` : 'Flughafen München';
  }
  // Bohr-Format "München – Airport Marriott Hotel, Alois-…" → Stadt-Präfix weg, wenn die PLZ folgt
  const pref = v.match(/^[\p{L} .-]{3,30}\s+–\s+(.+)$/u);
  if (pref && /\b\d{5}\b/.test(pref[1])) v = pref[1];
  return v;
}

// Wert einer Label-Zeile; wenn er keine Adresse ist, die Folgezeile (z.B. Bohr-Format
// "Ziel: München – Hilton City" + "Rosenheimer Straße 15, 81667 München") anhängen
function valueWithContinuation(ls: string[], i: number, first: string): string {
  let v = cleanValue(first);
  const next = cleanValue(ls[i + 1] || '');
  if (next && !looksLikeAddress(v) && looksLikeAddress(next) && !/:/.test(next)) {
    v = v ? `${v}, ${next}` : next;
  }
  return v;
}

function extractPickup(desc: string): string | null {
  const ls = lines(desc);
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(PICKUP_LABEL);
    if (!m) continue;
    // "Abhol-OrtAirport Munich" (fehlender Doppelpunkt) → Rest der Zeile
    const value = m[3];
    if (!cleanValue(value) || isTime(value)) continue;
    // "Von:" in E-Mail-Zitaten ("Von: Flughafen München taxi <info@...>")
    if (/@/.test(value)) continue;
    return valueWithContinuation(ls, i, value);
  }
  return null;
}

function extractDropoff(desc: string): { dropoff: string | null; via: string[] } {
  const ls = lines(desc);
  const hits: { n: number | null; value: string }[] = [];
  for (let i = 0; i < ls.length; i++) {
    const numbered = ls[i].match(NUMBERED_ZIEL);
    const m = numbered ? null : ls[i].match(DROPOFF_LABEL);
    const value = numbered ? numbered[2] : m ? m[4] : null;
    if (value === null || !cleanValue(value) || /@/.test(value)) continue;
    const n = numbered ? Number(numbered[1]) : null;
    hits.push({ n, value: valueWithContinuation(ls, i, value) });
    if (n === null) break; // erstes unnummeriertes Ziel gewinnt (spätere stammen oft aus E-Mail-Zitaten)
  }
  if (hits.length === 0) return { dropoff: null, via: [] };
  // Akar-Format "1. Ziel …", "2. Ziel.: …": letztes Ziel = Ziel, davor = Zwischenstopps
  if (hits.length > 1 && hits[0].n !== null) {
    const last = hits[hits.length - 1];
    return { dropoff: last.value, via: hits.slice(0, -1).map((h) => h.value) };
  }
  return { dropoff: hits[0].value, via: [] };
}

function airportLabel(desc: string): string {
  const t = desc.match(/Terminal\s*(\d)/i);
  return t ? `Flughafen München, Terminal ${t[1]}` : 'Flughafen München';
}

// ─── Fahrgast ────────────────────────────────────────────────────────────────

function cleanGuest(s: string): string {
  let v = cleanValue(
    s
      .replace(/\((?:mobil|tel|handy|phone)[^)]*\)/gi, '') // (Mobil: +34689962795)
      .replace(/\(\s*\+?[\d\s/-]{5,}\)/g, '') // (+421 915078313)
      .replace(/\(\s*\d+\s*\)/g, '') // (453642)
      .replace(/\+?\d[\d\s/-]{7,}/g, '') // lose Telefonnummern
      .replace(/^(herr|herrn|frau|mr\.?|mrs\.?|ms\.?)\s+/i, '')
  );
  v = v
    .replace(/\(\s*\)/g, '')
    .replace(/,(?=\S)/g, ', ')
    // "Jimmy bassily" → "Jimmy Bassily" (Füllwörter wie "und", "de", "van" bleiben klein)
    .replace(/(?<![\p{L}])(\p{Ll})(\p{Ll}{3,})/gu, (w, a: string, b: string) => (/^(und|oder|van|von|der|den|del|della)$/i.test(a + b) ? w : a.toUpperCase() + b))
    .trim();
  // Crew-Funktion wie bei bisherigen Bohr-Rechnungen: "Hallam Lucas (FO)"
  return v.replace(/\s+\(?(FO|FA|CA|CPT|FE)\)?$/, ' ($1)');
}

const RE_COMPANYISH = /\b(inc|gmbh|mbh|ag|ltd|llc|corp|kg|se|institut|schule)\b/i;

function extractGuest(desc: string, avoid: string[]): string | null {
  const ls = lines(desc);
  const names: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(/^\s*(?:\d+\.\s*)?(fahrgast|fahrgäste|passagiere?|passengers?)(?![\p{L}])\s*:?\s*(.*)$/iu);
    if (!m) continue;
    // "Passagiere: 6 (Rahmi Mert, Özcan Cikmaz, …)" → Namen aus der Klammer
    const counted = m[2].match(/^\s*\d+\s*\((.+)\)\s*$/);
    if (counted) {
      names.push(...counted[1].split(/\s*,\s*/).map(cleanGuest));
    } else if (cleanValue(m[2]) && !/^\s*\d/.test(m[2])) { // "Passagiere: 6" ist keine Namensangabe
      names.push(cleanGuest(m[2]));
    } else {
      // Liste: "Fahrgäste:" + "- MCQUILLEN, APRIL (CA)"
      for (let j = i + 1; j < ls.length && /^\s*-\s+/.test(ls[j]); j++) names.push(cleanGuest(ls[j].replace(/^\s*-\s+/, '')));
    }
  }
  const seen = new Set<string>();
  const unique = names.filter((n) => n.length >= 3 && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
  if (unique.length) return unique.join(', ').slice(0, 190);

  const isAvoided = (v: string) => avoid.some((a) => a && v.toLowerCase().includes(a.toLowerCase()));

  // Namensschild / Abholschild / Kunde — nur wenn es nach einer Person aussieht
  for (const label of ['namensschild', 'kunde', 'abholschild', 'passenger', 'name']) {
    const m = desc.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
    if (!m) continue;
    const v = cleanGuest(m[1]);
    if (v.length >= 3 && !RE_COMPANYISH.test(v) && !isAvoided(v) && !/@/.test(v)) return v;
  }

  // Akar-Format: Name steht direkt vor "2 Passagier + 2 Koffer" bzw. "Taxameter"
  for (let i = 1; i < ls.length; i++) {
    if (!/^\s*(\d+\s*passagier|taxameter)/i.test(ls[i])) continue;
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      const cand = cleanGuest(ls[j]);
      if (!cand) continue;
      if (cand.length >= 3 && !looksLikeAddress(cand) && !RE_FLIGHT_TITLE.test(cand) && !/\d{2}\.\d{2}\.\d{4}/.test(cand) && !isAvoided(cand)) return cand;
      break;
    }
  }
  return null;
}

// ─── Rechnungsempfänger aus der Beschreibung ────────────────────────────────

const OWN_EMAIL = /flughafen-muenchen|freisingtaxi|taxifreising|munichairport|noreply|no-reply|get-e\.com/i;

function extractEmails(desc: string): string[] {
  const out: string[] = [];
  const explicit = desc.match(/rechnungs-?e-?mail\s*:?\s*([^\s<>,;]+@[^\s<>,;]+)/i);
  if (explicit) out.push(explicit[1]);
  const all = desc.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (const e of all) out.push(e);
  return [...new Set(out.map((e) => e.replace(/[.,;]+$/, '').toLowerCase()))].filter((e) => !OWN_EMAIL.test(e));
}

function extractBilling(desc: string): BillingInfo | null {
  const ls = lines(desc);
  const ust = desc.match(/(?:UID|USt\.?-?Id(?:Nr)?\.?|VAT)[\s.-]*(?:Nr\.?)?\s*:?\s*([A-Z]{2}[A-Z0-9]{8,12})/i)?.[1] || null;
  const emails = extractEmails(desc);

  // 1) Block: "Rechnungsadresse:" / "Rechnungsanschrift lautet:" + Folgezeilen
  for (let i = 0; i < ls.length; i++) {
    const m = ls[i].match(/rechnungs(?:adresse|anschrift)(?:\s+lautet)?\s*:?\s*(.*)$/i);
    if (!m) continue;
    const block: string[] = [];
    let project: string | null = null;
    let email: string | null = null;
    const inline = cleanValue(m[1]);
    if (inline) block.push(inline);
    for (let j = i + 1; j < ls.length && block.length < 5; j++) {
      const l = cleanValue(ls[j]);
      if (!l) { if (block.length) break; continue; }
      const pm = l.match(/^projekt\s*:?\s*(.+)$/i);
      if (pm) { project = pm[1].trim(); continue; }
      const em = l.match(/e-?mail\s*:?\s*(\S+@\S+)/i);
      if (em) { email = em[1].toLowerCase(); continue; }
      if (/^(fahrgast|kontakt|tel|mobil|uid|ust)/i.test(l)) break;
      block.push(l);
    }
    if (block.length) {
      return { name: block[0], address: block.slice(1).join(', '), email: email || emails[0] || null, ust_idnr: ust, project };
    }
  }

  // 2) Inline: "Rechnung an: Sprachcaffe, Karl-Theodor-Str. 93, 80796 München"
  const inline = desc.match(/rechnung\s+an:?\s+([^\n]+)/i);
  if (inline) {
    // "(Rechnung an Sprachcaffe, Karl-Theodor-Str. 93, 80796 München)" — Klammern weg
    const parts = cleanValue(inline[1].replace(/\([^)]*\)/g, '').replace(/[()]/g, '')).split(/\s*,\s*/).filter(Boolean);
    if (parts.length) {
      return { name: parts[0], address: parts.slice(1).join(', '), email: emails[0] || null, ust_idnr: ust, project: null };
    }
  }

  // 3) Weitere Formulierungen (oft englisch, aus der Kundenmail übernommen), z. B.
  //    "I would also need an invoice with the following data:" + Firma / Adresse / "Company number/ID: …"
  //    Nur wenn 1) und 2) nichts gefunden haben — bestehende Treffer ändern sich nicht.
  for (let i = 0; i < ls.length; i++) {
    const trig = RE_BILLING_TRIGGERS.map((re) => ls[i].match(re)).find(Boolean);
    if (!trig) continue;
    const block: string[] = [];
    let id: string | null = null;
    let email: string | null = null;
    const inline = cleanValue(trig[1] || '');
    if (inline) block.push(inline);
    for (let j = i + 1; j < ls.length && block.length < 5; j++) {
      const l = cleanValue(ls[j]);
      if (!l) { if (block.length || id) break; continue; }
      const im = l.match(RE_BILLING_ID);
      if (im) { id = cleanValue(im[1]); continue; }
      const em = l.match(/e-?mail\s*:?\s*(\S+@\S+)/i);
      if (em) { email = em[1].toLowerCase(); continue; }
      if (RE_BILLING_END.test(l)) break;
      block.push(l);
    }
    if (block.length) {
      return { name: block[0], address: block.slice(1).join(', '), email: email || emails[0] || null, ust_idnr: ust || id, project: null };
    }
  }
  return null;
}

// Einleitungen eines Rechnungsempfänger-Blocks (EN/DE/TR), Rest der Zeile = erste Blockzeile.
const RE_BILLING_TRIGGERS: RegExp[] = [
  /\b(?:invoice|receipt|bill)\b[^\n]{0,60}\b(?:following|below)\b[^:\n]{0,30}:?\s*(.*)$/i,
  /\b(?:billing|invoice|invoicing)\s+(?:address|details|data|information)\s*:?\s*(.*)$/i,
  /\b(?:issue|send|address)\s+(?:the\s+)?(?:invoice|receipt)\s+to\s*:?\s*(.*)$/i,
  /\binvoice\s+(?:to|for)\s*:\s*(.*)$/i,
  /\brechnung\b[^\n]{0,40}\b(?:folgende[nr]?|diese)\s+(?:daten|adresse|firma|anschrift)\s*:?\s*(.*)$/i,
  /\b(?:rechnungsdaten|rechnungsempfänger(?:in)?)\s*:?\s*(.*)$/i,
  /\bfatura\s+(?:bilgileri|adresi)\s*:?\s*(.*)$/i,
];
// Firmen-/Steuernummer-Zeile im Block → ust_idnr (nicht Teil der Adresse).
const RE_BILLING_ID = /^(?:company\s*(?:number|no\.?|id|reg(?:istration)?)[^:]{0,15}|tax\s*(?:id|number|no\.?|code)|vat(?:\s*(?:id|number|no\.?|reg\w*))?|uid|ust-?id\w*|steuer-?(?:nummer|nr\.?)|registration\s*(?:number|no\.?)|vergi\s*(?:no|numarası))\s*[:#.]?\s*(.+)$/i;
// Zeilen, an denen der Rechnungsblock sicher zu Ende ist.
const RE_BILLING_END = /^(?:the price|price|best regards|kind regards|regards|thank|many thanks|we look forward|mit freundlichen|viele grüße|vielen dank|der preis|preis|fahrgast|passenger|kontakt|contact|tel\b|telefon|phone|mobil|mobile|whatsapp|www\.|trip date|from\s*:|to\s*:|date\s*:|datum)/i;

// ─── Firmenzuordnung ─────────────────────────────────────────────────────────

export function matchCompany(
  ev: CalEvent,
  tag: string | null,
  billing: BillingInfo | null,
  companies: CompanyRef[],
  aliases: AliasRef[]
): { company_id: number; via: ParsedRide['company_via'] } | null {
  const active = new Set(companies.map((c) => c.id));
  const aliasList = aliases.filter((a) => active.has(a.company_id)).sort((a, b) => b.alias.length - a.alias.length);

  // 1) Kürzel aus dem Ort-Feld (stärkstes Signal — so markiert der Betreiber selbst)
  if (tag) {
    const t = tag.toLowerCase();
    const a = aliasList.find((x) => x.alias.toLowerCase() === t);
    if (a) return { company_id: a.company_id, via: 'kuerzel' };
    const c = companies.find((x) => stripLegalForm(x.company_name) === stripLegalForm(tag) || stripLegalForm(x.company_name).split(' ')[0] === t);
    if (c) return { company_id: c.id, via: 'kuerzel' };
  }

  // 2) Gespeicherte Aliasse / Firmennamen — erst Ort+Titel (Kurzform reicht), dann Beschreibung
  //    (dort nur Alias oder voller Firmenname: "Osman" in einer Signatur ist nicht "Osman GmbH")
  const markers = `${ev.location}\n${ev.summary}`;
  for (const [text, allowCore] of [[markers, true], [ev.description, false]] as [string, boolean][]) {
    for (const a of aliasList) if (containsWord(text, a.alias)) return { company_id: a.company_id, via: 'alias' };
    for (const c of companies) {
      const core = stripLegalForm(c.company_name);
      if (containsWord(text, c.company_name) || (allowCore && core.length >= 4 && containsWord(text, core))) return { company_id: c.id, via: 'name' };
    }
  }

  // 3) Rechnungsadresse nennt eine bekannte Firma
  if (billing) {
    const core = stripLegalForm(billing.name);
    const c = companies.find((x) => {
      const xc = stripLegalForm(x.company_name);
      return xc.length >= 4 && (xc === core || core.startsWith(xc) || xc.startsWith(core));
    });
    if (c) return { company_id: c.id, via: 'rechnungsadresse' };
  }
  return null;
}

// ─── Sprache der Beschreibung ────────────────────────────────────────────────
// Englische Bestätigungen ("Dear …, Thank you for your booking … Trip date … Price") → Rechnung auf Englisch.
// Deutsch ist Standard; nur bei klar englischem Text wird 'en' gewählt.
const EN_WORDS = /\b(the|and|your|you|thank|please|booking|trip|date|time|from|to|flight|number|luggage|price|dear|regards|would|need|invoice|with|following|pickup|passengers?)\b/gi;
const DE_WORDS = /\b(der|die|das|und|ihre?|sie|vielen|dank|buchung|fahrt|abholung|uhr|preis|sehr|geehrte[rn]?|freundlichen|grüßen|mit|für|gepäck|passagiere?|koffer|rechnung|flughafen|zum|vom)\b/gi;
export function detectLanguage(text: string): 'de' | 'en' {
  const t = String(text || '').slice(0, 3000);
  const en = (t.match(EN_WORDS) || []).length;
  const de = (t.match(DE_WORDS) || []).length;
  return en >= 8 && en > de * 2 ? 'en' : 'de';
}

// ─── Ereignis → Rechnungsentwurf ─────────────────────────────────────────────

export function parseInvoiceRide(ev: CalEvent, companies: CompanyRef[], aliases: AliasRef[]): ParsedRide {
  const full = ev.description || '';
  const desc = ownPart(full);
  const tag = extractTag(ev.location);
  const billing = extractBilling(full);
  const company = matchCompany(ev, tag, billing, companies, aliases);

  // Preis: Ort-Feld (vom Betreiber gesetzt) vor Beschreibung
  const locPrice = priceFromLocation(ev.location);
  const descPrice = priceFromDescription(desc);
  const price = locPrice ?? descPrice?.value ?? null;
  const priceSource = locPrice ? 'Ort' : descPrice ? descPrice.label : null;
  const priceConflict = locPrice && descPrice && Math.abs(descPrice.value - locPrice) > 0.009 ? descPrice.value : null;

  // Abholort: Beschreibung → Titel (wenn Adresse) → Flughafen (wenn Titel = Flugnummer)
  const summary = cleanValue(ev.summary.replace(/zwischenstopp:.*$/i, ''));
  let pickup = extractPickup(desc);
  if (!pickup && looksLikeAddress(summary) && !RE_FLIGHT_TITLE.test(summary)) pickup = summary;
  if (!pickup && RE_FLIGHT_TITLE.test(summary)) pickup = airportLabel(desc);
  if (!pickup) {
    const adr = desc.match(/^\s*adresse\s*:\s*(.+)$/im);
    if (adr) pickup = cleanValue(adr[1]);
  }

  let { dropoff, via } = extractDropoff(desc);
  if (!dropoff && /abflug|departure|zum flughafen|ankunft flughafen/i.test(desc)) dropoff = airportLabel(desc);
  // Mehrere Abholadressen ("1. Abholung … Adresse: …", "2. Abholung … Adresse: …") → weitere Abholungen als Zwischenstopps
  if (!via.length) {
    const addrs = [...desc.matchAll(/^\s*adresse\s*:\s*(.+)$/gim)].map((m) => cleanValue(m[1]));
    if (addrs.length > 1) via = addrs.slice(1);
  }
  const zs = ev.summary.match(/zwischenstopp:\s*(.+)$/i);
  if (!via.length && zs) via = [cleanValue(zs[1])];

  const avoid = [tag || '', billing?.name || ''];
  const guest = extractGuest(desc, avoid);

  const roundTrip = /\(\s*h\s*\+\s*r\s*\)|hin-?\s*(?:und|\+|&)\s*r[üu]ck/i.test(desc);

  const emailCandidates = [...new Set([...(billing?.email ? [billing.email] : []), ...extractEmails(full)])];

  return {
    uid: ev.uid,
    html_link: ev.htmlLink,
    pickup_datetime: ev.start,
    month: ev.start ? ev.start.slice(0, 7) : null,
    summary: ev.summary,
    location: ev.location,
    description: full,
    tag,
    company_id: company?.company_id ?? null,
    company_via: company?.via ?? null,
    billing,
    lang: detectLanguage(desc || full),
    email_candidates: emailCandidates,
    pickup_address: normalizeAddress(pickup),
    dropoff_address: normalizeAddress(dropoff),
    guest_name: guest,
    price,
    price_source: priceSource,
    price_conflict: priceConflict,
    round_trip_hint: roundTrip,
    via: via.map((v) => normalizeAddress(v)).filter((v): v is string => !!v),
  };
}

// ─── MwSt nach Entfernung (§12 Abs. 2 Nr. 10 UStG: bis 50 km → 7 %) ─────────

const distanceCache = new Map<string, number | null>();

export async function drivingDistanceKm(from: string, to: string): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !from || !to) return null;
  const cacheKey = `${from.toLowerCase()}|${to.toLowerCase()}`;
  if (distanceCache.has(cacheKey)) return distanceCache.get(cacheKey)!;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', from);
    url.searchParams.set('destinations', to);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('region', 'de');
    url.searchParams.set('key', key);
    const res = await fetch(url.toString());
    const data = (await res.json()) as { status: string; rows?: { elements: { status: string; distance?: { value: number } }[] }[] };
    const el = data.rows?.[0]?.elements?.[0];
    const km = data.status === 'OK' && el?.status === 'OK' && el.distance ? Math.round(el.distance.value / 100) / 10 : null;
    distanceCache.set(cacheKey, km);
    return km;
  } catch {
    return null; // nicht cachen — Netzwerkfehler sollen beim nächsten Laden neu versucht werden
  }
}

export function steuersatzForDistance(km: number): 7 | 19 {
  return km > 50 ? 19 : 7;
}
