// Abmeldelink in Marketing-Mails (UWG §7 Abs. 3: jede Werbe-Mail braucht eine einfache
// Widerspruchsmöglichkeit). Signiertes JWT mit der E-Mail-Adresse; läuft nicht ab.
import jwt from 'jsonwebtoken';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || 'https://flughafen-muenchen.taxi/api').replace(/\/$/, '');

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET must be set');
  return s;
}

export function unsubscribeUrl(email: string, campaignId: number | null, lang = 'de'): string {
  const token = jwt.sign({ type: 'mkt_unsub', e: email.trim().toLowerCase(), c: campaignId, l: lang }, secret());
  return `${API_PUBLIC_URL}/marketing/unsubscribe/${token}`;
}

export function verifyUnsubscribeToken(token: string): { email: string; campaignId: number | null; lang: string } | null {
  try {
    const d = jwt.verify(token, secret()) as any;
    if (d?.type !== 'mkt_unsub' || typeof d.e !== 'string') return null;
    return { email: d.e, campaignId: typeof d.c === 'number' ? d.c : null, lang: ['de', 'en', 'tr'].includes(d.l) ? d.l : 'de' };
  } catch {
    return null;
  }
}
