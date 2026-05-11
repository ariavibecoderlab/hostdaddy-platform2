/**
 * Shared types for the Cloudflare API.
 * Reference: https://developers.cloudflare.com/api/
 */

export interface CloudflareConfig {
  /** Cloudflare account ID (from dashboard sidebar). */
  accountId: string;
  /** API token with the scopes listed in HOSTDADDY_ACCOUNT_SETUP.md §1.3. */
  apiToken: string;
  /** Override base URL (useful for tests / Workers fetch mocks). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
}

/** Standard envelope returned by all Cloudflare REST endpoints. */
export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: CloudflareError[];
  messages: CloudflareMessage[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}

export interface CloudflareError {
  code: number;
  message: string;
  error_chain?: CloudflareError[];
}

export interface CloudflareMessage {
  code: number;
  message: string;
}

/** Custom error thrown when the API returns success: false or a non-2xx status. */
export class CloudflareApiError extends Error {
  public readonly status: number;
  public readonly errors: CloudflareError[];
  public readonly endpoint: string;

  constructor(message: string, status: number, errors: CloudflareError[], endpoint: string) {
    super(message);
    this.name = 'CloudflareApiError';
    this.status = status;
    this.errors = errors;
    this.endpoint = endpoint;
  }

  /** True if the error indicates the resource doesn't exist. */
  get isNotFound(): boolean {
    return this.status === 404 || this.errors.some((e) => e.code === 1003 || e.code === 7003);
  }

  /** True if the error indicates an auth problem. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
