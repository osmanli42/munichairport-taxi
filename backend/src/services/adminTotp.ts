// Admin 2FA (TOTP, RFC 6238): 6 digits, 30 s steps, SHA-1 — what Google Authenticator,
// Authy, 1Password etc. expect. Implemented on node:crypto so no OTP dependency is needed.
//
// The shared secret is stored encrypted (AES-256-GCM). The key is derived from JWT_SECRET
// with HKDF, so a database dump alone doesn't reveal the secrets; there is deliberately no
// fallback key in the code.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = 'Flughafen-München.TAXI Admin';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set for 2FA');
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'admin-totp', 'totp-secret-v1', 32));
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = stored.split(':');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('bad secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, '0');
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** Code for a given step — used by tests/tools, never sent to a client. */
export function codeForStep(secret: string, step: number): string {
  return hotp(secret, step);
}

/**
 * Checks a code against the current step ±1 (clock drift). Returns the matched step, or
 * null. Steps at or before `lastStep` are refused so an observed code can't be replayed.
 */
export function verifyCode(secret: string, code: string, lastStep: number | null): number | null {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const now = currentStep();
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = hotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, username: string): string {
  const label = encodeURIComponent(`${ISSUER}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
}

// ── Recovery codes: 10 one-time codes like "7KQ4-M2XP", stored as bcrypt hashes ──

const RC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const bytes = crypto.randomBytes(8);
    const s = Array.from(bytes, (b) => RC_ALPHABET[b % RC_ALPHABET.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

function normalizeRecovery(code: string): string {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function hashRecoveryCodes(codes: string[]): Promise<string> {
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(normalizeRecovery(c), 10)));
  return JSON.stringify(hashes);
}

/** Returns the remaining hashes (JSON) when the code matched one, otherwise null. */
export async function consumeRecoveryCode(stored: string | null, code: string): Promise<string | null> {
  const norm = normalizeRecovery(code);
  if (!stored || norm.length !== 8) return null;
  let hashes: string[] = [];
  try { hashes = JSON.parse(stored); } catch { return null; }
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(norm, hashes[i])) {
      hashes.splice(i, 1);
      return JSON.stringify(hashes);
    }
  }
  return null;
}

export function recoveryCodesLeft(stored: string | null): number {
  if (!stored) return 0;
  try { return (JSON.parse(stored) as string[]).length; } catch { return 0; }
}
