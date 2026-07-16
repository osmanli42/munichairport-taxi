// ─── Google-Kalender-Import ──────────────────────────────────────────────────
// Telefon/E-Mail-Fahrten stehen im Google Kalender. Dieser Service liest sie
// (Google Calendar API per Service-Account oder ICS-Upload), parst Eventtexte
// zu Fahrt-Entwürfen und lässt den Admin sie nach Prüfung als bookings
// importieren (source='calendar'), damit die bestehende Sammelrechnung greift.

export interface RawEvent {
  uid: string;
  start: string | null; // 'YYYY-MM-DDTHH:mm' (Europe/Berlin)
  summary: string;
  description: string;
  location: string;
}

export interface CompanyRef {
  id: number;
  company_name: string;
}

export interface AliasRef {
  company_id: number;
  alias: string;
}

export interface DraftRide {
  uid: string;
  pickup_datetime: string | null;
  company_id: number | null;
  company_match: string | null; // welcher Text zur Firma geführt hat (Anzeige)
  pickup_address: string | null;
  dropoff_address: string | null;
  price: number | null;
  steuersatz: number | null;
  raw_summary: string;
  raw_description: string;
  parse_ok: boolean;
}

const BERLIN_TZ = 'Europe/Berlin';

// Date → 'YYYY-MM-DDTHH:mm' in Europe/Berlin (gleiches Format wie Buchungsformular)
function toBerlinLocal(date: Date): string {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BERLIN_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
  return s.replace(' ', 'T');
}

// ─── ICS-Parsing (RFC 5545) ──────────────────────────────────────────────────

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// DTSTART-Werte: '20260701T143000' (lokal/TZID), '20260701T123000Z' (UTC), '20260701' (ganztägig)
function parseIcsDate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return `${y}-${mo}-${d}T00:00`;
  if (z) {
    const utc = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    return toBerlinLocal(utc);
  }
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function parseIcsEvents(icsContent: string): RawEvent[] {
  // Zeilen entfalten (Fortsetzungszeilen beginnen mit Space/Tab)
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: RawEvent[] = [];
  let cur: Partial<RawEvent> | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      cur = { uid: '', start: null, summary: '', description: '', location: '' };
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (cur && cur.uid) events.push(cur as RawEvent);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const prop = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const value = line.slice(colonIdx + 1);

    switch (prop) {
      case 'UID': cur.uid = value.trim(); break;
      case 'DTSTART': cur.start = parseIcsDate(value.trim()); break;
      case 'SUMMARY': cur.summary = unescapeIcsText(value).trim(); break;
      case 'DESCRIPTION': cur.description = unescapeIcsText(value).trim(); break;
      case 'LOCATION': cur.location = unescapeIcsText(value).trim(); break;
    }
  }
  return events;
}

// ─── Google Calendar API (Service-Account) ──────────────────────────────────

export function hasServiceAccount(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

function getServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email/private_key');
  }
  return parsed;
}

export async function fetchCalendarEvents(calendarId: string, month: string): Promise<RawEvent[]> {
  const { google } = await import('googleapis');
  const sa = getServiceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  const calendar = google.calendar({ version: 'v3', auth });

  // Großzügiges Fenster (±1 Tag wegen Zeitzonen), danach exakt auf Berliner Monat filtern
  const [y, m] = month.split('-').map(Number);
  const timeMin = new Date(Date.UTC(y, m - 1, 1) - 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(Date.UTC(y, m, 1) + 24 * 3600 * 1000).toISOString();

  const events: RawEvent[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    });
    for (const ev of res.data.items || []) {
      let start: string | null = null;
      if (ev.start?.dateTime) start = toBerlinLocal(new Date(ev.start.dateTime));
      else if (ev.start?.date) start = `${ev.start.date}T00:00`;
      events.push({
        uid: ev.iCalUID || ev.id || '',
        start,
        summary: ev.summary || '',
        description: ev.description || '',
        location: ev.location || '',
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return events.filter((e) => e.uid && e.start && e.start.startsWith(month));
}

// ─── Eventtext → Fahrt-Entwurf ───────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

// Firmenname ohne Rechtsform ("Müller Logistik GmbH" → "müller logistik")
function stripLegalForm(name: string): string {
  return normalize(name)
    .replace(/\b(gmbh & co\.? kg|gmbh|ag|gbr|ug|ohg|se|e\.?\s?v\.?|e\.?\s?k(fr)?\.?|kg)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCompany(
  text: string,
  companies: CompanyRef[],
  aliases: AliasRef[]
): { company_id: number; matched: string; needle: string } | null {
  const haystack = normalize(text);

  // 1) Aliasse (längster zuerst, damit "BMW Werk 2" vor "BMW" gewinnt)
  const sortedAliases = [...aliases].sort((a, b) => b.alias.length - a.alias.length);
  for (const a of sortedAliases) {
    const needle = normalize(a.alias);
    if (needle && haystack.includes(needle)) {
      return { company_id: a.company_id, matched: a.alias, needle };
    }
  }

  // 2) Voller Firmenname, dann Name ohne Rechtsform
  const candidates = companies
    .flatMap((c) => [
      { company_id: c.id, needle: normalize(c.company_name), matched: c.company_name },
      { company_id: c.id, needle: stripLegalForm(c.company_name), matched: c.company_name },
    ])
    .filter((c) => c.needle.length >= 3)
    .sort((a, b) => b.needle.length - a.needle.length);
  for (const c of candidates) {
    if (haystack.includes(c.needle)) return { company_id: c.company_id, matched: c.matched, needle: c.needle };
  }
  return null;
}

function parsePrice(text: string): number | null {
  // "65€", "65,50 €", "EUR 65.50", "€ 65" — nur mit Währungskennzeichen, sonst zu riskant (Uhrzeiten!)
  const m =
    text.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euro\b)/i) ||
    text.match(/(?:€|eur|euro)\s*(\d{1,4}(?:[.,]\d{1,2})?)/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseRoute(text: string): { from: string | null; to: string | null } {
  // "von A nach B"
  let m = text.match(/\bvon\s+(.+?)\s+nach\s+(.+?)(?:[,;\n]|\s+um\s|\s*\d{1,3}[.,]?\d{0,2}\s*€|$)/i);
  if (m) return { from: m[1].trim(), to: m[2].trim() };

  // "A → B", "A -> B", "A => B"
  m = text.match(/([^\n,;→>]{3,}?)\s*(?:→|->|=>)\s*([^\n,;→>]{3,})/);
  if (m) return { from: cleanRoutePart(m[1]), to: cleanRoutePart(m[2]) };

  // "A - B" (nur mit Leerzeichen um den Bindestrich, sonst zerlegt es Straßennamen)
  m = text.match(/([^\n,;]{3,}?)\s+-\s+([^\n,;]{3,})/);
  if (m) return { from: cleanRoutePart(m[1]), to: cleanRoutePart(m[2]) };

  return { from: null, to: null };
}

function cleanRoutePart(s: string): string | null {
  // Preis/Uhrzeit-Reste am Rand abschneiden
  const cleaned = s.replace(/\d{1,2}:\d{2}\s*(uhr)?/gi, '').replace(/\d{1,4}[.,]?\d{0,2}\s*€.*/g, '').trim();
  return cleaned.length >= 3 ? cleaned : null;
}

export function parseEventToDraft(
  raw: RawEvent,
  companies: CompanyRef[],
  aliases: AliasRef[]
): DraftRide {
  const fullText = [raw.summary, raw.description, raw.location].filter(Boolean).join('\n');

  const company = matchCompany(fullText, companies, aliases);
  const price = parsePrice(fullText);
  // Route zuerst im Titel suchen (dort steht sie üblicherweise), dann in der Beschreibung
  let route = parseRoute(raw.summary);
  if (!route.from && !route.to && raw.description) route = parseRoute(raw.description);
  // LOCATION-Feld als Abholadresse, wenn Titel/Beschreibung nichts hergeben
  const pickup = route.from || (raw.location || null);

  return {
    uid: raw.uid,
    pickup_datetime: raw.start,
    company_id: company?.company_id ?? null,
    company_match: company?.matched ?? null,
    pickup_address: pickup,
    dropoff_address: route.to,
    price,
    steuersatz: null, // Default vergibt die Route (dominanter Satz der Firma, sonst 7)
    raw_summary: raw.summary,
    raw_description: raw.description,
    parse_ok: !!(raw.start && company && price),
  };
}
