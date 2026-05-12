# Overnight progress — Phase 2 build

Working session while Coach Fadzil slept. Goal: take the Phase 2 plan from "approved" to "code complete" so morning is just account setup + smoke test.

## What's shipped

All 9 build tasks (Day 1.1 → Day 4.2). Skipped only Day 4.3 (live smoke test + soft launch) — that requires you awake with real test cards and 5 friendly users.

**Status:** Whole monorepo compiles. `pnpm turbo typecheck` → 6/6 packages green.

### Backend (apps/workers)

```
src/
├── env.ts                       ← extended with Stripe price IDs + Billplz
├── lib/
│   ├── jwt.ts                   ← jose-based HS256 sign/verify, 7-day TTL
│   ├── password.ts              ← PBKDF2-SHA256, version-prefixed, upgradable
│   ├── cookies.ts               ← httpOnly Secure SameSite=Lax helpers
│   ├── email.ts                 ← Resend wrapper, dev-mode console fallback
│   ├── stripe-catalog.ts        ← Plan → price ID env var lookup
│   └── billplz.ts               ← FPX/GrabPay/TNG client + HMAC webhook verify
├── middleware/
│   └── auth.ts                  ← optionalAuth + requireAuth + KV revocation
├── routes/
│   ├── auth.ts                  ← register, login, logout, refresh, me,
│   │                              forgot-password, reset-password,
│   │                              change-password (rate-limited)
│   ├── me.ts                    ← GET/PATCH /me
│   ├── billing.ts               ← /billing/checkout, /billing/checkout/fpx,
│   │                              /billing/portal, /billing/plans
│   │                              /webhooks/stripe, /webhooks/billplz
│   │                              (both idempotent via processed_events)
│   └── domains.ts               ← (existing) /domains/check
├── emails/
│   └── render.ts                ← 4 templates: welcome, receipt,
│                                  password_reset, renewal_reminder
└── index.ts                     ← wires all routes + cron
```

### Frontend (apps/web)

```
src/
├── lib/
│   ├── api.ts                   ← typed fetch wrapper + authApi + meApi
│   └── auth.ts                  ← server-side getSession() helper
├── middleware.ts                ← /dashboard/* gate (root file)
└── app/
    ├── (auth)/
    │   ├── layout.tsx           ← dark gradient layout
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── forgot-password/page.tsx
    │   └── reset-password/[token]/page.tsx
    ├── dashboard/
    │   ├── layout.tsx           ← sidebar + topbar, gated by getSession()
    │   ├── page.tsx             ← overview: 3 stat cards + quick actions
    │   ├── domains/page.tsx     ← empty state
    │   ├── hosting/page.tsx     ← empty state
    │   ├── email/page.tsx       ← empty state
    │   ├── billing/page.tsx     ← empty state + portal link
    │   └── settings/
    │       ├── page.tsx
    │       └── settings-forms.tsx  ← profile + password forms
    └── checkout/
        ├── page.tsx             ← review screen, server-rendered
        ├── checkout-actions.tsx ← client island, both pay buttons
        ├── success/page.tsx
        └── cancelled/page.tsx
```

### Schema additions (packages/db)

Two new tables added to `src/schema.ts`:

- **`verification_tokens`** — used for password reset; supports email_change + email_verify too
- **`processed_events`** — webhook idempotency for Stripe + Billplz

### One-time setup script

`scripts/seed-stripe.ts` — creates 4 Stripe Products with monthly + yearly Prices in MYR. Idempotent (matches by `metadata.plan_id`). Prints the env vars to paste.

## Verification

```
pnpm turbo typecheck
# → Tasks: 6 successful, 6 total · 2.65s
```

No errors, no warnings beyond Next.js's normal "outdated version" notice.

## What I need from you when you wake up

In order of priority — none of these can be done by me:

### 1. Run the Stripe seed script (5 min)

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/seed-stripe.ts
```

Copy the printed env vars into `.env.local`. Also paste into Cloudflare Pages env vars when ready to deploy.

### 2. Create Billplz collection (10 min)

Already covered in `HOSTDADDY_ACCOUNT_SETUP.md §4`. You need:
- `BILLPLZ_API_KEY`
- `BILLPLZ_COLLECTION_ID`
- `BILLPLZ_X_SIGNATURE_KEY`

For first test, use Billplz sandbox by setting `BILLPLZ_BASE_URL=https://www.billplz-sandbox.com/api/v3`.

### 3. Apply D1 schema (2 min)

```bash
cd packages/db
pnpm generate                    # generates SQL migrations from schema.ts
pnpm migrate:local               # applies to local D1
# After Cloudflare creds are in:
pnpm migrate                     # applies to remote D1
```

### 4. Wire webhooks (10 min)

After deploying Workers to `api.hostdaddy.app`:
- Stripe → Add endpoint at `https://api.hostdaddy.app/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
  - Copy signing secret → `STRIPE_WEBHOOK_SECRET`
- Billplz → set webhook URL on the collection to `https://api.hostdaddy.app/webhooks/billplz`

### 5. Smoke test the full flow (Day 4.3 — 30 min)

In one terminal:
```bash
cd ~/Documents/Claude/Projects/hostdaddy.app
pnpm --filter @hostdaddy/web dev          # localhost:5173
```

In another:
```bash
cd ~/Documents/Claude/Projects/hostdaddy.app/apps/workers
pnpm dev                                    # localhost:8787 via wrangler
```

Then in your browser:

1. `http://localhost:5173/register` — create an account
2. Check terminal for `[email:mock]` welcome log (real email when RESEND_API_KEY is set)
3. `http://localhost:5173/dashboard` — should land here
4. Visit `/dashboard/settings` — change your name, confirm it saves
5. `http://localhost:5173/hosting` — click **Choose Business**
6. `/checkout?plan=business&cycle=yearly` — review screen
7. **Pay with card** → Stripe test card `4242 4242 4242 4242`
8. Stripe redirects back to `/checkout/success`
9. `/dashboard/billing` should now show the active plan
10. Click **Open billing portal** → Stripe Customer Portal opens

If all 10 steps work, you've cleared Phase 2 acceptance.

## Notes / decisions I made without you

These are reversible — flag anything you want different:

- **Password hashing: PBKDF2-SHA256** with 100k iterations (not bcrypt). Workers-native via Web Crypto, ~80ms per hash. Versioned format `pbkdf2-sha256$N$salt$hash` so we can swap to argon2id later without forcing re-login.
- **JWT TTL: 7 days.** With KV-backed revocation list on logout. A "Sessions" page in settings can list active sessions in Phase 7.
- **Rate limit on /auth/login: 5 failed attempts per IP per 15 min.** Bumps a KV counter on every failure.
- **SST handling: Stripe Tax = automatic.** No manual line item. The webhook back-calculates the SST portion (`total × 8/108`) and stores both subtotal and SST cents in `invoices`.
- **Plan IDs in Stripe metadata.** `seed-stripe.ts` writes `metadata.plan_id` on Products so re-running is idempotent.
- **Welcome email + receipt email = inline HTML** (in `apps/workers/src/emails/render.ts`). Brand-coloured, mobile-friendly, no images, plaintext fallback. React Email migration is a Phase 7 polish.
- **Two Customer Portal entry points:** topbar avatar → Settings, plus a dedicated link on `/dashboard/billing`.
- **Forgot-password is enumeration-safe** — always returns 200, only sends if account exists. Token = 32 random bytes → base64url, stored as SHA-256 hash with 1-hour TTL.

## What's intentionally NOT done

- Day 4.3 (live smoke test + soft launch to 5 users) — needs you awake.
- Real Stripe Products created (you run `seed-stripe.ts`).
- D1 migrations applied (you run `pnpm db:migrate`).
- Resend domain DNS records (DNS + 24h propagation).
- Webhook URLs registered in Stripe/Billplz dashboards.
- Push to `ariavibecoderlab/hostdaddy-platform2` — `scripts/bootstrap-repo.sh` is updated for that remote. Run it when ready.

## File count summary

| Area | Files added/modified | Lines |
|---|---|---|
| Workers backend | 9 new + 2 modified | ~1,400 |
| Web frontend | 18 new + 2 modified | ~1,500 |
| DB schema | 1 modified | +50 |
| Scripts | 1 new | ~80 |
| Docs | this file | — |

Get rest. When you're back, run the 5 steps above and we'll be live for soft launch within an hour.

— Claude, overnight
