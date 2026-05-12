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
    path: '/',
    maxAge: opts.maxAgeSeconds,
  });
}

export function clearAuthCookie(c: Context<AppBindings>): void {
  deleteCookie(c, AUTH_COOKIE, { path: '/' });
}

export function readAuthCookie(c: Context<AppBindings>): string | undefined {
  return getCookie(c, AUTH_COOKIE);
}
