# HostDaddy.ai — Account Setup Checklist

> Work through this list while Claude scaffolds the codebase in parallel.
> Anything marked **BLOCKING** is needed before Phase 1 ships. Anything marked **DEFERRABLE** can wait until the relevant phase.
> Paste each key into `.env.local` (and later into Cloudflare Pages + Workers env vars). The template is `.env.example` at the repo root.

---

## 1. Cloudflare — BLOCKING (Phase 1)

This is the master infrastructure account. Everything else depends on it.

### 1.1 Create Cloudflare account
- Go to https://dash.cloudflare.com/sign-up
- Sign up with `admin@hostdaddy.ai` (or your preferred ops email)
- Verify email → log in
- **Plan:** start on Free. Upgrade to Pro (USD 20/mo) before public launch for advanced rate limiting and image resizing.

### 1.2 Capture your Account ID
- After login, on the right sidebar of any zone overview page, copy **Account ID**
- Paste into `.env.local` as `CLOUDFLARE_ACCOUNT_ID=...`

### 1.3 Create the API Token (correct scopes are critical)
- Go to **My Profile → API Tokens → Create Token → Custom token**
- Name: `HostDaddy.ai Platform Token`
- **Permissions** (add each row):
  - **Account** — `Cloudflare Pages` — **Edit**
  - **Account** — `D1` — **Edit**
  - **Account** — `Workers Scripts` — **Edit**
  - **Account** — `Workers KV Storage` — **Edit**
  - **Account** — `Workers R2 Storage` — **Edit**
  - **Account** — `Email Routing Addresses` — **Edit**
  - **Account** — `Account Settings` — **Read**
  - **Zone** — `DNS` — **Edit**
  - **Zone** — `Zone Settings` — **Edit**
  - **Zone** — `Zone` — **Edit**
  - **Zone** — `Email Routing Rules` — **Edit**
  - **User** — `User Details` — **Read**
- **Account Resources:** Include → All accounts (or your one account)
- **Zone Resources:** Include → All zones from an account → your account
- **TTL:** no expiration for now (rotate quarterly)
- Click **Continue to summary → Create Token**
- Copy once — paste into `.env.local` as `CLOUDFLARE_API_TOKEN=...`
- Cloudflare will **not** show this token again. If lost, revoke and re-create.

### 1.4 Enable Cloudflare Registrar
- Go to **Domains → Register Domains**
- Accept the registrar terms
- This enables the `/registrar/domains/*` API endpoints used by `packages/cloudflare`.

### 1.5 Create the D1 database
- Go to **Workers & Pages → D1 → Create database**
- Name: `hostdaddy-prod`
- Region: closest to KL — currently **APAC** (auto)
- Copy the **Database ID** → paste into `.env.local` as `D1_DATABASE_ID=...`
- (We'll bind it via `wrangler.toml` once `apps/workers` is scaffolded.)

### 1.6 Create the R2 bucket
- Go to **R2 → Create bucket**
- Name: `hostdaddy-assets`
- Location hint: **Asia-Pacific**
- Click **Create bucket**
- Then **Manage R2 API Tokens → Create API Token**
  - Permissions: Object Read & Write
  - Bucket: `hostdaddy-assets`
- Copy `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` → paste into `.env.local`

### 1.7 Create the KV namespace (for sessions/cache)
- Go to **Workers & Pages → KV → Create a namespace**
- Name: `hostdaddy-sessions`
- Copy the **Namespace ID** → paste into `.env.local` as `KV_NAMESPACE_ID=...`

### 1.8 Enable Email Routing on the test domain
- We'll do this per-customer-domain via API, but enable it once on `hostdaddy.ai` itself: **Email → Email Routing → Enable**.

---

## 2. GitHub — BLOCKING (Phase 1)

### 2.1 Create the GitHub organisation
- Go to https://github.com/organizations/new
- Org name: `hostdaddy-ai` (or `hostdaddy`)
- Plan: Free
- Add yourself as owner

### 2.2 Create the repository
- Inside the org → **New repository**
- Name: `hostdaddy-platform`
- Private
- **Do not** initialize with README (we'll push the scaffold)
- Copy the SSH URL: `git@github.com:hostdaddy-ai/hostdaddy-platform.git`

### 2.3 Connect Cloudflare Pages auto-deploy
- In Cloudflare → **Workers & Pages → Create application → Pages → Connect to Git**
- Authorize Cloudflare GitHub App for the `hostdaddy-ai` org → repo `hostdaddy-platform`
- **Project name:** `hostdaddy-web`
- **Production branch:** `main`
- **Framework preset:** Next.js
- **Build command:** `pnpm turbo build --filter=web`
- **Build output:** `apps/web/.next`
- **Root directory:** `/`
- **Node version:** `20`
- **Environment variables (Production):** add the same ones from `.env.local` (we'll list the final set after Phase 1 completes)
- Save → first deploy will fail until we push code. That's fine.

### 2.4 GitHub Actions secret
- In the repo → **Settings → Secrets and variables → Actions → New repository secret**
- `CLOUDFLARE_API_TOKEN` — paste the token from §1.3
- `CLOUDFLARE_ACCOUNT_ID` — paste from §1.2

---

## 3. Stripe — BLOCKING (Phase 2 onwards, set up now)

- https://dashboard.stripe.com/register
- Business type: **Sdn Bhd** (White Unicorn Ventures)
- Country: **Malaysia**
- Currency: **MYR**
- Activate the account fully (KYC docs)
- **Developers → API keys**:
  - Copy `Publishable key` → `STRIPE_PUBLISHABLE_KEY=...`
  - Copy `Secret key` → `STRIPE_SECRET_KEY=...`
- **Developers → Webhooks → Add endpoint** (do this AFTER apps/workers is deployed):
  - URL: `https://api.hostdaddy.ai/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
  - Copy `Signing secret` → `STRIPE_WEBHOOK_SECRET=...`

---

## 4. Billplz (FPX, GrabPay, TNG) — BLOCKING (Phase 2)

- https://www.billplz.com/enterprise/register
- Verify business with SSM cert
- **Settings → API Key:** copy → `BILLPLZ_API_KEY=...`
- **Collections → Create collection** for HostDaddy.ai → copy `BILLPLZ_COLLECTION_ID=...`
- Webhook (after deploy): `https://api.hostdaddy.ai/webhooks/billplz`

---

## 5. Resend (transactional email) — BLOCKING (Phase 2)

- https://resend.com/signup
- **Domains → Add Domain** → `hostdaddy.ai`
- Add the SPF, DKIM, MX records that Resend gives you to Cloudflare DNS
- Wait for verification (usually < 5 min)
- **API Keys → Create API Key**
  - Permission: Sending access
  - Copy → `RESEND_API_KEY=...`
- Free tier covers 3,000 emails/mo (plenty for launch).

---

## 6. Zoho Mail (resold business email) — DEFERRABLE (Phase 2)

- https://www.zoho.com/mail/zohomail-pricing.html
- Sign up for **Mail Premium** reseller programme
- Capture credentials when you receive partner approval; we'll integrate provisioning in Phase 6.

---

## 7. Tawk.to (live chat) — DEFERRABLE (Phase 7)

- https://www.tawk.to/
- Free signup
- Create property: HostDaddy.ai
- **Administration → Property Settings → Property ID** → `TAWK_PROPERTY_ID=...`
- **Widget code → Widget ID** → `TAWK_WIDGET_ID=...`
- We'll embed in Phase 7 polish.

---

## 8. MYNIC partner (.my / .com.my) — DEFERRABLE (Phase 3)

You have two viable routes:

**Option A — Direct MYNIC accreditation** (slower, no margin sharing):
- https://www.mynic.my/en/registrar
- Apply for registrar status, ~RM 10k bond, audit, 4–8 weeks

**Option B — Reseller via Exabytes** (recommended for speed):
- https://www.exabytes.my/domain/reseller
- Sign reseller agreement
- They give you `EXABYTES_API_KEY` and `EXABYTES_RESELLER_ID`
- We wrap their API in `packages/cloudflare/src/mynic.ts` (since CF doesn't sell .my)

Use Option B for launch unless you already have a MYNIC relationship.

---

## 9. Mintlify (help centre) — DEFERRABLE (Phase 7)

- https://mintlify.com/
- Sign up, Pro plan USD 150/mo
- Create site `help.hostdaddy.ai`
- We'll point a CNAME at it during Phase 7.

---

## 10. Domain registration for hostdaddy.ai itself

- Once Cloudflare Registrar is active (§1.4), search for `hostdaddy.ai` directly inside Cloudflare → Domains → Register
- Or, if already registered elsewhere, use the in-product transfer flow (5–7 days)
- Set nameservers to Cloudflare's once moved
- Enable Email Routing (§1.8)

---

## What to send back to Claude when each section is done

After §1 (Cloudflare) and §2 (GitHub) are complete, paste back:

```
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
D1_DATABASE_ID=...
KV_NAMESPACE_ID=...
GITHUB_ORG=hostdaddy-ai
GITHUB_REPO=hostdaddy-platform
```

Claude will wire those into `wrangler.toml`, GitHub Actions, and the Pages project, then we move to Phase 2.

**Never paste API tokens into chat if you can avoid it** — once code is scaffolded, you'll add them directly to Cloudflare Pages env vars and a local `.env.local` file (which is gitignored).

---

*This checklist tracks Section 9.2 + Appendix A of the build spec. Last updated alongside Phase 1 scaffold.*
