import crypto from 'crypto';

// JWT_SECRET is required by middleware/auth.ts at startup anyway; there is deliberately no
// literal fallback here (the repo is public — a known secret would make every tracking
// link forgeable).
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

function hmac(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export type TrackingRole = 'cust' | 'drv';

// Per-booking links: the customer tracking page and the single-ride driver page. They are
// deterministic so an already-sent link keeps working; *when* they work is decided by the
// time window in services/driverTracking.ts, not by the token.
export function signToken(bookingNumber: string, role: TrackingRole): string {
  return hmac(`${role}:${bookingNumber}`);
}

export function verifyToken(bookingNumber: string, role: TrackingRole, token: string | undefined): boolean {
  if (!token) return false;
  return safeEqual(token, signToken(bookingNumber, role));
}

// Personal driver-app link: "<driverId>.<version>.<mac>". Bumping drivers.app_token_version
// revokes every link handed out before (lost phone, driver left).
export function signDriverAppToken(driverId: number, version: number): string {
  return `${driverId}.${version}.${hmac(`drv-app:${driverId}:${version}`)}`;
}

export function parseDriverAppToken(token: string | undefined): { driverId: number; version: number } | null {
  if (!token) return null;
  const m = /^(\d{1,9})\.(\d{1,9})\.([0-9a-f]{32})$/.exec(token);
  if (!m) return null;
  const driverId = Number(m[1]);
  const version = Number(m[2]);
  if (!safeEqual(m[3], hmac(`drv-app:${driverId}:${version}`))) return null;
  return { driverId, version };
}

// Device identifier for the Traccar Client app. The OsmAnd protocol has no auth, so the
// id itself is the secret: long and random, stored per driver, regenerated on demand.
export function newTraccarDeviceId(): string {
  return `fmt${crypto.randomBytes(12).toString('hex')}`;
}
