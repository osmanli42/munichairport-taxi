import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable must be set');
  return secret;
})();

export interface AuthRequest extends Request {
  adminId?: number;
  adminUsername?: string;
}

// Cache of the per-admin token_version so we don't hit the DB on every admin
// request. Short TTL plus an explicit bust on password change, so a revoked
// session can survive at most CACHE_TTL_MS.
const CACHE_TTL_MS = 15_000;
const tokenVersionCache = new Map<number, { tv: number; exp: number }>();

export function bustTokenVersionCache(adminId: number): void {
  tokenVersionCache.delete(adminId);
}

async function currentTokenVersion(adminId: number): Promise<number | null> {
  const hit = tokenVersionCache.get(adminId);
  if (hit && Date.now() < hit.exp) return hit.tv;
  const [row] = await query<{ token_version: number }>(
    'SELECT token_version FROM admin_users WHERE id = ?',
    [adminId]
  );
  if (!row) return null;
  const tv = Number(row.token_version) || 0;
  tokenVersionCache.set(adminId, { tv, exp: Date.now() + CACHE_TTL_MS });
  return tv;
}

// Only these download-link routes may pass the token in the query string
// (browser `<a href target="_blank">` navigation can't set an Authorization
// header). Every other admin route requires the Bearer header.
const QUERY_TOKEN_ALLOWED = [
  /^\/api\/admin\/companies\/invoices\/\d+\/pdf(\?|$)/,
  /^\/api\/admin\/report\/finanzamt(\?|$)/,
  /^\/api\/admin\/bookings\/\d+\/rechnung\.pdf(\?|$)/,
  /^\/api\/admin\/bookings\/\d+\/proforma\.pdf(\?|$)/,
];

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function checkAdminLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_LOGIN_ATTEMPTS;
}

export function resetAdminLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Password changes get their own, tighter budget: an attacker with a stolen
// token should not be able to brute-force the current password.
const pwChangeAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_PW_CHANGE_ATTEMPTS = 5;
const PW_CHANGE_WINDOW_MS = 15 * 60 * 1000;

export function checkPasswordChangeRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = pwChangeAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    pwChangeAttempts.set(key, { count: 1, resetAt: now + PW_CHANGE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_PW_CHANGE_ATTEMPTS;
}

export function resetPasswordChangeAttempts(key: string): void {
  pwChangeAttempts.delete(key);
}

export async function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (queryToken && QUERY_TOKEN_ALLOWED.some((re) => re.test(req.originalUrl))) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type === 'company' || !decoded.id || !decoded.username) {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }
    // Reject tokens minted before the last password change.
    const tv = await currentTokenVersion(decoded.id);
    if (tv === null) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    if ((decoded.tv ?? 0) !== tv) {
      res.status(401).json({ error: 'Session beendet – bitte erneut anmelden.', code: 'TOKEN_REVOKED' });
      return;
    }
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(id: number, username: string, tokenVersion = 0): string {
  return jwt.sign({ id, username, tv: tokenVersion }, JWT_SECRET, { expiresIn: '24h' });
}
