/**
 * HostDaddy.app API — Cloudflare Worker entry point.
 *
 * Routes are registered as a Hono tree. Phase 1 ships a minimal /health and
 * /domains/check endpoint. Phases 2–7 add auth, billing, DNS, etc.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { createCloudflare } from '@hostdaddy/cloudflare';
import { createDb } from '@hostdaddy/db';
import type { AppBindings, Env } from './env';
import { domainsRoute } from './routes/domains';
import { authRoute } from './routes/auth';
import { meRoute } from './routes/me';
import { billingRoute, webhooksRoute } from './routes/billing';
import { sitesRoute } from './routes/sites';
import { renderRoute } from './routes/render';
import { optionalAuth } from './middleware/auth';
import { hostRouter } from './middleware/host-router';

const app = new Hono<AppBindings>();

// CF for SaaS — must run BEFORE everything else so customer-domain traffic is
// dispatched to the site renderer without ever touching CORS/auth/API logic.
app.use('*', hostRouter);

app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const env = c.env as Env;
      const appUrl = env.APP_URL ?? 'http://localhost:5173';
      if (!origin) return appUrl;
      // Static allow-list
      const allowed = new Set([
        appUrl,
        'http://localhost:5173',
        'https://hostdaddy.app',
        'https://www.hostdaddy.app',
      ]);
      if (allowed.has(origin)) return origin;
      // Allow any *.hostdaddy-web.pages.dev preview deploy
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith('.hostdaddy-web.pages.dev')) return origin;
        if (host === 'hostdaddy-web.pages.dev') return origin;
      } catch {
        // fall through
      }
      return appUrl;
    },
    credentials: true,
  }),
);

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'hostdaddy-api',
    env: c.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }),
);

// ─── Auth-aware middleware (populates c.var.user when cookie is valid) ─────
app.use('*', optionalAuth);

// ─── Routes ────────────────────────────────────────────────────────────────
app.route('/auth', authRoute);
app.route('/me', meRoute);
app.route('/domains', domainsRoute);
app.route('/billing', billingRoute);
app.route('/webhooks', webhooksRoute);
app.route('/sites', sitesRoute);
app.route('/render', renderRoute);

// 404
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

// Global error handler
app.onError((err, c) => {
  console.error('[hostdaddy-api] error', err);
  return c.json(
    {
      error: err instanceof Error ? err.message : 'Unknown error',
      ...(c.env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : {}),
    },
    500,
  );
});

// ─── Cron handler (Phase 6: renewal reminders) ─────────────────────────────
async function scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  // Placeholder — wire up renewal reminder Worker in Phase 6.
  // Will:
  //   1. Query domains expiring in [60, 30, 14, 7] days
  //   2. Send Resend email per customer
  //   3. Mark `audit_log` accordingly
  const _db = createDb(env.DB);
  const _cf = createCloudflare({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  });
  console.log('[cron] renewal reminder pass — not yet implemented');
}

export default {
  fetch: app.fetch,
  scheduled,
};

// Re-export the helper builders so tests can construct identical clients.
export { createCloudflare, createDb };
