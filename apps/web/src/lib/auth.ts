/**
 * Server-side auth helpers for Next.js Server Components / Route Handlers.
 * Browser-side: use the `authApi` from ./api.ts directly (cookies travel).
 */

import { cookies } from 'next/headers';
import { authApi, ApiHttpError, type SessionUser } from './api';

/**
 * Resolve the current user from the request cookie. Returns null if not logged in.
 * Safe to call from layouts and server components.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const all = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!all.includes('hd_session=')) return null;

  try {
    const { user } = await authApi.me({ cookie: all });
    return user;
  } catch (err) {
    if (err instanceof ApiHttpError && (err.status === 401 || err.status === 404)) {
      return null;
    }
    // Network / 5xx — surface upward so the caller can show an error state
    // rather than silently redirecting to /login.
    throw err;
  }
}

/** Use inside Server Components that require auth. Returns the user or throws. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    // The root middleware.ts handles the redirect; this is a safety net.
    throw new Error('Unauthorised');
  }
  return user;
}
