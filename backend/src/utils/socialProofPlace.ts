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
