import type { CloudflareClient } from './client';

/**
 * Cloudflare DNS API.
 * Reference: https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-list-dns-records
 */

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'SRV'
  | 'CAA'
  | 'PTR'
  | 'SOA';

export interface DnsZone {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated';
  paused: boolean;
  type: 'full' | 'partial' | 'secondary';
  development_mode: number;
  name_servers: string[];
  original_name_servers: string[] | null;
  created_on: string;
  modified_on: string;
  account: { id: string; name: string };
}

export interface DnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: DnsRecordType;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  comment?: string;
  tags?: string[];
  created_on: string;
  modified_on: string;
}

export interface CreateDnsRecordInput {
  type: DnsRecordType;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
  tags?: string[];
}

export class DnsClient {
  constructor(private readonly client: CloudflareClient) {}

  // ─── Zones ─────────────────────────────────────────────────────────────────

  /** Create a new DNS zone (when a customer adds a domain not registered with us). */
  async createZone(name: string, jumpStart = false): Promise<DnsZone> {
    return this.client.post<DnsZone>('/zones', {
      name,
      account: { id: this.client.account.id },
      type: 'full',
      jump_start: jumpStart,
    });
  }

  /** List all zones in the master account. */
  async listZones(params: { name?: string; page?: number; per_page?: number } = {}): Promise<DnsZone[]> {
    return this.client.get<DnsZone[]>('/zones', { query: params });
  }

  /** Get a single zone by ID. */
  async getZone(zoneId: string): Promise<DnsZone> {
    return this.client.get<DnsZone>(`/zones/${zoneId}`);
  }

  /** Find a zone by domain name (returns null if not found). */
  async findZoneByName(name: string): Promise<DnsZone | null> {
    const results = await this.listZones({ name, per_page: 1 });
    return results[0] ?? null;
  }

  /** Delete a zone. Use with caution — this removes all DNS records. */
  async deleteZone(zoneId: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(`/zones/${zoneId}`);
  }

  // ─── Records ───────────────────────────────────────────────────────────────

  /** List DNS records for a zone, with optional filters. */
  async listRecords(
    zoneId: string,
    params: {
      type?: DnsRecordType;
      name?: string;
      content?: string;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<DnsRecord[]> {
    return this.client.get<DnsRecord[]>(`/zones/${zoneId}/dns_records`, { query: params });
  }

  /** Create a single DNS record. */
  async createRecord(zoneId: string, input: CreateDnsRecordInput): Promise<DnsRecord> {
    return this.client.post<DnsRecord>(`/zones/${zoneId}/dns_records`, {
      ttl: 1, // 1 = automatic
      proxied: false,
      ...input,
    });
  }

  /** Patch (partial update) an existing record. */
  async updateRecord(
    zoneId: string,
    recordId: string,
    patch: Partial<CreateDnsRecordInput>,
  ): Promise<DnsRecord> {
    return this.client.patch<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, patch);
  }

  /** Delete a record. */
  async deleteRecord(zoneId: string, recordId: string): Promise<{ id: string }> {
    return this.client.delete<{ id: string }>(`/zones/${zoneId}/dns_records/${recordId}`);
  }

  /** Bulk create — useful when provisioning a customer's initial DNS set. */
  async createMany(zoneId: string, records: CreateDnsRecordInput[]): Promise<DnsRecord[]> {
    const results: DnsRecord[] = [];
    for (const record of records) {
      results.push(await this.createRecord(zoneId, record));
    }
    return results;
  }
}
