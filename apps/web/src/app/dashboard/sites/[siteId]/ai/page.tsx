import { cookies } from 'next/headers';
import { Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SitePage } from '@/lib/api';
import { AiChat } from '@/components/dashboard/ai-chat';

export const runtime = 'edge';

export default async function AiAgentPage({ params }: { params: { siteId: string } }) {
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
        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">AI build agent</h2>
          <p className="text-sm text-navy-500">
            Describe what you want changed and the agent edits the site for you.
            Snapshots before mutations — undo any change in one click.
          </p>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : (
        <AiChat siteId={params.siteId} pages={pages} />
      )}
    </div>
  );
}
