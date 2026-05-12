/**
 * JWT signing + verification using `jose`.
 *
 * Tokens are HS256-signed with env.JWT_SECRET (must be at least 32 bytes).
 * Each token carries a `jti` (session id) so we can revoke without rotating the secret.
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const ISSUER = 'hostdaddy.ai';
const AUDIENCE = 'hostdaddy.ai/web';
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const ALGORITHM = 'HS256';

export interface HostDaddyJwtPayload extends JWTPayload {
  sub: string; // customer id
  jti: string; // session id (random UUID)
  email: string;
  role: 'customer' | 'franchisee' | 'agency' | 'admin';
}

function secretKey(secret: string): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

/** Create a signed access token. Returns the JWT string + the jti for revocation tracking. */
export async function signAccessToken(input: {
  secret: string;
  customerId: string;
  email: string;
  role: HostDaddyJwtPayload['role'];
  sessionId?: string; // pass an existing jti to renew; omit to mint a new one
  ttlSeconds?: number;
}): Promise<{ token: string; jti: string; expiresAt: number }> {
  const jti = input.sessionId ?? crypto.randomUUID();
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = nowSec + (input.ttlSeconds ?? ACCESS_TTL_SECONDS);

  const token = await new SignJWT({
    email: input.email,
    role: input.role,
  } satisfies Partial<HostDaddyJwtPayload>)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(input.customerId)
    .setJti(jti)
    .setIssuedAt(nowSec)
    .setExpirationTime(exp)
    .sign(secretKey(input.secret));

  return { token, jti, expiresAt: exp };
}

/** Verify a token. Throws on invalid signature, expiry, or claim mismatch. */
export async function verifyAccessToken(
  secret: string,
  token: string,
): Promise<HostDaddyJwtPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALGORITHM],
  });

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.role !== 'string'
  ) {
    throw new Error('Malformed token payload');
  }

  return payload as HostDaddyJwtPayload;
}

export { ACCESS_TTL_SECONDS };
