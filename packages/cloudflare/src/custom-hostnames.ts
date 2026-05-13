import type { CloudflareClient } from './client';

/**
 * Cloudflare for SaaS — Custom Hostnames API.
 *
 * Lets HostDaddy.app attach customer-owned domains to our SaaS zone
 * (hostdaddy.app). The customer keeps their domain wherever it's registered;
 * they CNAME (or A-record) it at us, and we serve their site via Workers.
 *
 * Reference:
 *   https://developers.cloudflare.com/api/operations/custom-hostname-for-a-zone-create-custom-hostname
 *   https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 *
 * Flow:
 *   1. Customer enters their domain (e.g. bb-kelana.com) in the dashboard.
 *   2. We POST /zones/{saasZoneId}/custom_hostnames to create a CH record.
 *   3. CF returns ownership_verification + ssl.validation_records — we relay
 *      these to the customer as DNS instructions ("add this TXT/CNAME at your
 *      current registrar").
 *   4. The customer adds the record; CF polls automatically and issues SSL.
 *   5. We poll /custom_hostnames/{id} until status === 'active'.
 *   6. Once active, HTTPS requests to bb-kelana.com hit Cloudflare → our
 *      Worker on the SaaS zone → renders the right customer's site.
 */

export type CustomHostnameStatus =
  | 'pending'
  | 'pending_validation'
  | 'pending_issuance'
  | 'pending_deployment'
  | 'active'
  | 'active_redeploying'
  | 'deleted'
  | 'blocked'
  | 'moved';

export type SslMethod = 'http' | 'txt' | 'email';

export type SslType = 'dv';

export interface OwnershipVerification {
  /** TXT record name and value the customer must add. */
  name?: string;
  type?: 'txt';
  value?: string;
  /** HTTP-based fallback (file at a well-known URL). */
  http_url?: string;
  http_body?: string;
}

export interface OwnershipVerificationHttp {
  http_url: string;
  http_body: string;
}

export interface SslValidationRecord {
  status?: 'pending' | 'active';
  txt_name?: string;
  txt_value?: string;
  /** CNAME-based validation alternative. */
  cname_name?: string;
  cname_target?: string;
  emails?: string[];
  http_url?: string;
  http_body?: string;
}

export interface CustomHostnameSsl {
  id?: string;
  type: SslType;
  method: SslMethod;
  status: 'initializing' | 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | 'expired' | 'deleted';
  validation_records?: SslValidationRecord[];
  validation_errors?: { message: string }[];
  hosts?: string[];
  issuer?: string;
  serial_number?: string;
  signature?: string;
  uploaded_on?: string;
  expires_on?: string;
  certificate_authority?: 'google' | 'lets_encrypt' | 'ssl_com';
  settings?: {
    min_tls_version?: '1.0' | '1.1' | '1.2' | '1.3';
    http2?: 'on' | 'off';
    tls_1_3?: 'on' | 'off';
    ciphers?: string[];
    early_hints?: 'on' | 'off';
  };
  bundle_method?: 'ubiquitous' | 'optimal' | 'force';
  wildcard?: boolean;
}

export interface CustomHostname {
  id: string;
  hostname: string;
  ssl: CustomHostnameSsl;
  status: CustomHostnameStatus;
  verification_errors?: string[];
  ownership_verification?: OwnershipVerification;
  ownership_verification_http?: OwnershipVerificationHttp;
  custom_metadata?: Record<string, string>;
  custom_origin_server?: string;
  custom_origin_sni?: string;
  created_at: string;
}

export interface CreateCustomHostnameInput {
  /** The customer's domain — e.g. 'bb-kelana.com'. */
  hostname: string;
  /** SSL configuration. Defaults are fine for most cases. */
  ssl?: Partial<Pick<CustomHostnameSsl, 'type' | 'method' | 'settings' | 'bundle_method' | 'wildcard'>> & {
    certificate_authority?: 'google' | 'lets_encrypt' | 'ssl_com';
  };
  /** Optional metadata stored alongside the hostname (we use this to tag the site_id). */
  custom_metadata?: Record<string, string>;
  /** When set, CF routes requests to this origin instead of the SaaS zone's worker. Leave undefined for our default Worker. */
  custom_origin_server?: string;
}

export class CustomHostnamesClient {
  constructor(private readonly client: CloudflareClient) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Create a Custom Hostname attaching `hostname` to the SaaS zone.
   * Returns the full CH record including the ownership_verification fields
   * the customer needs to add to their DNS.
   */
  async create(zoneId: string, input: CreateCustomHostnameInput): Promise<CustomHostname> {
    const body = {
      hostname: input.hostname.toLowerCase().trim(),
      ssl: {
        type: input.ssl?.type ?? 'dv',
        method: input.ssl?.method ?? 'txt',
        settings: input.ssl?.settings ?? {
          min_tls_version: '1.2',
          http2: 'on',
          tls_1_3: 'on',
        },
        bundle_method: input.ssl?.bundle_method ?? 'ubiquitous',
        wildcard: input.ssl?.wildcard ?? false,
        certificate_authority: input.ssl?.certificate_authority ?? 'google',
      },
      ...(input.custom_metadata ? { custom_metadata: input.custom_metadata } : {}),
      ...(input.custom_origin_server ? { custom_origin_server: input.custom_origin_server } : {}),
    };
    return this.client.post<CustomHostname>(`/zones/${zoneId}/custom_hostnames`, body);
  }

  /** Fetch the current state of a Custom Hostname (used for polling SSL status). */
  async get(zoneId: string, customHostnameId: string): Promise<CustomHostname> {
    return this.client.get<CustomHostname>(`/zones/${zoneId}/custom_hostnames/${customHostnameId}`);
  }

  /** Look up by hostname string (useful for de-dupe checks). */
  async findByHostname(zoneId: string, hostname: string): Promise<CustomHostname | null> {
    const results = await this.client.get<CustomHostname[]>(
      `/zones/${zoneId}/custom_hostnames`,
      { query: { hostname: hostname.toLowerCase().trim(), per_page: 1 } },
    );
    return results[0] ?? null;
  }

  /** List Custom Hostnames on the SaaS zone — paginated. */
  async list(
    zoneId: string,
    params: { page?: number; per_page?: number; ssl?: 0 | 1 } = {},
  ): Promise<CustomHostname[]> {
    return this.client.get<CustomHostname[]>(`/zones/${zoneId}/custom_hostnames`, {
      query: params,
    });
  }

  /** Delete a Custom Hostname (used when a customer disconnects their domain). */
  async delete(zoneId: string, customHostnameId: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(
      `/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
    );
  }

  /**
   * Request SSL re-validation. Useful when the customer reports the CNAME
   * is set but CF status hasn't flipped to active yet.
   */
  async revalidate(zoneId: string, customHostnameId: string): Promise<CustomHostname> {
    return this.client.patch<CustomHostname>(
      `/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
      { ssl: { method: 'txt', type: 'dv' } },
    );
  }

  // ─── Convenience: simplified status surface for the UI ─────────────────────

  /**
   * Reduces the verbose CF status fields into a single string the customer UI
   * can render: pending_verification | pending_ssl | active | error.
   * Also surfaces the verification record the customer still needs to add.
   */
  static summarise(ch: CustomHostname): {
    status: 'pending_verification' | 'pending_ssl' | 'active' | 'error';
    error?: string;
    record_to_add?: {
      type: 'TXT' | 'CNAME';
      name: string;
      value: string;
    } | null;
  } {
    if (ch.status === 'blocked') {
      return { status: 'error', error: 'This domain is blocked by Cloudflare.' };
    }
    if (ch.status === 'active' && ch.ssl.status === 'active') {
      return { status: 'active' };
    }
    if (ch.ssl.validation_errors && ch.ssl.validation_errors.length > 0) {
      return {
        status: 'error',
        error: ch.ssl.validation_errors.map((e) => e.message).join(' '),
      };
    }
    // Still verifying domain ownership? Surface the TXT record needed.
    const txt = ch.ownership_verification;
    const vrec = ch.ssl.validation_records?.[0];
    if (txt?.name && txt.value) {
      return {
        status: 'pending_verification',
        record_to_add: { type: 'TXT', name: txt.name, value: txt.value },
      };
    }
    if (vrec?.txt_name && vrec.txt_value) {
      return {
        status: 'pending_ssl',
        record_to_add: { type: 'TXT', name: vrec.txt_name, value: vrec.txt_value },
      };
    }
    if (vrec?.cname_name && vrec.cname_target) {
      return {
        status: 'pending_ssl',
        record_to_add: { type: 'CNAME', name: vrec.cname_name, value: vrec.cname_target },
      };
    }
    return { status: 'pending_ssl' };
  }
}
