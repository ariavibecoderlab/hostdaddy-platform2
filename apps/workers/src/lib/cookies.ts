/**
 * Session cookie helpers.
 *
 * The auth cookie is httpOnly + Secure + SameSite=Lax. JS in the browser cannot
 * read it; the cookie travels automatically on same-site fetches.
 */

import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { AppBindings } from '../env';

export const AUTH_COOKIE = 'hd_session';

export interface CookieOpts {
  maxAgeSeconds: number;
}

/**
 * Derive the cookie domain so the session is shared between
 * hostdaddy.app (web) and api.hostdaddy.app (Worker).
 * Returns undefined for localhost / preview deploys so the browser
 * just falls back to host-only cookies.
 */
function cookieDomain(c: Context<AppBindings>): string | undefined {
  try {
    const host = new URL(c.env.APP_URL ?? '').hostname;
    if (!host || host === 'localhost') return undefined;
    // Strip leading "www." so cookies cover both apex + www + api
    return '.' + host.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

export function setAuthCookie(
  c: Context<AppBindings>,
  token: string,
  opts: CookieOpts,
): void {
  const isProd = c.env.NODE_ENV === 'production';
  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProd, // dev (http://localhost) can't set Secure=true cookies
    sameSite: 'Lax',
    domain: isProd ? cookieDomain(c) : undefined,
    path: '/',
    maxAge: opts.maxAgeSeconds,
  });
}

export function clearAuthCookie(c: Context<AppBindings>): void {
  const isProd = c.env.NODE_ENV === 'production';
  deleteCookie(c, AUTH_COOKIE, {
    path: '/',
    domain: isProd ? cookieDomain(c) : undefined,
  });
}

export function readAuthCookie(c: Context<AppBindings>): string | undefined {
  return getCookie(c, AUTH_COOKIE);
}
