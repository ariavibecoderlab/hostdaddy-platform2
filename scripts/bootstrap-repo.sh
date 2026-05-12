#!/usr/bin/env bash
#
# bootstrap-repo.sh
# One-time script to clean up Claude's partial git state and create
# the first commit. Run this once from your Terminal, then push.
#
# Usage:
#   cd ~/Documents/Claude/Projects/hostdaddy.app
#   bash scripts/bootstrap-repo.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "════════════════════════════════════════════════════════════"
echo "  HostDaddy.app — repo bootstrap"
echo "════════════════════════════════════════════════════════════"
echo "Working in: $REPO_ROOT"
echo ""

# 1. Clean up any partial state from the Claude session
echo "[1/6] Cleaning up partial state..."
rm -f .git/index.lock 2>/dev/null || true
rm -f _tmp_* 2>/dev/null || true
find .git/objects -name 'tmp_obj_*' -delete 2>/dev/null || true

# 2. Re-initialise git cleanly
echo "[2/6] (Re)initialising git..."
if [ ! -d .git ]; then
  git init -b main
else
  git checkout -B main 2>/dev/null || git branch -M main
fi

# 3. Set committer info (override locally if you prefer)
echo "[3/6] Setting committer..."
git config user.email "${GIT_EMAIL:-fadzil@whiteunicornventures.com}"
git config user.name "${GIT_NAME:-Coach Fadzil}"

# 4. Stage everything respecting .gitignore
echo "[4/6] Staging files..."
git add .

# 5. Show what's about to be committed
STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')
echo "    → $STAGED files staged"

# 6. Commit
echo "[5/6] Creating initial commit..."
git commit -m "Phase 1 scaffold — HostDaddy.app monorepo foundation

- Turborepo + pnpm workspace (apps/web, apps/workers, 4 packages)
- packages/cloudflare: typed Registrar/DNS/Pages/Email Routing/MYNIC clients
- packages/ui: brand-themed Tailwind primitives (Navy/Electric/Cyan)
- packages/db: Drizzle ORM schema for D1 (10 tables incl. audit_log)
- packages/stripe: checkout, customer portal, webhook verification
- apps/web: Next.js 14 homepage (hero search, pricing, BB banner, footer)
- apps/workers: Hono router with /health and /domains/check
- CI: typecheck + Workers deploy via GitHub Actions
- Docs: README, CONTRIBUTING, ARCHITECTURE, PHASE_2_NEXT, ACCOUNT_SETUP

Refs: HostDaddy_AI_Build_Specification.docx Section 9, Steps 1-3"

echo "[6/6] Done."
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Next steps"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. Repo already exists at:"
echo "     https://github.com/ariavibecoderlab/hostdaddy-platform2"
echo ""
echo "2. Push (run these from this folder):"
echo "     git remote remove origin 2>/dev/null || true"
echo "     git remote add origin git@github.com:ariavibecoderlab/hostdaddy-platform2.git"
echo "     git branch -M main"
echo "     git push -u origin main"
echo ""
echo "   If the remote already has commits and you want this scaffold to replace them:"
echo "     git push -u origin main --force"
echo ""
echo "3. Invite your team:"
echo "     https://github.com/ariavibecoderlab/hostdaddy-platform2/settings/access"
echo ""
echo "4. Tell each developer to read:"
echo "     CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/PHASE_2_NEXT.md"
echo ""
echo "Git log:"
git log --oneline -5
