// Password policy for admin accounts.
// bcrypt silently truncates at 72 bytes, so MAX_LENGTH keeps every character
// the user types actually part of the secret.
export const MIN_LENGTH = 12;
export const MAX_LENGTH = 64;

// Substrings that make a password guessable for *this* deployment.
const CONTEXT_WORDS = [
  'munich', 'münchen', 'muenchen', 'taxi', 'flughafen', 'airport',
  'freising', 'admin', 'passwort', 'password', 'qwertz', 'qwerty',
  'letmein', '123456', 'willkommen', 'welcome',
];

export interface PolicyResult {
  ok: boolean;
  /** German, user-facing. */
  error?: string;
  /** 0-4, for the strength meter. */
  score: number;
}

function classes(pw: string): number {
  return [/[a-zß-ÿ]/.test(pw), /[A-ZÀ-Þ]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)]
    .filter(Boolean).length;
}

/** Rough strength score, only used to drive the UI meter. */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= MIN_LENGTH) s++;
  if (pw.length >= 16) s++;
  if (classes(pw) >= 3) s++;
  if (classes(pw) === 4 && pw.length >= 14) s++;
  const lower = pw.toLowerCase();
  if (CONTEXT_WORDS.some(w => lower.includes(w))) s = Math.min(s, 1);
  if (/^(.)\1+$/.test(pw)) s = 0;
  return Math.min(s, 4);
}

export function validatePassword(pw: string, username?: string): PolicyResult {
  const score = scorePassword(pw);
  if (typeof pw !== 'string' || pw.length < MIN_LENGTH) {
    return { ok: false, score, error: `Das Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.` };
  }
  if (Buffer.byteLength(pw, 'utf8') > MAX_LENGTH) {
    return { ok: false, score, error: `Das Passwort darf höchstens ${MAX_LENGTH} Zeichen lang sein.` };
  }
  if (classes(pw) < 3) {
    return {
      ok: false, score,
      error: 'Bitte mindestens drei von vier Zeichenarten verwenden: Kleinbuchstaben, Großbuchstaben, Ziffern, Sonderzeichen.',
    };
  }
  const lower = pw.toLowerCase();
  if (username && username.length >= 3 && lower.includes(username.toLowerCase())) {
    return { ok: false, score, error: 'Das Passwort darf den Benutzernamen nicht enthalten.' };
  }
  const hit = CONTEXT_WORDS.find(w => lower.includes(w));
  if (hit) {
    return { ok: false, score, error: `Das Passwort darf kein leicht zu erratendes Wort enthalten („${hit}“).` };
  }
  if (/^(.)\1+$/.test(pw)) {
    return { ok: false, score, error: 'Das Passwort darf nicht aus einem einzigen wiederholten Zeichen bestehen.' };
  }
  return { ok: true, score };
}
