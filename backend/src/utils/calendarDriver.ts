// Fahrer aus dem „Ort“-Feld eines Kalendertermins: der Disponent schreibt ihn ans Ende,
// z. B. „✅ Kk ödendi Abdülkadir“, „✅ 2xBus16 M.ALi & Saban“ („Taxi gitti“ = Fremdtaxi).
// Genutzt vom Fahrerplan-Widget und von der Statistik „Uns bleibt“.

const DRIVER_NOISE = /^(kk|ödendi|odendi|ödedi|bende|bargeld|bar|taxi|bus\S*|\d*x\S*|sitz\S*|maxi\S*|get-?e|rechnung\S*|g[öo]n\S*|kombi|van|fs-nr|nr|stamm|kein|e-?mail|ile|ok|iptal\S*|yok|var|\d+\S*)$/i;

export function driverTokens(location: string): string[] {
  // "Taxi Gitti" = handed over to another taxi.
  if (/taxi\s+gitti/i.test(location)) return ['Fremdtaxi'];
  const tokens = location
    .replace(/[☀-➿️\u{1F000}-\u{1FAFF}]/gu, ' ')
    .replace(/\*+[^*]*\*+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && out.length < 3; i--) {
    const t = tokens[i].replace(/[,;:]+$/, '');
    if (t === '&' || /^und$/i.test(t) || t === '+') continue;
    if (!out.length && /^\p{L}\.$/u.test(t)) continue; // "Gökhan C." → Gökhan
    if (DRIVER_NOISE.test(t) || !/\p{L}/u.test(t) || t.length < 3) break;
    out.unshift(t);
    // Only keep going across an explicit "A & B".
    const prev = tokens[i - 1];
    if (!(prev === '&' || prev === '+' || /^und$/i.test(prev || ''))) break;
    i--;
  }
  return out;
}
