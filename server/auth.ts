import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './db.ts';
import type { UserRecord } from './types.ts';

const TOKEN_SECRET =
  process.env.ONCOBYTE_TOKEN_SECRET || 'oncobyte-independent-session-secret-2026';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(keyBuf, derivedBuf);
}

export function issueSessionToken(userId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { sub: string; email: string } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || Date.now() > decoded.exp) return null;
    return { sub: decoded.sub, email: decoded.email };
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

export function sanitizeUser(user: UserRecord) {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : queryToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Provide Bearer token.' });
    return;
  }

  const verified = verifySessionToken(rawToken);
  if (!verified) {
    res.status(401).json({ error: 'Session token is invalid or expired.' });
    return;
  }

  const db = getDb();
  const user = db.users.find((u) => u.id === verified.sub);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }

  req.user = user;
  next();
}
