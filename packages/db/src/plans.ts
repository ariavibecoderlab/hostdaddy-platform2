/**
 * HostDaddy.app — Pricing plan catalog.
 *
 * Single source of truth for plan definitions. The runtime `hosting_plans`
 * table stores per-customer *subscription instances*; this file defines the
 * abstract plans those instances reference via `plan_type`.
 *
 * Money is always integer MYR cents in the DB. USD shown for international
 * customers (Stripe). Cents are the internal unit so we never lose precision.
 *
 * Bismillah — every plan designed to be halal-friendly and accessible to
 * Muslim entrepreneurs first, then the wider ummah.
 */

export type PlanType = 'starter' | 'business' | 'agency' | 'bb_franchisee';

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  /** Sites the customer can publish. -1 = unlimited. */
  sites: number;
  /** Storage in GB across all sites (D1 rows + R2 assets). -1 = unlimited. */
  storage_gb: number;
  /** Pages per site. -1 = unlimited. */
  pages_per_site: number;
  /** AI generations per month (page builds, copy rewrites, image generations). */
  ai_credits_monthly: number;
  /** Email forwards (Cloudflare Email Routing rules). */
  email_forwards: number;
  /** Custom domains the customer can attach via CF for SaaS. */
  custom_domains: number;
  /** Team-member seats (for Agency / Brainy Bunch). */
  team_seats: number;
  /** Bandwidth in GB / month (soft limit, monitored). */
  bandwidth_gb_monthly: number;
}

export interface PlanFeatures {
  white_label: boolean;
  remove_branding: boolean;
  priority_support: boolean;
  sla: boolean;
  api_access: boolean;
  custom_ai_training: boolean;
  multi_tenant: boolean;
  ecommerce_zero_fees: boolean;
}

export interface PlanCostBasis {
  /** What we estimate paying Cloudflare per active subscriber (cents/month). */
  cloudflare_cents_per_month: number;
  /** Variable AI inference cost per credit (cents). */
  ai_cost_cents_per_credit: number;
}

export interface PlanPrice {
  myr_cents: number;
  usd_cents: number;
}

export interface PlanDefinition {
  type: PlanType;
  /** Short customer-facing name. */
  name: string;
  /** One-line elevator pitch for the pricing page. */
  tagline: string;
  /** ~120-char description that fits in a card. */
  description: string;
  /** Cycle → price. */
  prices: Record<BillingCycle, PlanPrice>;
  limits: PlanLimits;
  features: PlanFeatures;
  cost_basis: PlanCostBasis;
  /** Display order on pricing page (lower first). */
  display_order: number;
  /** Recommended plan (highlight on pricing page). */
  recommended: boolean;
  /** Whether this plan is visible to self-serve signups. BB is gated. */
  visible: boolean;
  /** Stripe Price IDs (one per cycle). Populated at deploy time. */
  stripe_price_ids: Partial<Record<BillingCycle, string>>;
}

// ─── Plan definitions ────────────────────────────────────────────────────────
// Pricing math is documented in HOSTDADDY_PRICING.md. TL;DR:
//   - Cost per customer ≤ 15% of MRR → 85%+ gross margin
//   - Yearly = 10x monthly (i.e. 2 months free → standard SaaS incentive)
//   - MYR primary, USD pegged at ~4.2:1 rounded to clean numbers

export const PLANS: PlanDefinition[] = [
  {
    type: 'starter',
    name: 'Starter',
    tagline: 'Free, forever — get online today',
    description:
      'Perfect for personal projects, students, and trying HostDaddy.app risk-free. One site, one custom domain, AI-powered builder.',
    prices: {
      monthly: { myr_cents: 0, usd_cents: 0 },
      yearly: { myr_cents: 0, usd_cents: 0 },
    },
    limits: {
      sites: 1,
      storage_gb: 1,
      pages_per_site: 5,
      ai_credits_monthly: 20,
      email_forwards: 5,
      custom_domains: 1,
      team_seats: 1,
      bandwidth_gb_monthly: 10,
    },
    features: {
      white_label: false,
      remove_branding: false,
      priority_support: false,
      sla: false,
      api_access: false,
      custom_ai_training: false,
      multi_tenant: false,
      ecommerce_zero_fees: false,
    },
    cost_basis: {
      cloudflare_cents_per_month: 0, // entirely on CF free tier
      ai_cost_cents_per_credit: 1,
    },
    display_order: 1,
    recommended: false,
    visible: true,
    stripe_price_ids: {},
  },
  {
    type: 'business',
    name: 'Business',
    tagline: 'For serious solopreneurs and small businesses',
    description:
      'Five sites, unlimited AI generations, no HostDaddy branding, priority email support, integrated CRM and email marketing. The plan most Muslim entrepreneurs need.',
    prices: {
      monthly: { myr_cents: 4900, usd_cents: 1200 }, // RM49 / $12
      yearly: { myr_cents: 49000, usd_cents: 12000 }, // RM490 / $120 (2 months free)
    },
    limits: {
      sites: 5,
      storage_gb: 25,
      pages_per_site: -1,
      ai_credits_monthly: 500,
      email_forwards: 50,
      custom_domains: 5,
      team_seats: 3,
      bandwidth_gb_monthly: 100,
    },
    features: {
      white_label: false,
      remove_branding: true,
      priority_support: true,
      sla: false,
      api_access: false,
      custom_ai_training: false,
      multi_tenant: false,
      ecommerce_zero_fees: true,
    },
    cost_basis: {
      cloudflare_cents_per_month: 500, // ~RM5 worth of CF Pro + usage
      ai_cost_cents_per_credit: 1,
    },
    display_order: 2,
    recommended: true,
    visible: true,
    stripe_price_ids: {},
  },
  {
    type: 'agency',
    name: 'Agency',
    tagline: 'White-label HostDaddy.app for your clients',
    description:
      'Twenty-five sites, team seats, white-label option, API access, and custom AI training. For consultancies, design agencies, and Muslim entrepreneurs serving multiple clients.',
    prices: {
      monthly: { myr_cents: 19900, usd_cents: 4900 }, // RM199 / $49
      yearly: { myr_cents: 199000, usd_cents: 49000 }, // RM1990 / $490
    },
    limits: {
      sites: 25,
      storage_gb: 100,
      pages_per_site: -1,
      ai_credits_monthly: 3000,
      email_forwards: 250,
      custom_domains: 25,
      team_seats: 10,
      bandwidth_gb_monthly: 500,
    },
    features: {
      white_label: true,
      remove_branding: true,
      priority_support: true,
      sla: false,
      api_access: true,
      custom_ai_training: true,
      multi_tenant: false,
      ecommerce_zero_fees: true,
    },
    cost_basis: {
      cloudflare_cents_per_month: 2500, // ~RM25 worth of CF + storage
      ai_cost_cents_per_credit: 1,
    },
    display_order: 3,
    recommended: false,
    visible: true,
    stripe_price_ids: {},
  },
  {
    type: 'bb_franchisee',
    name: 'Brainy Bunch / Enterprise',
    tagline: 'Multi-tenant for franchise networks and Islamic schools',
    description:
      'Unlimited sites, multi-tenant master accounts, dedicated SLA, on-call support, custom integrations. Built for Brainy Bunch’s 130 schools and any organisation managing a network of sites.',
    prices: {
      monthly: { myr_cents: 49900, usd_cents: 11900 }, // RM499 / $119
      yearly: { myr_cents: 499000, usd_cents: 119000 }, // RM4990 / $1190
    },
    limits: {
      sites: -1,
      storage_gb: -1,
      pages_per_site: -1,
      ai_credits_monthly: 25000,
      email_forwards: -1,
      custom_domains: -1,
      team_seats: 50,
      bandwidth_gb_monthly: -1,
    },
    features: {
      white_label: true,
      remove_branding: true,
      priority_support: true,
      sla: true,
      api_access: true,
      custom_ai_training: true,
      multi_tenant: true,
      ecommerce_zero_fees: true,
    },
    cost_basis: {
      cloudflare_cents_per_month: 6000, // ~RM60 worth of CF Enterprise-ish workload
      ai_cost_cents_per_credit: 1,
    },
    display_order: 4,
    recommended: false,
    visible: false, // sales-led, gated by franchise_code or admin invite
    stripe_price_ids: {},
  },
];

const PLAN_BY_TYPE = new Map<PlanType, PlanDefinition>(PLANS.map((p) => [p.type, p]));

export function getPlan(type: PlanType): PlanDefinition {
  const plan = PLAN_BY_TYPE.get(type);
  if (!plan) throw new Error(`Unknown plan type: ${type}`);
  return plan;
}

export function getPlanPriceCents(
  type: PlanType,
  cycle: BillingCycle,
  currency: 'MYR' | 'USD' = 'MYR',
): number {
  const price = getPlan(type).prices[cycle];
  return currency === 'MYR' ? price.myr_cents : price.usd_cents;
}

/**
 * Check whether a plan covers a usage measurement.
 * Returns null if within limit, or a string explaining the breach.
 */
export function checkLimit(
  type: PlanType,
  metric: keyof PlanLimits,
  used: number,
): string | null {
  const limit = getPlan(type).limits[metric];
  if (limit === -1) return null; // unlimited
  if (used > limit) {
    return `Your ${getPlan(type).name} plan allows ${limit} ${metric.replace(/_/g, ' ')}; you have ${used}.`;
  }
  return null;
}

/**
 * For a Stripe price ID, find the plan + cycle.
 * Used by the Stripe webhook to map a paid subscription to a plan_type.
 */
export function findPlanByStripePrice(
  priceId: string,
): { plan: PlanDefinition; cycle: BillingCycle } | null {
  for (const plan of PLANS) {
    for (const [cycle, id] of Object.entries(plan.stripe_price_ids)) {
      if (id === priceId) return { plan, cycle: cycle as BillingCycle };
    }
  }
  return null;
}

/** Inject Stripe price IDs at boot time from env vars (Worker side). */
export function bindStripePriceIds(env: Record<string, string | undefined>): void {
  const map: Record<PlanType, Partial<Record<BillingCycle, string>>> = {
    starter: {
      monthly: env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: env.STRIPE_PRICE_STARTER_YEARLY,
    },
    business: {
      monthly: env.STRIPE_PRICE_BUSINESS_MONTHLY,
      yearly: env.STRIPE_PRICE_BUSINESS_YEARLY,
    },
    agency: {
      monthly: env.STRIPE_PRICE_AGENCY_MONTHLY,
      yearly: env.STRIPE_PRICE_AGENCY_YEARLY,
    },
    bb_franchisee: {
      monthly: env.STRIPE_PRICE_BB_MONTHLY,
      yearly: env.STRIPE_PRICE_BB_YEARLY,
    },
  };
  for (const plan of PLANS) {
    const ids = map[plan.type];
    plan.stripe_price_ids = {
      ...(ids.monthly ? { monthly: ids.monthly } : {}),
      ...(ids.yearly ? { yearly: ids.yearly } : {}),
    };
  }
}

// ─── Helpers for the pricing page ────────────────────────────────────────────

/** Visible plans sorted for the pricing page. */
export function listVisiblePlans(): PlanDefinition[] {
  return PLANS.filter((p) => p.visible).sort((a, b) => a.display_order - b.display_order);
}

/** All plans including hidden (admin). */
export function listAllPlans(): PlanDefinition[] {
  return [...PLANS].sort((a, b) => a.display_order - b.display_order);
}

/** Format an integer cents value as a localised string. */
export function formatPrice(cents: number, currency: 'MYR' | 'USD'): string {
  if (cents === 0) return currency === 'MYR' ? 'Free' : 'Free';
  const major = (cents / 100).toFixed(0);
  return currency === 'MYR' ? `RM${major}` : `$${major}`;
}
