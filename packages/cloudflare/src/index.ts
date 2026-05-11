/**
 * @hostdaddy/cloudflare — typed wrapper for the Cloudflare API.
 *
 * Usage:
 *   import { createCloudflare } from '@hostdaddy/cloudflare';
 *   const cf = createCloudflare({ accountId, apiToken });
 *   const zone = await cf.dns.findZoneByName('customer.com');
 *   await cf.dns.createRecord(zone.id, { type: 'A', name: '@', content: '1.2.3.4' });
 */

import { CloudflareClient } from './client.js';
import { RegistrarClient } from './registrar.js';
import { DnsClient } from './dns.js';
import { PagesClient } from './pages.js';
import { EmailRoutingClient } from './email.js';
import { MynicClient, type MynicConfig } from './mynic.js';
import type { CloudflareConfig } from './types.js';

export interface HostDaddyCloudflare {
  client: CloudflareClient;
  registrar: RegistrarClient;
  dns: DnsClient;
  pages: PagesClient;
  email: EmailRoutingClient;
  mynic?: MynicClient;
}

export interface CreateCloudflareInput extends CloudflareConfig {
  /** Optional MYNIC reseller for .my / .com.my domains. */
  mynic?: MynicConfig;
}

export function createCloudflare(input: CreateCloudflareInput): HostDaddyCloudflare {
  const client = new CloudflareClient(input);
  return {
    client,
    registrar: new RegistrarClient(client),
    dns: new DnsClient(client),
    pages: new PagesClient(client),
    email: new EmailRoutingClient(client),
    mynic: input.mynic ? new MynicClient(input.mynic) : undefined,
  };
}

// Re-export types and individual clients for callers who want them.
export { CloudflareClient } from './client.js';
export { RegistrarClient } from './registrar.js';
export { DnsClient } from './dns.js';
export { PagesClient } from './pages.js';
export { EmailRoutingClient } from './email.js';
export { MynicClient } from './mynic.js';
export {
  CloudflareApiError,
  type CloudflareConfig,
  type CloudflareApiResponse,
  type CloudflareError,
} from './types.js';
export type {
  CloudflareDomain,
  ContactInfo,
  DomainPricing,
} from './registrar.js';
export type {
  DnsZone,
  DnsRecord,
  DnsRecordType,
  CreateDnsRecordInput,
} from './dns.js';
export type {
  PagesProject,
  PagesDeployment,
  PagesDomain,
  PagesDeploymentConfig,
} from './pages.js';
export type {
  EmailRoutingSettings,
  EmailRoutingAddress,
  EmailRoutingRule,
  EmailMatcher,
  EmailAction,
} from './email.js';
export type { MynicConfig, MynicDomainStatus } from './mynic.js';

/**
 * Helper: list of TLDs supported by Cloudflare Registrar (Stage 1).
 * Pricing in RM, mirrors Section 3.1 of the build spec.
 */
export const SUPPORTED_TLDS = [
  { tld: 'com', price_rm: 49, renewal_rm: 49, registrar: 'cloudflare' as const },
  { tld: 'net', price_rm: 55, renewal_rm: 55, registrar: 'cloudflare' as const },
  { tld: 'org', price_rm: 52, renewal_rm: 52, registrar: 'cloudflare' as const },
  { tld: 'co', price_rm: 129, renewal_rm: 129, registrar: 'cloudflare' as const },
  { tld: 'io', price_rm: 169, renewal_rm: 169, registrar: 'cloudflare' as const },
  { tld: 'me', price_rm: 79, renewal_rm: 79, registrar: 'cloudflare' as const },
  { tld: 'store', price_rm: 19, renewal_rm: 19, registrar: 'cloudflare' as const },
  { tld: 'online', price_rm: 9, renewal_rm: 39, registrar: 'cloudflare' as const },
  { tld: 'my', price_rm: 69, renewal_rm: 69, registrar: 'mynic' as const },
  { tld: 'com.my', price_rm: 49, renewal_rm: 49, registrar: 'mynic' as const },
] as const;

export type SupportedTld = (typeof SUPPORTED_TLDS)[number]['tld'];
