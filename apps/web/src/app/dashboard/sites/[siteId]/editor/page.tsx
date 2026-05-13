import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError } from '@/lib/api';

export const runtime = 'edge';

/**
 * The "Editor" tab is a shortcut to editing the home page. If no home page
 * exists yet, we surface a small empty state with a CTA to create one.
 */
export default async function EditorEntry({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  try {
    const { pages } = await sitesApi.listPages(params.siteId, { cookie: cookieHeader });
    const home = pages.find((p) => p.is_home) ?? pages[0];
    if (home) {
      redirect(`/dashboard/sites/${params.siteId}/pages/${home.id}/edit`);
    }
  } catch (err) {
    if (!(err instanceof ApiHttpError)) throw err;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-sm text-navy-600">
        <p>No pages on this site yet.</p>
        <a
          href={`/dashboard/sites/${params.siteId}/pages`}
          className="inline-block font-medium text-electric-600 hover:underline"
        >
          Create your first page →
        </a>
      </CardContent>
    </Card>
  );
}
