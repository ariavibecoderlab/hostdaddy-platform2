import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SitePage } from '@/lib/api';

export const runtime = 'edge';

function statusVariant(s: SitePage['status']): 'success' | 'warning' | 'neutral' {
  if (s === 'published') return 'success';
  if (s === 'draft') return 'warning';
  return 'neutral';
}

export default async function PagesIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let pages: SitePage[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listPages(params.siteId, { cookie: cookieHeader });
    pages = res.pages;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load pages.';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-navy-900">Pages</h2>
        <Link
          href={`/dashboard/sites/${params.siteId}/pages/new`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-electric-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-electric-700"
        >
          + New page
        </Link>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No pages yet. Create your first one or ask the AI agent to draft a landing
            page for you.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-navy-100">
              {pages.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {p.is_home ? (
                        <span aria-label="Home page" className="text-electric-500">
                          ★
                        </span>
                      ) : null}
                      <Link
                        href={`/dashboard/sites/${params.siteId}/pages/${p.id}/edit`}
                        className="truncate text-sm font-semibold text-navy-900 hover:underline"
                      >
                        {p.title}
                      </Link>
                    </div>
                    <div className="truncate text-xs text-navy-500">{p.slug}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    <Link
                      href={`/dashboard/sites/${params.siteId}/pages/${p.id}/edit`}
                      className="text-sm font-medium text-electric-600 hover:underline"
                    >
                      Edit →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
