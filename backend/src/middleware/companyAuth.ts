import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

export interface CompanyAuthRequest extends Request {
  companyUserId?: number;
  companyId?: number;
  companyRole?: 'admin' | 'member';
  companyName?: string;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

export function resetLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

export function generateCompanyToken(companyUserId: number, companyId: number): string {
  return jwt.sign({ companyUserId, companyId, type: 'company' }, JWT_SECRET, { expiresIn: '7d' });
}

export async function authenticateCompany(req: CompanyAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'company' || !decoded.companyUserId || !decoded.companyId) {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const [company] = await query('SELECT status, company_name FROM companies WHERE id = ?', [decoded.companyId]);
    if (!company || company.status !== 'active') {
      res.status(403).json({ error: 'Company account is not active' });
      return;
    }

    const [user] = await query('SELECT id, role FROM company_users WHERE id = ? AND company_id = ?', [decoded.companyUserId, decoded.companyId]);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.companyUserId = decoded.companyUserId;
    req.companyId = decoded.companyId;
    req.companyRole = user.role;
    req.companyName = company.company_name;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function getCompanyAuth(req: Request): { companyUserId: number; companyId: number } | null {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'company' || !decoded.companyUserId || !decoded.companyId) return null;
    return { companyUserId: decoded.companyUserId, companyId: decoded.companyId };
  } catch {
    return null;
  }
}
