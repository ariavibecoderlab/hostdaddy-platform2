/**
 * Auth middleware.
 *
 * `requireAuth` — 401s if no valid session. Use on protected routes.
 * `optionalAuth` — populates c.var.user if cookie is present, but doesn't 401.
 *
 * Both check the KV revocation list so that logout has immediate effect across
 * the edge without waiting for token expiry.
 */

import type { MiddlewareHandler } from 'hono';
import { verifyAccessToken } from '../lib/jwt';
import { readAuthCookie } from '../lib/cookies';
import type { AppBindings } from '../env';

const REVOKED_PREFIX = 'revoked:';

async function resolveUser(c: Parameters<MiddlewareHandler<AppBindings>>[0]) {
  const token = readAuthCookie(c);
  if (!token) return undefined;

  let payload: Awaited<ReturnType<typeof verifyAccessToken>>;
  try {
    payload = await verifyAccessToken(c.env.JWT_SECRET, token);
  } catch {
    return undefined; // invalid or expired
  }

  // Check revocation list — logout adds an entry with TTL = remaining lifetime.
  const revoked = await c.env.SESSIONS.get(REVOKED_PREFIX + payload.jti);
  if (revoked) return undefined;

  return {
    customerId: payload.sub,
    email: payload.email,
    role: payload.role,
    sessionId: payload.jti,
  } as const;
}

export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await resolveUser(c);
  if (user) c.set('user', user);
  await next();
};

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await resolveUser(c);
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }
  c.set('user', user);
  await next();
};

/** Admin-only gate. Combine after requireAuth. */
export const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
};

/** Mark a JWT as revoked. TTL is auto-set to the remaining lifetime so KV cleans up. */
export async function revokeSession(
  kv: KVNamespace,
  jti: string,
  expiresAtUnixSeconds: number,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, expiresAtUnixSeconds - nowSec); // minimum 60s
  await kv.put(REVOKED_PREFIX + jti, '1', { expirationTtl: ttl });
}
