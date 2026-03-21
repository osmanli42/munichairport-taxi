import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-very-secret-key';

export interface AuthRequest extends Request {
  adminId?: number;
  adminUsername?: string;
}

export function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
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
