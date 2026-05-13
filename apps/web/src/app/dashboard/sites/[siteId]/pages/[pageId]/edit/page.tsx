import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { sitesApi, ApiHttpError } from '@/lib/api';
import { PageEditor } from '@/components/dashboard/page-editor';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export default async function EditPageRoute({
  params,
}: {
  params: { siteId: string; pageId: string };
}) {
  const cookieHeader = cookies().toString();
  try {
    const { page } = await sitesApi.getPage(params.siteId, params.pageId, {
      cookie: cookieHeader,
    });
    return (
      <PageEditor
        siteId={params.siteId}
        initialPage={page}
        previewSrc={`${API_BASE}/render/${params.siteId}/${encodeURIComponent(page.slug.replace(/^\//, ''))}`}
      />
    );
  } catch (err) {
    if (err instanceof ApiHttpError && err.status === 404) notFound();
    throw err;
  }
}
