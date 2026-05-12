import type { CloudflareClient } from './client';

/**
 * Cloudflare Email Routing API.
 * Reference: https://developers.cloudflare.com/api/operations/email-routing-routing-rules-list-routing-rules
 *
 * Provides free email forwarding (info@customer.com → personal@gmail.com).
 * For full mailboxes, customers upgrade to Zoho or Google Workspace.
 */

export interface EmailRoutingSettings {
  enabled: boolean;
  name: string;
  tag: string;
  status: 'ready' | 'unconfigured' | 'misconfigured';
  created: string;
  modified: string;
}

export interface EmailRoutingAddress {
  id: string;
  tag: string;
  email: string;
  verified: string | null;
  created: string;
  modified: string;
}

export interface EmailRoutingRule {
  id: string;
  tag: string;
  name: string;
  priority: number;
  enabled: boolean;
  matchers: EmailMatcher[];
  actions: EmailAction[];
}

export type EmailMatcher =
  | { type: 'literal'; field: 'to'; value: string }
  | { type: 'all' };

export type EmailAction =
  | { type: 'forward'; value: string[] }
  | { type: 'worker'; value: string[] }
  | { type: 'drop' };

export class EmailRoutingClient {
  constructor(private readonly client: CloudflareClient) {}

  // ─── Zone-level settings ───────────────────────────────────────────────────

  async getSettings(zoneId: string): Promise<EmailRoutingSettings> {
    return this.client.get<EmailRoutingSettings>(`/zones/${zoneId}/email/routing`);
  }

  /** Enable Email Routing for a zone (provisions MX + TXT records). */
  async enable(zoneId: string): Promise<EmailRoutingSettings> {
    return this.client.post<EmailRoutingSettings>(`/zones/${zoneId}/email/routing/enable`);
  }

  async disable(zoneId: string): Promise<EmailRoutingSettings> {
    return this.client.post<EmailRoutingSettings>(`/zones/${zoneId}/email/routing/disable`);
  }

  /** DNS records that must exist for routing to work. */
  async getDnsRecords(zoneId: string): Promise<Array<{ type: string; name: string; content: string; priority?: number }>> {
    return this.client.get<Array<{ type: string; name: string; content: string; priority?: number }>>(
      `/zones/${zoneId}/email/routing/dns`,
    );
  }

  // ─── Destination addresses (account-scoped) ────────────────────────────────

  async listDestinationAddresses(): Promise<EmailRoutingAddress[]> {
    return this.client.get<EmailRoutingAddress[]>(
      `/accounts/${this.client.account.id}/email/routing/addresses`,
    );
  }

  /** Add a destination address. Cloudflare will email a verification link. */
  async createDestinationAddress(email: string): Promise<EmailRoutingAddress> {
    return this.client.post<EmailRoutingAddress>(
      `/accounts/${this.client.account.id}/email/routing/addresses`,
      { email },
    );
  }

  async deleteDestinationAddress(addressId: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(
      `/accounts/${this.client.account.id}/email/routing/addresses/${addressId}`,
    );
  }

  // ─── Routing rules (zone-scoped) ──────────────────────────────────────────

  async listRules(zoneId: string): Promise<EmailRoutingRule[]> {
    return this.client.get<EmailRoutingRule[]>(`/zones/${zoneId}/email/routing/rules`);
  }

  /**
   * Create a forwarding rule:
   *   info@customer.com → [personal@gmail.com]
   */
  async createForwardingRule(
    zoneId: string,
    input: { name: string; from: string; to: string[]; enabled?: boolean; priority?: number },
  ): Promise<EmailRoutingRule> {
    return this.client.post<EmailRoutingRule>(`/zones/${zoneId}/email/routing/rules`, {
      name: input.name,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 0,
      matchers: [{ type: 'literal', field: 'to', value: input.from }],
      actions: [{ type: 'forward', value: input.to }],
    });
  }

  async updateRule(
    zoneId: string,
    ruleId: string,
    patch: Partial<EmailRoutingRule>,
  ): Promise<EmailRoutingRule> {
    return this.client.put<EmailRoutingRule>(
      `/zones/${zoneId}/email/routing/rules/${ruleId}`,
      patch,
    );
  }

  async deleteRule(zoneId: string, ruleId: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(
      `/zones/${zoneId}/email/routing/rules/${ruleId}`,
    );
  }
}
