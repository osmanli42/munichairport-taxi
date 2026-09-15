// Gemeinsame Anzeige-Helfer für automatische Rabatte (Fahrzeugkarten, Buchung, Banner, Admin).

export type DiscountLocale = 'de' | 'en' | 'tr';

export interface PublicAutoDiscount {
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  amount: number;
  labels?: { de: string; en: string; tr: string };
  ends_at?: string | null;
  remaining?: number | null;
  badge?: 'red' | 'classic';
}

// "Nur noch 2 Rabattplätze" — nur wenn ein Kontingent existiert und noch Plätze frei sind.
export function formatRemainingSpots(n: number | null | undefined, locale: string): string | null {
  if (n == null || n <= 0) return null;
  const l = asLocale(locale);
  if (l === 'en') return n === 1 ? 'Only 1 discount spot left' : `Only ${n} discount spots left`;
  if (l === 'tr') return `Son ${n} indirim hakkı`;
  return n === 1 ? 'Nur noch 1 Rabattplatz' : `Nur noch ${n} Rabattplätze`;
}

const asLocale = (l: string): DiscountLocale => (l === 'en' || l === 'tr' ? l : 'de');

const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

// Regelwert: DE "−5 %", EN "−5%", TR "%5"; fester Betrag "−3 €".
export function formatDiscountValue(type: 'percent' | 'fixed', value: number, locale: string): string {
  const l = asLocale(locale);
  if (type === 'fixed') return `−${trimNum(value).replace('.', l === 'en' ? '.' : ',')} €`;
  if (l === 'tr') return `%${trimNum(value).replace('.', ',')}`;
  if (l === 'en') return `−${trimNum(value)}%`;
  return `−${trimNum(value).replace('.', ',')} %`;
}

export function pickDiscountLabel(d: Pick<PublicAutoDiscount, 'name' | 'labels'>, locale: string): string {
  return d.labels?.[asLocale(locale)] || d.name;
}

// Minute des Tages ↔ "HH:MM" für <input type="time">
export function minutesToHHMM(m: number | null | undefined): string {
  if (m == null) return '';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function hhmmToMinutes(v: string): number | null {
  const match = v.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
