/**
 * Stripe product catalogue.
 *
 * Price IDs are injected via environment variables so we can use distinct
 * IDs in test mode vs live mode without redeploying. Run
 *   pnpm tsx scripts/seed-stripe.ts
 * once to create the Products + Prices in Stripe; the script prints the IDs
 * to paste into Cloudflare Pages env vars.
 */

export type PlanId = 'starter' | 'business' | 'agency' | 'bb_franchisee';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanDescriptor {
  id: PlanId;
  name: string;
  description: string;
  sitesLimit: number; // -1 = unlimited
  storageGb: number;
  monthly: { rm: number; envVar: string };
  yearly: { rm: number; envVar: string };
}

export const PLANS: ReadonlyArray<PlanDescriptor> = [
  {
    id: 'starter',
    name: 'Starter',
    description: '1 site · 5 GB · for solopreneurs and side projects.',
    sitesLimit: 1,
    storageGb: 5,
    monthly: { rm: 29, envVar: 'STRIPE_PRICE_STARTER_MONTHLY' },
    yearly: { rm: 290, envVar: 'STRIPE_PRICE_STARTER_YEARLY' },
  },
  {
    id: 'business',
    name: 'Business',
    description: '5 sites · 25 GB · AI website builder included.',
    sitesLimit: 5,
    storageGb: 25,
    monthly: { rm: 79, envVar: 'STRIPE_PRICE_BUSINESS_MONTHLY' },
    yearly: { rm: 790, envVar: 'STRIPE_PRICE_BUSINESS_YEARLY' },
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Unlimited sites · 100 GB · reseller dashboard.',
    sitesLimit: -1,
    storageGb: 100,
    monthly: { rm: 199, envVar: 'STRIPE_PRICE_AGENCY_MONTHLY' },
    yearly: { rm: 1990, envVar: 'STRIPE_PRICE_AGENCY_YEARLY' },
  },
  {
    id: 'bb_franchisee',
    name: 'Brainy Bunch franchisee',
    description: '1 school site · 10 GB · franchise rate.',
    sitesLimit: 1,
    storageGb: 10,
    monthly: { rm: 49, envVar: 'STRIPE_PRICE_BB_MONTHLY' },
    yearly: { rm: 490, envVar: 'STRIPE_PRICE_BB_YEARLY' },
  },
];

export function planById(id: PlanId): PlanDescriptor | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Look up the Stripe Price ID for a given plan + cycle from env. */
export function getPriceId(
  env: Record<string, string | undefined>,
  plan: PlanId,
  cycle: BillingCycle,
): string | undefined {
  const descriptor = planById(plan);
  if (!descriptor) return undefined;
  const envVar = descriptor[cycle].envVar;
  return env[envVar];
}
