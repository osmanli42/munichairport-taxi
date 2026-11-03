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
  /** Höchstbetrag der Regel (€) — ohne Kappung zeigt die Karte mehr Rabatt als gebucht wird */
  max_amount?: number | null;
  /** Smart Rabatt: Hinweis „automatisiert personalisierter Preis“ zeigen (EGBGB Art. 246a) */
  personalized?: boolean;
}

// Pflichtangabe bei automatisiert personalisierten Preisen
export function personalizedPriceNotice(locale: string): string {
  const l = asLocale(locale);
  if (l === 'en') return 'Personalised price based on automated decision-making';
  if (l === 'tr') return 'Otomatik karar ile kişiselleştirilmiş fiyat';
  return 'Preis auf Grundlage automatisierter Entscheidungsfindung personalisiert';
}

// Smart Rabatt: Karar-Zeile für Live und Replay (Admin, Türkisch)
export interface SmartDecision { percent: number; holdout: boolean; blocked: string | null; signals: string[]; score: number | null }

export const SMART_SIGNAL_LABELS: Record<string, string> = {
  quiet_day: 'sakin gün', gap: 'boş saat', draft: 'yarım form', back_from_form: 'formdan döndü', exit: 'çıkış hareketi',
  returning: 'tekrar geldi', search_changes: 'tarih/saat değiştirdi', dwell: '45+ sn bekledi', tab_away: 'sekmeden döndü',
};

export function smartLine(d: SmartDecision): string {
  const why = d.signals.map(k => SMART_SIGNAL_LABELS[k] || k).join(', ');
  if (d.blocked === 'capacity') return 'Smart: indirim yok — araçlar dolu';
  if (d.holdout) return 'Smart: kontrol grubu — indirim gösterilmez';
  if (d.percent > 0) return `Smart: %${d.percent}${why ? ` — ${why}` : ''}`;
  return `Smart: indirim yok${why ? ` — sinyal yetmedi (${why})` : ' — sinyal yok'}`;
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
