# Contributing to HostDaddy.ai

Welcome. This doc gets you from `git clone` to a working dev environment in under 10 minutes.

For *what* we're building and *why*, read [README.md](./README.md) and `HostDaddy_AI_Build_Specification.docx`.
For *what's next*, read [docs/PHASE_2_NEXT.md](./docs/PHASE_2_NEXT.md).
For *how the system is wired*, read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## 1. Prerequisites

| Tool        | Version  | Install                                           |
| ----------- | -------- | ------------------------------------------------- |
| Node.js     | ≥ 20.10  | https://nodejs.org or `nvm install 20`            |
| pnpm        | ≥ 9.12   | `npm install -g pnpm@9.12.0`                      |
| Wrangler    | ≥ 3.74   | comes via pnpm install                            |
| Git         | any      | preinstalled                                      |
| 1Password CLI | latest | https://1password.com/downloads/command-line/     |

We use **pnpm**, not npm or yarn. Don't mix them — you'll desync the lockfile.

## 2. Get the code

```bash
git clone git@github.com:hostdaddy-ai/hostdaddy-platform.git
cd hostdaddy-platform
pnpm install
```

## 3. Get your secrets

Secrets live in the **HostDaddy.ai — Engineering** 1Password vault. Ask your team lead to add you.

```bash
# Once you have vault access:
op read "op://Engineering/HostDaddy local .env/notesPlain" > .env.local
```

Or copy `.env.example` to `.env.local` and paste the values manually.

**Never commit `.env.local`** — it's gitignored, but be vigilant.

For Wrangler (Cloudflare CLI), authenticate with *your own* Cloudflare account:

```bash
cd apps/workers
pnpm exec wrangler login
```

This OAuths your personal Cloudflare account against the HostDaddy.ai organisation. You'll have whatever permissions the account owner granted you.

## 4. Run it

```bash
pnpm dev
```

That starts both:
- **Web** on http://localhost:3000 — Next.js marketing site + customer dashboard
- **Workers** on http://localhost:8787 — Hono API, runs against local D1 via Wrangler

Open http://localhost:3000 and you should see the homepage.

To run just one:

```bash
pnpm --filter @hostdaddy/web dev
pnpm --filter @hostdaddy/workers dev
```

## 5. Quality gates

Before pushing any branch:

```bash
pnpm typecheck   # all packages must pass
pnpm lint        # ESLint + tsc --noEmit
pnpm test        # unit tests (Vitest)
```

CI runs the same checks on every PR. Don't bypass — fix the code.

## 6. Database

The schema lives in `packages/db/src/schema.ts` using Drizzle ORM.

```bash
# After editing schema.ts, generate a migration:
pnpm --filter @hostdaddy/db generate

# Apply to local D1:
pnpm --filter @hostdaddy/db migrate:local

# Apply to remote (production D1). Only the team lead runs this.
pnpm --filter @hostdaddy/db migrate
```

Seed local dev data:

```bash
pnpm --filter @hostdaddy/db seed
```

## 7. Branching strategy

We're small. Keep it simple:

```
main                ← always deployable, protected
├── feat/<short>    ← new feature work
├── fix/<short>     ← bug fixes
└── chore/<short>   ← refactors, deps, docs
```

Rules:
- **Never push directly to main.** Open a PR.
- **One concern per branch.** If you find a second thing to fix, open a second branch.
- **Rebase, don't merge.** `git pull --rebase origin main` before opening a PR.
- **Delete your branch** after the PR merges.

## 8. Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(auth): add password reset flow
fix(dns): handle 404 from cloudflare list-records
chore(deps): bump drizzle to 0.34
docs(architecture): clarify worker → d1 path
```

Scope is the package or feature area (`auth`, `dns`, `billing`, `ui`, `db`, etc.).

## 9. Pull request checklist

Every PR description must include:

- [ ] **Linked task / issue** — `Closes #123` or the Linear ticket
- [ ] **What changed** — 1–3 bullets, plain English
- [ ] **Why** — the user-facing or business reason
- [ ] **How tested** — manual steps + which tests cover it
- [ ] **Screenshots** — for any UI change
- [ ] **Migration risk** — flag breaking changes, env var additions, DB schema changes

Reviewers look at:
1. Does this match the spec doc / phase plan?
2. Are types right? Drizzle queries safe?
3. Are Cloudflare API calls error-handled (the `CloudflareApiError` class)?
4. Money handled as integer cents, never floats?
5. PII / API tokens never logged?

## 10. Code style

- **TypeScript strict mode is on.** No `any`. Use `unknown` if you must.
- **Imports** — prefer named exports. Avoid default exports outside Next.js page/layout files.
- **Money** — always integer **MYR cents** in the database. Convert at the boundary.
- **Dates** — store as Unix timestamps (integer seconds) in D1. Convert at the boundary.
- **IDs** — `randomUUID()` from `node:crypto` (or `crypto.randomUUID()` in Workers).
- **Errors** — throw `Error` subclasses, never raw strings.
- **Logs** — `console.log` in Workers is fine for now; structured logging comes in Phase 7.

## 11. Security

- **Never log API tokens, JWTs, passwords, or PII.** Logs go to Cloudflare and are queryable.
- **Use the typed Cloudflare wrapper** (`@hostdaddy/cloudflare`) — don't call the CF API directly from Workers.
- **Validate user input** at the edge with Zod (see `apps/workers/src/routes/domains.ts` for the pattern).
- **Webhook signatures** — always verify Stripe & Billplz signatures before trusting the body.
- **Suspicious activity** — if you spot something off (credentials in a commit, weird API patterns), Slack `@fadzil` immediately. Don't open a public issue.

## 12. Getting unstuck

In order of escalation:

1. Check `docs/ARCHITECTURE.md` and the build spec doc
2. Search the repo: `git log --all --oneline | grep <keyword>`
3. Ask in `#hostdaddy-eng` Slack
4. @-mention your team lead
5. As a last resort, ask Coach Fadzil

We move fast. Don't wait two days for an answer — escalate at the 30-minute mark if you're stuck.

---

*Welcome aboard. Bismillah, let's build.*
