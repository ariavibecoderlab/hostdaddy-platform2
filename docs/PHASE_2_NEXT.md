# Phase 2 — Auth + Dashboard Shell + Billing

**Goal:** a customer can sign up, log in, see an empty dashboard, and complete a Stripe checkout. No domain operations yet (that's Phase 3).

**Estimated:** 3–4 days for one full-stack engineer.

**Spec doc reference:** Section 9.4 Steps 4, 5, 7, 8.

**Prerequisites before starting:**
- Phase 1 merged to `main` (done)
- Sections 1, 2, 3, 5 of `HOSTDADDY_ACCOUNT_SETUP.md` complete (Cloudflare, GitHub, Stripe, Resend)
- `.env.local` populated with real keys
- D1 migrated locally (`pnpm db:migrate:local`)

---

## Task list

Tasks are ordered by dependency. Tick them off in this order.

### 2.1 Auth — Workers side `[backend]`

**Files to create:**
- `apps/workers/src/middleware/auth.ts` — JWT verify + KV revocation check + `c.set('user', ...)`
- `apps/workers/src/routes/auth.ts` — register / login / logout / refresh / forgot-password / reset-password
- `apps/workers/src/lib/jwt.ts` — sign/verify using Web Crypto (NOT `jsonwebtoken` — it's not Workers-compatible). Use `jose` instead.
- `apps/workers/src/lib/password.ts` — bcrypt-compatible hashing. Use `bcrypt-edge` (Workers-safe) at cost factor 10.

**Acceptance:**
- POST `/auth/register` creates a customer, returns 201 + sets httpOnly cookie
- POST `/auth/login` returns 200 + cookie on valid creds, 401 otherwise
- POST `/auth/logout` blacklists the JWT's `jti` in KV (TTL = remaining lifetime), clears cookie
- Protected route returns 401 when cookie missing or JWT expired
- `forgot-password` emails a 1-hour reset token via Resend
- All endpoints input-validated with Zod
- Passwords minimum 8 chars, contain letter + number (front-end + back-end both validate)
- Rate-limited: 5 failed logins per IP per 15 min (use KV counter)

**Tests:** Vitest unit tests for jwt + password lib. Integration test for full register → login → protected → logout flow.

---

### 2.2 Auth — Web side `[frontend]`

**Files to create:**
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/reset-password/[token]/page.tsx`
- `apps/web/src/lib/auth.ts` — server-side `getSession()` helper that reads the cookie and calls Workers
- `apps/web/src/lib/api.ts` — typed fetch wrapper for Workers API, includes credentials

**Acceptance:**
- Pixel-clean forms matching the brand (use `@hostdaddy/ui` Input + Button)
- Error states inline below the relevant field
- `/login` and `/register` redirect to `/dashboard` on success
- Forgot-password flow round-trips via email
- Middleware (`middleware.ts` at repo root) redirects unauthenticated `/dashboard/*` requests to `/login?next=…`

---

### 2.3 Dashboard shell `[frontend]`

**Files to create:**
- `apps/web/src/app/dashboard/layout.tsx` — sidebar + top bar + main content area
- `apps/web/src/app/dashboard/page.tsx` — overview (3 stat cards + quick actions + renewal banner)
- `apps/web/src/app/dashboard/domains/page.tsx` — empty state placeholder
- `apps/web/src/app/dashboard/hosting/page.tsx` — empty state placeholder
- `apps/web/src/app/dashboard/email/page.tsx` — empty state placeholder
- `apps/web/src/app/dashboard/billing/page.tsx` — empty state placeholder
- `apps/web/src/app/dashboard/settings/page.tsx` — name, email, password change
- `apps/web/src/components/dashboard/sidebar.tsx`
- `apps/web/src/components/dashboard/topbar.tsx` — search + notifications + avatar menu

**Acceptance:**
- Sidebar collapses on mobile (md breakpoint)
- All tabs route correctly even when empty
- Top bar shows logged-in user's name + avatar fallback (initials)
- Logout in avatar menu hits `/auth/logout` and redirects to `/`

Reference: Section 4.4 of the spec doc.

---

### 2.4 Stripe checkout — first happy path `[fullstack]`

**Files to create:**
- `apps/workers/src/routes/billing.ts` — `/billing/checkout` + `/billing/portal` + `/webhooks/stripe`
- `apps/web/src/app/checkout/page.tsx` — review cart, click "Pay with Stripe" → redirect to hosted checkout
- `apps/web/src/app/checkout/success/page.tsx` — confirmation page
- `apps/web/src/app/checkout/cancelled/page.tsx`

**Acceptance:**
- A logged-in user can buy a hosting plan (Starter / Business / Agency)
- Stripe checkout opens with correct line items + MYR currency
- Webhook `checkout.session.completed` inserts a row into `hosting_plans` table with `status: 'active'`
- Webhook `customer.subscription.updated` updates the row
- Webhook signatures verified — invalid signature returns 400
- Failed payment shows a friendly retry page; doesn't create a hosting plan row
- Idempotent — re-delivering the same webhook doesn't double-insert

**Test mode first:** use `4242 4242 4242 4242` until end-to-end works, then switch to live keys.

---

### 2.5 Email templates `[backend]`

**Files to create:**
- `apps/workers/src/lib/email.ts` — Resend wrapper with typed `sendTemplate` helper
- `apps/workers/src/emails/welcome.ts` — sent on register
- `apps/workers/src/emails/receipt.ts` — sent on successful checkout
- `apps/workers/src/emails/password-reset.ts`

Use plain HTML strings or React Email (https://react.email). Keep them simple — brand colours, logo, plain copy. No images.

**Acceptance:**
- All three trigger correctly
- DKIM / SPF verified (Resend dashboard)
- HTML renders in Gmail and Outlook (test both)
- Includes unsubscribe footer (legally required even for transactional)

---

### 2.6 Phase 2 verification

Before opening the Phase 3 ticket:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Manual smoke test, in order:
1. Register at `/register` → see welcome email
2. Logout → log back in
3. Visit `/dashboard` → see overview shell
4. Buy a Starter plan via Stripe test card → see success page
5. Check D1: `wrangler d1 execute hostdaddy-prod --command "SELECT * FROM hosting_plans"`
6. Visit `/dashboard/billing` → see the plan listed
7. Click "Manage billing" → land in Stripe Customer Portal

If any step fails, fix before merging.

---

## Out of scope for Phase 2

These are explicitly **not** in Phase 2 — don't get sucked in:

- Domain registration (Phase 3)
- DNS editor (Phase 3)
- Transfer wizard (Phase 3)
- Email forwarding setup (Phase 6)
- Admin panel (Phase 7)
- Billplz / FPX (Phase 2.5 — see below)
- 2FA (Phase 7)
- SSO / social login (post-launch)
- AI features (Stage 2)

## Phase 2.5 (optional, between 2 and 3): Billplz for FPX

If Brainy Bunch onboarding starts before Phase 3, prioritise FPX over Stripe:

- Wire `packages/billplz` (new) — most franchisees won't have international cards
- Same flow as Stripe but redirect to Billplz collection URL
- Webhook at `/webhooks/billplz` — verify with X-Signature

Skip this if launch order is "general SME first, BB second."

---

## Open questions before starting Phase 2

Surface these to Coach Fadzil in `#hostdaddy-eng` Slack before kicking off:

1. **Confirm Stripe is in MYR-default mode.** If Stripe was activated as a USD account, switch before any line items get created.
2. **Resend domain** — has `hello@hostdaddy.ai` been verified yet? If not, do step 5.5 of the account setup checklist first.
3. **Password reset email subject + body copy** — need a brand-aligned first draft. Owner: marketing (use the `marketing:content-creation` skill).
4. **Welcome email — include a "what's next" CTA?** Default: "Search for your first domain." Confirm with product.
5. **Refund policy** — Stripe needs a refund window configured. Spec doc says nothing; default to 7 days for hosting, no refund on domains (industry standard).

---

*This doc gets updated as Phase 2 tasks are absorbed by the team. Anyone can edit; PRs welcome.*
