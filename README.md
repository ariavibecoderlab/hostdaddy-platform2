# HostDaddy.ai

Domain registration, hosting, and AI-built websites — built entirely on Cloudflare.
A White Unicorn Ventures venture, serving Muslim entrepreneurs, Brainy Bunch franchisees, and the Malaysian SME market.

## Stack

| Layer        | Tech                                                              |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router) + Tailwind, deployed to Cloudflare Pages  |
| Backend      | Cloudflare Workers (Hono router)                                  |
| Database     | Cloudflare D1 (SQLite) + Drizzle ORM                              |
| Cache        | Cloudflare KV                                                     |
| Storage      | Cloudflare R2                                                     |
| Auth         | JWT in Workers (Phase 2)                                          |
| Payments     | Stripe + Billplz (FPX/GrabPay/TNG)                                |
| Email        | Cloudflare Email Routing + Resend (transactional)                 |
| Domains      | Cloudflare Registrar + Exabytes (MYNIC reseller for .my)          |

## Repository layout

```
hostdaddy.app/
├── apps/
│   ├── web/             Next.js 14 marketing site + customer dashboard + admin
│   └── workers/         Cloudflare Workers — all API endpoints
├── packages/
│   ├── cloudflare/      Typed wrapper for the Cloudflare API (Section 5 of spec)
│   ├── ui/              Shared Tailwind components
│   ├── db/              D1 schema + Drizzle ORM + migrations
│   └── stripe/          Stripe checkout + webhooks
├── HOSTDADDY_ACCOUNT_SETUP.md   Step-by-step external service setup
└── HostDaddy_AI_Build_Specification.docx   Full product spec (source of truth)
```

## Build phases

| Phase | Spec doc steps | Goal                                                            |
| ----- | -------------- | --------------------------------------------------------------- |
| 1     | 1, 2, 3        | Monorepo + Cloudflare API package + UI + D1 schema              |
| 2     | 4, 5           | Auth + homepage + dashboard shell + Stripe billing              |
| 3     | 6, 7, 9, 10    | Domain search + cart/checkout + DNS editor + transfer wizard    |
| 4     | —              | (Stage 2 — AI features deferred until after launch)             |
| 5     | —              | (Stage 2 — AI site builder deferred until after launch)         |
| 6     | 12, 13         | Email routing + Resend templates + Cron renewal reminders       |
| 7     | 11, 14         | Admin panel + polish + security audit + Brainy Bunch soft launch|

> Stage 2 features (AI site builder, AI Bulk Manager, multi-domain groups, slide-over panels) are intentionally deferred. Stage 1 is GoDaddy-equivalent first.

## Getting started

```bash
# 1. Install deps
pnpm install

# 2. Copy env template
cp .env.example .env.local
#    ↳ fill in CLOUDFLARE_* values from HOSTDADDY_ACCOUNT_SETUP.md

# 3. Run dev (web on :3000, workers on :8787)
pnpm dev

# 4. Typecheck the whole monorepo
pnpm typecheck
```

## Deployment

- `apps/web` deploys automatically to **Cloudflare Pages** via GitHub Actions on push to `main`.
- `apps/workers` deploys via `pnpm --filter workers deploy` (uses `wrangler`).

See `.github/workflows/deploy.yml` for the exact pipeline.

## Status

Phase 1 in progress. See `HOSTDADDY_ACCOUNT_SETUP.md` for the parallel account-setup checklist.
