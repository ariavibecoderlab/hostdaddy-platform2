import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@hostdaddy/ui';
import { getSession } from '@/lib/auth';
import { planById, formatRm, type BillingCycle, type PlanId } from '@/lib/plans';
import { CheckoutActions } from './checkout-actions';

export const runtime = 'edge';

interface SearchParams {
  searchParams: { plan?: string; cycle?: string };
}

export default async function CheckoutPage({ searchParams }: SearchParams) {
  const user = await getSession();
  if (!user) {
    const next = `/checkout?plan=${searchParams.plan ?? ''}&cycle=${searchParams.cycle ?? ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const plan = planById(searchParams.plan ?? '');
  const cycle: BillingCycle = searchParams.cycle === 'monthly' ? 'monthly' : 'yearly';
  if (!plan) redirect('/hosting');

  const subtotal = cycle === 'monthly' ? plan.monthlyRm : plan.yearlyRm;
  const sst = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + sst;
  const yearlySavings = cycle === 'yearly' ? plan.monthlyRm * 12 - plan.yearlyRm : 0;

  return (
    <div className="min-h-screen bg-navy-50/40">
      <header className="border-b border-navy-100 bg-white">
        <div className="container-page flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-base font-semibold text-navy-900">
            <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500" aria-hidden />
            HostDaddy<span className="text-electric-500">.app</span>
          </Link>
          <Link href="/hosting" className="text-sm text-navy-600 hover:text-navy-900">
            ← Back to plans
          </Link>
        </div>
      </header>

      <main className="container-page py-12">
        <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h1 className="font-display text-2xl font-bold text-navy-900">
              Confirm your order
            </h1>
            <p className="mt-1 text-sm text-navy-500">
              Pay with card via Stripe, or with FPX / GrabPay / TNG via Billplz.
            </p>

            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-navy-500">
                      Plan
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold text-navy-900">
                      {plan.name}
                    </h2>
                    <p className="mt-1 text-sm text-navy-600">{plan.description}</p>
                  </div>
                  <span className="rounded-full bg-electric-50 px-3 py-1 text-xs font-medium text-electric-700">
                    {cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                  </span>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-navy-700">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        ✓
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <p className="mt-4 text-xs text-navy-500">
              Subscriptions renew automatically. Cancel anytime in your dashboard.
              7-day refund window on hosting. Domains are non-refundable once registered.
            </p>
          </div>

          <div className="lg:col-span-2">
            <Card className="lg:sticky lg:top-6">
              <CardContent className="space-y-3 p-6 text-sm">
                <h2 className="font-display text-lg font-semibold text-navy-900">
                  Order summary
                </h2>
                <div className="flex justify-between text-navy-700">
                  <span>
                    {plan.name} · {cycle}
                  </span>
                  <span>{formatRm(subtotal)}</span>
                </div>
                {yearlySavings > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Yearly savings</span>
                    <span>− {formatRm(yearlySavings)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-navy-700">
                  <span>SST (8%)</span>
                  <span>RM {sst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-navy-100 pt-3 text-base font-semibold text-navy-900">
                  <span>Total today</span>
                  <span>RM {total.toFixed(2)}</span>
                </div>

                <CheckoutActions plan={plan.id as PlanId} cycle={cycle} />

                <p className="pt-1 text-center text-xs text-navy-500">
                  Secure payment. We never store your card details.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
