import Link from 'next/link';
import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SitePost } from '@/lib/api';

export const runtime = 'edge';

function variant(s: SitePost['status']): 'success' | 'warning' | 'info' | 'neutral' {
  if (s === 'published') return 'success';
  if (s === 'scheduled') return 'info';
  if (s === 'draft') return 'warning';
  return 'neutral';
}

function fmtDate(value: number | string | null): string {
  if (!value) return '—';
  const ms = typeof value === 'number' ? value * 1000 : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString();
}

export default async function BlogIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let posts: SitePost[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listPosts(params.siteId, { cookie: cookieHeader });
    posts = res.posts;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load posts.';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-navy-900">Blog</h2>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/sites/${params.siteId}/ai`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-medium text-navy-700 hover:bg-navy-50"
          >
            Draft with AI
          </Link>
          <button
            type="button"
            disabled
            title="Phase B"
            className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md bg-navy-200 px-4 text-sm font-medium text-navy-500"
          >
            + New post
          </button>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No posts yet. Ask the AI agent to draft a few in your voice, then publish
            the ones you like.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Author</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Published</th>
                  <th className="px-4 py-2 text-right">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-navy-900">{p.title}</div>
                      <div className="text-xs text-navy-500">/{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-navy-600">{p.author_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={variant(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-navy-500">{fmtDate(p.published_at)}</td>
                    <td className="px-4 py-3 text-right text-navy-700">{p.view_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
