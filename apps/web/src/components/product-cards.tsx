import Link from 'next/link';
import { Card, CardContent } from '@hostdaddy/ui';

const PRODUCTS = [
  {
    title: 'Domains',
    description: 'Register .com, .my, and 8 more TLDs at fair prices. No upsell tricks.',
    priceFrom: 'RM 9',
    priceLabel: 'first year',
    href: '/domains' as const,
    cta: 'Search domains',
  },
  {
    title: 'Hosting',
    description: 'Cloudflare Pages-powered hosting. Free SSL, global CDN, instant deploys.',
    priceFrom: 'RM 29',
    priceLabel: 'per month',
    href: '/hosting' as const,
    cta: 'View plans',
  },
  {
    title: 'Email',
    description: 'Free forwarding included. Upgrade to full mailboxes when you grow.',
    priceFrom: 'Free',
    priceLabel: 'with any plan',
    href: '/email' as const,
    cta: 'Set up email',
  },
];

export function ProductCards() {
  return (
    <section className="bg-navy-50/40 py-20">
      <div className="container-page">
        <h2 className="heading-section text-center">Everything your business needs online.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-navy-500">
          One dashboard. One bill. One trusted partner — built for Muslim entrepreneurs and Malaysian SMEs.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRODUCTS.map((p) => (
            <Card key={p.title} className="transition-shadow hover:shadow-glow">
              <CardContent className="flex flex-col gap-4 p-6 pt-6">
                <h3 className="font-display text-xl font-semibold text-navy-900">{p.title}</h3>
                <p className="text-sm text-navy-600">{p.description}</p>
                <div className="mt-auto flex items-end gap-1">
                  <span className="font-display text-2xl font-bold text-navy-900">{p.priceFrom}</span>
                  <span className="pb-0.5 text-sm text-navy-500">/ {p.priceLabel}</span>
                </div>
                <Link
                  href={p.href}
                  className="mt-2 text-sm font-semibold text-electric-600 hover:text-electric-700"
                >
                  {p.cta} →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
