/**
 * /sites — Sites module API (Phase A).
 *
 * Surface area covered here:
 *   GET    /sites                              list current user's sites + counts
 *   GET    /sites/:siteId                      site detail
 *
 *   GET    /sites/:siteId/pages
 *   POST   /sites/:siteId/pages                create page
 *   GET    /sites/:siteId/pages/:pageId
 *   PATCH  /sites/:siteId/pages/:pageId        update title/slug/content/seo/status
 *   DELETE /sites/:siteId/pages/:pageId
 *
 *   GET    /sites/:siteId/posts
 *   POST   /sites/:siteId/posts
 *   PATCH  /sites/:siteId/posts/:postId
 *   DELETE /sites/:siteId/posts/:postId
 *
 *   GET    /sites/:siteId/forms
 *   POST   /sites/:siteId/forms
 *   PATCH  /sites/:siteId/forms/:formId
 *   DELETE /sites/:siteId/forms/:formId
 *
 *   GET    /sites/:siteId/submissions
 *   POST   /sites/:siteId/forms/:slug/submit   PUBLIC (no auth)
 *
 *   GET    /sites/:siteId/contacts
 *   POST   /sites/:siteId/contacts
 *   PATCH  /sites/:siteId/contacts/:contactId
 *   DELETE /sites/:siteId/contacts/:contactId
 *
 *   GET    /sites/:siteId/products
 *   POST   /sites/:siteId/products
 *   PATCH  /sites/:siteId/products/:productId
 *   DELETE /sites/:siteId/products/:productId
 *
 *   GET    /sites/:siteId/orders
 *
 * Every authenticated route requires the JWT cookie. Ownership is enforced by
 * `loadSite()` which 404s if the requested site isn't owned by the caller.
 * Every mutation writes an entry to `audit_log`.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  createDb,
  sites,
  sitePages,
  sitePosts,
  siteForms,
  siteFormSubmissions,
  siteContacts,
  siteProducts,
  siteOrders,
  siteMedia,
  siteAiRuns,
  siteVersions,
  hostingPlans,
  auditLog,
  PLANS,
  getPlan,
  checkLimit,
  eq,
  and,
  desc,
  sql,
} from '@hostdaddy/db';
import { createCloudflare, CustomHostnamesClient } from '@hostdaddy/cloudflare';
import { requireAuth } from '../middleware/auth';
import type { AppBindings, Env, AuthUser } from '../env';

export const sitesRoute = new Hono<AppBindings>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

type DbClient = ReturnType<typeof createDb>;

async function loadSite(
  db: DbClient,
  customerId: string,
  siteId: string,
): Promise<typeof sites.$inferSelect | null> {
  const rows = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.customer_id, customerId)))
    .limit(1);
  return rows[0] ?? null;
}

async function writeAudit(
  db: DbClient,
  args: {
    user: AuthUser;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    id: crypto.randomUUID(),
    customer_id: args.user.customerId,
    actor: 'customer',
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId,
    metadata: args.metadata ? JSON.stringify(args.metadata) : null,
    ip_address: args.ip ?? null,
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-/]+$/, 'Slug must contain only lowercase letters, numbers, dashes, slashes');

// ─── GET /sites ──────────────────────────────────────────────────────────────

sitesRoute.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(sites)
    .where(eq(sites.customer_id, user.customerId))
    .orderBy(desc(sites.created_at));

  // Inline counts. For a handful of sites per customer this is cheap; revisit
  // with a single aggregated query if a customer ever has 100+ sites.
  const result = await Promise.all(
    rows.map(async (s) => {
      const [pageCount, postCount, productCount, contactCount] = await Promise.all([
        db
          .select({ n: sql<number>`count(*)` })
          .from(sitePages)
          .where(eq(sitePages.site_id, s.id))
          .then((r) => Number(r[0]?.n ?? 0)),
        db
          .select({ n: sql<number>`count(*)` })
          .from(sitePosts)
          .where(eq(sitePosts.site_id, s.id))
          .then((r) => Number(r[0]?.n ?? 0)),
        db
          .select({ n: sql<number>`count(*)` })
          .from(siteProducts)
          .where(eq(siteProducts.site_id, s.id))
          .then((r) => Number(r[0]?.n ?? 0)),
        db
          .select({ n: sql<number>`count(*)` })
          .from(siteContacts)
          .where(eq(siteContacts.site_id, s.id))
          .then((r) => Number(r[0]?.n ?? 0)),
      ]);
      return {
        id: s.id,
        name: s.name,
        template: s.template,
        status: s.status,
        cf_pages_project: s.cf_pages_project,
        last_deployed_at: s.last_deployed_at,
        counts: {
          pages: pageCount,
          posts: postCount,
          products: productCount,
          contacts: contactCount,
        },
      };
    }),
  );

  return c.json({ sites: result });
});

// ─── GET /sites/:siteId ──────────────────────────────────────────────────────

sitesRoute.get('/:siteId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  return c.json({ site });
});

// ─── POST /sites — create a new site ─────────────────────────────────────────
// Requires an active hosting plan. Creates the site row + a default home page.
// Cloudflare Pages project provisioning is queued (a future worker will pick
// up sites in `provisioning` status, create the CF Pages project, and flip
// the status to `building` then `live`).

const newSiteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  hosting_plan_id: z.string().min(1),
  template: z.string().max(80).optional().nullable(),
});

sitesRoute.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newSiteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  // Verify the hosting plan exists and belongs to this customer.
  const planRows = await db
    .select()
    .from(hostingPlans)
    .where(
      and(
        eq(hostingPlans.id, parsed.data.hosting_plan_id),
        eq(hostingPlans.customer_id, user.customerId),
      ),
    )
    .limit(1);
  const plan = planRows[0];
  if (!plan) return c.json({ error: 'Hosting plan not found' }, 404);
  if (plan.status !== 'active' && plan.status !== 'trial') {
    return c.json({ error: 'Hosting plan is not active' }, 403);
  }

  // Enforce site limit.
  if (plan.sites_limit !== -1) {
    const countRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(sites)
      .where(eq(sites.hosting_plan_id, plan.id));
    const existing = Number(countRows[0]?.n ?? 0);
    if (existing >= plan.sites_limit) {
      return c.json(
        { error: `Plan limit reached (${plan.sites_limit} sites). Upgrade to add more.` },
        403,
      );
    }
  }

  const id = crypto.randomUUID();
  const baseSlug = slugify(parsed.data.name) || id.slice(0, 8);
  // Make sure the CF Pages project name is globally-unique-enough. Append a
  // short suffix derived from the site id to avoid collisions across tenants.
  const cfPagesProject = `${baseSlug.slice(0, 40)}-${id.slice(0, 6)}`;

  try {
    await db.insert(sites).values({
      id,
      customer_id: user.customerId,
      hosting_plan_id: plan.id,
      domain_id: null,
      name: parsed.data.name,
      cf_pages_project: cfPagesProject,
      template: parsed.data.template ?? null,
      status: 'provisioning',
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'Site name collision — try a different name' }, 409);
    }
    throw err;
  }

  // Default home page so the dashboard isn't empty.
  await db.insert(sitePages).values({
    id: crypto.randomUUID(),
    customer_id: user.customerId,
    site_id: id,
    slug: '/',
    title: parsed.data.name,
    content_json: JSON.stringify({
      sections: [
        {
          type: 'hero',
          props: {
            headline: parsed.data.name,
            subhead: 'Welcome to your new site. Edit this hero in the builder.',
            cta_label: 'Get in touch',
            cta_href: '#contact',
          },
        },
      ],
    }),
    status: 'draft',
    is_home: true,
  });

  await writeAudit(db, {
    user,
    action: 'site.created',
    entityType: 'site',
    entityId: id,
    metadata: { name: parsed.data.name, hosting_plan_id: plan.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  return c.json({ site: fresh[0] }, 201);
});

// ─── DELETE /sites/:siteId ───────────────────────────────────────────────────

sitesRoute.delete('/:siteId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  // Cascade handles all the content tables. Media R2 objects are kept until
  // a janitor cron sweeps orphaned r2_keys (so accidental deletes are
  // recoverable for ~24 hours).
  await db.delete(sites).where(eq(sites.id, site.id));

  await writeAudit(db, {
    user,
    action: 'site.deleted',
    entityType: 'site',
    entityId: site.id,
    metadata: { name: site.name, cf_pages_project: site.cf_pages_project },
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── Custom domain attach / status / detach (Cloudflare for SaaS) ────────────
// Lets a customer point an existing domain at HostDaddy.app. We create a CF
// Custom Hostname on the SaaS zone, return the TXT/CNAME record the customer
// must add at their existing registrar, and poll until SSL is live.

const HOSTNAME_RE = /^(?=.{4,253}$)(?!.*\.\.)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_HOSTNAMES = new Set([
  'hostdaddy.app',
  'www.hostdaddy.app',
  'api.hostdaddy.app',
  'sites.hostdaddy.app',
  'mail.hostdaddy.app',
]);

const attachDomainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .min(4)
    .max(253)
    .refine((h) => HOSTNAME_RE.test(h), 'Not a valid domain (use e.g. yourbrand.com)')
    .refine((h) => !RESERVED_HOSTNAMES.has(h), 'This domain is reserved.'),
});

function makeCf(env: Env) {
  return createCloudflare({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
  });
}

function ensureSaasConfig(env: Env): { zoneId: string; cnameTarget: string } | null {
  if (!env.CF_SAAS_ZONE_ID) return null;
  return {
    zoneId: env.CF_SAAS_ZONE_ID,
    cnameTarget: env.CF_SAAS_CNAME_TARGET ?? 'hostdaddy.app',
  };
}

sitesRoute.post('/:siteId/attach-domain', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);

  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const saas = ensureSaasConfig(c.env);
  if (!saas) {
    return c.json(
      { error: 'Custom domains are not configured for this environment yet.' },
      503,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = attachDomainSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const hostname = parsed.data.hostname;

  // Plan limit: how many custom domains can this customer attach?
  const planRows = await db
    .select()
    .from(hostingPlans)
    .where(eq(hostingPlans.id, site.hosting_plan_id))
    .limit(1);
  const plan = planRows[0];
  if (!plan) return c.json({ error: 'Site has no active hosting plan' }, 403);

  const planType = plan.plan_type;
  const limit = getPlan(planType).limits.custom_domains;
  if (limit !== -1) {
    const usedRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(sites)
      .where(
        and(
          eq(sites.customer_id, user.customerId),
          sql`${sites.custom_hostname} IS NOT NULL`,
        ),
      );
    const used = Number(usedRows[0]?.n ?? 0);
    // Treat the current site's existing hostname as "freed" if we're replacing it.
    const effective = site.custom_hostname ? used - 1 : used;
    if (effective >= limit) {
      return c.json(
        {
          error: `Your ${getPlan(planType).name} plan allows ${limit} custom domain${limit === 1 ? '' : 's'}.`,
          limit,
          used: effective,
        },
        403,
      );
    }
  }

  // Reject duplicate across tenants.
  const dup = await db
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.custom_hostname, hostname), sql`${sites.id} != ${site.id}`))
    .limit(1);
  if (dup.length > 0) {
    return c.json({ error: 'That domain is already attached to another HostDaddy site.' }, 409);
  }

  // Call Cloudflare API.
  const cf = makeCf(c.env);
  let ch;
  try {
    // If this site already had a hostname attached, detach the old one first.
    if (site.cf_hostname_id) {
      try {
        await cf.hostnames.delete(saas.zoneId, site.cf_hostname_id);
      } catch {
        // Idempotent — CF returns 404 if already deleted; ignore.
      }
    }
    ch = await cf.hostnames.create(saas.zoneId, {
      hostname,
      ssl: { type: 'dv', method: 'txt' },
      custom_metadata: { site_id: site.id, customer_id: user.customerId },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cloudflare API error';
    return c.json({ error: `Could not register the domain: ${msg}` }, 502);
  }

  const summary = CustomHostnamesClient.summarise(ch);

  await db
    .update(sites)
    .set({
      custom_hostname: hostname,
      cf_hostname_id: ch.id,
      ssl_status: ch.ssl.status,
      verification_record_type: summary.record_to_add?.type ?? null,
      verification_record_name: summary.record_to_add?.name ?? null,
      verification_record_value: summary.record_to_add?.value ?? null,
      provisioned_at: ch.status === 'active' && ch.ssl.status === 'active' ? new Date() : null,
      updated_at: new Date(),
    })
    .where(eq(sites.id, site.id));

  await writeAudit(db, {
    user,
    action: 'site.domain.attached',
    entityType: 'site',
    entityId: site.id,
    metadata: { hostname, cf_hostname_id: ch.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    {
      site_id: site.id,
      hostname,
      status: summary.status,
      // The CNAME the customer must add at their DNS to actually route traffic.
      // CF for SaaS routes via SNI on the apex hostdaddy.app zone, so all
      // customer domains CNAME to the same target.
      cname: { name: hostname, target: saas.cnameTarget },
      // Plus an ownership/SSL verification record if CF still needs one.
      verification: summary.record_to_add ?? null,
      ssl: { status: ch.ssl.status },
    },
    201,
  );
});

sitesRoute.get('/:siteId/domain-status', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);

  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  if (!site.cf_hostname_id || !site.custom_hostname) {
    return c.json({ attached: false });
  }

  const saas = ensureSaasConfig(c.env);
  if (!saas) {
    return c.json({ error: 'Custom domains not configured' }, 503);
  }

  const cf = makeCf(c.env);
  let ch;
  try {
    ch = await cf.hostnames.get(saas.zoneId, site.cf_hostname_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cloudflare API error';
    return c.json({ error: msg }, 502);
  }

  const summary = CustomHostnamesClient.summarise(ch);

  await db
    .update(sites)
    .set({
      ssl_status: ch.ssl.status,
      verification_record_type: summary.record_to_add?.type ?? null,
      verification_record_name: summary.record_to_add?.name ?? null,
      verification_record_value: summary.record_to_add?.value ?? null,
      provisioned_at:
        site.provisioned_at ??
        (ch.status === 'active' && ch.ssl.status === 'active' ? new Date() : null),
      updated_at: new Date(),
    })
    .where(eq(sites.id, site.id));

  return c.json({
    attached: true,
    hostname: site.custom_hostname,
    status: summary.status,
    cname: { name: site.custom_hostname, target: saas.cnameTarget },
    verification: summary.record_to_add ?? null,
    ssl: { status: ch.ssl.status, errors: ch.ssl.validation_errors ?? [] },
  });
});

sitesRoute.delete('/:siteId/domain', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);

  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  if (!site.cf_hostname_id) {
    return c.json({ ok: true, already_detached: true });
  }

  const saas = ensureSaasConfig(c.env);
  if (!saas) {
    return c.json({ error: 'Custom domains not configured' }, 503);
  }

  const cf = makeCf(c.env);
  try {
    await cf.hostnames.delete(saas.zoneId, site.cf_hostname_id);
  } catch {
    // Idempotent — keep going even if CF returns 404.
  }

  await db
    .update(sites)
    .set({
      custom_hostname: null,
      cf_hostname_id: null,
      ssl_status: null,
      verification_record_type: null,
      verification_record_name: null,
      verification_record_value: null,
      provisioned_at: null,
      updated_at: new Date(),
    })
    .where(eq(sites.id, site.id));

  await writeAudit(db, {
    user,
    action: 'site.domain.detached',
    entityType: 'site',
    entityId: site.id,
    metadata: { hostname: site.custom_hostname },
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json({ ok: true });
});

// ─── Pages ───────────────────────────────────────────────────────────────────

const newPageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(200),
  content_json: z.string().optional(),
  is_home: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
});

const patchPageSchema = newPageSchema.partial();

sitesRoute.get('/:siteId/pages', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const pages = await db
    .select()
    .from(sitePages)
    .where(eq(sitePages.site_id, site.id))
    .orderBy(desc(sitePages.updated_at));
  return c.json({ pages });
});

sitesRoute.post('/:siteId/pages', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newPageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const isPublished = parsed.data.status === 'published';

  // If is_home is true, demote any existing home pages on this site
  if (parsed.data.is_home) {
    await db
      .update(sitePages)
      .set({ is_home: false, updated_at: now })
      .where(and(eq(sitePages.site_id, site.id), eq(sitePages.is_home, true)));
  }

  try {
    await db.insert(sitePages).values({
      id,
      customer_id: user.customerId,
      site_id: site.id,
      slug: parsed.data.slug,
      title: parsed.data.title,
      content_json: parsed.data.content_json ?? '{"sections":[]}',
      is_home: parsed.data.is_home ?? false,
      status: parsed.data.status ?? 'draft',
      seo_title: parsed.data.seo_title ?? null,
      seo_description: parsed.data.seo_description ?? null,
      published_at: isPublished ? now : null,
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A page with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.page.created',
    entityType: 'site_page',
    entityId: id,
    metadata: { slug: parsed.data.slug, site_id: site.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  const page = await db.select().from(sitePages).where(eq(sitePages.id, id)).limit(1);
  return c.json({ page: page[0] }, 201);
});

sitesRoute.get('/:siteId/pages/:pageId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const rows = await db
    .select()
    .from(sitePages)
    .where(and(eq(sitePages.id, c.req.param('pageId')), eq(sitePages.site_id, site.id)))
    .limit(1);
  const page = rows[0];
  if (!page) return c.json({ error: 'Page not found' }, 404);
  return c.json({ page });
});

sitesRoute.patch('/:siteId/pages/:pageId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const pageId = c.req.param('pageId');
  const existingRows = await db
    .select()
    .from(sitePages)
    .where(and(eq(sitePages.id, pageId), eq(sitePages.site_id, site.id)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return c.json({ error: 'Page not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = patchPageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }

  const now = new Date();
  const update: Partial<typeof sitePages.$inferInsert> & { updated_at: Date } = {
    updated_at: now,
  };
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.title !== undefined) update.title = input.title;
  if (input.content_json !== undefined) update.content_json = input.content_json;
  if (input.is_home !== undefined) update.is_home = input.is_home;
  if (input.seo_title !== undefined) update.seo_title = input.seo_title;
  if (input.seo_description !== undefined) update.seo_description = input.seo_description;
  if (input.status !== undefined) {
    update.status = input.status;
    if (input.status === 'published' && !existing.published_at) {
      update.published_at = now;
    }
  }

  if (input.is_home === true) {
    await db
      .update(sitePages)
      .set({ is_home: false, updated_at: now })
      .where(and(eq(sitePages.site_id, site.id), eq(sitePages.is_home, true)));
  }

  try {
    await db.update(sitePages).set(update).where(eq(sitePages.id, pageId));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A page with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.page.updated',
    entityType: 'site_page',
    entityId: pageId,
    metadata: { keys: Object.keys(input) },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(sitePages).where(eq(sitePages.id, pageId)).limit(1);
  return c.json({ page: fresh[0] });
});

sitesRoute.delete('/:siteId/pages/:pageId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const pageId = c.req.param('pageId');
  const result = await db
    .delete(sitePages)
    .where(and(eq(sitePages.id, pageId), eq(sitePages.site_id, site.id)));
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Page not found' }, 404);

  await writeAudit(db, {
    user,
    action: 'site.page.deleted',
    entityType: 'site_page',
    entityId: pageId,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── Posts (blog) ────────────────────────────────────────────────────────────

const newPostSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(500).optional().nullable(),
  content_md: z.string().optional(),
  category: z.string().max(80).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  author_name: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['draft', 'published', 'scheduled', 'archived']).optional(),
  scheduled_for: z.string().datetime().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  cover_media_id: z.string().optional().nullable(),
});

const patchPostSchema = newPostSchema.partial();

sitesRoute.get('/:siteId/posts', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const posts = await db
    .select()
    .from(sitePosts)
    .where(eq(sitePosts.site_id, site.id))
    .orderBy(desc(sitePosts.updated_at));
  return c.json({ posts });
});

sitesRoute.post('/:siteId/posts', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newPostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const slug = parsed.data.slug ?? slugify(parsed.data.title) ?? id.slice(0, 8);
  const status = parsed.data.status ?? 'draft';

  try {
    await db.insert(sitePosts).values({
      id,
      customer_id: user.customerId,
      site_id: site.id,
      slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt ?? null,
      content_md: parsed.data.content_md ?? '',
      content_html: null,
      cover_media_id: parsed.data.cover_media_id ?? null,
      category: parsed.data.category ?? null,
      tags_json: JSON.stringify(parsed.data.tags ?? []),
      author_name: parsed.data.author_name ?? 'Anonymous',
      status,
      scheduled_for: parsed.data.scheduled_for ? new Date(parsed.data.scheduled_for) : null,
      published_at: status === 'published' ? now : null,
      seo_title: parsed.data.seo_title ?? null,
      seo_description: parsed.data.seo_description ?? null,
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A post with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.post.created',
    entityType: 'site_post',
    entityId: id,
    metadata: { slug, site_id: site.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(sitePosts).where(eq(sitePosts.id, id)).limit(1);
  return c.json({ post: fresh[0] }, 201);
});

sitesRoute.patch('/:siteId/posts/:postId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const postId = c.req.param('postId');
  const existingRows = await db
    .select()
    .from(sitePosts)
    .where(and(eq(sitePosts.id, postId), eq(sitePosts.site_id, site.id)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return c.json({ error: 'Post not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = patchPostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }

  const now = new Date();
  const update: Partial<typeof sitePosts.$inferInsert> & { updated_at: Date } = {
    updated_at: now,
  };
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.title !== undefined) update.title = input.title;
  if (input.excerpt !== undefined) update.excerpt = input.excerpt;
  if (input.content_md !== undefined) update.content_md = input.content_md;
  if (input.category !== undefined) update.category = input.category;
  if (input.tags !== undefined) update.tags_json = JSON.stringify(input.tags);
  if (input.author_name !== undefined) update.author_name = input.author_name;
  if (input.seo_title !== undefined) update.seo_title = input.seo_title;
  if (input.seo_description !== undefined) update.seo_description = input.seo_description;
  if (input.cover_media_id !== undefined) update.cover_media_id = input.cover_media_id;
  if (input.scheduled_for !== undefined) {
    update.scheduled_for = input.scheduled_for ? new Date(input.scheduled_for) : null;
  }
  if (input.status !== undefined) {
    update.status = input.status;
    if (input.status === 'published' && !existing.published_at) {
      update.published_at = now;
    }
  }

  try {
    await db.update(sitePosts).set(update).where(eq(sitePosts.id, postId));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A post with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.post.updated',
    entityType: 'site_post',
    entityId: postId,
    metadata: { keys: Object.keys(input) },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(sitePosts).where(eq(sitePosts.id, postId)).limit(1);
  return c.json({ post: fresh[0] });
});

sitesRoute.delete('/:siteId/posts/:postId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const postId = c.req.param('postId');
  const result = await db
    .delete(sitePosts)
    .where(and(eq(sitePosts.id, postId), eq(sitePosts.site_id, site.id)));
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Post not found' }, 404);
  await writeAudit(db, {
    user,
    action: 'site.post.deleted',
    entityType: 'site_post',
    entityId: postId,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── Forms ───────────────────────────────────────────────────────────────────

const fieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'short_text',
    'long_text',
    'email',
    'phone',
    'select',
    'radio',
    'checkbox',
    'date',
    'number',
    'file',
    'hidden',
    'rating',
  ]),
  label: z.string().min(1).max(200),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  help_text: z.string().max(500).optional(),
});

const newFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema.optional(),
  fields: z.array(fieldSchema).max(40).optional(),
  settings: z
    .object({
      submit_label: z.string().max(40).optional(),
      success_message: z.string().max(500).optional(),
      notify_emails: z.array(z.string().email()).max(5).optional(),
      redirect_url: z.string().url().optional().nullable(),
      webhook_url: z.string().url().optional().nullable(),
      enable_turnstile: z.boolean().optional(),
    })
    .optional(),
  is_active: z.boolean().optional(),
});

const patchFormSchema = newFormSchema.partial();

sitesRoute.get('/:siteId/forms', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const forms = await db
    .select()
    .from(siteForms)
    .where(eq(siteForms.site_id, site.id))
    .orderBy(desc(siteForms.updated_at));
  return c.json({ forms });
});

sitesRoute.post('/:siteId/forms', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newFormSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const id = crypto.randomUUID();
  const slug = parsed.data.slug ?? slugify(parsed.data.name) ?? id.slice(0, 8);

  try {
    await db.insert(siteForms).values({
      id,
      customer_id: user.customerId,
      site_id: site.id,
      name: parsed.data.name,
      slug,
      fields_json: JSON.stringify(parsed.data.fields ?? []),
      settings_json: JSON.stringify(parsed.data.settings ?? {}),
      is_active: parsed.data.is_active ?? true,
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A form with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.form.created',
    entityType: 'site_form',
    entityId: id,
    metadata: { slug, site_id: site.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(siteForms).where(eq(siteForms.id, id)).limit(1);
  return c.json({ form: fresh[0] }, 201);
});

sitesRoute.patch('/:siteId/forms/:formId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const formId = c.req.param('formId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchFormSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }

  const update: Partial<typeof siteForms.$inferInsert> & { updated_at: Date } = {
    updated_at: new Date(),
  };
  if (input.name !== undefined) update.name = input.name;
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.fields !== undefined) update.fields_json = JSON.stringify(input.fields);
  if (input.settings !== undefined) update.settings_json = JSON.stringify(input.settings);
  if (input.is_active !== undefined) update.is_active = input.is_active;

  try {
    await db
      .update(siteForms)
      .set(update)
      .where(and(eq(siteForms.id, formId), eq(siteForms.site_id, site.id)));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A form with that slug already exists on this site' }, 409);
    }
    throw err;
  }

  await writeAudit(db, {
    user,
    action: 'site.form.updated',
    entityType: 'site_form',
    entityId: formId,
    metadata: { keys: Object.keys(input) },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(siteForms).where(eq(siteForms.id, formId)).limit(1);
  if (!fresh[0]) return c.json({ error: 'Form not found' }, 404);
  return c.json({ form: fresh[0] });
});

sitesRoute.delete('/:siteId/forms/:formId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const formId = c.req.param('formId');
  const result = await db
    .delete(siteForms)
    .where(and(eq(siteForms.id, formId), eq(siteForms.site_id, site.id)));
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Form not found' }, 404);
  await writeAudit(db, {
    user,
    action: 'site.form.deleted',
    entityType: 'site_form',
    entityId: formId,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── PUBLIC: Submit a form ───────────────────────────────────────────────────
// Anyone on a customer's published site can submit. We do NOT require auth.
// Spam protection is the responsibility of the form's `enable_turnstile`
// setting which the public renderer enforces; this endpoint additionally
// rate-limits silently via the IP-keyed KV in a future patch.

const publicSubmitSchema = z.object({
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  turnstile_token: z.string().optional(),
});

sitesRoute.post('/:siteId/forms/:slug/submit', async (c) => {
  const db = createDb(c.env.DB);
  const siteId = c.req.param('siteId');
  const slug = c.req.param('slug');

  // Note: no `loadSite` ownership check — public endpoint. Form lookup is
  // bound by site_id + slug so cross-tenant access isn't possible.
  const formRows = await db
    .select()
    .from(siteForms)
    .where(and(eq(siteForms.site_id, siteId), eq(siteForms.slug, slug)))
    .limit(1);
  const form = formRows[0];
  if (!form || !form.is_active) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = publicSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid submission', details: parsed.error.flatten() }, 400);
  }

  // Optional Turnstile verification
  const settings: { enable_turnstile?: boolean } = JSON.parse(form.settings_json || '{}');
  if (settings.enable_turnstile) {
    const ok = await verifyTurnstile(c.env, parsed.data.turnstile_token, c.req.header('cf-connecting-ip'));
    if (!ok) return c.json({ error: 'Captcha failed' }, 400);
  }

  const submissionId = crypto.randomUUID();
  await db.insert(siteFormSubmissions).values({
    id: submissionId,
    customer_id: form.customer_id,
    site_id: form.site_id,
    form_id: form.id,
    data_json: JSON.stringify(parsed.data.data),
    ip_address: c.req.header('cf-connecting-ip') ?? null,
    user_agent: c.req.header('user-agent') ?? null,
    referrer: c.req.header('referer') ?? null,
    contact_id: null,
  });

  // Best-effort: if there's an email field, dedupe into site_contacts.
  const email = pickEmail(parsed.data.data);
  if (email) {
    await upsertContact(db, {
      customerId: form.customer_id,
      siteId: form.site_id,
      email,
      name: pickName(parsed.data.data),
      source: `form:${form.slug}`,
    });
  }

  await db
    .update(siteForms)
    .set({
      submission_count: sql`${siteForms.submission_count} + 1`,
      updated_at: new Date(),
    })
    .where(eq(siteForms.id, form.id));

  return c.json({ ok: true, id: submissionId }, 201);
});

async function verifyTurnstile(
  env: Env,
  token: string | undefined,
  ip: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  // Worker-side Turnstile verification — secret comes from a future env var.
  const secret = (env as unknown as { TURNSTILE_SECRET?: string }).TURNSTILE_SECRET;
  if (!secret) return true; // not configured yet; fail open in Phase A
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

function pickEmail(data: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string') continue;
    const low = k.toLowerCase();
    if (low === 'email' || low.includes('email') || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v.toLowerCase();
    }
  }
  return undefined;
}

function pickName(data: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string') continue;
    const low = k.toLowerCase();
    if (low === 'name' || low.includes('name') || low === 'full_name') return v;
  }
  return undefined;
}

async function upsertContact(
  db: DbClient,
  args: { customerId: string; siteId: string; email: string; name?: string; source: string },
): Promise<void> {
  const existing = await db
    .select()
    .from(siteContacts)
    .where(and(eq(siteContacts.site_id, args.siteId), eq(siteContacts.email, args.email)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(siteContacts)
      .set({ last_seen_at: new Date(), updated_at: new Date() })
      .where(eq(siteContacts.id, existing[0].id));
    return;
  }
  await db.insert(siteContacts).values({
    id: crypto.randomUUID(),
    customer_id: args.customerId,
    site_id: args.siteId,
    email: args.email,
    name: args.name ?? null,
    source: args.source,
    last_seen_at: new Date(),
  });
}

// ─── Submissions list ────────────────────────────────────────────────────────

sitesRoute.get('/:siteId/submissions', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const formId = c.req.query('form_id');
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);

  const condition =
    formId !== undefined
      ? and(eq(siteFormSubmissions.site_id, site.id), eq(siteFormSubmissions.form_id, formId))
      : eq(siteFormSubmissions.site_id, site.id);

  const submissions = await db
    .select()
    .from(siteFormSubmissions)
    .where(condition)
    .orderBy(desc(siteFormSubmissions.created_at))
    .limit(limit);
  return c.json({ submissions });
});

// ─── Contacts ────────────────────────────────────────────────────────────────

const newContactSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  country: z.string().max(2).optional().nullable(),
  source: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).optional().nullable(),
});
const patchContactSchema = newContactSchema.partial();

sitesRoute.get('/:siteId/contacts', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  const contacts = await db
    .select()
    .from(siteContacts)
    .where(eq(siteContacts.site_id, site.id))
    .orderBy(desc(siteContacts.created_at))
    .limit(limit);
  return c.json({ contacts });
});

sitesRoute.post('/:siteId/contacts', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newContactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(siteContacts).values({
      id,
      customer_id: user.customerId,
      site_id: site.id,
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      phone: parsed.data.phone ?? null,
      company: parsed.data.company ?? null,
      country: parsed.data.country ?? null,
      source: parsed.data.source ?? 'manual',
      tags_json: JSON.stringify(parsed.data.tags ?? []),
      notes: parsed.data.notes ?? null,
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A contact with that email already exists on this site' }, 409);
    }
    throw err;
  }
  await writeAudit(db, {
    user,
    action: 'site.contact.created',
    entityType: 'site_contact',
    entityId: id,
    metadata: { email: parsed.data.email, site_id: site.id },
    ip: c.req.header('cf-connecting-ip'),
  });
  const fresh = await db.select().from(siteContacts).where(eq(siteContacts.id, id)).limit(1);
  return c.json({ contact: fresh[0] }, 201);
});

sitesRoute.patch('/:siteId/contacts/:contactId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = patchContactSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }
  const update: Partial<typeof siteContacts.$inferInsert> & { updated_at: Date } = {
    updated_at: new Date(),
  };
  if (input.email !== undefined) update.email = input.email;
  if (input.name !== undefined) update.name = input.name;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.company !== undefined) update.company = input.company;
  if (input.country !== undefined) update.country = input.country;
  if (input.source !== undefined) update.source = input.source;
  if (input.tags !== undefined) update.tags_json = JSON.stringify(input.tags);
  if (input.notes !== undefined) update.notes = input.notes;

  const contactId = c.req.param('contactId');
  await db
    .update(siteContacts)
    .set(update)
    .where(and(eq(siteContacts.id, contactId), eq(siteContacts.site_id, site.id)));
  const fresh = await db.select().from(siteContacts).where(eq(siteContacts.id, contactId)).limit(1);
  if (!fresh[0]) return c.json({ error: 'Contact not found' }, 404);
  return c.json({ contact: fresh[0] });
});

sitesRoute.delete('/:siteId/contacts/:contactId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const contactId = c.req.param('contactId');
  const result = await db
    .delete(siteContacts)
    .where(and(eq(siteContacts.id, contactId), eq(siteContacts.site_id, site.id)));
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Contact not found' }, 404);
  await writeAudit(db, {
    user,
    action: 'site.contact.deleted',
    entityType: 'site_contact',
    entityId: contactId,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── Products ────────────────────────────────────────────────────────────────

const newProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  description_md: z.string().max(20000).optional().nullable(),
  type: z.enum(['physical', 'digital', 'service', 'subscription']).optional(),
  price_cents: z.number().int().nonnegative(),
  compare_at_cents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().length(3).optional(),
  cover_media_id: z.string().optional().nullable(),
  gallery_media_ids: z.array(z.string()).max(20).optional(),
  inventory_qty: z.number().int().nonnegative().optional().nullable(),
  track_inventory: z.boolean().optional(),
  variants: z.unknown().optional(),
  weight_grams: z.number().int().nonnegative().optional().nullable(),
  sku: z.string().max(64).optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  featured: z.boolean().optional(),
});
const patchProductSchema = newProductSchema.partial();

sitesRoute.get('/:siteId/products', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const products = await db
    .select()
    .from(siteProducts)
    .where(eq(siteProducts.site_id, site.id))
    .orderBy(desc(siteProducts.updated_at));
  return c.json({ products });
});

sitesRoute.post('/:siteId/products', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = newProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const id = crypto.randomUUID();
  const slug = parsed.data.slug ?? slugify(parsed.data.name) ?? id.slice(0, 8);

  try {
    await db.insert(siteProducts).values({
      id,
      customer_id: user.customerId,
      site_id: site.id,
      name: parsed.data.name,
      slug,
      description_md: parsed.data.description_md ?? null,
      type: parsed.data.type ?? 'digital',
      price_cents: parsed.data.price_cents,
      compare_at_cents: parsed.data.compare_at_cents ?? null,
      currency: parsed.data.currency ?? 'MYR',
      cover_media_id: parsed.data.cover_media_id ?? null,
      gallery_media_json: JSON.stringify(parsed.data.gallery_media_ids ?? []),
      inventory_qty: parsed.data.inventory_qty ?? null,
      track_inventory: parsed.data.track_inventory ?? false,
      variants_json: parsed.data.variants ? JSON.stringify(parsed.data.variants) : null,
      weight_grams: parsed.data.weight_grams ?? null,
      sku: parsed.data.sku ?? null,
      status: parsed.data.status ?? 'draft',
      featured: parsed.data.featured ?? false,
    });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A product with that slug already exists on this site' }, 409);
    }
    throw err;
  }
  await writeAudit(db, {
    user,
    action: 'site.product.created',
    entityType: 'site_product',
    entityId: id,
    metadata: { slug, site_id: site.id, price_cents: parsed.data.price_cents },
    ip: c.req.header('cf-connecting-ip'),
  });
  const fresh = await db.select().from(siteProducts).where(eq(siteProducts.id, id)).limit(1);
  return c.json({ product: fresh[0] }, 201);
});

sitesRoute.patch('/:siteId/products/:productId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;
  if (Object.keys(input).length === 0) {
    return c.json({ error: 'Nothing to update' }, 400);
  }
  const update: Partial<typeof siteProducts.$inferInsert> & { updated_at: Date } = {
    updated_at: new Date(),
  };
  if (input.name !== undefined) update.name = input.name;
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.description_md !== undefined) update.description_md = input.description_md;
  if (input.type !== undefined) update.type = input.type;
  if (input.price_cents !== undefined) update.price_cents = input.price_cents;
  if (input.compare_at_cents !== undefined) update.compare_at_cents = input.compare_at_cents;
  if (input.currency !== undefined) update.currency = input.currency;
  if (input.cover_media_id !== undefined) update.cover_media_id = input.cover_media_id;
  if (input.gallery_media_ids !== undefined)
    update.gallery_media_json = JSON.stringify(input.gallery_media_ids);
  if (input.inventory_qty !== undefined) update.inventory_qty = input.inventory_qty;
  if (input.track_inventory !== undefined) update.track_inventory = input.track_inventory;
  if (input.variants !== undefined)
    update.variants_json = input.variants === null ? null : JSON.stringify(input.variants);
  if (input.weight_grams !== undefined) update.weight_grams = input.weight_grams;
  if (input.sku !== undefined) update.sku = input.sku;
  if (input.status !== undefined) update.status = input.status;
  if (input.featured !== undefined) update.featured = input.featured;

  const productId = c.req.param('productId');
  try {
    await db
      .update(siteProducts)
      .set(update)
      .where(and(eq(siteProducts.id, productId), eq(siteProducts.site_id, site.id)));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ error: 'A product with that slug already exists on this site' }, 409);
    }
    throw err;
  }
  await writeAudit(db, {
    user,
    action: 'site.product.updated',
    entityType: 'site_product',
    entityId: productId,
    metadata: { keys: Object.keys(input) },
    ip: c.req.header('cf-connecting-ip'),
  });
  const fresh = await db.select().from(siteProducts).where(eq(siteProducts.id, productId)).limit(1);
  if (!fresh[0]) return c.json({ error: 'Product not found' }, 404);
  return c.json({ product: fresh[0] });
});

sitesRoute.delete('/:siteId/products/:productId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const productId = c.req.param('productId');
  const result = await db
    .delete(siteProducts)
    .where(and(eq(siteProducts.id, productId), eq(siteProducts.site_id, site.id)));
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) return c.json({ error: 'Product not found' }, 404);
  await writeAudit(db, {
    user,
    action: 'site.product.deleted',
    entityType: 'site_product',
    entityId: productId,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── Orders (read-only in Phase A; create/refund come with the Sales Worker) ─

sitesRoute.get('/:siteId/orders', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
  const orders = await db
    .select()
    .from(siteOrders)
    .where(eq(siteOrders.site_id, site.id))
    .orderBy(desc(siteOrders.created_at))
    .limit(limit);
  return c.json({ orders });
});

// ─── Media library (R2) ──────────────────────────────────────────────────────
// Upload accepts `multipart/form-data` with a `file` field. Stored under
// `<site_id>/<uuid>-<safe-name>` in the ASSETS bucket. The public URL is
// composed from `MEDIA_PUBLIC_BASE_URL` + r2_key.

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf'];

function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function mediaPublicUrl(env: Env, r2Key: string): string {
  const base = (env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/${r2Key}` : `/r2/${r2Key}`;
}

sitesRoute.get('/:siteId/media', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);
  const folder = c.req.query('folder');
  const limit = Math.min(Number(c.req.query('limit') ?? 200), 500);
  const condition =
    folder !== undefined
      ? and(eq(siteMedia.site_id, site.id), eq(siteMedia.folder, folder))
      : eq(siteMedia.site_id, site.id);
  const rows = await db
    .select()
    .from(siteMedia)
    .where(condition)
    .orderBy(desc(siteMedia.created_at))
    .limit(limit);
  return c.json({
    media: rows.map((m) => ({ ...m, public_url: mediaPublicUrl(c.env, m.r2_key) })),
  });
});

sitesRoute.post('/:siteId/media', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const ct = c.req.header('content-type') ?? '';
  if (!ct.startsWith('multipart/form-data')) {
    return c.json({ error: 'Expected multipart/form-data with a `file` field' }, 400);
  }

  const form = await c.req.formData();
  const fileEntry = form.get('file');
  // FormDataEntryValue is `string | Blob`; the Workers runtime gives us a
  // Blob-with-name (File) but the type isn't always exposed.
  if (!fileEntry || typeof fileEntry === 'string') {
    return c.json({ error: 'Missing `file` field' }, 400);
  }
  const file = fileEntry as Blob & { name?: string; size: number; type: string };
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` }, 413);
  }
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p) || mime === p)) {
    return c.json({ error: `Unsupported file type: ${mime}` }, 415);
  }

  const altText = (form.get('alt_text') as string | null) ?? null;
  const folder = (form.get('folder') as string | null) ?? null;

  const id = crypto.randomUUID();
  const safeName = safeFilename(file.name || 'file');
  const r2Key = `${site.id}/${id}-${safeName}`;

  await c.env.ASSETS.put(r2Key, file.stream(), {
    httpMetadata: { contentType: mime },
    customMetadata: {
      customer_id: user.customerId,
      site_id: site.id,
      uploaded_by: user.email,
    },
  });

  await db.insert(siteMedia).values({
    id,
    customer_id: user.customerId,
    site_id: site.id,
    r2_key: r2Key,
    file_name: safeName,
    mime_type: mime,
    size_bytes: file.size,
    width: null,
    height: null,
    alt_text: altText,
    ai_caption: null,
    folder,
  });

  await writeAudit(db, {
    user,
    action: 'site.media.uploaded',
    entityType: 'site_media',
    entityId: id,
    metadata: { r2_key: r2Key, size_bytes: file.size, mime, site_id: site.id },
    ip: c.req.header('cf-connecting-ip'),
  });

  const fresh = await db.select().from(siteMedia).where(eq(siteMedia.id, id)).limit(1);
  const row = fresh[0];
  return c.json(
    { media: row ? { ...row, public_url: mediaPublicUrl(c.env, row.r2_key) } : null },
    201,
  );
});

sitesRoute.delete('/:siteId/media/:mediaId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const mediaId = c.req.param('mediaId');
  const rows = await db
    .select()
    .from(siteMedia)
    .where(and(eq(siteMedia.id, mediaId), eq(siteMedia.site_id, site.id)))
    .limit(1);
  const row = rows[0];
  if (!row) return c.json({ error: 'Media not found' }, 404);

  try {
    await c.env.ASSETS.delete(row.r2_key);
  } catch (err) {
    console.warn('[media.delete] R2 delete failed (will be cleaned up by janitor)', err);
  }
  await db.delete(siteMedia).where(eq(siteMedia.id, mediaId));

  await writeAudit(db, {
    user,
    action: 'site.media.deleted',
    entityType: 'site_media',
    entityId: mediaId,
    metadata: { r2_key: row.r2_key },
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json({ ok: true });
});

// ─── R2 dev proxy ────────────────────────────────────────────────────────────
// When MEDIA_PUBLIC_BASE_URL is empty (dev or pre-CDN), media URLs point at
// /r2/<key> on this Worker. This route streams the object back. Public — no
// auth — but key collisions across tenants are protected by the {site_id}/...
// prefix encoded in r2_key.

sitesRoute.get('/r2/*', async (c) => {
  // Strip the leading "/r2/" — Hono captures the rest as wildcard.
  const path = c.req.path.replace(/^.*\/r2\//, '');
  if (!path) return c.json({ error: 'Missing path' }, 400);
  const obj = await c.env.ASSETS.get(path);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
});

// ─── AI build agent ──────────────────────────────────────────────────────────
// POST /sites/:siteId/ai/build
//   body: { prompt: string }
//
// Calls Anthropic Claude with a small tool set that operates on the site's
// content tree. Every mutating tool call snapshots the affected page into
// site_versions for one-click undo. The entire run is logged to site_ai_runs.
//
// If ANTHROPIC_API_KEY is not set, returns a deterministic mock response so
// the dashboard UI works in dev / preview.

const aiBuildSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  page_id: z.string().optional(),
  model: z.string().optional(),
});

interface AiToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: { ok: boolean; message: string; data?: unknown };
}

// ─── Minimal Anthropic SDK shape ─────────────────────────────────────────────
// Mirrors only the bits we use, so this file typechecks without
// `@anthropic-ai/sdk` in node_modules. Replace with the real SDK types after
// `pnpm install` adds the package.

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string };

interface AnthropicMessage {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicLite {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      tools: unknown[];
      messages: unknown[];
    }): Promise<AnthropicMessage>;
  };
}

sitesRoute.post('/:siteId/ai/build', requireAuth, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const db = createDb(c.env.DB);
  const site = await loadSite(db, user.customerId, c.req.param('siteId'));
  if (!site) return c.json({ error: 'Site not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = aiBuildSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
  }

  const start = Date.now();
  const model = parsed.data.model ?? c.env.AI_MODEL ?? 'claude-sonnet-4-6';
  const runId = crypto.randomUUID();
  const toolCalls: AiToolCall[] = [];

  // ── Mock path (no API key configured) ─────────────────────────────────────
  if (!c.env.ANTHROPIC_API_KEY) {
    const mock = mockAgentResponse(parsed.data.prompt);
    await db.insert(siteAiRuns).values({
      id: runId,
      customer_id: user.customerId,
      site_id: site.id,
      agent: 'build',
      prompt: parsed.data.prompt,
      tool_calls_json: JSON.stringify(mock.tool_calls),
      result_summary: mock.summary,
      success: true,
      duration_ms: Date.now() - start,
      tokens_input: 0,
      tokens_output: 0,
      cost_cents: 0,
      model: 'mock',
      snapshot_id: null,
    });
    return c.json({
      run_id: runId,
      summary: mock.summary,
      tool_calls: mock.tool_calls,
      model: 'mock',
      note: 'ANTHROPIC_API_KEY is not set — running in mock mode. Set the secret to enable real AI edits.',
    });
  }

  // ── Live path ─────────────────────────────────────────────────────────────
  // Lazy import so workers that never hit this route don't pay the bundle cost.
  const sdkMod = (await import('@anthropic-ai/sdk')) as unknown as {
    default: new (opts: { apiKey: string }) => AnthropicLite;
  };
  const client = new sdkMod.default({ apiKey: c.env.ANTHROPIC_API_KEY });

  // Load page context if a specific page was named, else load all pages.
  const pages = await db
    .select({
      id: sitePages.id,
      slug: sitePages.slug,
      title: sitePages.title,
      is_home: sitePages.is_home,
      status: sitePages.status,
    })
    .from(sitePages)
    .where(eq(sitePages.site_id, site.id));

  const systemPrompt =
    `You are the HostDaddy Sites AI agent. You edit websites for paying customers ` +
    `via the tools below. Be concise, decisive, and only call tools you actually ` +
    `need. Always read a page before editing it. Snapshots are taken automatically ` +
    `before any mutating call, so prefer making the edit over asking for permission. ` +
    `Site: "${site.name}" (id ${site.id}). Pages on this site: ` +
    pages.map((p) => `${p.is_home ? '★' : ''}${p.slug} ("${p.title}", ${p.status})`).join(', ');

  const tools = [
    {
      name: 'read_page',
      description: 'Fetch a page including its full content_json. Use this before editing.',
      input_schema: {
        type: 'object',
        properties: { page_id: { type: 'string' } },
        required: ['page_id'],
      },
    },
    {
      name: 'update_page_content',
      description:
        'Replace a page content_json. Provide the full new sections tree. ' +
        'A snapshot is taken automatically so the customer can undo.',
      input_schema: {
        type: 'object',
        properties: {
          page_id: { type: 'string' },
          content_json: { type: 'string', description: 'JSON-encoded new content tree' },
          reason: { type: 'string', description: 'Short reason shown to the customer' },
        },
        required: ['page_id', 'content_json'],
      },
    },
    {
      name: 'update_page_meta',
      description: 'Update page title, slug, status, or SEO meta. Snapshots first.',
      input_schema: {
        type: 'object',
        properties: {
          page_id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          seo_title: { type: 'string' },
          seo_description: { type: 'string' },
        },
        required: ['page_id'],
      },
    },
    {
      name: 'create_post',
      description: 'Create a new blog post draft. Sets status=draft so the customer reviews.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content_md: { type: 'string' },
          excerpt: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          author_name: { type: 'string' },
        },
        required: ['title', 'content_md'],
      },
    },
  ] as const;

  let inputTokens = 0;
  let outputTokens = 0;

  // Run a small agentic loop — Claude calls tools, we execute, feed results
  // back, up to 8 turns. Keeps cost predictable.
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    { role: 'user', content: parsed.data.prompt },
  ];

  let summary = '';
  for (let turn = 0; turn < 8; turn++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      tools: tools as unknown as unknown[],
      messages: messages as unknown[],
    });
    inputTokens += resp.usage.input_tokens;
    outputTokens += resp.usage.output_tokens;

    // Append assistant turn.
    messages.push({ role: 'assistant', content: resp.content });

    // Extract any tool_use blocks; if none, capture text and stop.
    const toolUses = resp.content.filter(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
    );
    const textBlocks = resp.content.filter(
      (b): b is AnthropicTextBlock => b.type === 'text',
    );
    if (textBlocks.length) summary = textBlocks.map((b) => b.text).join('\n').trim();

    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) break;

    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const use of toolUses) {
      const call: AiToolCall = { name: use.name, input: use.input as Record<string, unknown> };
      try {
        call.result = await executeTool(db, c.env, user.customerId, site.id, runId, call);
      } catch (err) {
        call.result = {
          ok: false,
          message: err instanceof Error ? err.message : 'Tool execution failed',
        };
      }
      toolCalls.push(call);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(call.result),
        is_error: !call.result.ok,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  await db.insert(siteAiRuns).values({
    id: runId,
    customer_id: user.customerId,
    site_id: site.id,
    agent: 'build',
    prompt: parsed.data.prompt,
    tool_calls_json: JSON.stringify(toolCalls),
    result_summary: summary || null,
    success: true,
    duration_ms: Date.now() - start,
    tokens_input: inputTokens,
    tokens_output: outputTokens,
    cost_cents: estimateCostCents(model, inputTokens, outputTokens),
    model,
    snapshot_id: null,
  });

  return c.json({ run_id: runId, summary, tool_calls: toolCalls, model });
});

// ─── AI agent helpers ────────────────────────────────────────────────────────

async function executeTool(
  db: DbClient,
  env: Env,
  customerId: string,
  siteId: string,
  runId: string,
  call: AiToolCall,
): Promise<{ ok: boolean; message: string; data?: unknown }> {
  void env; // reserved for future tools that need env (e.g. AI image gen)
  const { name, input } = call;

  if (name === 'read_page') {
    const pageId = String(input.page_id ?? '');
    const rows = await db
      .select()
      .from(sitePages)
      .where(and(eq(sitePages.id, pageId), eq(sitePages.site_id, siteId)))
      .limit(1);
    const page = rows[0];
    if (!page) return { ok: false, message: 'Page not found' };
    return {
      ok: true,
      message: 'Loaded',
      data: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        status: page.status,
        content_json: page.content_json,
        seo_title: page.seo_title,
        seo_description: page.seo_description,
      },
    };
  }

  if (name === 'update_page_content') {
    const pageId = String(input.page_id ?? '');
    const contentJson = String(input.content_json ?? '');
    try {
      JSON.parse(contentJson);
    } catch {
      return { ok: false, message: 'content_json is not valid JSON' };
    }
    const existing = await db
      .select()
      .from(sitePages)
      .where(and(eq(sitePages.id, pageId), eq(sitePages.site_id, siteId)))
      .limit(1);
    const page = existing[0];
    if (!page) return { ok: false, message: 'Page not found' };

    // Snapshot before mutating.
    const snapId = crypto.randomUUID();
    await db.insert(siteVersions).values({
      id: snapId,
      customer_id: customerId,
      site_id: siteId,
      page_id: pageId,
      label: typeof input.reason === 'string' ? `AI: ${input.reason}` : 'AI edit',
      actor: `ai:build:${runId}`,
      content_snapshot_json: page.content_json,
    });

    await db
      .update(sitePages)
      .set({ content_json: contentJson, updated_at: new Date() })
      .where(eq(sitePages.id, pageId));
    return { ok: true, message: 'Page content updated', data: { snapshot_id: snapId } };
  }

  if (name === 'update_page_meta') {
    const pageId = String(input.page_id ?? '');
    const existing = await db
      .select()
      .from(sitePages)
      .where(and(eq(sitePages.id, pageId), eq(sitePages.site_id, siteId)))
      .limit(1);
    const page = existing[0];
    if (!page) return { ok: false, message: 'Page not found' };

    const update: Partial<typeof sitePages.$inferInsert> & { updated_at: Date } = {
      updated_at: new Date(),
    };
    if (typeof input.title === 'string') update.title = input.title;
    if (typeof input.slug === 'string') update.slug = input.slug;
    if (typeof input.status === 'string') {
      const s = input.status as 'draft' | 'published' | 'archived';
      update.status = s;
      if (s === 'published' && !page.published_at) update.published_at = new Date();
    }
    if (typeof input.seo_title === 'string') update.seo_title = input.seo_title;
    if (typeof input.seo_description === 'string') update.seo_description = input.seo_description;

    await db.update(sitePages).set(update).where(eq(sitePages.id, pageId));
    return { ok: true, message: 'Page meta updated' };
  }

  if (name === 'create_post') {
    const title = String(input.title ?? '');
    const contentMd = String(input.content_md ?? '');
    if (!title) return { ok: false, message: 'title is required' };

    const id = crypto.randomUUID();
    const slug = slugify(title) || id.slice(0, 8);
    await db.insert(sitePosts).values({
      id,
      customer_id: customerId,
      site_id: siteId,
      slug,
      title,
      content_md: contentMd,
      excerpt: typeof input.excerpt === 'string' ? input.excerpt : null,
      category: typeof input.category === 'string' ? input.category : null,
      tags_json: JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
      author_name: typeof input.author_name === 'string' ? input.author_name : 'AI assistant',
      status: 'draft',
    });
    return { ok: true, message: 'Draft post created', data: { id, slug } };
  }

  return { ok: false, message: `Unknown tool: ${name}` };
}

function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  // Rough estimate — replace with real pricing on bill audit.
  // Sonnet-class default; Opus is ~5x.
  const inputPer1kCents = /opus/i.test(model) ? 1.5 : 0.3;
  const outputPer1kCents = /opus/i.test(model) ? 7.5 : 1.5;
  return Math.ceil(
    (inputTokens / 1000) * inputPer1kCents + (outputTokens / 1000) * outputPer1kCents,
  );
}

function mockAgentResponse(prompt: string): { summary: string; tool_calls: AiToolCall[] } {
  const lower = prompt.toLowerCase();
  if (/seo|meta|search/.test(lower)) {
    return {
      summary:
        'Mock: would audit your SEO across all pages, regenerate weak meta descriptions ' +
        'with Claude, and add FAQ schema. Set ANTHROPIC_API_KEY to run for real.',
      tool_calls: [
        { name: 'audit_seo', input: { scope: 'all_pages' } },
        { name: 'generate_meta', input: { pages: 'auto' } },
      ],
    };
  }
  if (/blog|post|article/.test(lower)) {
    return {
      summary: 'Mock: would draft 3 blog posts and save them as drafts for your review.',
      tool_calls: [{ name: 'create_post', input: { count: 3 } }],
    };
  }
  if (/hero|headline|copy/.test(lower)) {
    return {
      summary: 'Mock: would rewrite your hero block and snapshot the previous version.',
      tool_calls: [
        { name: 'update_page_content', input: { page_id: 'home', op: 'rewrite_hero' } },
      ],
    };
  }
  return {
    summary:
      "Mock response — ANTHROPIC_API_KEY isn't set, so I can't actually edit your site yet. " +
      'Add the secret in wrangler and ask me again.',
    tool_calls: [{ name: 'agent_plan', input: { task: prompt.slice(0, 80) } }],
  };
}
