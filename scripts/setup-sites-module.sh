#!/usr/bin/env bash
#
# setup-sites-module.sh — one-time runbook for Phase A of the Sites module.
#
# What it does (idempotent — safe to re-run):
#   1. Install pnpm deps (picks up @anthropic-ai/sdk added in workers)
#   2. Apply D1 migrations locally + remotely
#   3. Create the R2 bucket the media library writes to
#   4. List the new secrets you still need to set
#   5. Offer to seed a sample site against your local DB
#
# Run from repo root:
#   bash scripts/setup-sites-module.sh
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WRANGLER_CONFIG="apps/workers/wrangler.toml"
DB_NAME="hostdaddy-prod"
R2_BUCKET="hostdaddy-assets"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }
section() { printf "\n\033[1;36m── %s\033[0m\n" "$*"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    red "Required command not found: $1"
    exit 1
  fi
}

confirm() {
  local prompt="$1"
  read -r -p "$prompt [y/N] " ans
  [[ "$ans" =~ ^[yY] ]]
}

echo "════════════════════════════════════════════════════════════"
echo "  HostDaddy.app — Sites module Phase A setup"
echo "════════════════════════════════════════════════════════════"
echo "Repo: $REPO_ROOT"
echo "Wrangler config: $WRANGLER_CONFIG"
echo "D1 database:     $DB_NAME"
echo "R2 bucket:       $R2_BUCKET"
echo ""

require_cmd pnpm
require_cmd npx

# ── 1. Install deps ──────────────────────────────────────────────────────────
section "1/5  pnpm install (picks up @anthropic-ai/sdk)"
pnpm install
green "✓ Dependencies installed"

# ── 2. Apply D1 migrations ───────────────────────────────────────────────────
section "2/5  Apply D1 migrations (local then remote)"

green "→ Local D1"
pnpm --filter @hostdaddy/db migrate:local

if confirm "→ Apply migrations to PRODUCTION D1 now?"; then
  pnpm --filter @hostdaddy/db migrate
  green "✓ Remote migrations applied"
else
  yellow "Skipped remote migration. Run later with: pnpm --filter @hostdaddy/db migrate"
fi

# ── 3. Create R2 bucket ──────────────────────────────────────────────────────
section "3/5  R2 bucket for media library"

if npx --yes wrangler r2 bucket list 2>/dev/null | grep -q "^${R2_BUCKET}$"; then
  green "✓ R2 bucket '$R2_BUCKET' already exists"
else
  if confirm "→ Create R2 bucket '$R2_BUCKET' now?"; then
    npx --yes wrangler r2 bucket create "$R2_BUCKET"
    green "✓ R2 bucket created"
  else
    yellow "Skipped. Run later: wrangler r2 bucket create $R2_BUCKET"
  fi
fi

# ── 4. Secrets ───────────────────────────────────────────────────────────────
section "4/5  Secrets you should set (skip in dev)"
cat <<'EOF'
The Sites module adds two new secrets:

  ANTHROPIC_API_KEY   — needed for the AI build agent. Without it, the agent
                        runs in a deterministic mock mode (fine for dev).
  TURNSTILE_SECRET    — needed for captcha-protected public form submissions.
                        Without it, Turnstile fails open.

Set them when you're ready:

  cd apps/workers
  npx wrangler secret put ANTHROPIC_API_KEY
  npx wrangler secret put TURNSTILE_SECRET

You may also want to set:

  MEDIA_PUBLIC_BASE_URL  — public URL for media. Wire this in [vars] of
                           apps/workers/wrangler.toml (currently empty,
                           which means media is served via /r2/* on this
                           Worker).
  CF_SAAS_ZONE_ID         — zone id for the hostdaddy.app parent zone, used by
                            CF for SaaS Custom Hostnames. Already declared
                            in env.ts; set the value via:
                              npx wrangler secret put CF_SAAS_ZONE_ID
EOF

# ── 5. Optional: seed a sample site ──────────────────────────────────────────
section "5/5  Seed a sample site against LOCAL D1"

if confirm "→ Seed a sample site now? (local only)"; then
  read -r -p "Customer email to attach the site to: " SEED_EMAIL
  if [[ -z "${SEED_EMAIL:-}" ]]; then
    yellow "No email provided; skipping seed."
  else
    SEED_EMAIL="$SEED_EMAIL" bash "$REPO_ROOT/scripts/seed-sample-site.sh"
  fi
else
  yellow "Skipped. Run later: SEED_EMAIL=you@example.com bash scripts/seed-sample-site.sh"
fi

echo ""
green "════════════════════════════════════════════════════════════"
green "  Sites module Phase A setup complete."
green "════════════════════════════════════════════════════════════"
echo ""
cat <<'EOF'
Next:

  pnpm --filter @hostdaddy/workers dev   # start the API on :8787
  pnpm --filter @hostdaddy/web dev       # start the dashboard on :5173

Open http://localhost:5173/dashboard/sites — your sample site should appear.

For the full Phase A walkthrough see docs/PHASE_A_SITES_MODULE.md.
EOF
