import Link from 'next/link';
import { Card, CardContent, Button } from '@hostdaddy/ui';

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-navy-50/40">
      <main className="container-page flex min-h-screen items-center justify-center py-12">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-4 p-10">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-display text-2xl font-bold text-navy-900">
              Payment received
            </h1>
            <p className="text-sm text-navy-600">
              Thanks — your subscription is now active. We&apos;ve emailed you a
              receipt. You can manage your plan and download invoices from the
              billing tab anytime.
            </p>
            <Link href="/dashboard" className="block">
              <Button fullWidth size="lg">
                Go to dashboard
              </Button>
            </Link>
            <Link
              href="/dashboard/billing"
              className="block text-sm font-medium text-electric-600 hover:text-electric-700"
            >
              View billing
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
