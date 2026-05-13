# Phase A — Sites module scaffold

Goal: turn `hostdaddy.app` from "domain reseller + hosting" into "domain reseller + hosting + AI website builder" by absorbing the prototype as a first-class module of the platform. Phase A ships the **schema, API, public renderer scaffold, and a navigable dashboard** for every Sites-module surface.

Status: **shipped, typecheck-clean across all 6 packages.**

---

## TL;DR — what to do tomorrow

```bash
cd ~/Documents/Claude/Projects/hostdaddy.app
bash scripts/setup-sites-module.sh
```

That one command:
1. Runs `pnpm install` (picks up `@anthropic-ai/sdk`)
2. Applies D1 migrations locally + (with confirmation) remotely
3. Creates the `hostdaddy-assets` R2 bucket
4. Lists the new secrets you should set
5. Optionally seeds a sample site so your dashboard isn't empty

Then:

```bash
pnpm --filter @hostdaddy/workers dev   # API on :8787
pnpm --filter @hostdaddy/web dev       # Dashboard on :5173
```

Open `http://localhost:5173/dashboard/sites`.

---

## What landed in this session

### 1. Database (`@hostdaddy/db`)

`packages/db/src/sites-content.ts` (re-exported from `schema.ts`):

| Table | Purpose |
|---|---|
| `site_pages` | Editable pages with JSON content tree, per-page SEO, home-page flag |
| `site_media` | Media library (R2 references, alt text, AI captions, folder organization) |
| `site_posts` | Blog with markdown source, cached HTML, drafts/scheduled/published |
| `site_forms` | Form definitions (fields_json, settings_json, Turnstile flag) |
| `site_form_submissions` | Immutable submission log, IP/UA, contact dedupe link |
| `site_contacts` | Per-site CRM, unique (site_id, email), tags, LTV, order count |
| `site_products` | Catalog: physical / digital / service / subscription, MYR cents, variants |
| `site_orders` | End-customer orders (separate from `invoices` which bills the hostdaddy customer) |
| `site_discounts` | Discount codes: percent / fixed / free shipping |
| `site_email_campaigns` | Campaigns with open/click/bounce/unsubscribe counters |
| `site_email_automations` | Welcome / abandoned-cart / win-back / birthday triggers |
| `site_chat_conversations` | Visitor AI chat transcripts, captured emails, resolutions |
| `site_versions` | Page snapshots for one-click undo |
| `site_ai_runs` | AI agent audit log (prompt, tool calls, tokens, cost, model) |

Migrations:
- `0001_sites_content.sql` — all the tables above
- `0002_cf_for_saas.sql` — adds `custom_hostname`, `cf_hostname_id`, `ssl_status`, `verification_record_*`, `provisioned_at` to `sites` (BYO-domain via Cloudflare for SaaS Custom Hostnames)

### 2. Workers API (`apps/workers`)

`apps/workers/src/routes/sites.ts`:

| Method | Path | Notes |
|---|---|---|
| GET | `/sites` | List your sites with content counts |
| POST | `/sites` | **NEW** — create a site (default home page included) |
| GET | `/sites/:siteId` | Site detail |
| DELETE | `/sites/:siteId` | **NEW** — cascade-deletes all content |
| GET / POST | `/sites/:siteId/pages` | List / create |
| GET / PATCH / DELETE | `/sites/:siteId/pages/:pageId` | Home-page demotion built in |
| GET / POST / PATCH / DELETE | `/sites/:siteId/posts[/:postId]` | Blog CRUD |
| GET / POST / PATCH / DELETE | `/sites/:siteId/forms[/:formId]` | Form CRUD |
| GET / POST / PATCH / DELETE | `/sites/:siteId/contacts[/:contactId]` | CRM CRUD |
| GET / POST / PATCH / DELETE | `/sites/:siteId/products[/:productId]` | Catalog CRUD |
| GET | `/sites/:siteId/orders` | Read-only (sales worker writes in Phase F) |
| POST | `/sites/:siteId/forms/:slug/submit` | **PUBLIC** — Turnstile-aware, contacts dedupe |
| GET | `/sites/:siteId/submissions` | |
| GET / POST / DELETE | `/sites/:siteId/media[/:mediaId]` | **NEW** — R2-backed media library, 25 MB cap, MIME allow-list |
| GET | `/sites/:siteId/r2/*` | **NEW** — dev proxy when `MEDIA_PUBLIC_BASE_URL` is empty |
| POST | `/sites/:siteId/ai/build` | **NEW** — Claude tool-calling agent with snapshot-before-mutation |

`apps/workers/src/routes/render.ts`:

| Method | Path | Notes |
|---|---|---|
| GET | `/render/:siteId` | **NEW** — renders the home page from `site_pages.content_json` |
| GET | `/render/:siteId/:slug` | **NEW** — renders any page; falls back to home for published-only mode |

The render module exports a `renderSiteByIdAndSlug()` function so the host-router middleware (which dispatches CF-for-SaaS Custom Hostname traffic) can serve customer-domain requests without going through the Hono CORS/auth stack.

`apps/workers/src/routes/me.ts`:

| Method | Path | Notes |
|---|---|---|
| GET | `/me/hosting-plans` | **NEW** — current customer's plans, used by the New Site form |

### 3. Worker infra

- `apps/workers/wrangler.toml`
  - R2 bucket `hostdaddy-assets` bound as `ASSETS`
  - New vars `MEDIA_PUBLIC_BASE_URL` and `AI_MODEL`
  - Documented new secrets `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`
- `apps/workers/src/env.ts`
  - `ASSETS: R2Bucket` (was optional)
  - Added `MEDIA_PUBLIC_BASE_URL`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET`
  - The user-added `CF_SAAS_ZONE_ID` + `CF_SAAS_CNAME_TARGET` for CF for SaaS
- `apps/workers/package.json`
  - Added `@anthropic-ai/sdk`

### 4. AI build agent

`POST /sites/:siteId/ai/build` runs a small Claude tool-call loop (max 8 turns):

| Tool | Effect |
|---|---|
| `read_page` | Returns full page incl. `content_json` so the model has context |
| `update_page_content` | Replace `content_json` — **snapshots first** into `site_versions` for one-click undo |
| `update_page_meta` | Title / slug / status / SEO |
| `create_post` | Draft blog post |

Every run is logged to `site_ai_runs` (prompt, tool calls, tokens, cost estimate, model, duration). If `ANTHROPIC_API_KEY` is unset, the route returns deterministic mock responses so the dashboard works in dev.

### 5. Public renderer

The renderer walks the JSON tree and emits HTML for a small block library: `hero`, `text`, `features`, `cta`, `image`, `gallery`, `faq`, `logo_strip`, `stats`, `footer`. Unknown block types render a labelled placeholder rather than breaking. Minimal CSS bundled inline so previews work without any external CDN.

Cache headers: `private, no-cache` for the dashboard preview path; `public, max-age=60, s-maxage=300` for production traffic via the host-router.

### 6. Dashboard (`apps/web`)

- Sidebar gained a **Sites** entry (with a layered-stack icon)
- `apps/web/src/lib/api.ts` — full typed `sitesApi`, `meApi.hostingPlans()`, media upload helper, AI build helper

Routes added under `/dashboard/sites/`:

| Route | Purpose |
|---|---|
| `/sites` | Site list with counts + status |
| `/sites/new` | Create-site form with plan selector + 5 starter templates |
| `/sites/[siteId]` | Site overview with KPI strip + 6 module cards |
| `/sites/[siteId]/layout.tsx` | Shared header + tabs for every sub-page |
| `/sites/[siteId]/pages` | Pages list with home-page star, status pills |
| `/sites/[siteId]/pages/[pageId]/edit` | **Editor** — title/slug/SEO + JSON textarea + live preview iframe |
| `/sites/[siteId]/editor` | Shortcut — redirects to the home page editor |
| `/sites/[siteId]/blog` | Posts table |
| `/sites/[siteId]/forms` | Forms list with submission counts |
| `/sites/[siteId]/contacts` | CRM table with LTV summary |
| `/sites/[siteId]/shop` | Product grid with status badges |
| `/sites/[siteId]/orders` | Orders table with payment + fulfillment status |
| `/sites/[siteId]/ai` | **AI chat** with focus-page selector, quick prompts, tool-call inspection |

All server-rendered with edge runtime where applicable. Client components only for the editor and the AI chat (where they need interactivity).

### 7. Scripts (`scripts/`)

- `setup-sites-module.sh` — one-command runbook
- `seed-sample-site.sh` — seeds a site (2 pages, 2 posts, 1 form, 2 contacts, 2 products) for a given customer email against local D1

---

## Follow-ups (do these tomorrow before users touch it)

1. **Run the setup script**: `bash scripts/setup-sites-module.sh`
2. **Set the secrets** when you want real AI + Turnstile:
   ```bash
   cd apps/workers
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put TURNSTILE_SECRET
   ```
3. **Set `CF_SAAS_ZONE_ID`** secret + optional `CF_SAAS_CNAME_TARGET` for the BYO-domain Custom Hostnames flow.
4. **Wire `MEDIA_PUBLIC_BASE_URL`** in `wrangler.toml [vars]` once you've decided on a CDN hostname (or leave empty to use the `/sites/:siteId/r2/*` Worker proxy).
5. **Drizzle snapshot regen** — the hand-written migrations apply cleanly but the drizzle-kit snapshots are stale on a Linux box. Run `pnpm db:generate` once on your Mac to refresh them; if it emits an extra `0003_*.sql` that tries to re-create existing tables, just delete it and commit the new snapshot.

---

## Known gaps (intentional — Phase B fixes)

- The page editor uses a JSON textarea. Phase B replaces it with drag-and-drop.
- The "+ New post / form / product" buttons are disabled. CRUD via API works; Phase B adds the dashboard forms for them.
- `hosting_plan_id` and `cf_pages_project` are typed as nullable in Drizzle but the SQL columns are still NOT NULL from migration 0000. The POST /sites endpoint always provides values, so this is fine in practice. A future migration can rebuild the table when truly nullable inserts are needed.
- The render endpoint does inline-CSS only. Phase B adds per-site theming.

---

## Phase B preview

- Drag-and-drop block editor (Craft.js or similar) replacing the JSON textarea
- "+ New post / form / product" dashboard forms
- Custom domain attach flow using CF for SaaS API (we already have the schema; need the UI + Worker → CF API calls)
- 5 production-ready starter templates (founder, Islamic school, F&B, e-com, agency)
- Per-site theming (color, font, layout presets) applied by the renderer
- AI agent visitor chat widget (embeddable `<script>` snippet)

Estimated: 2 focused weeks once Phase A is verified on a live customer.
