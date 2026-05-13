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

export interface HostingPlanSummary {
  id: string;
  plan_type: 'starter' | 'business' | 'agency' | 'bb_franchisee';
  sites_limit: number;
  storage_gb: number;
  billing_cycle: 'monthly' | 'yearly';
  status: 'active' | 'past_due' | 'cancelled' | 'trial';
  price_cents: number;
  expires_at: number | string | null;
}

export const meApi = {
  update: (body: { name?: string; phone?: string; company?: string }) =>
    api.patch<{ user: SessionUser }>('/me', body),
  hostingPlans: (opts?: { cookie?: string }) =>
    api.get<{ plans: HostingPlanSummary[] }>('/me/hosting-plans', opts),
};

// ─── Sites module endpoints ─────────────────────────────────────────────────

export interface SiteSummary {
  id: string;
  name: string;
  template: string | null;
  status: 'provisioning' | 'building' | 'live' | 'error' | 'paused';
  cf_pages_project: string;
  last_deployed_at: number | string | null;
  counts: {
    pages: number;
    posts: number;
    products: number;
    contacts: number;
  };
}

export interface SitePage {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  content_json: string;
  status: 'draft' | 'published' | 'archived';
  is_home: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: number | string | null;
  updated_at: number | string;
}

export interface SitePost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author_name: string;
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  category: string | null;
  tags_json: string;
  published_at: number | string | null;
  view_count: number;
  updated_at: number | string;
}

export interface SiteForm {
  id: string;
  name: string;
  slug: string;
  fields_json: string;
  settings_json: string;
  submission_count: number;
  is_active: boolean;
  updated_at: number | string;
}

export interface SiteContact {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  tags_json: string;
  ltv_cents: number;
  order_count: number;
  last_seen_at: number | string | null;
  created_at: number | string;
}

export interface SiteProduct {
  id: string;
  name: string;
  slug: string;
  type: 'physical' | 'digital' | 'service' | 'subscription';
  price_cents: number;
  compare_at_cents: number | null;
  currency: string;
  status: 'active' | 'draft' | 'archived';
  featured: boolean;
  sold_count: number;
  updated_at: number | string;
}

export interface SiteOrder {
  id: string;
  order_number: string;
  end_customer_email: string;
  end_customer_name: string;
  total_cents: number;
  currency: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial_refund';
  fulfillment_status: 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: number | string;
}

export interface SiteMedia {
  id: string;
  r2_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  folder: string | null;
  created_at: number | string;
  public_url: string;
}

export interface AiBuildResult {
  run_id: string;
  summary: string;
  tool_calls: Array<{
    name: string;
    input: Record<string, unknown>;
    result?: { ok: boolean; message: string; data?: unknown };
  }>;
  model: string;
  note?: string;
}

export const sitesApi = {
  list: (opts?: { cookie?: string }) => api.get<{ sites: SiteSummary[] }>('/sites', opts),
  get: (id: string, opts?: { cookie?: string }) =>
    api.get<{ site: SiteSummary }>(`/sites/${id}`, opts),
  create: (body: { name: string; hosting_plan_id: string; template?: string | null }) =>
    api.post<{ site: SiteSummary }>('/sites', body),
  delete: (id: string) => api.delete<{ ok: true }>(`/sites/${id}`),

  // Pages
  listPages: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ pages: SitePage[] }>(`/sites/${siteId}/pages`, opts),
  getPage: (siteId: string, pageId: string, opts?: { cookie?: string }) =>
    api.get<{ page: SitePage }>(`/sites/${siteId}/pages/${pageId}`, opts),
  createPage: (siteId: string, body: Partial<SitePage> & { slug: string; title: string }) =>
    api.post<{ page: SitePage }>(`/sites/${siteId}/pages`, body),
  updatePage: (siteId: string, pageId: string, body: Partial<SitePage>) =>
    api.patch<{ page: SitePage }>(`/sites/${siteId}/pages/${pageId}`, body),
  deletePage: (siteId: string, pageId: string) =>
    api.delete<{ ok: true }>(`/sites/${siteId}/pages/${pageId}`),

  // Posts
  listPosts: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ posts: SitePost[] }>(`/sites/${siteId}/posts`, opts),
  createPost: (siteId: string, body: Partial<SitePost> & { title: string }) =>
    api.post<{ post: SitePost }>(`/sites/${siteId}/posts`, body),
  updatePost: (siteId: string, postId: string, body: Partial<SitePost>) =>
    api.patch<{ post: SitePost }>(`/sites/${siteId}/posts/${postId}`, body),
  deletePost: (siteId: string, postId: string) =>
    api.delete<{ ok: true }>(`/sites/${siteId}/posts/${postId}`),

  // Forms
  listForms: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ forms: SiteForm[] }>(`/sites/${siteId}/forms`, opts),
  createForm: (siteId: string, body: { name: string; slug?: string }) =>
    api.post<{ form: SiteForm }>(`/sites/${siteId}/forms`, body),

  // Contacts
  listContacts: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ contacts: SiteContact[] }>(`/sites/${siteId}/contacts`, opts),
  createContact: (
    siteId: string,
    body: { email: string; name?: string | null; phone?: string | null; source?: string },
  ) => api.post<{ contact: SiteContact }>(`/sites/${siteId}/contacts`, body),

  // Products
  listProducts: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ products: SiteProduct[] }>(`/sites/${siteId}/products`, opts),
  createProduct: (
    siteId: string,
    body: { name: string; price_cents: number; type?: SiteProduct['type']; currency?: string },
  ) => api.post<{ product: SiteProduct }>(`/sites/${siteId}/products`, body),

  // Orders
  listOrders: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ orders: SiteOrder[] }>(`/sites/${siteId}/orders`, opts),

  // Media (R2)
  listMedia: (siteId: string, opts?: { cookie?: string }) =>
    api.get<{ media: SiteMedia[] }>(`/sites/${siteId}/media`, opts),
  // Media upload uses FormData; the typed fetch wrapper above is JSON-only, so
  // this helper bypasses it directly.
  uploadMedia: async (siteId: string, file: File, altText?: string, folder?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (altText) form.append('alt_text', altText);
    if (folder) form.append('folder', folder);
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';
    const res = await fetch(`${base}/sites/${siteId}/media`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const errPayload = await res.json().catch(() => null);
      throw new ApiHttpError(
        (errPayload as { error?: string } | null)?.error ?? `Upload failed (${res.status})`,
        res.status,
        errPayload,
      );
    }
    return (await res.json()) as { media: SiteMedia };
  },
  deleteMedia: (siteId: string, mediaId: string) =>
    api.delete<{ ok: true }>(`/sites/${siteId}/media/${mediaId}`),

  // AI build agent
  aiBuild: (siteId: string, body: { prompt: string; page_id?: string; model?: string }) =>
    api.post<AiBuildResult>(`/sites/${siteId}/ai/build`, body),
};
