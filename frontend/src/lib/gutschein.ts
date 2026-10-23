// Persönlicher Gutschein-Link (?gutschein=GS-…, per E-Mail aus dem Admin verschickt).
// Der Code wird in localStorage gemerkt, damit er auch gilt, wenn der Kunde Tage später in einem
// neuen Tab zurückkommt; /buchen löst ihn automatisch ein (wie den Live-Chat-Code).

export const GUTSCHEIN_KEY = 'mt_gutschein';
export const GUTSCHEIN_EVENT = 'mt-gutschein';

export interface StoredGutschein {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  end_date: string; // YYYY-MM-DD, letzter gültiger Tag
}

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function readGutschein(): StoredGutschein | null {
  try {
    const raw = localStorage.getItem(GUTSCHEIN_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as StoredGutschein;
    if (!g?.code || !g.end_date || g.end_date < todayLocal()) {
      localStorage.removeItem(GUTSCHEIN_KEY);
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

export function saveGutschein(g: StoredGutschein): void {
  try { localStorage.setItem(GUTSCHEIN_KEY, JSON.stringify(g)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(GUTSCHEIN_EVENT)); } catch { /* ignore */ }
}

export function clearGutschein(code?: string): void {
  try {
    const cur = readGutschein();
    if (code && cur && cur.code.toUpperCase() !== code.toUpperCase()) return;
    localStorage.removeItem(GUTSCHEIN_KEY);
  } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(GUTSCHEIN_EVENT)); } catch { /* ignore */ }
}
