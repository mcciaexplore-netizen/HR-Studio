import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { Store, HttpError, type Actor } from './store';

export const SESSION_COOKIE = 'hrstudio_session';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (value: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(value, salt)).toString('hex')}`;
}
export async function checkPassword(value: string, hash: string) {
  const [, salt, expected] = hash.split(':');
  const key = await derive(value, salt);
  const stored = Buffer.from(expected, 'hex');
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export function actorFrom(row: any): Actor {
  return { id: row.id, orgId: row.org_id, name: row.name, email: row.email, accessRole: row.role, employeeId: row.employee_id, mustChangePassword: !!row.must_change };
}
export function cookieToken(header = '') {
  return header.split(';').map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) || '';
}
export function createSession(store: Store, res: Response, userId: string, secure: boolean) {
  const token = randomBytes(32).toString('hex'), duration = 8 * 60 * 60 * 1000;
  store.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), userId, Date.now() + duration);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: duration });
}
export function authenticate(store: Store): RequestHandler {
  return (req, res, next) => {
    const row = store.db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(digest(cookieToken(req.headers.cookie)), Date.now());
    if (!row) return next(new HttpError(401, 'Sign in to continue.'));
    res.locals.actor = actorFrom(row); next();
  };
}
export const requireStaff: RequestHandler = (_req, res, next) => next(res.locals.actor.accessRole === 'employee' ? new HttpError(403, 'HR access is required.') : undefined);
export const requireOwner: RequestHandler = (_req, res, next) => next(res.locals.actor.accessRole !== 'owner' ? new HttpError(403, 'Only the company owner can do this.') : undefined);
export function rateLimit(limit: number, windowMs: number): RequestHandler {
  const entries = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now(), key = res.locals.actor?.id || req.ip || 'unknown';
    if (entries.size > 5000) for (const [id, entry] of entries) if (entry.until <= now) entries.delete(id);
    if (!entries.has(key) && entries.size >= 10000) return next(new HttpError(429, 'Please try again later.'));
    let entry = entries.get(key);
    if (!entry || entry.until <= now) { entry = { count: 0, until: now + windowMs }; entries.set(key, entry); }
    if (++entry.count > limit) { res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000)); return next(new HttpError(429, 'Too many attempts. Please try again later.')); }
    next();
  };
}
