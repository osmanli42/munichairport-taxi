import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'changeme-very-secret-key';

export type TrackingRole = 'cust' | 'drv';

export function signToken(bookingNumber: string, role: TrackingRole): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${role}:${bookingNumber}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyToken(bookingNumber: string, role: TrackingRole, token: string | undefined): boolean {
  if (!token) return false;
  const expected = signToken(bookingNumber, role);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
