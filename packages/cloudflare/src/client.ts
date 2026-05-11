import {
  CloudflareApiError,
  type CloudflareApiResponse,
  type CloudflareConfig,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, skips throwing on success: false (caller handles errors). */
  rawErrors?: boolean;
}

/**
 * Low-level Cloudflare API client.
 * All higher-level modules (registrar, dns, pages, email) sit on top of this.
 */
export class CloudflareClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudflareConfig) {
    if (!config.accountId) throw new Error('CloudflareClient: accountId is required');
    if (!config.apiToken) throw new Error('CloudflareClient: apiToken is required');
    this.accountId = config.accountId;
    this.apiToken = config.apiToken;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        'CloudflareClient: no fetch implementation available. Pass config.fetch on Node < 18.',
      );
    }
  }

  get account(): { id: string } {
    return { id: this.accountId };
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const init: RequestInit = { method, headers };
    if (options.body !== undefined && method !== 'GET' && method !== 'DELETE') {
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url.toString(), init);

    let payload: CloudflareApiResponse<T>;
    try {
      payload = (await response.json()) as CloudflareApiResponse<T>;
    } catch {
      throw new CloudflareApiError(
        `Cloudflare returned non-JSON response (status ${response.status})`,
        response.status,
        [],
        `${method} ${path}`,
      );
    }

    if (!response.ok || (!payload.success && !options.rawErrors)) {
      const message =
        payload.errors?.[0]?.message ?? `Cloudflare API ${method} ${path} failed`;
      throw new CloudflareApiError(message, response.status, payload.errors ?? [], `${method} ${path}`);
    }

    return payload.result;
  }

  // Convenience helpers
  get<T>(path: string, opts?: RequestOptions) {
    return this.request<T>('GET', path, opts);
  }
  post<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('POST', path, { ...opts, body });
  }
  put<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('PUT', path, { ...opts, body });
  }
  patch<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...opts, body });
  }
  delete<T>(path: string, opts?: RequestOptions) {
    return this.request<T>('DELETE', path, opts);
  }
}
