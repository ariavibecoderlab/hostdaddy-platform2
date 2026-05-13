/**
 * /render — public site renderer (Phase A.5).
 *
 *   GET /render/:siteId          → renders the home page (is_home=true)
 *   GET /render/:siteId/:slug    → renders the page with that slug
 *
 * Reads `site_pages.content_json` and walks the section tree, emitting HTML
 * for a small library of known block types (hero / text / features / cta /
 * image / gallery / faq / logo_strip / stats). Unknown block types render
 * as a minimal placeholder so previews never break on malformed JSON.
 *
 * Phase B replaces this with a shared "site Worker" that routes by Host
 * header (Cloudflare for SaaS Custom Hostnames). Until then, the dashboard
 * editor iframe points at this route.
 */

import { Hono } from 'hono';
import { createDb, sites, sitePages, eq, and } from '@hostdaddy/db';
import type { AppBindings } from '../env';

export const renderRoute = new Hono<AppBindings>();

renderRoute.get('/:siteId{[a-zA-Z0-9-]+}/:slug{.*}?', async (c) => {
  const db = createDb(c.env.DB);
  const result = await renderSiteByIdAndSlug(db, c.req.param('siteId'), c.req.param('slug'), {
    publishedOnly: false, // dashboard preview can see drafts
  });
  return c.html(result.html, result.status, result.headers ?? {});
});

/**
 * Shared renderer used by both the dashboard preview route above AND the
 * host-router middleware (for public customer traffic). Decouples the lookup
 * from Hono so it can be called from any middleware context.
 */
export async function renderSiteByIdAndSlug(
  db: ReturnType<typeof createDb>,
  siteId: string,
  slug: string | undefined,
  opts: { publishedOnly?: boolean } = {},
): Promise<{ html: string; status: 200 | 404; headers?: Record<string, string> }> {
  const siteRows = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  const site = siteRows[0];
  if (!site) return { html: notFoundHtml('Site not found'), status: 404 };

  const conditions = slug
    ? [eq(sitePages.site_id, site.id), eq(sitePages.slug, normalizeSlug(slug))]
    : [eq(sitePages.site_id, site.id), eq(sitePages.is_home, true)];
  if (opts.publishedOnly) {
    conditions.push(eq(sitePages.status, 'published'));
  }
  const pageRows = await db
    .select()
    .from(sitePages)
    .where(and(...conditions))
    .limit(1);
  let page = pageRows[0];
  // For public traffic, fall back to the published home page if the requested
  // slug doesn't exist — preserves UX when visitors hit /about on a site that
  // hasn't built that page yet.
  if (!page && slug && opts.publishedOnly) {
    const homeRows = await db
      .select()
      .from(sitePages)
      .where(
        and(
          eq(sitePages.site_id, site.id),
          eq(sitePages.is_home, true),
          eq(sitePages.status, 'published'),
        ),
      )
      .limit(1);
    page = homeRows[0];
  }
  if (!page) return { html: notFoundHtml(`Page not found at /${slug ?? ''}`), status: 404 };

  let tree: SectionTree;
  try {
    tree = JSON.parse(page.content_json || '{"sections":[]}') as SectionTree;
  } catch {
    tree = { sections: [] };
  }

  const html = renderPage({
    siteName: site.name,
    pageTitle: page.title,
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
    seoOgImage: page.seo_og_image,
    sections: Array.isArray(tree.sections) ? tree.sections : [],
  });

  return {
    html,
    status: 200,
    headers: {
      'cache-control': opts.publishedOnly
        ? 'public, max-age=60, s-maxage=300'
        : 'private, no-cache',
    },
  };
}

// ─── Section tree types ──────────────────────────────────────────────────────

interface Section {
  type: string;
  props?: Record<string, unknown>;
}
interface SectionTree {
  sections?: Section[];
}

function normalizeSlug(raw: string): string {
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

// ─── Block renderers ─────────────────────────────────────────────────────────

function getString(props: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const v = props?.[key];
  return typeof v === 'string' ? v : fallback;
}
function getArray<T>(props: Record<string, unknown> | undefined, key: string): T[] {
  const v = props?.[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function renderSection(section: Section): string {
  const props = section.props ?? {};
  switch (section.type) {
    case 'hero':
      return renderHero(props);
    case 'text':
      return renderText(props);
    case 'features':
      return renderFeatures(props);
    case 'cta':
      return renderCta(props);
    case 'image':
      return renderImage(props);
    case 'gallery':
      return renderGallery(props);
    case 'faq':
      return renderFaq(props);
    case 'logo_strip':
      return renderLogoStrip(props);
    case 'stats':
      return renderStats(props);
    case 'footer':
      return renderFooter(props);
    default:
      return `<section class="block block-unknown" data-type="${esc(section.type)}"><div class="container"><p class="muted">Block "${esc(section.type)}" — preview not implemented yet.</p></div></section>`;
  }
}

function renderHero(p: Record<string, unknown>): string {
  const headline = getString(p, 'headline', 'Welcome.');
  const subhead = getString(p, 'subhead');
  const ctaLabel = getString(p, 'cta_label');
  const ctaHref = getString(p, 'cta_href', '#');
  const bgImage = getString(p, 'bg_image');
  const accent = getString(p, 'accent_color') || '#E50914';
  return `
  <section class="block block-hero" style="--accent:${esc(accent)};${
    bgImage ? `background-image:linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.65)),url('${esc(bgImage)}');background-size:cover;background-position:center;` : ''
  }">
    <div class="container">
      <h1>${esc(headline)}</h1>
      ${subhead ? `<p class="lead">${esc(subhead)}</p>` : ''}
      ${ctaLabel ? `<a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>` : ''}
    </div>
  </section>`;
}

function renderText(p: Record<string, unknown>): string {
  const heading = getString(p, 'heading');
  const body = getString(p, 'body');
  return `
  <section class="block block-text">
    <div class="container narrow">
      ${heading ? `<h2>${esc(heading)}</h2>` : ''}
      ${body ? `<div class="prose">${escMultiline(body)}</div>` : ''}
    </div>
  </section>`;
}

function renderFeatures(p: Record<string, unknown>): string {
  const heading = getString(p, 'heading');
  const items = getArray<Record<string, unknown>>(p, 'items');
  const cards = items
    .map(
      (it) => `
      <div class="card">
        <h3>${esc(getString(it, 'title'))}</h3>
        <p>${esc(getString(it, 'body'))}</p>
      </div>`,
    )
    .join('');
  return `
  <section class="block block-features">
    <div class="container">
      ${heading ? `<h2>${esc(heading)}</h2>` : ''}
      <div class="grid">${cards}</div>
    </div>
  </section>`;
}

function renderCta(p: Record<string, unknown>): string {
  const heading = getString(p, 'heading', "Let's build something together.");
  const label = getString(p, 'cta_label', 'Contact');
  const href = getString(p, 'cta_href', '#contact');
  return `
  <section class="block block-cta">
    <div class="container narrow">
      <h2>${esc(heading)}</h2>
      <a class="btn btn-inverse" href="${esc(href)}">${esc(label)}</a>
    </div>
  </section>`;
}

function renderImage(p: Record<string, unknown>): string {
  const src = getString(p, 'src');
  const alt = getString(p, 'alt');
  const caption = getString(p, 'caption');
  if (!src) return '';
  return `
  <section class="block block-image">
    <figure class="container narrow">
      <img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />
      ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}
    </figure>
  </section>`;
}

function renderGallery(p: Record<string, unknown>): string {
  const items = getArray<Record<string, unknown>>(p, 'items');
  const cells = items
    .map(
      (it) =>
        `<a class="gcell" href="${esc(getString(it, 'href') || getString(it, 'src'))}"><img src="${esc(getString(it, 'src'))}" alt="${esc(getString(it, 'alt'))}" loading="lazy"/></a>`,
    )
    .join('');
  return `<section class="block block-gallery"><div class="container"><div class="grid grid-tight">${cells}</div></div></section>`;
}

function renderFaq(p: Record<string, unknown>): string {
  const heading = getString(p, 'heading', 'Frequently asked');
  const items = getArray<Record<string, unknown>>(p, 'items');
  const rows = items
    .map(
      (it) => `
      <details>
        <summary>${esc(getString(it, 'q'))}</summary>
        <p>${esc(getString(it, 'a'))}</p>
      </details>`,
    )
    .join('');
  return `<section class="block block-faq"><div class="container narrow"><h2>${esc(heading)}</h2>${rows}</div></section>`;
}

function renderLogoStrip(p: Record<string, unknown>): string {
  const heading = getString(p, 'heading');
  const items = getArray<Record<string, unknown>>(p, 'items');
  const logos = items
    .map(
      (it) => {
        const src = getString(it, 'src');
        const name = getString(it, 'name');
        if (src) return `<img class="logo" src="${esc(src)}" alt="${esc(name)}" loading="lazy"/>`;
        return `<span class="logo logo-text">${esc(name)}</span>`;
      },
    )
    .join('');
  return `<section class="block block-logos"><div class="container">${heading ? `<p class="muted small">${esc(heading)}</p>` : ''}<div class="logo-row">${logos}</div></div></section>`;
}

function renderStats(p: Record<string, unknown>): string {
  const items = getArray<Record<string, unknown>>(p, 'items');
  const cells = items
    .map(
      (it) => `
      <div class="stat">
        <div class="stat-num">${esc(getString(it, 'value'))}</div>
        <div class="stat-label">${esc(getString(it, 'label'))}</div>
      </div>`,
    )
    .join('');
  return `<section class="block block-stats"><div class="container"><div class="grid">${cells}</div></div></section>`;
}

function renderFooter(p: Record<string, unknown>): string {
  const text = getString(p, 'text', '');
  return `<footer class="block block-footer"><div class="container"><p class="muted small">${esc(text)}</p></div></footer>`;
}

// ─── Page wrapper ────────────────────────────────────────────────────────────

interface PageRenderArgs {
  siteName: string;
  pageTitle: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImage: string | null;
  sections: Section[];
}

function renderPage(a: PageRenderArgs): string {
  const title = a.seoTitle || `${a.pageTitle} — ${a.siteName}`;
  const desc = a.seoDescription || '';
  const og = a.seoOgImage || '';
  const body = a.sections.length
    ? a.sections.map(renderSection).join('\n')
    : `<section class="block block-empty"><div class="container narrow"><p class="muted">This page is empty. Open the builder to add content.</p></div></section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}" />` : ''}
<meta property="og:title" content="${esc(title)}" />
${desc ? `<meta property="og:description" content="${esc(desc)}" />` : ''}
${og ? `<meta property="og:image" content="${esc(og)}" />` : ''}
<meta name="generator" content="HostDaddy" />
<style>${BASE_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Like esc() but preserves line breaks as <br> and double-breaks as <p>. */
function escMultiline(input: string): string {
  const escaped = esc(input);
  const paragraphs = escaped.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`);
  return paragraphs.join('');
}

function notFoundHtml(msg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>404</title><style>${BASE_CSS}</style></head><body><section class="block block-empty"><div class="container narrow"><h1>404</h1><p class="muted">${esc(msg)}</p></div></section></body></html>`;
}

// Minimal first-pass stylesheet. Phase B per-site themes will override.
const BASE_CSS = `
:root { --accent: #E50914; --bg: #fff; --ink: #0a0a0a; --muted: #6b6b6b; --line: #eaeaea; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.5; }
img { max-width: 100%; display: block; }
a { color: var(--accent); text-decoration: none; }
.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.container.narrow { max-width: 760px; }
h1, h2, h3 { font-family: "Playfair Display", Georgia, serif; line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 16px; }
h1 { font-size: clamp(40px, 6vw, 72px); font-weight: 900; }
h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; }
h3 { font-size: 20px; font-weight: 800; }
p { margin: 0 0 14px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.lead { font-size: 18px; color: rgba(0,0,0,0.7); max-width: 640px; margin-bottom: 28px; }
.btn { display: inline-block; padding: 14px 22px; background: var(--accent); color: #fff; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 4px; }
.btn-inverse { background: #0a0a0a; }
.block { padding: 80px 0; }
.block-hero { background: #0a0a0a; color: #fff; padding: 120px 0; }
.block-hero h1 { color: #fff; }
.block-hero .lead { color: rgba(255,255,255,0.8); }
.block-features .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 28px; }
.block-features .card { background: #fafafa; padding: 24px; border-radius: 8px; }
.block-cta { background: var(--accent); color: #fff; text-align: center; }
.block-cta h2 { color: #fff; }
.block-image figure { margin: 0; }
.block-image figcaption { text-align: center; color: var(--muted); font-size: 12px; margin-top: 8px; }
.block-gallery .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
.block-gallery .gcell img { aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; }
.block-faq details { border-top: 1px solid var(--line); padding: 14px 0; }
.block-faq details summary { font-weight: 700; cursor: pointer; }
.block-faq details p { margin-top: 8px; color: var(--muted); }
.block-logos .logo-row { display: flex; flex-wrap: wrap; gap: 28px; align-items: center; justify-content: center; padding-top: 18px; opacity: 0.85; }
.block-logos .logo { max-height: 36px; }
.block-logos .logo-text { font-family: "Playfair Display", serif; font-weight: 800; font-size: 18px; color: var(--muted); }
.block-stats .grid { display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); text-align: center; }
.block-stats .stat-num { font-family: "Playfair Display", serif; font-size: 48px; font-weight: 900; color: var(--accent); line-height: 1; }
.block-stats .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 6px; }
.block-footer { padding: 32px 0; border-top: 1px solid var(--line); }
.block-empty { padding: 160px 0; text-align: center; }
.block-unknown { background: #fff7f7; }
`;
