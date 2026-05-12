#!/usr/bin/env tsx
/**
 * One-time setup: create Products + Prices in Stripe for HostDaddy.app.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/seed-stripe.ts
 *
 * Prints a list of env vars to paste into Cloudflare Pages and .env.local.
 * Idempotent — re-running will reuse existing products by `metadata.plan_id`.
 */

import Stripe from 'stripe';

interface PlanSpec {
  id: 'starter' | 'business' | 'agency' | 'bb_franchisee';
  name: string;
  description: string;
  monthlyRm: number;
  yearlyRm: number;
  envPrefix: string;
}

const PLANS: PlanSpec[] = [
  { id: 'starter', name: 'HostDaddy.app · Starter', description: '1 site · 5 GB storage', monthlyRm: 29, yearlyRm: 290, envPrefix: 'STARTER' },
  { id: 'business', name: 'HostDaddy.app · Business', description: '5 sites · 25 GB storage', monthlyRm: 79, yearlyRm: 790, envPrefix: 'BUSINESS' },
  { id: 'agency', name: 'HostDaddy.app · Agency', description: 'Unlimited sites · 100 GB storage', monthlyRm: 199, yearlyRm: 1990, envPrefix: 'AGENCY' },
  { id: 'bb_franchisee', name: 'HostDaddy.app · Brainy Bunch Franchisee', description: '1 school site · 10 GB storage', monthlyRm: 49, yearlyRm: 490, envPrefix: 'BB' },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is required.');
    process.exit(1);
  }
  const stripe = new Stripe(key, { apiVersion: '2024-06-20', typescript: true });

  const envLines: string[] = [];

  for (const plan of PLANS) {
    // Find or create the Product
    const existing = await stripe.products.search({
      query: `metadata['plan_id']:'${plan.id}'`,
    });
    let product = existing.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { plan_id: plan.id },
      });
      console.log(`✓ created product ${plan.name}`);
    } else {
      console.log(`• reusing product ${plan.name}`);
    }

    // Find or create monthly + yearly prices
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

    async function ensurePrice(cycle: 'monthly' | 'yearly', rm: number): Promise<Stripe.Price> {
      const cents = rm * 100;
      const existingPrice = prices.data.find(
        (p) =>
          p.currency === 'myr' &&
          p.unit_amount === cents &&
          p.recurring?.interval === (cycle === 'monthly' ? 'month' : 'year'),
      );
      if (existingPrice) return existingPrice;
      return stripe.prices.create({
        product: product!.id,
        currency: 'myr',
        unit_amount: cents,
        recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
        nickname: `${plan.name} · ${cycle}`,
        metadata: { plan_id: plan.id, cycle },
      });
    }

    const monthly = await ensurePrice('monthly', plan.monthlyRm);
    const yearly = await ensurePrice('yearly', plan.yearlyRm);

    envLines.push(`STRIPE_PRICE_${plan.envPrefix}_MONTHLY=${monthly.id}`);
    envLines.push(`STRIPE_PRICE_${plan.envPrefix}_YEARLY=${yearly.id}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Paste these into .env.local AND Cloudflare Pages env vars:');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(envLines.join('\n'));
  console.log('══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
