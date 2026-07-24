import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable must be set');
  return secret;
})();

export interface AuthRequest extends Request {
  adminId?: number;
  adminUsername?: string;
}

// Only these download-link routes may pass the token in the query string
// (browser `<a href target="_blank">` navigation can't set an Authorization
// header). Every other admin route requires the Bearer header.
const QUERY_TOKEN_ALLOWED = [
  /^\/api\/admin\/companies\/invoices\/\d+\/pdf(\?|$)/,
  /^\/api\/admin\/report\/finanzamt(\?|$)/,
  /^\/api\/admin\/bookings\/\d+\/rechnung\.pdf(\?|$)/,
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

export function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
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
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(id: number, username: string): string {
  return jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '24h' });
}
