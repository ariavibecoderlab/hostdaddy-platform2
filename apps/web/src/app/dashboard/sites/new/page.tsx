import { cookies } from 'next/headers';
import Link from 'next/link';
import { Card, CardContent } from '@hostdaddy/ui';
import { meApi, ApiHttpError, type HostingPlanSummary } from '@/lib/api';
import { EmptyState } from '@/components/dashboard/empty-state';
import { NewSiteForm } from '@/components/dashboard/new-site-form';

export const runtime = 'edge';

export default async function NewSitePage() {
  const cookieHeader = cookies().toString();
  let plans: HostingPlanSummary[] = [];
  let loadError: string | null = null;
  try {
    const res = await meApi.hostingPlans({ cookie: cookieHeader });
    plans = res.plans;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load hosting plans.';
  }

  const usablePlans = plans.filter((p) => p.status === 'active' || p.status === 'trial');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/sites"
            className="text-xs font-medium text-electric-600 hover:underline"
          >
            ← All sites
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-navy-900">
            New site
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            Spin up a site in seconds. You can edit everything later — name, content,
            domain, theme.
          </p>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : usablePlans.length === 0 ? (
        <EmptyState
          title="No active hosting plan"
          body="You need an active hosting plan before you can create a site. Pick a plan — Starter, Business, or Agency — and we'll wire it up in seconds."
          ctaLabel="Choose a plan"
          ctaHref="/dashboard/hosting"
        />
      ) : (
        <NewSiteForm plans={usablePlans} />
      )}
    </div>
  );
}
