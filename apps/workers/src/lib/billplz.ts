/**
 * Billplz API client.
 *
 * Billplz is Malaysia's FPX / DuitNow / e-wallet (GrabPay, TNG) aggregator.
 * Auth: HTTP Basic with API key as username, empty password.
 * Webhook auth: HMAC-SHA256 over sorted form fields, sent as `x_signature` field.
 */

const DEFAULT_BASE_URL = 'https://www.billplz.com/api/v3';

export interface BillplzConfig {
  apiKey: string;
  xSignatureKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface CreateBillInput {
  collectionId: string;
  email: string;
  name: string;
  /** Amount in MYR sen (cents). */
  amount: number;
  description: string;
  callbackUrl: string;
  redirectUrl?: string;
  reference1Label?: string;
  reference1?: string;
  reference2Label?: string;
  reference2?: string;
}

export interface BillplzBill {
  id: string;
  collection_id: string;
  paid: boolean;
  state: 'due' | 'paid' | 'deleted';
  amount: number;
  paid_amount: number;
  due_at: string | null;
  email: string;
  mobile: string | null;
  name: string;
  url: string;
  reference_1_label?: string;
  reference_1?: string;
  reference_2_label?: string;
  reference_2?: string;
  description: string;
  redirect_url?: string;
  callback_url: string;
}

export interface BillplzWebhookPayload {
  id: string;
  collection_id: string;
  paid: 'true' | 'false' | boolean;
  state: string;
  amount: string;
  paid_amount: string;
  email: string;
  name: string;
  reference_1?: string;
  reference_2?: string;
  paid_at?: string;
  x_signature: string;
  [k: string]: unknown;
}

export class BillplzClient {
  private readonly apiKey: string;
  private readonly xSignatureKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: BillplzConfig) {
    if (!config.apiKey) throw new Error('BillplzClient: apiKey is required');
    if (!config.xSignatureKey) throw new Error('BillplzClient: xSignatureKey is required');
    this.apiKey = config.apiKey;
    this.xSignatureKey = config.xSignatureKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  private authHeader(): string {
    return 'Basic ' + btoa(`${this.apiKey}:`);
  }

  async createBill(input: CreateBillInput): Promise<BillplzBill> {
    const body = new URLSearchParams({
      collection_id: input.collectionId,
      email: input.email,
      name: input.name,
      amount: String(input.amount),
      description: input.description,
      callback_url: input.callbackUrl,
    });
    if (input.redirectUrl) body.append('redirect_url', input.redirectUrl);
    if (input.reference1Label) body.append('reference_1_label', input.reference1Label);
    if (input.reference1) body.append('reference_1', input.reference1);
    if (input.reference2Label) body.append('reference_2_label', input.reference2Label);
    if (input.reference2) body.append('reference_2', input.reference2);

    const res = await this.fetchImpl(`${this.baseUrl}/bills`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Billplz createBill failed (${res.status}): ${errBody}`);
    }
    return (await res.json()) as BillplzBill;
  }

  async getBill(billId: string): Promise<BillplzBill> {
    const res = await this.fetchImpl(`${this.baseUrl}/bills/${billId}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (!res.ok) {
      throw new Error(`Billplz getBill failed (${res.status})`);
    }
    return (await res.json()) as BillplzBill;
  }

  /**
   * Verify a webhook payload's `x_signature`. Billplz sorts the remaining
   * form fields by key, concatenates `key|value` separated by `|`, and
   * HMAC-SHA256s the result with the X-Signature Key.
   */
  async verifyWebhookSignature(payload: BillplzWebhookPayload): Promise<boolean> {
    const { x_signature, ...rest } = payload;
    if (typeof x_signature !== 'string') return false;
    const keys = Object.keys(rest).sort();
    const source = keys
      .map((k) => `${k}${stringify(rest[k as keyof typeof rest])}`)
      .join('|');
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(this.xSignatureKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(source));
    const computedHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (computedHex.length !== x_signature.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ x_signature.charCodeAt(i);
    }
    return diff === 0;
  }
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function createBillplz(config: BillplzConfig): BillplzClient {
  return new BillplzClient(config);
}
