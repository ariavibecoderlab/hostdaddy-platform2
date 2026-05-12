import Link from 'next/link';
import { Card, CardContent, Button } from '@hostdaddy/ui';

interface SearchParams {
  searchParams: { plan?: string; cycle?: string };
}

export default function CheckoutCancelledPage({ searchParams }: SearchParams) {
  const retryHref = `/checkout?plan=${searchParams.plan ?? ''}&cycle=${searchParams.cycle ?? 'yearly'}`;
  return (
    <div className="min-h-screen bg-navy-50/40">
      <main className="container-page flex min-h-screen items-center justify-center py-12">
        <Card className="max-w-md text-center">
          <CardContent className="space-y-4 p-10">
            <h1 className="font-display text-2xl font-bold text-navy-900">
              Checkout cancelled
            </h1>
            <p className="text-sm text-navy-600">
              No charge made. You can pick up where you left off, or browse plans
              again.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href={retryHref}>
                <Button fullWidth size="lg">
                  Try again
                </Button>
              </Link>
              <Link href="/hosting">
                <Button fullWidth size="lg" variant="ghost">
                  Browse plans
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
