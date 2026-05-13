'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, Input } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SitePage } from '@/lib/api';

interface Props {
  siteId: string;
  initialPage: SitePage;
  previewSrc: string;
}

export function PageEditor({ siteId, initialPage, previewSrc }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [contentJson, setContentJson] = useState(formatJson(initialPage.content_json));
  const [seoTitle, setSeoTitle] = useState(initialPage.seo_title ?? '');
  const [seoDescription, setSeoDescription] = useState(initialPage.seo_description ?? '');
  const [title, setTitle] = useState(initialPage.title);
  const [slug, setSlug] = useState(initialPage.slug);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const isDirty = useMemo(() => {
    return (
      title !== page.title ||
      slug !== page.slug ||
      seoTitle !== (page.seo_title ?? '') ||
      seoDescription !== (page.seo_description ?? '') ||
      contentJson.trim() !== formatJson(page.content_json).trim()
    );
  }, [title, slug, seoTitle, seoDescription, contentJson, page]);

  // Lightweight client-side JSON validation as the user types.
  useEffect(() => {
    try {
      JSON.parse(contentJson || '{"sections":[]}');
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [contentJson]);

  const save = useCallback(
    async (overrides: Partial<SitePage> = {}) => {
      if (parseError) {
        setSaveError('Fix the JSON parse error before saving.');
        return;
      }
      setSaveError(null);
      setSaving(true);
      try {
        const body: Partial<SitePage> = {
          title,
          slug,
          content_json: contentJson,
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          ...overrides,
        };
        const res = await sitesApi.updatePage(siteId, page.id, body);
        setPage(res.page);
        setContentJson(formatJson(res.page.content_json));
        setLastSavedAt(new Date());
        previewRef.current?.contentWindow?.location.reload();
      } catch (err) {
        setSaveError(err instanceof ApiHttpError ? err.message : 'Save failed.');
      } finally {
        setSaving(false);
      }
    },
    [contentJson, page.id, parseError, seoDescription, seoTitle, siteId, slug, title],
  );

  async function publish() {
    await save({ status: 'published' });
  }
  async function unpublish() {
    await save({ status: 'draft' });
  }

  async function destroy() {
    if (!confirm(`Delete page "${page.title}"? This can't be undone.`)) return;
    try {
      await sitesApi.deletePage(siteId, page.id);
      router.push(`/dashboard/sites/${siteId}/pages`);
    } catch (err) {
      setSaveError(err instanceof ApiHttpError ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold text-navy-900">
            Edit page
          </h2>
          <Badge variant={page.status === 'published' ? 'success' : 'warning'}>
            {page.status}
          </Badge>
          {isDirty ? <span className="text-xs text-navy-500">unsaved changes</span> : null}
          {lastSavedAt ? (
            <span className="text-xs text-navy-400">
              saved {lastSavedAt.toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={destroy}>
            Delete
          </Button>
          {page.status === 'published' ? (
            <Button variant="ghost" onClick={unpublish} disabled={saving}>
              Unpublish
            </Button>
          ) : (
            <Button variant="ghost" onClick={publish} disabled={saving}>
              Publish
            </Button>
          )}
          <Button onClick={() => save()} disabled={saving || !!parseError}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Form column ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-500">
                  Title
                </label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-500">
                  Slug
                </label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                <p className="mt-1 text-xs text-navy-400">
                  Use <code>/</code> for the home page. Otherwise <code>/about</code>,{' '}
                  <code>/blog</code>, etc.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-500">
                  SEO title
                </label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-navy-500">
                  SEO description
                </label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/20"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide text-navy-500">
                  Content JSON
                </label>
                {parseError ? (
                  <span className="text-xs text-red-600">{parseError}</span>
                ) : (
                  <span className="text-xs text-green-600">valid</span>
                )}
              </div>
              <textarea
                value={contentJson}
                onChange={(e) => setContentJson(e.target.value)}
                rows={20}
                spellCheck={false}
                className="block w-full rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 font-mono text-xs text-navy-900 shadow-sm focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/20"
              />
              <p className="text-xs text-navy-400">
                Phase B replaces this textarea with a drag-and-drop block editor. For
                now you can hand-edit the JSON or ask the AI agent to do it for you.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Preview column ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wide text-navy-500">
              Live preview
            </label>
            <button
              type="button"
              onClick={() => previewRef.current?.contentWindow?.location.reload()}
              className="text-xs font-medium text-electric-600 hover:underline"
            >
              Refresh ↻
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-navy-200 bg-white shadow-card">
            <iframe
              ref={previewRef}
              src={previewSrc}
              title="Site preview"
              className="h-[640px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input || '{}'), null, 2);
  } catch {
    return input;
  }
}
