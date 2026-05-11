/**
 * HostDaddy.ai database schema.
 * Mirrors Section 9.3 of the build spec, expanded with audit fields.
 *
 * Each row stores money in MYR cents (integer) — never use floats for money.
 */

import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const id = () => text('id').primaryKey();
const timestamps = {
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

// ─── Customers ───────────────────────────────────────────────────────────────

export const customers = sqliteTable(
  'customers',
  {
    id: id(),
    email: text('email').notNull(),
    password_hash: text('password_hash'), // null if SSO-only
    name: text('name').notNull(),
    phone: text('phone'),
    company: text('company'),
    country: text('country').notNull().default('MY'),
    role: text('role', { enum: ['customer', 'franchisee', 'agency', 'admin'] })
      .notNull()
      .default('customer'),
    franchise_code: text('franchise_code'), // e.g. BRAINYBUNCH-KL01
    stripe_customer_id: text('stripe_customer_id'),
    email_verified_at: integer('email_verified_at', { mode: 'timestamp' }),
    last_login_at: integer('last_login_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    email_idx: uniqueIndex('customers_email_unique').on(t.email),
    stripe_idx: index('customers_stripe_idx').on(t.stripe_customer_id),
  }),
);

// ─── Domains ─────────────────────────────────────────────────────────────────

export const domains = sqliteTable(
  'domains',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    domain_name: text('domain_name').notNull(),
    tld: text('tld').notNull(),
    registrar: text('registrar', { enum: ['cloudflare', 'mynic'] }).notNull(),
    cloudflare_zone_id: text('cloudflare_zone_id'),
    status: text('status', {
      enum: ['active', 'pending_register', 'pending_transfer', 'expired', 'redemption', 'cancelled'],
    })
      .notNull()
      .default('pending_register'),
    expires_at: integer('expires_at', { mode: 'timestamp' }),
    auto_renew: integer('auto_renew', { mode: 'boolean' }).notNull().default(true),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(true),
    privacy_enabled: integer('privacy_enabled', { mode: 'boolean' }).notNull().default(true),
    purchase_price_cents: integer('purchase_price_cents').notNull(), // MYR cents
    renewal_price_cents: integer('renewal_price_cents').notNull(),
    ...timestamps,
  },
  (t) => ({
    domain_unique: uniqueIndex('domains_name_unique').on(t.domain_name),
    customer_idx: index('domains_customer_idx').on(t.customer_id),
    expires_idx: index('domains_expires_idx').on(t.expires_at),
  }),
);

// ─── Hosting plans ───────────────────────────────────────────────────────────

export const hostingPlans = sqliteTable(
  'hosting_plans',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    plan_type: text('plan_type', {
      enum: ['starter', 'business', 'agency', 'bb_franchisee'],
    }).notNull(),
    sites_limit: integer('sites_limit').notNull(), // -1 = unlimited
    storage_gb: integer('storage_gb').notNull(),
    billing_cycle: text('billing_cycle', { enum: ['monthly', 'yearly'] })
      .notNull()
      .default('yearly'),
    status: text('status', { enum: ['active', 'past_due', 'cancelled', 'trial'] })
      .notNull()
      .default('trial'),
    price_cents: integer('price_cents').notNull(), // MYR cents per cycle
    started_at: integer('started_at', { mode: 'timestamp' }),
    expires_at: integer('expires_at', { mode: 'timestamp' }),
    cancel_at_period_end: integer('cancel_at_period_end', { mode: 'boolean' })
      .notNull()
      .default(false),
    stripe_subscription_id: text('stripe_subscription_id'),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('hosting_plans_customer_idx').on(t.customer_id),
    stripe_idx: index('hosting_plans_stripe_idx').on(t.stripe_subscription_id),
  }),
);

// ─── Sites ───────────────────────────────────────────────────────────────────

export const sites = sqliteTable(
  'sites',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    hosting_plan_id: text('hosting_plan_id')
      .notNull()
      .references(() => hostingPlans.id, { onDelete: 'cascade' }),
    domain_id: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    cf_pages_project: text('cf_pages_project').notNull(),
    github_repo: text('github_repo'),
    template: text('template'), // e.g. 'brainy_bunch_school'
    status: text('status', {
      enum: ['provisioning', 'building', 'live', 'error', 'paused'],
    })
      .notNull()
      .default('provisioning'),
    last_deployed_at: integer('last_deployed_at', { mode: 'timestamp' }),
    last_deployment_id: text('last_deployment_id'),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('sites_customer_idx').on(t.customer_id),
    plan_idx: index('sites_plan_idx').on(t.hosting_plan_id),
    pages_unique: uniqueIndex('sites_cf_pages_unique').on(t.cf_pages_project),
  }),
);

// ─── Email routes ────────────────────────────────────────────────────────────

export const emailRoutes = sqliteTable(
  'email_routes',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    domain_id: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    from_address: text('from_address').notNull(),
    to_address: text('to_address').notNull(),
    cf_rule_id: text('cf_rule_id').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    domain_idx: index('email_routes_domain_idx').on(t.domain_id),
    cf_unique: uniqueIndex('email_routes_cf_rule_unique').on(t.cf_rule_id),
  }),
);

// ─── Invoices ────────────────────────────────────────────────────────────────

export const invoices = sqliteTable(
  'invoices',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    invoice_number: text('invoice_number').notNull(), // HD-2026-00001
    description: text('description').notNull(),
    subtotal_cents: integer('subtotal_cents').notNull(),
    sst_cents: integer('sst_cents').notNull().default(0), // 8% SST
    total_cents: integer('total_cents').notNull(),
    currency: text('currency').notNull().default('MYR'),
    status: text('status', {
      enum: ['draft', 'open', 'paid', 'void', 'failed', 'refunded'],
    })
      .notNull()
      .default('draft'),
    payment_provider: text('payment_provider', { enum: ['stripe', 'billplz'] }),
    stripe_invoice_id: text('stripe_invoice_id'),
    billplz_bill_id: text('billplz_bill_id'),
    pdf_url: text('pdf_url'),
    paid_at: integer('paid_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('invoices_customer_idx').on(t.customer_id),
    number_unique: uniqueIndex('invoices_number_unique').on(t.invoice_number),
    stripe_idx: index('invoices_stripe_idx').on(t.stripe_invoice_id),
  }),
);

// ─── Transfers ───────────────────────────────────────────────────────────────

export const transfers = sqliteTable(
  'transfers',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    domain_name: text('domain_name').notNull(),
    direction: text('direction', { enum: ['in', 'out'] }).notNull().default('in'),
    auth_code: text('auth_code'),
    status: text('status', {
      enum: [
        'initiated',
        'awaiting_confirmation',
        'approved',
        'dns_updated',
        'completed',
        'failed',
        'cancelled',
      ],
    })
      .notNull()
      .default('initiated'),
    error_message: text('error_message'),
    initiated_at: integer('initiated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    completed_at: integer('completed_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('transfers_customer_idx').on(t.customer_id),
    domain_idx: index('transfers_domain_idx').on(t.domain_name),
  }),
);

// ─── Support tickets ─────────────────────────────────────────────────────────

export const supportTickets = sqliteTable(
  'support_tickets',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    category: text('category', {
      enum: ['domain', 'dns', 'hosting', 'email', 'billing', 'other'],
    })
      .notNull()
      .default('other'),
    priority: text('priority', { enum: ['low', 'normal', 'high', 'urgent'] })
      .notNull()
      .default('normal'),
    status: text('status', { enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] })
      .notNull()
      .default('open'),
    assigned_to: text('assigned_to'),
    resolved_at: integer('resolved_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    customer_idx: index('support_tickets_customer_idx').on(t.customer_id),
    status_idx: index('support_tickets_status_idx').on(t.status),
  }),
);

// ─── Sessions (auth) ─────────────────────────────────────────────────────────
// Lives in D1 as a backup; KV is the primary fast-path store for session lookups.

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    customer_id: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull(),
    user_agent: text('user_agent'),
    ip_address: text('ip_address'),
    expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
    revoked_at: integer('revoked_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => ({
    token_unique: uniqueIndex('sessions_token_unique').on(t.token_hash),
    customer_idx: index('sessions_customer_idx').on(t.customer_id),
  }),
);

// ─── Audit log ───────────────────────────────────────────────────────────────

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    customer_id: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    actor: text('actor').notNull(), // 'customer', 'admin:<id>', 'system', 'cron'
    action: text('action').notNull(), // 'domain.registered', 'dns.record.created', etc.
    entity_type: text('entity_type'),
    entity_id: text('entity_id'),
    metadata: text('metadata'), // JSON
    ip_address: text('ip_address'),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    customer_idx: index('audit_log_customer_idx').on(t.customer_id),
    action_idx: index('audit_log_action_idx').on(t.action),
    created_idx: index('audit_log_created_idx').on(t.created_at),
  }),
);

// ─── Type exports ────────────────────────────────────────────────────────────

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type HostingPlan = typeof hostingPlans.$inferSelect;
export type NewHostingPlan = typeof hostingPlans.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type EmailRoute = typeof emailRoutes.$inferSelect;
export type NewEmailRoute = typeof emailRoutes.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Unused placeholder to silence TS noUnusedLocals on `real` import
// (kept available for future numeric-typed fields like usage counters).
export const _real = real;
