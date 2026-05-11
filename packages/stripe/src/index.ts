/**
 * @hostdaddy/stripe — billing wrapper.
 *
 * Wired up in Phase 2 once auth + dashboard exist. Stripe handles cards
 * (international); Billplz handles FPX/GrabPay/TNG (local Malaysia).
 */

import Stripe from 'stripe';

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
  /** Override for tests. */
  apiVersion?: Stripe.LatestApiVersion;
}

export interface CreateCheckoutInput {
  customerId?: string;
  customerEmail?: string;
  /** Stripe Price IDs (annual or monthly subscription). */
  lineItems: Array<{ priceId: string; quantity?: number }>;
  /** Where to send the customer after success/cancel. */
  successUrl: string;
  cancelUrl: string;
  /** Mode: 'subscription' for hosting plans, 'payment' for one-off domain registrations. */
  mode: 'subscription' | 'payment';
  /** Custom metadata stored on the resulting checkout session + invoice. */
  metadata?: Record<string, string>;
  /** Optional 8% SST line — Stripe Tax handles this if enabled. */
  collectTax?: boolean;
}

export class HostDaddyStripe {
  public readonly stripe: Stripe;
  private readonly webhookSecret?: string;

  constructor(config: StripeConfig) {
    if (!config.secretKey) throw new Error('HostDaddyStripe: secretKey is required');
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: config.apiVersion ?? '2024-06-20',
      typescript: true,
    });
    this.webhookSecret = config.webhookSecret;
  }

  /** Create or fetch a Stripe customer record for a HostDaddy customer. */
  async upsertCustomer(input: {
    email: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const existing = await this.stripe.customers.list({ email: input.email, limit: 1 });
    if (existing.data[0]) {
      return existing.data[0];
    }
    return this.stripe.customers.create({
      email: input.email,
      name: input.name,
      phone: input.phone,
      metadata: input.metadata,
    });
  }

  /** Create a checkout session. */
  async createCheckoutSession(input: CreateCheckoutInput): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      customer: input.customerId,
      customer_email: input.customerId ? undefined : input.customerEmail,
      mode: input.mode,
      line_items: input.lineItems.map((li) => ({
        price: li.priceId,
        quantity: li.quantity ?? 1,
      })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      automatic_tax: input.collectTax ? { enabled: true } : undefined,
      metadata: input.metadata,
      allow_promotion_codes: true,
    });
  }

  /** Create a Customer Portal session so users can manage card / cancel themselves. */
  async createCustomerPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
  }

  /**
   * Verify a webhook signature.
   * Pass the raw request body (NOT the parsed JSON) and the Stripe-Signature header.
   */
  constructEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new Error('HostDaddyStripe: webhookSecret not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  /** Refund an invoice — used by admin panel and customer-initiated refunds. */
  async refund(input: {
    paymentIntentId: string;
    amountCents?: number; // partial refund support
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  }): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: input.paymentIntentId,
      amount: input.amountCents,
      reason: input.reason,
    });
  }
}

export type { Stripe };
