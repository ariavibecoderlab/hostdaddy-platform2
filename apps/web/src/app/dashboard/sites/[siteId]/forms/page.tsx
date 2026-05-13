import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SiteForm } from '@/lib/api';

export const runtime = 'edge';

export default async function FormsIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let forms: SiteForm[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listForms(params.siteId, { cookie: cookieHeader });
    forms = res.forms;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load forms.';
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-navy-900">Forms</h2>
        <button
          type="button"
          disabled
          title="Drag-and-drop form builder ships in Phase B"
          className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md bg-navy-200 px-4 text-sm font-medium text-navy-500"
        >
          + New form
        </button>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No forms yet. The seed script creates a sample contact form — re-run it
            from the terminal to populate this view.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-navy-100">
              {forms.map((f) => {
                let fields: unknown[] = [];
                try {
                  fields = JSON.parse(f.fields_json || '[]');
                } catch {
                  /* ignore */
                }
                return (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-navy-900">{f.name}</div>
                      <div className="text-xs text-navy-500">
                        /{f.slug} · {fields.length} field{fields.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-navy-500">
                        {f.submission_count} submission{f.submission_count === 1 ? '' : 's'}
                      </span>
                      <Badge variant={f.is_active ? 'success' : 'neutral'}>
                        {f.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
