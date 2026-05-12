/**
 * Plan catalogue mirrored in the frontend so server components can render
 * pricing without a network round-trip. Keep in sync with
 * apps/workers/src/lib/stripe-catalog.ts.
 */

export type PlanId = 'starter' | 'business' | 'agency' | 'bb_franchisee';
export type BillingCycle = 'monthly' | 'yearly';

export interface PlanDescriptor {
  id: PlanId;
  name: string;
  description: string;
  sitesLimit: number;
  storageGb: number;
  monthlyRm: number;
  yearlyRm: number;
  highlights: string[];
}

export const PLANS: ReadonlyArray<PlanDescriptor> = [
  {
    id: 'starter',
    name: 'Starter',
    description: '1 site · 5 GB · for solopreneurs and side projects.',
    sitesLimit: 1,
    storageGb: 5,
    monthlyRm: 29,
    yearlyRm: 290,
    highlights: [
      'Free SSL + Cloudflare CDN',
      'DDoS protection',
      'Email forwarding (5 addresses)',
      '1-click Cowork Claude deployment',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: '5 sites · 25 GB · AI website builder included.',
    sitesLimit: 5,
    storageGb: 25,
    monthlyRm: 79,
    yearlyRm: 790,
    highlights: [
      'Everything in Starter',
      'AI website builder (Stage 2)',
      'Priority support',
      'Domain forwarding manager',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'Unlimited sites · 100 GB · reseller dashboard.',
    sitesLimit: -1,
    storageGb: 100,
    monthlyRm: 199,
    yearlyRm: 1990,
    highlights: [
      'Everything in Business',
      'Reseller dashboard',
      'White-label customer view',
      '20% recurring referral commission',
    ],
  },
  {
    id: 'bb_franchisee',
    name: 'Brainy Bunch franchisee',
    description: '1 school site · 10 GB · franchise rate.',
    sitesLimit: 1,
    storageGb: 10,
    monthlyRm: 49,
    yearlyRm: 490,
    highlights: [
      'Brainy Bunch standard template',
      'English + Bahasa Malaysia toggle',
      'SEO-optimised for local search',
      'CMS for school-side updates',
    ],
  },
];

export function planById(id: string): PlanDescriptor | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatRm(rm: number): string {
  return `RM ${rm.toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;
}
