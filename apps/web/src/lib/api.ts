/**
 * Typed fetch wrapper for the HostDaddy.app Workers API.
 * Browser-side and server-side both work; cookies travel automatically
 * on browser fetches because of `credentials: 'include'`.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export class ApiHttpError extends Error {
  public readonly status: number;
  public readonly details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.details = details;
  }
}

type Json = Record<string, unknown> | unknown[] | null;

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: Json; cookie?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  // Forward an explicit cookie when server-side (Next.js server components).
  if (options.cookie) headers['Cookie'] = options.cookie;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // Server components: don't cache auth-sensitive endpoints.
    cache: 'no-store',
  });

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : '') || `Request failed (${res.status})`;
    throw new ApiHttpError(msg, res.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: { cookie?: string }) =>
    request<T>('GET', path, opts),
  post: <T>(path: string, body?: Json, opts?: { cookie?: string }) =>
    request<T>('POST', path, { body, ...opts }),
  patch: <T>(path: string, body?: Json, opts?: { cookie?: string }) =>
    request<T>('PATCH', path, { body, ...opts }),
  delete: <T>(path: string, opts?: { cookie?: string }) =>
    request<T>('DELETE', path, opts),
};

// ─── Typed endpoints ───────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  role: 'customer' | 'franchisee' | 'agency' | 'admin';
  franchiseCode?: string | null;
}

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    company?: string;
    franchiseCode?: string;
  }) => api.post<{ user: SessionUser }>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<{ user: SessionUser }>('/auth/login', body),

  logout: () => api.post<{ ok: true }>('/auth/logout'),

  me: (opts?: { cookie?: string }) =>
    api.get<{ user: SessionUser }>('/auth/me', opts),

  forgotPassword: (body: { email: string }) =>
    api.post<{ ok: true }>('/auth/forgot-password', body),

  resetPassword: (body: { token: string; password: string }) =>
    api.post<{ ok: true }>('/auth/reset-password', body),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<{ ok: true }>('/auth/change-password', body),
};

export const meApi = {
  update: (body: { name?: string; phone?: string; company?: string }) =>
    api.patch<{ user: SessionUser }>('/me', body),
};
