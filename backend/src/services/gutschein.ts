// Persönliche Gutschein-Codes (promotions.personal = 1): Code-Erzeugung und Link — gemeinsam
// für Rabatte → „Kişisel indirim“ (routes/promotions.ts) und Marketing-Kampagnen.

import crypto from 'crypto';

const SITE = 'https://flughafen-muenchen.taxi';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I

/** Link, über den der Kunde den Gutschein bekommt (die Website merkt sich den Code). */
export const gutscheinUrl = (code: string, lang: string) =>
  `${SITE}${lang === 'de' || !['en', 'tr'].includes(lang) ? '' : `/${lang}`}/?gutschein=${encodeURIComponent(code)}`;

export const newGutscheinCode = () =>
  'GS-' + Array.from({ length: 8 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');

export const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
