import type { CloudflareClient } from './client.js';

/**
 * Cloudflare Registrar API.
 * Reference: https://developers.cloudflare.com/api/operations/registrar-domains-list-domains
 *
 * Note: Cloudflare Registrar supports gTLDs (.com, .net, .org, .io, .me, .store, .online, .co)
 * and a growing ccTLD list. Malaysian .my / .com.my require a MYNIC reseller — see ./mynic.ts.
 */

export interface CloudflareDomain {
  id: string;
  name: string;
  available: boolean;
  supported_tld: boolean;
  can_register: boolean;
  transfer_in: {
    unlock_domain: 'ok' | 'needed' | 'unknown';
    disable_privacy: 'ok' | 'needed' | 'unknown';
    enter_auth_code: 'ok' | 'needed' | 'unknown';
    approve_transfer: 'ok' | 'needed' | 'unknown' | 'pending';
    accept_foa: 'ok' | 'needed' | 'unknown';
    status: 'unknown' | 'pending' | 'cancelled' | 'completed';
  };
  current_registrar: string;
  registry_statuses: string;
  locked: boolean;
  auto_renew: boolean;
  privacy: boolean;
  expires_at: string;
  registrant_contact?: ContactInfo;
}

export interface ContactInfo {
  first_name: string;
  last_name: string;
  organization?: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

export interface DomainPricing {
  tld: string;
  registration_price: number;
  renewal_price: number;
  transfer_price: number;
  currency: string;
}

export class RegistrarClient {
  constructor(private readonly client: CloudflareClient) {}

  private base(): string {
    return `/accounts/${this.client.account.id}/registrar/domains`;
  }

  /**
   * Check availability + price for a single domain.
   * Returns null if the TLD is not supported by Cloudflare Registrar.
   */
  async checkAvailability(domain: string): Promise<CloudflareDomain | null> {
    try {
      return await this.client.get<CloudflareDomain>(`${this.base()}/${encodeURIComponent(domain)}`);
    } catch (err) {
      if ((err as { isNotFound?: boolean }).isNotFound) return null;
      throw err;
    }
  }

  /** List all domains in the master account. */
  async list(params: { page?: number; per_page?: number } = {}): Promise<CloudflareDomain[]> {
    return this.client.get<CloudflareDomain[]>(this.base(), { query: params });
  }

  /** Register a new domain via Cloudflare Registrar. */
  async register(input: {
    domain: string;
    years?: number;
    privacy?: boolean;
    auto_renew?: boolean;
    contact: ContactInfo;
  }): Promise<CloudflareDomain> {
    return this.client.post<CloudflareDomain>(`${this.base()}/${encodeURIComponent(input.domain)}`, {
      years: input.years ?? 1,
      privacy: input.privacy ?? true,
      auto_renew: input.auto_renew ?? true,
      registrant_contact: input.contact,
    });
  }

  /** Toggle auto-renew. */
  async setAutoRenew(domain: string, autoRenew: boolean): Promise<CloudflareDomain> {
    return this.client.put<CloudflareDomain>(`${this.base()}/${encodeURIComponent(domain)}`, {
      auto_renew: autoRenew,
    });
  }

  /** Lock or unlock a domain (transfer protection). */
  async setLock(domain: string, locked: boolean): Promise<CloudflareDomain> {
    return this.client.put<CloudflareDomain>(`${this.base()}/${encodeURIComponent(domain)}`, {
      locked,
    });
  }

  /** Toggle WHOIS privacy. */
  async setPrivacy(domain: string, privacy: boolean): Promise<CloudflareDomain> {
    return this.client.put<CloudflareDomain>(`${this.base()}/${encodeURIComponent(domain)}`, {
      privacy,
    });
  }

  /** Initiate a transfer-in. EPP/auth code required for most TLDs. */
  async initiateTransfer(input: {
    domain: string;
    auth_code: string;
    contact: ContactInfo;
  }): Promise<CloudflareDomain> {
    return this.client.post<CloudflareDomain>(
      `${this.base()}/${encodeURIComponent(input.domain)}/transfer`,
      {
        auth_code: input.auth_code,
        registrant_contact: input.contact,
      },
    );
  }

  /** Get current transfer status. */
  async getTransferStatus(domain: string): Promise<CloudflareDomain['transfer_in']> {
    const result = await this.client.get<CloudflareDomain>(
      `${this.base()}/${encodeURIComponent(domain)}`,
    );
    return result.transfer_in;
  }

  /** Update registrant contact info. */
  async updateContact(domain: string, contact: ContactInfo): Promise<CloudflareDomain> {
    return this.client.put<CloudflareDomain>(`${this.base()}/${encodeURIComponent(domain)}`, {
      registrant_contact: contact,
    });
  }

  /** Renew a domain manually (separate from auto-renew). */
  async renew(domain: string, years = 1): Promise<CloudflareDomain> {
    return this.client.post<CloudflareDomain>(
      `${this.base()}/${encodeURIComponent(domain)}/renew`,
      { years },
    );
  }
}
