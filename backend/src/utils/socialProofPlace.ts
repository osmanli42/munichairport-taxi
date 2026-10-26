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
  words = words.filter((w) => !TITLES.test(w)).map((w) => w.replace(/[.]+$/, ''));
  // "Hr. Müller": nach der Anrede steht nur der Nachname — den nicht ausschreiben
  if (!words.length || (hadTitle && words.length === 1)) return null;
  const first = titleCase(words[0]);
  if (!/^\p{L}[\p{L}'-]{1,20}$/u.test(first)) return null;
  const last = words.length > 1 ? titleCase(words[words.length - 1]) : '';
  return last && /^\p{L}/u.test(last) ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}
