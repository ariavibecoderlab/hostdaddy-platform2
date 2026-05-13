#!/usr/bin/env bash
#
# seed-sample-site.sh — insert one sample site (with pages, posts, forms,
# contacts, products) against your LOCAL D1 so the Sites dashboard lights up.
#
# Usage:
#   SEED_EMAIL=test@example.my bash scripts/seed-sample-site.sh
#
# Optional:
#   SEED_REMOTE=1     also seed against remote D1 (skip in production)
#   SEED_NAME="…"     override the site name (default: "<Email handle>'s Site")
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WRANGLER_CONFIG="apps/workers/wrangler.toml"
DB_NAME="hostdaddy-prod"

: "${SEED_EMAIL:?Set SEED_EMAIL=you@example.com}"

red() { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
section() { printf "\n\033[1;36m── %s\033[0m\n" "$*"; }

if ! command -v python3 >/dev/null 2>&1; then
  red "python3 is required (used to generate UUIDs)"
  exit 1
fi
uuid() { python3 -c 'import uuid; print(uuid.uuid4())'; }
now() { python3 -c 'import time; print(int(time.time()))'; }

# ── Look up the customer id by email (local D1) ──────────────────────────────
section "Resolving customer_id for $SEED_EMAIL (local D1)"
LOOKUP_JSON=$(npx --yes wrangler d1 execute "$DB_NAME" --local --json \
  --config "$WRANGLER_CONFIG" \
  --command "SELECT id FROM customers WHERE email='${SEED_EMAIL}' LIMIT 1;" 2>/dev/null || true)

CUSTOMER_ID=$(printf "%s" "$LOOKUP_JSON" | python3 -c '
import json, sys
try:
  data = json.load(sys.stdin)
  rows = data[0].get("results", []) if isinstance(data, list) and data else []
  print(rows[0]["id"] if rows else "")
except Exception:
  print("")
')

if [[ -z "$CUSTOMER_ID" ]]; then
  red "No customer found with email '$SEED_EMAIL'. Register an account first."
  exit 1
fi
green "✓ customer_id = $CUSTOMER_ID"

# ── Generate IDs + values ────────────────────────────────────────────────────
SITE_ID=$(uuid)
HOME_ID=$(uuid)
ABOUT_ID=$(uuid)
POST1_ID=$(uuid)
POST2_ID=$(uuid)
FORM_ID=$(uuid)
CONTACT1_ID=$(uuid)
CONTACT2_ID=$(uuid)
PRODUCT1_ID=$(uuid)
PRODUCT2_ID=$(uuid)
TS=$(now)

HANDLE=$(printf "%s" "$SEED_EMAIL" | cut -d@ -f1)
SITE_NAME=${SEED_NAME:-"${HANDLE}'s Site"}
CF_PROJECT="${HANDLE:0:24}-${SITE_ID:0:6}"

read -r -d '' SEED_SQL <<SQL || true
-- Sample site for ${SEED_EMAIL}
INSERT INTO sites (id, customer_id, hosting_plan_id, domain_id, name, cf_pages_project, template, status, created_at, updated_at)
VALUES ('${SITE_ID}', '${CUSTOMER_ID}', NULL, NULL, '${SITE_NAME//\'/\'\'}', '${CF_PROJECT}', 'starter_personal', 'provisioning', ${TS}, ${TS});

INSERT INTO site_pages (id, customer_id, site_id, slug, title, content_json, status, is_home, created_at, updated_at)
VALUES ('${HOME_ID}', '${CUSTOMER_ID}', '${SITE_ID}', '/', 'Home',
  '{"sections":[
    {"type":"hero","props":{"headline":"${SITE_NAME//\'/\'\'}","subhead":"Built on HostDaddy. Edit this hero in the builder, or ask the AI agent to rewrite it.","cta_label":"Get in touch","cta_href":"#contact","accent_color":"#E50914"}},
    {"type":"features","props":{"heading":"What we do","items":[
      {"title":"Make","body":"Ship products people actually use."},
      {"title":"Sell","body":"Stripe + Billplz checkout out of the box."},
      {"title":"Grow","body":"Email marketing, AI chat, analytics — built in."}
    ]}},
    {"type":"cta","props":{"heading":"Ready to build?","cta_label":"Contact","cta_href":"#contact"}}
  ]}',
  'published', 1, ${TS}, ${TS});

INSERT INTO site_pages (id, customer_id, site_id, slug, title, content_json, status, is_home, created_at, updated_at)
VALUES ('${ABOUT_ID}', '${CUSTOMER_ID}', '${SITE_ID}', '/about', 'About',
  '{"sections":[{"type":"text","props":{"heading":"About","body":"This is a sample About page. Replace this copy from the dashboard."}}]}',
  'draft', 0, ${TS}, ${TS});

INSERT INTO site_posts (id, customer_id, site_id, slug, title, excerpt, content_md, author_name, status, published_at, tags_json, created_at, updated_at)
VALUES ('${POST1_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'hello-world', 'Hello, world',
  'A welcome post from the HostDaddy Sites module.',
  '# Hello, world\n\nThis is your first post. Open the dashboard to edit or ask the AI agent to draft more.',
  'You', 'published', ${TS}, '["welcome"]', ${TS}, ${TS});

INSERT INTO site_posts (id, customer_id, site_id, slug, title, excerpt, content_md, author_name, status, tags_json, created_at, updated_at)
VALUES ('${POST2_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'why-i-built-this', 'Why I built this',
  'A short note on the why behind this project.',
  '# Why I built this\n\nA short note on the why.',
  'You', 'draft', '["founder"]', ${TS}, ${TS});

INSERT INTO site_forms (id, customer_id, site_id, name, slug, fields_json, settings_json, is_active, created_at, updated_at)
VALUES ('${FORM_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'Contact', 'contact',
  '[
    {"id":"name","type":"short_text","label":"Your name","required":true},
    {"id":"email","type":"email","label":"Email","required":true},
    {"id":"message","type":"long_text","label":"Message","required":true}
  ]',
  '{"submit_label":"Send","success_message":"Thanks — talk soon.","notify_emails":["${SEED_EMAIL}"]}',
  1, ${TS}, ${TS});

INSERT INTO site_contacts (id, customer_id, site_id, email, name, source, tags_json, ltv_cents, order_count, last_seen_at, created_at, updated_at)
VALUES ('${CONTACT1_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'first.lead@example.com', 'First Lead', 'form:contact', '["lead"]', 0, 0, ${TS}, ${TS}, ${TS});

INSERT INTO site_contacts (id, customer_id, site_id, email, name, source, tags_json, ltv_cents, order_count, last_seen_at, created_at, updated_at)
VALUES ('${CONTACT2_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'returning.buyer@example.com', 'Returning Buyer', 'order', '["buyer","vip"]', 19700, 2, ${TS}, ${TS}, ${TS});

INSERT INTO site_products (id, customer_id, site_id, name, slug, description_md, type, price_cents, currency, gallery_media_json, track_inventory, status, featured, sold_count, created_at, updated_at)
VALUES ('${PRODUCT1_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'Starter Guide', 'starter-guide',
  'Digital download — the starter guide.',
  'digital', 9700, 'MYR', '[]', 0, 'active', 1, 12, ${TS}, ${TS});

INSERT INTO site_products (id, customer_id, site_id, name, slug, description_md, type, price_cents, currency, gallery_media_json, track_inventory, status, featured, sold_count, created_at, updated_at)
VALUES ('${PRODUCT2_ID}', '${CUSTOMER_ID}', '${SITE_ID}', 'Coaching Session', 'coaching-session',
  '60-minute 1:1 coaching session.',
  'service', 49700, 'MYR', '[]', 0, 'active', 0, 3, ${TS}, ${TS});
SQL

# Write to a tmpfile so wrangler can read it.
TMP_SQL=$(mktemp -t seed-sample-site-XXXXXX.sql)
printf "%s\n" "$SEED_SQL" > "$TMP_SQL"
trap 'rm -f "$TMP_SQL"' EXIT

section "Applying seed to LOCAL D1"
npx --yes wrangler d1 execute "$DB_NAME" --local --file "$TMP_SQL" \
  --config "$WRANGLER_CONFIG"
green "✓ Seed applied locally"

if [[ "${SEED_REMOTE:-0}" == "1" ]]; then
  yellow "SEED_REMOTE=1 set — also applying to REMOTE D1"
  npx --yes wrangler d1 execute "$DB_NAME" --remote --file "$TMP_SQL" \
    --config "$WRANGLER_CONFIG"
  green "✓ Seed applied remotely"
fi

echo ""
green "Sample site seeded:"
echo "  site_id   = $SITE_ID"
echo "  name      = $SITE_NAME"
echo "  pages     = 2  (home published, about draft)"
echo "  posts     = 2  (one published, one draft)"
echo "  forms     = 1  (contact)"
echo "  contacts  = 2  (one lead, one buyer)"
echo "  products  = 2  (digital + service)"
echo ""
echo "Visit http://localhost:5173/dashboard/sites to see it."
