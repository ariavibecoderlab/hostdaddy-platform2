/**
 * Host-router middleware.
 *
 * Inspects the inbound Host header. When it matches a registered Custom
 * Hostname (a HostDaddy.app customer who attached their domain via the
 * Cloudflare-for-SaaS flow), we render their site directly. Otherwise we
 * fall through and the request reaches the normal API routes.
 *
 * Runs first in `index.ts` so customer-domain traffic never touches CORS,
 * auth, or API logic.
 */

import type { MiddlewareHandler } from 'hono';
import { createDb, sites, eq } from '@hostdaddy/db';
import type { AppBindings } from '../env';
import { renderSiteByIdAndSlug } from '../routes/render';

/** Hosts we always treat as platform traffic. */
const PLATFORM_HOSTS = new Set([
  'hostdaddy.app',
  'www.hostdaddy.app',
  'api.hostdaddy.app',
  'localhost',
]);

function bareHost(host: string): string {
  return (host.toLowerCase().split(':')[0] ?? '').trim();
}

function isPlatformHost(host: string): boolean {
  const bare = bareHost(host);
  if (!bare) return true;
  if (PLATFORM_HOSTS.has(bare)) return true;
  if (bare.endsWith('.workers.dev')) return true;
  if (bare.endsWith('.pages.dev')) return true;
  if (bare.endsWith('.hostdaddy.app')) return true; // staging / preview subs
  return false;
}

export const hostRouter: MiddlewareHandler<AppBindings> = async (c, next) => {
  const host = c.req.header('host') ?? '';
  if (!host || isPlatformHost(host)) {
    return next();
  }

  const lookup = bareHost(host);
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ id: sites.id, status: sites.status })
    .from(sites)
    .where(eq(sites.custom_hostname, lookup))
    .limit(1);
  const match = rows[0];
  if (!match) {
    return c.html(renderUnconnected(host), 404);
  }

  // Use the incoming pathname (e.g. '/', '/about') to find the right page.
  // The shared renderer falls back to the published home page when the slug
  // doesn't exist.
  const url = new URL(c.req.url);
  const slug = url.pathname === '/' ? undefined : url.pathname;
  const rendered = await renderSiteByIdAndSlug(db, match.id, slug, {
    publishedOnly: true,
  });
  return c.html(rendered.html, rendered.status, {
    ...(rendered.headers ?? {}),
    'X-HostDaddy-Site': match.id,
  });
};

function renderUnconnected(host: string): string {
  const safe = host
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safe} — not connected</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f7faff;color:#0a1638;display:grid;place-items:center;min-height:100vh}
  main{max-width:560px;text-align:center;padding:48px 24px}
  h1{font-size:32px;letter-spacing:-.02em;margin:0 0 12px}
  p{color:#3a4a72;margin:0 0 16px;line-height:1.55}
  code{background:#e8eefc;padding:2px 8px;border-radius:6px;font-size:.95em}
  a{display:inline-block;margin-top:24px;background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;text-decoration:none}
  a:hover{background:#1e40af}
</style></head>
<body><main>
<h1>This domain isn't connected yet</h1>
<p><code>${safe}</code> isn't pointing at a live HostDaddy.app site.</p>
<p>If you own this domain, sign in and attach it under <strong>Sites → Add domain</strong>.</p>
<a href="https://hostdaddy.app">Visit HostDaddy.app</a>
</main></body></html>`;
}
