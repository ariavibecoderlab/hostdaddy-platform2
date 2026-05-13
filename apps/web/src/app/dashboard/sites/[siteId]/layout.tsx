import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { Badge } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError } from '@/lib/api';
import { SiteTabs } from '@/components/dashboard/site-tabs';

export const runtime = 'edge';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  live: 'success',
  building: 'info',
  provisioning: 'info',
  paused: 'warning',
  error: 'danger',
};

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { siteId: string };
}) {
  const cookieHeader = cookies().toString();
  let siteName = 'Site';
  let status: keyof typeof STATUS_VARIANT | string = 'unknown';
  let cfProject: string | null = null;

  try {
    const res = await sitesApi.get(params.siteId, { cookie: cookieHeader });
    siteName = res.site.name;
    status = res.site.status;
    cfProject = res.site.cf_pages_project;
  } catch (err) {
    if (err instanceof ApiHttpError && err.status === 404) notFound();
    // For other errors, fall through and render with placeholder header.
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-navy-100 pb-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/sites"
            className="text-xs font-medium text-electric-600 hover:underline"
          >
            ← All sites
          </Link>
          <h1 className="mt-1 truncate font-display text-2xl font-bold text-navy-900">
            {siteName}
          </h1>
          <p className="mt-0.5 text-sm text-navy-500">
            {cfProject ? `${cfProject}.pages.dev` : 'No deployment yet'} ·{' '}
            <Badge variant={STATUS_VARIANT[status] ?? 'neutral'}>{status}</Badge>
          </p>
        </div>
        {cfProject ? (
          <a
            href={`https://${cfProject}.pages.dev`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-medium text-navy-700 shadow-sm transition-colors hover:bg-navy-50"
          >
            View live ↗
          </a>
        ) : null}
      </header>
      <SiteTabs siteId={params.siteId} />
      {children}
    </div>
  );
}
