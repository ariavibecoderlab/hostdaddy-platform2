/**
 * MYNIC reseller wrapper (.my and .com.my domains).
 *
 * Cloudflare Registrar does not support .my TLDs, so we route through
 * a MYNIC-accredited reseller. Default integration: Exabytes Reseller API.
 *
 * This file is a stub — real endpoints/auth depend on the reseller agreement
 * (see HOSTDADDY_ACCOUNT_SETUP.md §8). Fill in once Exabytes reseller is signed.
 */

export interface MynicConfig {
  apiKey: string;
  resellerId: string;
  baseUrl?: string; // override per environment
  fetch?: typeof fetch;
}

export interface MynicDomainStatus {
  domain: string;
  available: boolean;
  price_myr: number;
  registrar: 'mynic-reseller';
}

export class MynicClient {
  private readonly apiKey: string;
  private readonly resellerId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: MynicConfig) {
    if (!config.apiKey) throw new Error('MynicClient: apiKey is required');
    if (!config.resellerId) throw new Error('MynicClient: resellerId is required');
    this.apiKey = config.apiKey;
    this.resellerId = config.resellerId;
    this.baseUrl = (config.baseUrl ?? 'https://api.exabytes.my/v1').replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  /** TODO: replace with the real Exabytes endpoint once contract is signed. */
  async checkAvailability(domain: string): Promise<MynicDomainStatus> {
    throw new Error(
      `MynicClient.checkAvailability not yet implemented. Sign the Exabytes reseller agreement (see HOSTDADDY_ACCOUNT_SETUP.md §8), then wire up the real endpoint. Domain: ${domain}, reseller: ${this.resellerId}, baseUrl: ${this.baseUrl}, fetch: ${typeof this.fetchImpl}`,
    );
  }

  async register(_input: {
    domain: string;
    years: number;
    contact: {
      name: string;
      ic_number: string; // Malaysian NRIC required for .my
      address: string;
      city: string;
      postcode: string;
      state: string;
      phone: string;
      email: string;
    };
  }): Promise<MynicDomainStatus> {
    throw new Error(
      `MynicClient.register not yet implemented. Reseller: ${this.resellerId}. ` +
        `API key length: ${this.apiKey.length} (auth header to be defined per Exabytes spec).`,
    );
  }
}
