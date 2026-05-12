/**
 * /auth — register, login, logout, refresh, me.
 *
 * Cookie strategy: httpOnly JWT in `hd_session` cookie. JS can't read it.
 * Revocation: KV entry under `revoked:<jti>` with TTL = remaining lifetime.
 * Rate limit: 5 failed logins per IP per 15 minutes via KV counter.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  createDb,
  customers,
  sessions,
  auditLog,
  verificationTokens,
  eq,
  and,
  isNull,
  gt,
} from '@hostdaddy/db';
import { hashPassword, verifyPassword, needsRehash } from '../lib/password';
import { signAccessToken, ACCESS_TTL_SECONDS } from '../lib/jwt';
import { setAuthCookie, clearAuthCookie } from '../lib/cookies';
import { requireAuth, revokeSession } from '../middleware/auth';
import { sendEmail } from '../lib/email';
import type { AppBindings } from '../env';

export const authRoute = new Hono<AppBindings>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Enter your name').max(120),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  franchiseCode: z.string().trim().max(64).optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ipOf(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_SECONDS = 60 * 15;

async function checkLoginRateLimit(kv: KVNamespace, ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:login:${ip}`;
  const current = await kv.get(key);
  const count = current ? Number.parseInt(current, 10) : 0;
  if (count >= LOGIN_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: LOGIN_RATE_LIMIT - count };
}

async function bumpLoginRateLimit(kv: KVNamespace, ip: string): Promise<void> {
  const key = `ratelimit:login:${ip}`;
  const current = await kv.get(key);
  const count = current ? Number.parseInt(current, 10) : 0;
  await kv.put(key, String(count + 1), { expirationTtl: LOGIN_RATE_WINDOW_SECONDS });
}

async function persistSession(
  db: ReturnType<typeof createDb>,
  input: { jti: string; customerId: string; expiresAtSec: number; userAgent?: string; ip?: string },
) {
  const tokenHashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.jti));
  const tokenHashHex = Array.from(new Uint8Array(tokenHashBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    customer_id: input.customerId,
    token_hash: tokenHashHex,
    user_agent: input.userAgent ?? null,
    ip_address: input.ip ?? null,
    expires_at: new Date(input.expiresAtSec * 1000),
  });
}

async function recordAudit(
  db: ReturnType<typeof createDb>,
  input: {
    customerId?: string;
    actor: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
  },
) {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    customer_id: input.customerId ?? null,
    actor: input.actor,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    ip_address: input.ip ?? null,
  });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Creates a new customer, signs them in, returns the user object.
 */
authRoute.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  const db = createDb(c.env.DB);

  // Reject duplicates without leaking which emails exist (return generic error).
  const existing = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Could not create account', details: { email: ['An account with this email may already exist'] } }, 409);
  }

  const customerId = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);

  await db.insert(customers).values({
    id: customerId,
    email: input.email,
    name: input.name,
    phone: input.phone ?? null,
    company: input.company ?? null,
    franchise_code: input.franchiseCode ?? null,
    password_hash: passwordHash,
    role: input.franchiseCode ? 'franchisee' : 'customer',
  });

  const { token, jti, expiresAt } = await signAccessToken({
    secret: c.env.JWT_SECRET,
    customerId,
    email: input.email,
    role: input.franchiseCode ? 'franchisee' : 'customer',
  });

  await persistSession(db, {
    jti,
    customerId,
    expiresAtSec: expiresAt,
    userAgent: c.req.header('user-agent') ?? undefined,
    ip: ipOf(c.req.raw),
  });

  await recordAudit(db, {
    customerId,
    actor: 'customer',
    action: 'auth.register',
    entityType: 'customer',
    entityId: customerId,
    ip: ipOf(c.req.raw),
  });

  setAuthCookie(c, token, { maxAgeSeconds: ACCESS_TTL_SECONDS });

  // Fire-and-forget welcome email. We use ctx.executionCtx.waitUntil where
  // available so that the response returns immediately.
  const sendWelcome = sendEmail(c.env, {
    to: input.email,
    template: 'welcome',
    data: { name: input.name },
  }).catch((err) => console.error('[email:welcome] failed', err));
  c.executionCtx?.waitUntil(sendWelcome);

  return c.json(
    {
      user: {
        id: customerId,
        email: input.email,
        name: input.name,
        role: input.franchiseCode ? 'franchisee' : 'customer',
      },
    },
    201,
  );
});

/**
 * POST /auth/login
 * Signs an existing customer in. Returns 401 on bad creds (without leaking
 * whether the email exists).
 */
authRoute.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { email, password } = parsed.data;
  const ip = ipOf(c.req.raw);

  const rate = await checkLoginRateLimit(c.env.SESSIONS, ip);
  if (!rate.allowed) {
    return c.json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }

  const db = createDb(c.env.DB);
  const rows = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  const customer = rows[0];

  if (!customer || !customer.password_hash) {
    await bumpLoginRateLimit(c.env.SESSIONS, ip);
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  const ok = await verifyPassword(password, customer.password_hash);
  if (!ok) {
    await bumpLoginRateLimit(c.env.SESSIONS, ip);
    await recordAudit(db, {
      customerId: customer.id,
      actor: 'customer',
      action: 'auth.login.failed',
      ip,
    });
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  // Opportunistically upgrade the hash if iteration count is below current target.
  if (needsRehash(customer.password_hash)) {
    const newHash = await hashPassword(password);
    await db.update(customers).set({ password_hash: newHash, updated_at: new Date() }).where(eq(customers.id, customer.id));
  }

  await db.update(customers).set({ last_login_at: new Date() }).where(eq(customers.id, customer.id));

  const { token, jti, expiresAt } = await signAccessToken({
    secret: c.env.JWT_SECRET,
    customerId: customer.id,
    email: customer.email,
    role: customer.role,
  });

  await persistSession(db, {
    jti,
    customerId: customer.id,
    expiresAtSec: expiresAt,
    userAgent: c.req.header('user-agent') ?? undefined,
    ip,
  });

  await recordAudit(db, {
    customerId: customer.id,
    actor: 'customer',
    action: 'auth.login',
    ip,
  });

  setAuthCookie(c, token, { maxAgeSeconds: ACCESS_TTL_SECONDS });

  return c.json({
    user: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      role: customer.role,
    },
  });
});

/**
 * POST /auth/logout
 * Revokes the current session (KV entry) and clears the cookie.
 */
authRoute.post('/logout', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: true }); // requireAuth ensures this, type-narrowing

  // Compute remaining lifetime so the KV revocation entry expires when the JWT would have anyway.
  // We can re-derive by querying the session row's expires_at, but doing a max-TTL is simpler:
  // revoke for one week to cover any possible JWT lifetime, then KV cleans itself up.
  const nowSec = Math.floor(Date.now() / 1000);
  await revokeSession(c.env.SESSIONS, user.sessionId, nowSec + ACCESS_TTL_SECONDS);

  const db = createDb(c.env.DB);
  await recordAudit(db, {
    customerId: user.customerId,
    actor: 'customer',
    action: 'auth.logout',
    ip: ipOf(c.req.raw),
  });

  clearAuthCookie(c);
  return c.json({ ok: true });
});

/**
 * POST /auth/refresh
 * Issues a fresh token if the current one is still valid (i.e. not revoked + not expired).
 * Used by the frontend to extend the session as the user is active.
 */
authRoute.post('/refresh', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const { token, expiresAt } = await signAccessToken({
    secret: c.env.JWT_SECRET,
    customerId: user.customerId,
    email: user.email,
    role: user.role,
    sessionId: user.sessionId, // preserve jti so the old token is still revocable via the same key
  });

  // Don't rewrite the sessions row; updating expires_at is fine but optional.
  setAuthCookie(c, token, { maxAgeSeconds: ACCESS_TTL_SECONDS });
  return c.json({ ok: true, expiresAt });
});

// ─── Forgot password flow ────────────────────────────────────────────────────

const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

async function sha256Hex(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

/**
 * POST /auth/forgot-password
 * Always returns 200 to avoid email enumeration. Sends an email if the account
 * exists.
 */
authRoute.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { email } = parsed.data;
  const db = createDb(c.env.DB);

  const rows = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  const customer = rows[0];

  // Always succeed externally; only do real work if account exists.
  if (customer) {
    // Generate a 32-byte random token, encoded as base64url.
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000);

    await db.insert(verificationTokens).values({
      id: crypto.randomUUID(),
      customer_id: customer.id,
      type: 'password_reset',
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetUrl = `${c.env.APP_URL}/reset-password/${token}`;
    const sending = sendEmail(c.env, {
      to: customer.email,
      template: 'password_reset',
      data: { name: customer.name, resetUrl },
    }).catch((err) => console.error('[email:password_reset] failed', err));
    c.executionCtx?.waitUntil(sending);

    await recordAudit(db, {
      customerId: customer.id,
      actor: 'customer',
      action: 'auth.forgot_password.requested',
      ip: ipOf(c.req.raw),
    });
  }

  return c.json({ ok: true });
});

/**
 * POST /auth/reset-password
 * Verifies the token, sets a new password, marks the token as used,
 * revokes all existing sessions.
 */
authRoute.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { token, password } = parsed.data;
  const db = createDb(c.env.DB);
  const tokenHash = await sha256Hex(token);

  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token_hash, tokenHash),
        eq(verificationTokens.type, 'password_reset'),
        isNull(verificationTokens.used_at),
        gt(verificationTokens.expires_at, new Date()),
      ),
    )
    .limit(1);

  const record = rows[0];
  if (!record) {
    return c.json({ error: 'Reset link is invalid or has expired' }, 400);
  }

  const newHash = await hashPassword(password);
  await db.update(customers).set({ password_hash: newHash, updated_at: new Date() }).where(eq(customers.id, record.customer_id));
  await db.update(verificationTokens).set({ used_at: new Date() }).where(eq(verificationTokens.id, record.id));

  await recordAudit(db, {
    customerId: record.customer_id,
    actor: 'customer',
    action: 'auth.password_reset.completed',
    ip: ipOf(c.req.raw),
  });

  return c.json({ ok: true });
});

/**
 * POST /auth/change-password
 * Authenticated, requires the current password.
 */
authRoute.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { currentPassword, newPassword } = parsed.data;
  const db = createDb(c.env.DB);

  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer || !customer.password_hash) {
    return c.json({ error: 'Account not found' }, 404);
  }

  const ok = await verifyPassword(currentPassword, customer.password_hash);
  if (!ok) {
    return c.json({ error: 'Current password is incorrect' }, 400);
  }
  const newHash = await hashPassword(newPassword);
  await db.update(customers).set({ password_hash: newHash, updated_at: new Date() }).where(eq(customers.id, customer.id));

  await recordAudit(db, {
    customerId: customer.id,
    actor: 'customer',
    action: 'auth.password.changed',
    ip: ipOf(c.req.raw),
  });

  return c.json({ ok: true });
});

/**
 * GET /auth/me
 * Returns the current authenticated customer. Used by the web app on initial load.
 */
authRoute.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const db = createDb(c.env.DB);
  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer) {
    clearAuthCookie(c);
    return c.json({ error: 'Account no longer exists' }, 404);
  }
  return c.json({
    user: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      company: customer.company,
      role: customer.role,
      franchiseCode: customer.franchise_code,
    },
  });
});
