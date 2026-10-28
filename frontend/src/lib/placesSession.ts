// Google Places Session Token: eine Sitzung = alle Autocomplete-Anfragen einer Eingabe + das abschliessende
// Place Details. Google rechnet sie zusammen ab (statt jeden Tastendruck einzeln).
export function newPlacesSessionToken(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fallback */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
