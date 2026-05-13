import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { EmptyState } from '@/components/dashboard/empty-state';
import { sitesApi, type SiteSummary, ApiHttpError } from '@/lib/api';

export const runtime = 'edge';

function siteStatusVariant(
  status: SiteSummary['status'],
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'live':
      return 'success';
    case 'building':
    case 'provisioning':
      return 'info';
    case 'paused':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatRelative(value: number | string | null): string {
  if (!value) return '—';
  const ms = typeof value === 'number' ? value * 1000 : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default async function SitesPage() {
  const cookieHeader = cookies().toString();

  let sites: SiteSummary[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.list({ cookie: cookieHeader });
    sites = res.sites;
  } catch (err) {
    loadError =
      err instanceof ApiHttpError
        ? err.message
        : 'Could not load your sites. Try refreshing.';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Sites</h1>
          <p className="mt-1 text-sm text-navy-500">
            Build, edit, and grow every site you host with HostDaddy. Visual builder,
            blog, e-commerce, forms, and AI agent — all on one platform.
          </p>
        </div>
        <Link
          href="/dashboard/sites/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-electric-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-electric-700"
        >
          + New site
        </Link>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : sites.length === 0 ? (
        <EmptyState
          title="No sites yet"
          body="Spin up your first site in under a minute. Pick a template, talk to the AI agent, or start from a blank canvas."
          ctaLabel="Create your first site"
          ctaHref="/dashboard/sites/new"
          secondaryLabel="Browse templates"
          secondaryHref="/templates"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/dashboard/sites/${site.id}`}
              className="block transition-transform hover:-translate-y-0.5"
            >
              <Card className="h-full hover:border-electric-200 hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-semibold text-navy-900">
                        {site.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-navy-500">
                        {site.cf_pages_project}.pages.dev
                      </p>
                    </div>
                    <Badge variant={siteStatusVariant(site.status)}>{site.status}</Badge>
                  </div>

                  <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
                    <CountCell label="Pages" value={site.counts.pages} />
                    <CountCell label="Posts" value={site.counts.posts} />
                    <CountCell label="Shop" value={site.counts.products} />
                    <CountCell label="Contacts" value={site.counts.contacts} />
                  </dl>

                  <p className="mt-4 text-xs text-navy-400">
                    Last deploy: {formatRelative(site.last_deployed_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-navy-50 px-1 py-2">
      <div className="font-display text-base font-bold text-navy-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-navy-500">{label}</div>
    </div>
  );
}
