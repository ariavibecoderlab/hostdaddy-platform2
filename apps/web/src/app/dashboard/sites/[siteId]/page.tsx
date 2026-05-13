import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@hostdaddy/ui';
import {
  sitesApi,
  ApiHttpError,
  type SiteSummary,
  type SitePage,
  type SitePost,
  type SiteForm,
  type SiteContact,
  type SiteProduct,
  type SiteOrder,
} from '@/lib/api';

export const runtime = 'edge';

interface SiteDetailData {
  site: SiteSummary;
  pages: SitePage[];
  posts: SitePost[];
  forms: SiteForm[];
  contacts: SiteContact[];
  products: SiteProduct[];
  orders: SiteOrder[];
}

async function loadSiteDetail(
  siteId: string,
  cookie: string,
): Promise<SiteDetailData | { notFound: true } | { error: string }> {
  try {
    const [site, pages, posts, forms, contacts, products, orders] = await Promise.all([
      sitesApi.get(siteId, { cookie }),
      sitesApi.listPages(siteId, { cookie }),
      sitesApi.listPosts(siteId, { cookie }),
      sitesApi.listForms(siteId, { cookie }),
      sitesApi.listContacts(siteId, { cookie }),
      sitesApi.listProducts(siteId, { cookie }),
      sitesApi.listOrders(siteId, { cookie }),
    ]);
    return {
      site: {
        ...site.site,
        counts: {
          pages: pages.pages.length,
          posts: posts.posts.length,
          products: products.products.length,
          contacts: contacts.contacts.length,
        },
      },
      pages: pages.pages,
      posts: posts.posts,
      forms: forms.forms,
      contacts: contacts.contacts,
      products: products.products,
      orders: orders.orders,
    };
  } catch (err) {
    if (err instanceof ApiHttpError && err.status === 404) return { notFound: true };
    return { error: err instanceof Error ? err.message : 'Failed to load site.' };
  }
}

function formatMoney(cents: number, currency = 'MYR'): string {
  const amount = (cents / 100).toFixed(2);
  return `${currency} ${amount}`;
}

function statusBadge(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'published':
    case 'active':
    case 'live':
    case 'paid':
    case 'delivered':
      return 'success';
    case 'scheduled':
    case 'processing':
    case 'building':
    case 'provisioning':
    case 'sending':
      return 'info';
    case 'draft':
    case 'unfulfilled':
    case 'pending':
    case 'paused':
      return 'warning';
    case 'error':
    case 'failed':
    case 'refunded':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default async function SiteDetailPage({
  params,
}: {
  params: { siteId: string };
}) {
  const cookieHeader = cookies().toString();
  const data = await loadSiteDetail(params.siteId, cookieHeader);

  if ('notFound' in data) notFound();
  if ('error' in data) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-navy-900">Site</h1>
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{data.error}</CardContent>
        </Card>
      </div>
    );
  }

  const { site, pages, posts, forms, contacts, products, orders } = data;
  const ordersRevenueCents = orders
    .filter((o) => o.payment_status === 'paid')
    .reduce((sum, o) => sum + o.total_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/dashboard/sites/${site.id}/editor`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-electric-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-electric-700"
        >
          Open editor
        </Link>
        <Link
          href={`/dashboard/sites/${site.id}/ai`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-navy-200 bg-white px-4 text-sm font-medium text-navy-700 shadow-sm transition-colors hover:bg-navy-50"
        >
          Ask AI agent
        </Link>
      </div>

      {/* ─── KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pages" value={pages.length} sub={`${publishedCount(pages, 'status', 'published')} published`} />
        <KpiCard label="Blog posts" value={posts.length} sub={`${publishedCount(posts, 'status', 'published')} live`} />
        <KpiCard label="Contacts" value={contacts.length} sub={`${ltvSum(contacts)} total LTV`} />
        <KpiCard
          label="Revenue (paid)"
          value={formatMoney(ordersRevenueCents)}
          sub={`${orders.length} order${orders.length === 1 ? '' : 's'}`}
        />
      </div>

      {/* ─── Modules grid ───────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pages */}
        <ModuleCard
          title="Pages"
          description="Edit your home page, about, contact, and landing pages in the visual builder."
          href={`/dashboard/sites/${site.id}/pages`}
          actionLabel="Manage pages →"
          empty={pages.length === 0 ? 'No pages yet — create your first one.' : null}
        >
          {pages.slice(0, 5).map((p) => (
            <Row
              key={p.id}
              left={
                <>
                  {p.is_home ? (
                    <span aria-hidden className="mr-1 text-electric-500">★</span>
                  ) : null}
                  {p.title}
                </>
              }
              sub={p.slug}
              right={<Badge variant={statusBadge(p.status)}>{p.status}</Badge>}
            />
          ))}
        </ModuleCard>

        {/* Blog */}
        <ModuleCard
          title="Blog"
          description="Publish posts with AI writing assist, scheduling, categories, and SEO baked in."
          href={`/dashboard/sites/${site.id}/blog`}
          actionLabel="Manage blog →"
          empty={posts.length === 0 ? 'No posts yet — draft your first article.' : null}
        >
          {posts.slice(0, 5).map((p) => (
            <Row
              key={p.id}
              left={p.title}
              sub={`${p.author_name} · ${p.view_count} views`}
              right={<Badge variant={statusBadge(p.status)}>{p.status}</Badge>}
            />
          ))}
        </ModuleCard>

        {/* Forms */}
        <ModuleCard
          title="Forms"
          description="Drag-and-drop forms with conditional logic, webhooks, and Turnstile spam protection."
          href={`/dashboard/sites/${site.id}/forms`}
          actionLabel="Manage forms →"
          empty={forms.length === 0 ? 'No forms yet — build a lead-capture form.' : null}
        >
          {forms.slice(0, 5).map((f) => (
            <Row
              key={f.id}
              left={f.name}
              sub={`/${f.slug}`}
              right={
                <span className="text-xs font-medium text-navy-500">
                  {f.submission_count} submission{f.submission_count === 1 ? '' : 's'}
                </span>
              }
            />
          ))}
        </ModuleCard>

        {/* Contacts */}
        <ModuleCard
          title="Contacts"
          description="Every visitor, subscriber, lead, and buyer — unified in one CRM."
          href={`/dashboard/sites/${site.id}/contacts`}
          actionLabel="Open CRM →"
          empty={contacts.length === 0 ? 'No contacts yet.' : null}
        >
          {contacts.slice(0, 5).map((c) => (
            <Row
              key={c.id}
              left={c.name ?? c.email}
              sub={`${c.source} · ${formatMoney(c.ltv_cents)} LTV`}
              right={<span className="text-xs text-navy-400">{c.email}</span>}
            />
          ))}
        </ModuleCard>

        {/* Products */}
        <ModuleCard
          title="Shop"
          description="Physical, digital, services, subscriptions. Stripe + Billplz checkout. Inventory tracked."
          href={`/dashboard/sites/${site.id}/shop`}
          actionLabel="Manage shop →"
          empty={products.length === 0 ? 'No products yet — list your first product.' : null}
        >
          {products.slice(0, 5).map((p) => (
            <Row
              key={p.id}
              left={p.name}
              sub={`${p.type} · sold ${p.sold_count}`}
              right={
                <span className="text-xs font-semibold text-navy-900">
                  {formatMoney(p.price_cents, p.currency)}
                </span>
              }
            />
          ))}
        </ModuleCard>

        {/* Orders */}
        <ModuleCard
          title="Orders"
          description="Fulfill, refund, and track every order through Stripe or Billplz."
          href={`/dashboard/sites/${site.id}/orders`}
          actionLabel="View orders →"
          empty={orders.length === 0 ? 'No orders yet.' : null}
        >
          {orders.slice(0, 5).map((o) => (
            <Row
              key={o.id}
              left={`#${o.order_number}`}
              sub={o.end_customer_name}
              right={
                <span className="flex items-center gap-2">
                  <Badge variant={statusBadge(o.payment_status)}>{o.payment_status}</Badge>
                  <span className="text-xs font-semibold text-navy-900">
                    {formatMoney(o.total_cents, o.currency)}
                  </span>
                </span>
              }
            />
          ))}
        </ModuleCard>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function publishedCount<T>(list: T[], key: keyof T, value: string): number {
  return list.filter((row) => row[key] === value).length;
}

function ltvSum(contacts: SiteContact[]): string {
  return formatMoney(contacts.reduce((s, c) => s + c.ltv_cents, 0));
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-navy-500">
          {label}
        </div>
        <div className="mt-1 font-display text-2xl font-bold text-navy-900">{value}</div>
        <div className="mt-0.5 text-xs text-navy-400">{sub}</div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  title,
  description,
  href,
  actionLabel,
  empty,
  children,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {empty ? (
          <p className="rounded-md bg-navy-50 px-4 py-6 text-center text-sm text-navy-500">
            {empty}
          </p>
        ) : (
          <ul className="divide-y divide-navy-100">{children}</ul>
        )}
        <div className="mt-4">
          <Link
            href={href}
            className="text-sm font-medium text-electric-600 hover:underline"
          >
            {actionLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  left,
  sub,
  right,
}: {
  left: React.ReactNode;
  sub: string;
  right: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-navy-900">{left}</div>
        <div className="truncate text-xs text-navy-500">{sub}</div>
      </div>
      <div className="flex-shrink-0">{right}</div>
    </li>
  );
}
