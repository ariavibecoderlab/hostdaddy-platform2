'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent } from '@hostdaddy/ui';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 29,
    yearly: 290,
    sites: '1 site',
    storage: '5 GB storage',
    features: [
      'Free SSL + CDN',
      'Cloudflare DDoS protection',
      'Email forwarding (5 addresses)',
      '1-click Cowork Claude deployment',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 79,
    yearly: 790,
    sites: '5 sites',
    storage: '25 GB storage',
    popular: true,
    features: [
      'Everything in Starter',
      'AI website builder (Stage 2)',
      'Priority support',
      'Domain forwarding manager',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthly: 199,
    yearly: 1990,
    sites: 'Unlimited sites',
    storage: '100 GB storage',
    features: [
      'Everything in Business',
      'Reseller dashboard',
      'White-label customer view',
      '20% recurring referral commission',
    ],
  },
];

export function PricingPlans() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <section id="pricing" className="bg-white py-20">
      <div className="container-page">
        <div className="text-center">
          <h2 className="heading-section">Simple hosting. Honest pricing.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-navy-500">
            Pay annually and get two months free. No surprise renewal hikes — ever.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-navy-100 p-1 text-sm font-medium">
            <button
              onClick={() => setCycle('monthly')}
              className={[
                'rounded-full px-4 py-1.5 transition-colors',
                cycle === 'monthly' ? 'bg-white text-navy-900 shadow' : 'text-navy-600',
              ].join(' ')}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={[
                'inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors',
                cycle === 'yearly' ? 'bg-white text-navy-900 shadow' : 'text-navy-600',
              ].join(' ')}
            >
              Yearly <Badge variant="success">Save 17%</Badge>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.id}
              className={[
                'relative flex flex-col',
                p.popular ? 'border-electric-500 shadow-glow' : '',
              ].join(' ')}
            >
              {p.popular ? (
                <Badge
                  variant="electric"
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                >
                  Most popular
                </Badge>
              ) : null}
              <CardContent className="flex flex-1 flex-col gap-4 p-6 pt-8">
                <div>
                  <h3 className="font-display text-2xl font-semibold text-navy-900">{p.name}</h3>
                  <p className="mt-1 text-sm text-navy-500">
                    {p.sites} · {p.storage}
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-navy-900">
                    RM {cycle === 'monthly' ? p.monthly : Math.round(p.yearly / 12)}
                  </span>
                  <span className="text-sm text-navy-500">/ mo</span>
                </div>
                {cycle === 'yearly' ? (
                  <p className="-mt-2 text-xs text-emerald-600">
                    Billed RM {p.yearly}/yr (save RM {p.monthly * 12 - p.yearly})
                  </p>
                ) : null}

                <ul className="mt-2 space-y-2 text-sm text-navy-700">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-electric-100 text-electric-700">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={{ pathname: '/register', query: { plan: p.id } }}
                  className="mt-6"
                >
                  <Button variant={p.popular ? 'primary' : 'outline'} fullWidth>
                    Choose {p.name}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
