# HostDaddy.app — Architecture

A reference for engineers joining the project. The source of truth for product decisions is `HostDaddy_AI_Build_Specification.docx` at the repo root. This doc explains *how the code is wired* — what each piece does and how requests flow through the system.

---

## 1. The product in one paragraph

HostDaddy.app is a domain registrar + web host + email forwarder + AI site builder, built entirely on Cloudflare. Customers search for a domain → buy it → it auto-provisions a DNS zone, a Cloudflare Pages project, and email routing — all within a single Cloudflare master account. The customer sees a clean dashboard; we see one bill from Cloudflare.

Three customer segments power the unit economics:
1. **Brainy Bunch franchisees** — mandatory bundle, ~130 schools, RM 6,370 MRR floor on day 1
2. **Muslim entrepreneurs via SuccessMuslim** — community pipeline
3. **Malaysian SMEs** — open public funnel

---

## 2. Monorepo layout

```
hostdaddy.app/
├── apps/
│   ├── web/        Next.js 14 — marketing site, customer dashboard, admin panel
│   └── workers/    Cloudflare Workers — all API endpoints + cron jobs
├── packages/
│   ├── cloudflare/ Typed wrapper for the Cloudflare REST API
│   ├── ui/         Shared Tailwind components + brand tokens
│   ├── db/         Drizzle ORM schema + D1 client
│   └── stripe/     Stripe checkout, customer portal, webhook verification
├── .github/workflows/    CI typecheck + Workers deploy on push to main
├── HOSTDADDY_ACCOUNT_SETUP.md    External services checklist
└── HostDaddy_AI_Build_Specification.docx    Product spec — source of truth
```

Why Turborepo + pnpm: incremental builds, shared TS config, one lockfile, zero cross-package import gymnastics. Cloudflare Pages deploys `apps/web`; Wrangler deploys `apps/workers`. Packages compile in-place — there's no separate `dist/` build step.

---

## 3. The Cloudflare account model

We run **one master Cloudflare account**. Every customer's resources (DNS zone, Pages project, email routing rules) live under it. Customers never log into Cloudflare — they only see our dashboard.

```
HostDaddy.app master Cloudflare account
├── Registrar
│   ├── customer1.com
│   ├── customer2.net
│   └── ...
├── DNS Zones
│   ├── customer1.com (zone_id stored in db.domains.cloudflare_zone_id)
│   └── ...
├── Pages projects
│   ├── customer1-com-site (Pages project per customer site)
│   └── ...
├── Email Routing
│   └── per-zone forwarding rules
├── D1: hostdaddy-prod (one database, all customers)
├── KV: hostdaddy-sessions
└── R2: hostdaddy-assets
```

Customer isolation is enforced at the **application layer** (every D1 query is scoped by `customer_id`) and at the **API layer** (the API token used to provision a customer's zone is the master token; per-customer scoping is logical, not credential-based).

This is the trade-off we took for simplicity. It scales to ~50k customers before we'd consider a per-tenant account model.

---

## 4. Request flow — buying a .com domain

This is the canonical end-to-end flow. Most other operations are simpler subsets.

```
1. User hits hostdaddy.app homepage
   → Next.js (Cloudflare Pages) renders <HeroSearch>

2. User types "mybrand" + Enter
   → Router pushes /search?q=mybrand

3. /search page calls GET api.hostdaddy.app/domains/check?q=mybrand
   → apps/workers/src/routes/domains.ts
   → packages/cloudflare → Registrar API for each TLD in SUPPORTED_TLDS
   → Returns availability + RM pricing

4. User adds mybrand.com to cart → /checkout
   → Cart persists in localStorage (Phase 3)

5. /checkout calls POST /api/checkout/create-session
   → packages/stripe.createCheckoutSession({ mode: 'payment', lineItems: [...] })
   → Stripe returns checkout URL → 302 redirect

6. Stripe webhook fires checkout.session.completed
   → POST api.hostdaddy.app/webhooks/stripe
   → packages/stripe.constructEvent() verifies signature
   → Insert invoice row, mark paid
   → Enqueue provisioning job

7. Provisioning Worker (async, durable):
   a. packages/cloudflare.registrar.register({ domain, contact, years: 1 })
   b. packages/cloudflare.dns.createZone(domain)
   c. packages/cloudflare.email.enable(zone_id)  // if customer opted in
   d. INSERT INTO domains (...) with cloudflare_zone_id
   e. Send receipt via Resend
   f. Push audit_log row

8. User redirected to /dashboard
   → Sees mybrand.com under "Active Domains"
```

Failure modes are handled in the provisioning Worker — partial failures roll back (delete zone if registrar fails after zone creation, etc.) and surface as a banner on the dashboard.

---

## 5. Package responsibilities

### `packages/cloudflare`
Typed wrapper for the Cloudflare REST API. Five clients:
- `RegistrarClient` — domain availability, registration, transfer, auto-renew
- `DnsClient` — zone CRUD, record CRUD, bulk operations
- `PagesClient` — Pages project CRUD, deployments, custom domains
- `EmailRoutingClient` — enable/disable routing, forwarding rules
- `MynicClient` — stub for Exabytes-resold .my domains (Phase 3)

One entry point: `createCloudflare({ accountId, apiToken })` returns all five.

Error model: every method throws `CloudflareApiError` on non-2xx or `success: false`. Check `err.isNotFound` / `err.isAuthError` rather than poking at status codes.

### `packages/db`
Drizzle ORM schema. 10 tables: customers, domains, hosting_plans, sites, email_routes, invoices, transfers, support_tickets, sessions, audit_log.

Conventions:
- IDs are UUIDs stored as TEXT
- Money is integer MYR cents, never floats
- Timestamps are Unix seconds (integer), accessed as JS Date through Drizzle's `mode: 'timestamp'`
- Every table that holds customer data has `customer_id` indexed
- `audit_log` is append-only — never UPDATE or DELETE rows there

### `packages/ui`
Shared Tailwind components + a brand preset (Navy `#0A1628`, Electric Blue `#1A56DB`, Cyan `#06B6D4`). All apps import the preset, all apps consume the same primitives. No design tokens hardcoded in app code.

Components: Button, Input, Card, Badge, Table, Dialog, Tabs. Add new primitives here before adding them to `apps/web` — keeps the design system honest.

### `packages/stripe`
Wraps the Stripe SDK with HostDaddy-specific helpers:
- `upsertCustomer` (idempotent — looks up by email first)
- `createCheckoutSession` (subscription or payment mode)
- `createCustomerPortalSession` (self-serve cancel / card update)
- `constructEvent` (webhook signature verification)
- `refund`

### `apps/workers`
Cloudflare Worker entry point using Hono. Routes:
- `/health` — liveness check
- `/domains/check` — public availability lookup (Phase 1, done)
- `/auth/*` — JWT register/login/logout (Phase 2)
- `/domains/*` — register/transfer/manage (Phase 3)
- `/dns/*` — zone records CRUD (Phase 3)
- `/billing/*` — checkout, portal, webhooks (Phase 2)
- `/email/*` — routing rules (Phase 6)
- `/admin/*` — internal admin panel (Phase 6)

Cron handler in `index.ts` runs daily at 08:00 UTC — drives renewal reminders (Phase 6).

### `apps/web`
Next.js 14 App Router. Three logical sections:
1. **Marketing** (`/`, `/domains`, `/hosting`, `/email`, `/transfer`) — public, statically rendered
2. **Customer dashboard** (`/dashboard/*`) — auth-gated, mostly server components calling Workers API
3. **Admin** (`/admin/*`) — auth-gated, admin-only, internal team only

Deploys to Cloudflare Pages via the GitHub integration (configured in dashboard, not in code).

---

## 6. Auth model (Phase 2)

JWT-based. No third-party auth provider — too much value at stake (this is the credential into customer DNS).

```
1. POST /auth/register { email, password, name }
   → bcrypt hash password
   → INSERT customer
   → Issue JWT (signed with env.JWT_SECRET, 7-day expiry)
   → Set httpOnly cookie

2. POST /auth/login
   → Find customer by email
   → bcrypt.compare
   → Issue JWT, set cookie

3. Each authenticated request:
   → Middleware reads cookie
   → Verifies JWT signature + expiry
   → Looks up session in KV (revocation list)
   → Attaches { customerId, role } to context

4. POST /auth/logout
   → Add session.id to KV revocation list (TTL = remaining JWT lifetime)
   → Clear cookie
```

Why KV revocation: JWTs are stateless and we want explicit logout. KV gives us a 1ms revocation check at the edge without a DB round-trip.

Admin role check: `role === 'admin'` on `customers` row. No separate admin user pool.

---

## 7. Data flow for the home-page domain search

The simplest live path. Use this to verify your local setup works.

```
Browser                  Pages (apps/web)        Workers (apps/workers)    Cloudflare API
  │                            │                          │                       │
  │  GET /search?q=mybrand     │                          │                       │
  ├───────────────────────────►│                          │                       │
  │                            │ <HeroSearch> renders SSR │                       │
  │◄───────────────────────────┤                          │                       │
  │                            │                          │                       │
  │  fetch(/domains/check?q=…) │                          │                       │
  ├───────────────────────────────────────────────────────►│                      │
  │                            │                          │ GET /registrar/…     │
  │                            │                          ├─────────────────────►│
  │                            │                          │◄─────────────────────┤
  │                            │                          │ (×10 TLDs)           │
  │◄───────────────────────────────────────────────────────┤                      │
  │  { results: [...] }        │                          │                       │
```

Open `apps/workers/src/routes/domains.ts` and `apps/web/src/components/hero-search.tsx` to see this in code.

---

## 8. Deployment

Two pipelines, both triggered by push to `main`:

**Web** — Cloudflare Pages auto-build via Git integration
- Configured in Cloudflare dashboard (see `HOSTDADDY_ACCOUNT_SETUP.md §2.3`)
- Build command: `pnpm turbo build --filter=web`
- Output: `apps/web/.next`
- Adapter (Phase 2): `@cloudflare/next-on-pages` for full SSR support

**Workers** — GitHub Actions runs `wrangler deploy`
- See `.github/workflows/deploy.yml`
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (set in repo Settings → Secrets)
- Deploys to `hostdaddy-api.workers.dev` until DNS is pointed at `api.hostdaddy.app`

Both run typecheck first; a failing typecheck blocks deploy.

---

## 9. Build phases (status)

| Phase | Spec doc steps | Status                                    |
| ----- | -------------- | ----------------------------------------- |
| 1     | 1, 2, 3        | **Done** — monorepo + CF wrapper + UI + DB |
| 2     | 4, 5           | Next up — auth + homepage + Stripe        |
| 3     | 6, 7, 9, 10    | Pending — search, cart, DNS, transfers    |
| 4     | (Stage 2)      | Deferred — AI features                    |
| 5     | (Stage 2)      | Deferred — AI site builder                |
| 6     | 12, 13         | Pending — Resend templates + cron         |
| 7     | 11, 14         | Pending — admin panel + polish            |

See [docs/PHASE_2_NEXT.md](./PHASE_2_NEXT.md) for the actionable Phase 2 task list.

---

## 10. Things that will bite you

- **Cloudflare API rate limits**: 1,200 requests per 5-min window. Bulk operations (e.g., creating 20 DNS records) should serialise, not parallelise.
- **D1 single-region**: writes go to one region. Reads are eventually consistent across the edge. Don't read-your-write across multiple Worker invocations.
- **Pages cold starts**: first request to a fresh Pages function can take ~500ms. Keep critical paths in static Pages routes where possible.
- **Money types**: always cents, always integer. If you ever see a `.toFixed()` in money code, that's a bug.
- **MYR vs USD**: SST is 8% on services. Cloudflare invoices us in USD; we charge customers in MYR. The conversion happens at signup time and is locked for the term.
- **Domain names are case-insensitive**: normalise to lowercase before INSERT or lookup. Cloudflare API accepts both but our index doesn't.
- **`.my` TLDs aren't on Cloudflare**: they route through Exabytes. The `MynicClient` is currently a stub.

---

*Last updated alongside Phase 1 scaffold. Update this doc with every phase boundary.*
