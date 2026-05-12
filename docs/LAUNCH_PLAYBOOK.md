# HostDaddy.app — Launch + group-domain migration playbook

Two things are happening at the same time:

**Part A** — Put **hostdaddy.app** live on the internet so customers can sign up.
**Part B** — Move the group's existing domains (drecoffee.com, brainybunch.edu.my, etc.) onto Cloudflare DNS.

These are independent. You can do Part A and Part B in parallel.

---

## Part A · Get hostdaddy.app live (≈45–60 min)

### A1. Apply D1 migrations to production (5 min)

In your terminal, with your Cloudflare API token + Account ID + D1 database ID in `.env.local`:

```bash
cd ~/Documents/Claude/Projects/hostdaddy.app
pnpm --filter @hostdaddy/db generate    # generates SQL from schema.ts
pnpm --filter @hostdaddy/db migrate     # applies to remote D1 (hostdaddy-prod)
```

Verify the tables exist:

```bash
cd apps/workers
pnpm exec wrangler d1 execute hostdaddy-prod --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see all the tables incl. `customers`, `verification_tokens`, `processed_events`, `audit_log`.

### A2. Set Worker secrets (10 min)

The `apps/workers/wrangler.toml` documents which secrets are needed. Set them with `wrangler secret put`:

```bash
cd apps/workers

pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID    # paste from §1.2 of HOSTDADDY_ACCOUNT_SETUP
pnpm exec wrangler secret put CLOUDFLARE_API_TOKEN     # paste from §1.3

# Generate a strong JWT secret (32+ chars). One-liner:
openssl rand -base64 48 | pnpm exec wrangler secret put JWT_SECRET

pnpm exec wrangler secret put STRIPE_SECRET_KEY         # sk_live_... once you go live; sk_test_... first
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET     # whsec_... — set later after webhook endpoint exists

# Stripe price IDs (one per plan × cycle). Run the seed script first:
STRIPE_SECRET_KEY=sk_test_... pnpm tsx ../../scripts/seed-stripe.ts
# Copy the 8 STRIPE_PRICE_* values it prints, then:
pnpm exec wrangler secret put STRIPE_PRICE_STARTER_MONTHLY
pnpm exec wrangler secret put STRIPE_PRICE_STARTER_YEARLY
pnpm exec wrangler secret put STRIPE_PRICE_BUSINESS_MONTHLY
pnpm exec wrangler secret put STRIPE_PRICE_BUSINESS_YEARLY
pnpm exec wrangler secret put STRIPE_PRICE_AGENCY_MONTHLY
pnpm exec wrangler secret put STRIPE_PRICE_AGENCY_YEARLY
pnpm exec wrangler secret put STRIPE_PRICE_BB_MONTHLY
pnpm exec wrangler secret put STRIPE_PRICE_BB_YEARLY

pnpm exec wrangler secret put BILLPLZ_API_KEY           # from Billplz dashboard
pnpm exec wrangler secret put BILLPLZ_COLLECTION_ID
pnpm exec wrangler secret put BILLPLZ_X_SIGNATURE_KEY
pnpm exec wrangler secret put RESEND_API_KEY            # from resend.com
```

### A3. Update `wrangler.toml` with the real D1 + KV IDs

Edit `apps/workers/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hostdaddy-prod"
database_id = "PASTE_REAL_D1_ID_HERE"   # from §1.5 of account setup

[[kv_namespaces]]
binding = "SESSIONS"
id = "PASTE_REAL_KV_ID_HERE"            # from §1.7
```

Uncomment the `routes` section so the Worker serves api.hostdaddy.app:

```toml
routes = [
  { pattern = "api.hostdaddy.app/*", zone_name = "hostdaddy.app" }
]
```

### A4. Deploy Workers (2 min)

```bash
cd apps/workers
pnpm exec wrangler deploy
```

That gives you a URL like `hostdaddy-api.<your-subdomain>.workers.dev`. After DNS is set up (next step) it'll also answer at `api.hostdaddy.app`.

### A5. Connect Cloudflare Pages to the GitHub repo (10 min)

In Cloudflare dashboard:
1. **Workers & Pages → Create application → Pages → Connect to Git**
2. Authorize the `ariavibecoderlab` GitHub org → pick `hostdaddy-platform2`
3. **Project name:** `hostdaddy-web`
4. **Production branch:** `main`
5. **Framework preset:** Next.js
6. **Build command:** `pnpm install --frozen-lockfile && cd apps/web && pnpm run build:pages`
7. **Build output:** `apps/web/.vercel/output/static`
8. **Root directory:** `/`
9. **Node version:** `20`
10. **Compatibility flags:** Add `nodejs_compat` for both Production and Preview (Settings → Functions → Compatibility flags).
11. Environment variables (Production):

```
NEXT_PUBLIC_APP_URL=https://hostdaddy.app
NEXT_PUBLIC_API_URL=https://api.hostdaddy.app
```

11. Save → first deploy runs automatically.

### A6. Point hostdaddy.app at the Pages project (5 min)

In Cloudflare → Pages → your `hostdaddy-web` project → **Custom domains**:
1. Add `hostdaddy.app` (apex) → Cloudflare creates the DNS records automatically
2. Add `www.hostdaddy.app` → CF creates a CNAME

Then add `api.hostdaddy.app` for the Worker:
1. Cloudflare → Websites → hostdaddy.app → **DNS → Records**
2. Add CNAME `api` → `hostdaddy-api.<your-subdomain>.workers.dev` (proxy on)

### A7. Set up Stripe webhook (5 min)

In Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://api.hostdaddy.app/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy the signing secret → `wrangler secret put STRIPE_WEBHOOK_SECRET`
- Redeploy: `pnpm exec wrangler deploy`

### A8. Set up Resend domain (DNS, 5 min — then up to 24h propagation)

In Resend → Domains → Add Domain → `hostdaddy.app`. Resend gives you ~4 DNS records (SPF, DKIM, MX). Paste them into Cloudflare DNS. Wait for green checks (5 min to 24 h).

### A9. Smoke test (5 min)

Visit:
1. https://hostdaddy.app — homepage loads
2. https://hostdaddy.app/register — create an account
3. Check email — receive welcome email
4. https://hostdaddy.app/dashboard — see the dashboard
5. https://hostdaddy.app/hosting → **Choose Business**
6. Use Stripe test card `4242 4242 4242 4242` → pay → land on success
7. https://hostdaddy.app/dashboard/billing — see the plan
8. Click **Open billing portal** → Stripe portal loads

If all 8 pass, **HostDaddy.app is live**.

---

## Part B · Migrate group domains to Cloudflare DNS

### Important reality check

There are **two separate migrations** that you may be conflating:

1. **DNS migration** — change which nameservers answer queries for the domain. *Fast.* 5 min per domain. Site stays on Wix/GoDaddy.
2. **Hosting migration** — actually move the site files off Wix onto HostDaddy. *Slow.* Wix sites can't be exported in a usable format — they have to be **rebuilt** on HostDaddy. That's days of work per site, not minutes.

This playbook covers **Part B1 (DNS only)**. Hosting rebuilds are a Phase 3+ engineering effort.

### What DNS migration gets you

Even with sites still served from Wix:
- You stop paying GoDaddy's expensive renewal pricing
- You get Cloudflare's free CDN + DDoS in front of every site
- Every domain shows up in one Cloudflare dashboard
- You're ready to flip individual sites onto HostDaddy hosting one at a time, no DNS surgery required

### Recommended migration order

Start with low-stakes, end with the most critical. Allows you to learn the workflow before touching anything that has 130 schools depending on it.

| Order | Domain | Risk | Notes |
|---|---|---|---|
| 1 | successmuslim.com | Low | Test your workflow on this one first |
| 2 | whiteunicornventures.com | Low | Mostly investor reading; low traffic |
| 3 | drecoffee.com | Med | Has email (preserve MX records carefully) |
| 4 | goldify.io | Med | DeFi audience — needs uptime |
| 5 | staffbirthdaygifts.com | Med | B2B SaaS — check Stripe webhook URLs etc. |
| 6 | brainybunch.edu.my | **HIGH** | .edu.my is a special MYNIC TLD — different process. 130 schools depend on this. Do last, off-peak, with backups. |
| — | Other ventures | Mixed | Do one at a time, weekly. |

### Per-domain runbook (gTLDs like .com / .io / .app)

For each domain. Takes ~10 min per domain + propagation.

**Step 1: Capture the current DNS state (5 min)**

Before changing anything, screenshot or export the current DNS zone at GoDaddy/Wix. You're looking for:

- **A** records — IP addresses the domain points to
- **CNAME** records — aliases (especially `www`)
- **MX** records — **critical if you use email on this domain**
- **TXT** records — SPF, DKIM, DMARC, domain verification (Google Workspace, etc.)
- **NS** records — current nameservers (you'll change these)

```bash
# Quick command-line dump:
dig +short MX drecoffee.com
dig +short A drecoffee.com
dig +short TXT drecoffee.com
dig +short CNAME www.drecoffee.com
```

Save the output. If anything goes wrong you can put it back.

**Step 2: Add the domain to Cloudflare (3 min)**

1. Cloudflare → Add a site → enter `drecoffee.com` → Free plan
2. Cloudflare auto-scans the current DNS → imports records
3. Review the imported records. **Every MX and TXT you had should be present.** If not, paste them manually now.
4. Cloudflare gives you two nameservers like `chad.ns.cloudflare.com` and `lola.ns.cloudflare.com`. Copy them.

**Step 3: Change nameservers at the current registrar (2 min)**

- **At GoDaddy:** My Products → Domain → DNS → Nameservers → Change → "I'll use my own" → paste the two Cloudflare nameservers → Save.
- **At Wix:** Domains → manage → Advanced → Name servers → choose "Use external nameservers" → paste → Save.
- **At Namecheap:** Domain List → Manage → Nameservers → Custom DNS → paste → Save.

**Step 4: Wait for propagation (5–30 min, sometimes longer)**

Check with:

```bash
dig +short NS drecoffee.com
# Should show the cloudflare.com nameservers (not the old ones).
```

You can also watch the Cloudflare → Overview page for that zone — the banner flips to **Active** once DNS is verified.

**Step 5: Verify the site still loads (1 min)**

Open the site in a fresh browser. If it loads identically, you're done. Mail should still work because MX records were carried over.

If you see a 502 or weird TLS error in the first 5 min, that's normal — give it 15. If it's still broken at 30 min, check your imported records vs the screenshot you took in step 1.

### Special case: brainybunch.edu.my

Cloudflare can serve DNS for `.edu.my` domains but **cannot register** them. The flow:

1. Add the domain to Cloudflare (same as step 2 above) — this enables DNS
2. At MYNIC (or your current MYNIC reseller — Exabytes, IPserverOne, etc.), change nameservers to Cloudflare's
3. Registrar (who you pay the renewal fee to) stays with MYNIC
4. Cloudflare handles all DNS resolution

This means you keep paying MYNIC ~RM 30/yr per .edu.my domain, but you get all the Cloudflare benefits. To transfer the registrar itself (and get HostDaddy.app to manage it), you need the Exabytes reseller agreement — that's HOSTDADDY_ACCOUNT_SETUP.md §8.

**Critical for brainybunch.edu.my specifically:**

- Coordinate with all 130 franchisees BEFORE doing this. Even a 30-min DNS blip during propagation will cause panicked WhatsApps.
- Pick a Sunday 2am Malaysia time for the change.
- Have one franchisee's site URL on standby to test as soon as DNS flips.

### After DNS migration: optional registrar transfer

Once DNS is stable in Cloudflare and the site has been working for 1+ weeks:

1. **Unlock** the domain at the current registrar (GoDaddy/Namecheap)
2. **Get the auth code** (EPP code) — usually emailed to you
3. **Cloudflare → Domains → Transfer Domains** → enter domain + EPP → pay 1-year renewal (this extends your registration by 1 year)
4. Wait 5–7 days for ICANN to process
5. Domain registrar = Cloudflare. Renewals are now at-cost (no more GoDaddy markups).

ICANN locks new registrations for 60 days; if a domain was just registered, transfer-out is blocked until day 61.

### What you can NOT do via DNS alone

- Migrate Wix-hosted content. Wix doesn't have a "download site" feature for general transfer. Sites must be rebuilt.
- Migrate Wix-managed email mailboxes. If you bought email through Wix, you need to set up Zoho/Gmail equivalent.
- Migrate Wix's e-commerce data. Carts, customer accounts, products — all proprietary.

For each Wix-hosted site, the rebuild path is:
1. Document the site's structure (pages, sections, content)
2. Use HostDaddy's Phase 5 AI site builder (when it ships) OR Cowork Claude to rebuild it manually
3. Deploy to Cloudflare Pages via HostDaddy's hosting flow
4. Point the DNS A/CNAME records at the new Pages project
5. Sunset the Wix subscription

This is real engineering effort — plan a week per significant site.

---

## Quick reference: which step depends on what

```
A1 D1 migrate          → needed before A4
A2 Worker secrets      → needed before A4
A3 wrangler.toml IDs   → needed before A4
A4 Worker deploy       → needed before A5/A6 webhook + custom domain work
A5 Pages connect       → needed before A6
A6 Custom domain       → needed before A9 smoke test
A7 Stripe webhook      → needed before paid transactions work
A8 Resend DNS          → needed for welcome/reset emails to be deliverable
A9 Smoke test          → final acceptance

B per-domain runbook   → independent of Part A; can start before/after/during
```

---

*Keep this doc updated as you discover edge cases per domain.*
