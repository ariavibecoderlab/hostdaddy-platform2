/**
 * /billing and /webhooks — Stripe + Billplz integrations.
 *
 * Endpoints (mounted at `/billing/*` and `/webhooks/*`):
 *   POST  /billing/checkout         → Stripe Checkout Session for cards
 *   POST  /billing/checkout/fpx     → Billplz Bill for FPX/GrabPay/TNG
 *   POST  /billing/portal           → Stripe Customer Portal session
 *   POST  /webhooks/stripe          → Stripe webhook receiver
 *   POST  /webhooks/billplz         → Billplz webhook receiver
 *
 * All webhook handlers are idempotent — re-delivery of the same event is a no-op
 * because we track external event IDs in the `processed_events` table.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { HostDaddyStripe } from '@hostdaddy/stripe';
import {
  createDb,
  customers,
  hostingPlans,
  invoices,
  processedEvents,
  auditLog,
  eq,
} from '@hostdaddy/db';
import { requireAuth } from '../middleware/auth';
import {
  PLANS,
  planById,
  getPriceId,
  type PlanId,
  type BillingCycle,
} from '../lib/stripe-catalog';
import { sendEmail } from '../lib/email';
import { createBillplz, type BillplzWebhookPayload } from '../lib/billplz';
import type { AppBindings } from '../env';

export const billingRoute = new Hono<AppBindings>();
export const webhooksRoute = new Hono<AppBindings>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRm(cents: number): string {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function nextInvoiceNumber(): string {
  // HD-YYYY-XXXXXXX — XXXXXXX is the first 7 hex chars of a UUID.
  const year = new Date().getUTCFullYear();
  const tail = crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase();
  return `HD-${year}-${tail}`;
}

async function alreadyProcessed(
  db: ReturnType<typeof createDb>,
  eventId: string,
): Promise<boolean> {
  const rows = await db.select().from(processedEvents).where(eq(processedEvents.id, eventId)).limit(1);
  return rows.length > 0;
}

async function markProcessed(
  db: ReturnType<typeof createDb>,
  input: { id: string; provider: 'stripe' | 'billplz'; eventType: string },
) {
  await db.insert(processedEvents).values({
    id: input.id,
    provider: input.provider,
    event_type: input.eventType,
  });
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const planSchema = z.enum(['starter', 'business', 'agency', 'bb_franchisee']);
const cycleSchema = z.enum(['monthly', 'yearly']);
const checkoutSchema = z.object({ plan: planSchema, cycle: cycleSchema });

// ─── POST /billing/checkout ──────────────────────────────────────────────────

billingRoute.post('/checkout', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { plan, cycle } = parsed.data;
  const priceId = getPriceId(c.env as unknown as Record<string, string | undefined>, plan, cycle);
  if (!priceId) {
    return c.json({ error: `Stripe price not configured for ${plan}/${cycle}` }, 503);
  }

  const stripe = new HostDaddyStripe({ secretKey: c.env.STRIPE_SECRET_KEY });
  const db = createDb(c.env.DB);

  // Make sure the Stripe customer exists and is linked.
  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer) return c.json({ error: 'Account not found' }, 404);

  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const created = await stripe.upsertCustomer({
      email: customer.email,
      name: customer.name,
      phone: customer.phone ?? undefined,
      metadata: { customerId: customer.id },
    });
    stripeCustomerId = created.id;
    await db.update(customers).set({ stripe_customer_id: stripeCustomerId, updated_at: new Date() }).where(eq(customers.id, customer.id));
  }

  const session = await stripe.createCheckoutSession({
    customerId: stripeCustomerId,
    mode: 'subscription',
    lineItems: [{ priceId, quantity: 1 }],
    successUrl: `${c.env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${c.env.APP_URL}/checkout/cancelled?plan=${plan}&cycle=${cycle}`,
    metadata: {
      customerId: customer.id,
      plan,
      cycle,
    },
    collectTax: true,
  });

  if (!session.url) {
    return c.json({ error: 'Stripe did not return a checkout URL' }, 502);
  }
  return c.json({ url: session.url });
});

// ─── POST /billing/portal ────────────────────────────────────────────────────

billingRoute.post('/portal', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const stripe = new HostDaddyStripe({ secretKey: c.env.STRIPE_SECRET_KEY });
  const db = createDb(c.env.DB);
  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer || !customer.stripe_customer_id) {
    return c.json({ error: 'No Stripe customer yet — buy a plan first' }, 400);
  }
  const session = await stripe.createCustomerPortalSession({
    customerId: customer.stripe_customer_id,
    returnUrl: `${c.env.APP_URL}/dashboard/billing`,
  });
  return c.json({ url: session.url });
});

// ─── POST /billing/checkout/fpx (Billplz) ────────────────────────────────────

billingRoute.post('/checkout/fpx', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const { plan, cycle } = parsed.data;
  const descriptor = planById(plan);
  if (!descriptor) return c.json({ error: 'Unknown plan' }, 400);
  if (!c.env.BILLPLZ_COLLECTION_ID) {
    return c.json({ error: 'Billplz collection not configured' }, 503);
  }

  const db = createDb(c.env.DB);
  const rows = await db.select().from(customers).where(eq(customers.id, user.customerId)).limit(1);
  const customer = rows[0];
  if (!customer) return c.json({ error: 'Account not found' }, 404);

  const amountMyrCents = (descriptor[cycle].rm) * 100;
  const billplz = createBillplz({
    apiKey: c.env.BILLPLZ_API_KEY,
    xSignatureKey: c.env.BILLPLZ_X_SIGNATURE_KEY,
    baseUrl: c.env.BILLPLZ_BASE_URL,
  });

  const callbackUrl = `${c.env.APP_URL.replace(/\/$/, '')}/api-callback/billplz`;
  // Note: callback hits the Worker via a separate route we expose to webhooks.

  const bill = await billplz.createBill({
    collectionId: c.env.BILLPLZ_COLLECTION_ID,
    email: customer.email,
    name: customer.name,
    amount: amountMyrCents,
    description: `HostDaddy.app · ${descriptor.name} (${cycle})`,
    callbackUrl: `${c.env.APP_URL.replace(/\/$/, '')}/webhooks/billplz`,
    redirectUrl: `${c.env.APP_URL}/checkout/success?bill_id=${''}`,
    reference1Label: 'customer_id',
    reference1: customer.id,
    reference2Label: 'plan',
    reference2: `${plan}:${cycle}`,
  });

  return c.json({ url: bill.url, billId: bill.id });
});

// ─── POST /webhooks/stripe ───────────────────────────────────────────────────

webhooksRoute.post('/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'Missing signature' }, 400);
  const rawBody = await c.req.text();

  const stripe = new HostDaddyStripe({
    secretKey: c.env.STRIPE_SECRET_KEY,
    webhookSecret: c.env.STRIPE_WEBHOOK_SECRET,
  });

  let event: ReturnType<HostDaddyStripe['constructEvent']>;
  try {
    event = stripe.constructEvent(rawBody, signature);
  } catch (err) {
    console.error('[stripe-webhook] signature verify failed', err);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = createDb(c.env.DB);
  if (await alreadyProcessed(db, event.id)) {
    return c.json({ ok: true, idempotent: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        customer: string;
        subscription: string | null;
        amount_total: number;
        metadata: Record<string, string>;
        payment_intent?: string;
        invoice?: string;
      };
      const customerId = session.metadata?.customerId;
      const plan = session.metadata?.plan as PlanId | undefined;
      const cycle = session.metadata?.cycle as BillingCycle | undefined;
      const descriptor = plan ? planById(plan) : undefined;
      if (customerId && plan && cycle && descriptor) {
        const sst = Math.round(session.amount_total * (8 / 108));
        const subtotal = session.amount_total - sst;
        const invoiceId = crypto.randomUUID();
        await db.insert(invoices).values({
          id: invoiceId,
          customer_id: customerId,
          invoice_number: nextInvoiceNumber(),
          description: `${descriptor.name} · ${cycle}`,
          subtotal_cents: subtotal,
          sst_cents: sst,
          total_cents: session.amount_total,
          currency: 'MYR',
          status: 'paid',
          payment_provider: 'stripe',
          stripe_invoice_id: session.invoice ?? null,
          paid_at: new Date(),
        });

        await db.insert(hostingPlans).values({
          id: crypto.randomUUID(),
          customer_id: customerId,
          plan_type: plan,
          sites_limit: descriptor.sitesLimit,
          storage_gb: descriptor.storageGb,
          billing_cycle: cycle,
          status: 'active',
          price_cents: descriptor[cycle].rm * 100,
          started_at: new Date(),
          stripe_subscription_id: session.subscription,
        });

        // Send receipt email (fire-and-forget).
        const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        const customer = rows[0];
        if (customer) {
          c.executionCtx?.waitUntil(
            sendEmail(c.env, {
              to: customer.email,
              template: 'receipt',
              data: {
                name: customer.name,
                invoiceNumber: nextInvoiceNumber(),
                description: `${descriptor.name} · ${cycle}`,
                amountRm: formatRm(session.amount_total),
                paidAt: new Date().toISOString().slice(0, 10),
              },
            }).catch((err) => console.error('[email:receipt] failed', err)),
          );
        }

        await db.insert(auditLog).values({
          id: crypto.randomUUID(),
          customer_id: customerId,
          actor: 'system',
          action: 'billing.checkout.completed',
          entity_type: 'hosting_plan',
          entity_id: invoiceId,
          metadata: JSON.stringify({ plan, cycle, amountCents: session.amount_total }),
        });
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string; status: string };
      const status = sub.status === 'canceled' ? 'cancelled' : sub.status === 'past_due' ? 'past_due' : 'active';
      await db
        .update(hostingPlans)
        .set({ status: status as 'active' | 'past_due' | 'cancelled' | 'trial', updated_at: new Date() })
        .where(eq(hostingPlans.stripe_subscription_id, sub.id));
      break;
    }
    case 'invoice.payment_failed': {
      // Update plan status; surface in dashboard.
      const inv = event.data.object as { subscription?: string };
      if (inv.subscription) {
        await db.update(hostingPlans).set({ status: 'past_due', updated_at: new Date() }).where(eq(hostingPlans.stripe_subscription_id, inv.subscription));
      }
      break;
    }
    default:
      // unhandled event types are still marked processed to avoid retries
      break;
  }

  await markProcessed(db, { id: event.id, provider: 'stripe', eventType: event.type });
  return c.json({ ok: true });
});

// ─── POST /webhooks/billplz ──────────────────────────────────────────────────

webhooksRoute.post('/billplz', async (c) => {
  const billplz = createBillplz({
    apiKey: c.env.BILLPLZ_API_KEY,
    xSignatureKey: c.env.BILLPLZ_X_SIGNATURE_KEY,
    baseUrl: c.env.BILLPLZ_BASE_URL,
  });

  const contentType = c.req.header('content-type') ?? '';
  let payload: BillplzWebhookPayload;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await c.req.formData();
    payload = Object.fromEntries(form.entries()) as unknown as BillplzWebhookPayload;
  } else {
    payload = (await c.req.json()) as BillplzWebhookPayload;
  }

  if (!(await billplz.verifyWebhookSignature(payload))) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = createDb(c.env.DB);
  if (await alreadyProcessed(db, `billplz:${payload.id}`)) {
    return c.json({ ok: true, idempotent: true });
  }

  if (payload.paid === 'true' || payload.paid === true) {
    const customerId = payload.reference_1;
    const planCycle = (payload.reference_2 ?? '').split(':');
    const plan = planCycle[0] as PlanId | undefined;
    const cycle = planCycle[1] as BillingCycle | undefined;
    const descriptor = plan ? planById(plan) : undefined;
    if (customerId && plan && cycle && descriptor) {
      const totalCents = Number(payload.amount);
      const sst = Math.round(totalCents * (8 / 108));
      const subtotal = totalCents - sst;
      const invoiceId = crypto.randomUUID();
      await db.insert(invoices).values({
        id: invoiceId,
        customer_id: customerId,
        invoice_number: nextInvoiceNumber(),
        description: `${descriptor.name} · ${cycle}`,
        subtotal_cents: subtotal,
        sst_cents: sst,
        total_cents: totalCents,
        currency: 'MYR',
        status: 'paid',
        payment_provider: 'billplz',
        billplz_bill_id: payload.id,
        paid_at: new Date(),
      });
      await db.insert(hostingPlans).values({
        id: crypto.randomUUID(),
        customer_id: customerId,
        plan_type: plan,
        sites_limit: descriptor.sitesLimit,
        storage_gb: descriptor.storageGb,
        billing_cycle: cycle,
        status: 'active',
        price_cents: descriptor[cycle].rm * 100,
        started_at: new Date(),
      });

      const rows = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      const customer = rows[0];
      if (customer) {
        c.executionCtx?.waitUntil(
          sendEmail(c.env, {
            to: customer.email,
            template: 'receipt',
            data: {
              name: customer.name,
              invoiceNumber: nextInvoiceNumber(),
              description: `${descriptor.name} · ${cycle}`,
              amountRm: formatRm(totalCents),
              paidAt: new Date().toISOString().slice(0, 10),
            },
          }).catch((err) => console.error('[email:receipt] failed', err)),
        );
      }
    }
  }

  await markProcessed(db, {
    id: `billplz:${payload.id}`,
    provider: 'billplz',
    eventType: 'bill.paid',
  });
  return c.json({ ok: true });
});

/**
 * GET /billing/plans
 * Public: returns the plan catalogue so the marketing site can fetch fresh
 * pricing instead of hardcoding it in three places.
 */
billingRoute.get('/plans', (c) =>
  c.json({
    plans: PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sitesLimit: p.sitesLimit,
      storageGb: p.storageGb,
      monthlyRm: p.monthly.rm,
      yearlyRm: p.yearly.rm,
    })),
  }),
);
