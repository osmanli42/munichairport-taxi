// Signed link for the "endgültig bestätigen" button in the admin's new-booking mail. The
// link works without login (from the phone's mail app), so it is a JWT bound to one
// booking number; it only opens a page — confirming needs a second click there.
import jwt from 'jsonwebtoken';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL || 'https://flughafen-muenchen.taxi/api').replace(/\/$/, '');

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET must be set');
  return s;
}

export function bookingConfirmUrl(bookingNumber: string): string {
  const token = jwt.sign({ type: 'booking_confirm', bn: bookingNumber }, secret(), { expiresIn: '90d' });
  return `${API_PUBLIC_URL}/booking-confirm/${token}`;
}

export function verifyBookingConfirmToken(token: string): string | null {
  try {
    const d = jwt.verify(token, secret()) as any;
    return d?.type === 'booking_confirm' && typeof d.bn === 'string' ? d.bn : null;
  } catch {
    return null;
  }
}

// 1×1 open pixel in a customer mail (routes/mail-open.ts): "received" = Buchung eingegangen,
// "cancel" = Stornierung by the admin
export type MailOpenKind = 'received' | 'cancel';

export function mailOpenPixelUrl(bookingNumber: string, kind: MailOpenKind = 'received'): string {
  const token = jwt.sign({ type: 'mail_open', bn: bookingNumber, k: kind }, secret(), { expiresIn: '180d' });
  return `${API_PUBLIC_URL}/mail-open/${token}.gif`;
}

export function verifyMailOpenToken(token: string): { bn: string; kind: MailOpenKind } | null {
  try {
    const d = jwt.verify(token, secret()) as any;
    if (d?.type !== 'mail_open' || typeof d.bn !== 'string') return null;
    return { bn: d.bn, kind: d.k === 'cancel' ? 'cancel' : 'received' };
  } catch {
    return null;
  }
}
