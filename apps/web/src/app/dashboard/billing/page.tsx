import Link from 'next/link';
import { Card, CardContent, Button } from '@hostdaddy/ui';
import { EmptyState } from '@/components/dashboard/empty-state';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Billing
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Invoices, subscriptions, and your payment method.
        </p>
      </div>

      <EmptyState
        title="No invoices yet"
        body="Once you pick a hosting plan or register a domain, your invoices and subscription will live here. Manage your card and download tax invoices anytime."
        ctaLabel="Choose a plan"
        ctaHref="/hosting"
      />

      <Card>
        <CardContent className="flex flex-col items-start gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-navy-900">
              Manage payment method
            </h3>
            <p className="mt-1 max-w-md text-sm text-navy-600">
              Update your card, switch to FPX, or cancel a subscription in the
              Stripe Customer Portal.
            </p>
          </div>
          <Link href="/dashboard/billing/portal">
            <Button variant="outline">Open billing portal</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
