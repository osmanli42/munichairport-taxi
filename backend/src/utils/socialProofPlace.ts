// Social-Proof-Toast: aus einer Zieladresse nur den Ort machen — nie Straße/Hausnummer/Hotelname,
// denn Vorname + Initial + Hausadresse wären personenbezogen (DSGVO).
export function socialProofPlace(address: string | null | undefined): string {
  let a = String(address || '');
  try { a = decodeURIComponent(a); } catch { /* bereits dekodiert */ }
  if (/flughafen|airport|terminal|\bMUC\b/i.test(a) && /85356|flughafen m(ü|ue)nchen|munich airport/i.test(a)) {
    return 'Flughafen München';
  }
  const m = a.match(/\b\d{5}\s+([^,]+)/);
  if (!m) return '';
  let city = m[1].trim();
  if (/^M(ü|ue)nchen\b/i.test(city)) return 'München';
  if (city.length > 24 && city.includes('-')) city = city.split('-')[0].trim();
  return city.slice(0, 30);
}

// Social-Proof-Toast für Kalender-Fahrten: aus dem Fahrgast der Terminbeschreibung
// "Vorname N." machen — wie bei Web-Buchungen. Mehrere Fahrgäste → der erste;
// "MÜLLER, ANNA" (Nachname, Vorname) → "Anna M."; Anrede/Klammern weg. Sieht es nicht nach
// einer Person aus (Firma, Zahlen, E-Mail), kommt null zurück und der Eintrag wird nicht gezeigt.
const TITLES = /^(herr|frau|hr|fr|mr|mrs|ms|miss|dr|prof)\.?$/i;
const COMPANYISH = /\b(gmbh|ag|kg|ug|ltd|inc|llc|group|hotel|firma|company|gbr|e\.?v\.?|se)\b/i;
const titleCase = (w: string) => (w === w.toUpperCase() ? w.charAt(0) + w.slice(1).toLowerCase() : w);
export function socialProofGuestName(raw: string | null | undefined): string | null {
  let g = String(raw || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!g || /@|\d/.test(g) || COMPANYISH.test(g)) return null;
  const parts = g.split(/\s*[,;/&+]\s*|\s+und\s+/i).filter(Boolean);
  let words: string[];
  // "MÜLLER, ANNA" bzw. "Müller, Anna": genau zwei Teile mit je einem Wort → Nachname, Vorname
  if (parts.length >= 2 && !/\s/.test(parts[0]) && !/\s/.test(parts[1]) && parts[0] === parts[0].toUpperCase()) {
    words = [parts[1], parts[0]];
  } else {
    words = parts[0].split(' ');
  }
  const hadTitle = words.some((w) => TITLES.test(w));
  const gender = words.map((w) => w.replace(/\.$/, '').toLowerCase())
    .map((w) => (['herr', 'hr', 'mr'].includes(w) ? 'Herr' : ['frau', 'fr', 'mrs', 'ms', 'miss'].includes(w) ? 'Frau' : null))
    .find(Boolean) || null;
  words = words.filter((w) => !TITLES.test(w)).map((w) => w.replace(/[.]+$/, ''));
  if (!words.length) return null;
  // "Frau Gerold" / "Ms. Young": nur der Nachname bekannt → "Frau G." (Nachname nie ausschreiben)
  if (hadTitle && words.length === 1) {
    const w = titleCase(words[0]);
    return gender && /^\p{L}[\p{L}'-]{1,30}$/u.test(w) ? `${gender} ${w.charAt(0).toUpperCase()}.` : null;
  }
  const first = titleCase(words[0]);
  if (!/^\p{L}[\p{L}'-]{1,20}$/u.test(first)) return null;
  const last = words.length > 1 ? titleCase(words[words.length - 1]) : '';
  return last && /^\p{L}/u.test(last) ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

// Kalender-Termine aus Buchungsbestätigungen beginnen mit der Anrede: „Sehr geehrter Herr Helmut
// Ocker“, „Sehr geehrte Frau Gerold“, „Dear Ms. Young,“. Daraus den Namen (mit Anrede) holen —
// nur, wenn der Termin selbst keinen Fahrgast nennt. Sammelanreden („Damen und Herren“) zählen nicht.
const RE_SALUTATION = /^\s*(?:sehr\s+geehrte[rs]?|liebe[rs]?|hallo|guten\s+tag|dear|hello|hi)\s+(.+?)\s*[,!.:]?\s*$/i;
export function salutationGuest(description: string | null | undefined): string | null {
  const lines = String(description || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  for (const l of lines) {
    const m = l.match(RE_SALUTATION);
    if (!m) continue;
    const v = m[1].replace(/[,!.:]+$/, '').trim();
    if (!v || /damen|herren|kunde|kundin|team|sir|madam|all\b|zusammen/i.test(v)) return null;
    return v.slice(0, 120);
  }
  return null;
}
