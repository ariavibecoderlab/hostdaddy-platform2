import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SiteProduct } from '@/lib/api';

export const runtime = 'edge';

function money(cents: number, currency = 'MYR'): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function variant(s: SiteProduct['status']): 'success' | 'warning' | 'neutral' {
  if (s === 'active') return 'success';
  if (s === 'draft') return 'warning';
  return 'neutral';
}

export default async function ShopIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let products: SiteProduct[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listProducts(params.siteId, { cookie: cookieHeader });
    products = res.products;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load products.';
  }

  const totalRevenue = products.reduce((s, p) => s + p.price_cents * p.sold_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">Shop</h2>
          <p className="text-sm text-navy-500">
            {products.length} product{products.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-navy-900">{money(totalRevenue)}</span>{' '}
            lifetime sales
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Product editor ships in Phase B"
          className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md bg-navy-200 px-4 text-sm font-medium text-navy-500"
        >
          + New product
        </button>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No products yet. The seed script creates two sample products.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-navy-900">{p.name}</div>
                    <div className="truncate text-xs text-navy-500">
                      {p.type} · /{p.slug}
                    </div>
                  </div>
                  <Badge variant={variant(p.status)}>{p.status}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="font-display text-xl font-bold text-electric-600">
                    {money(p.price_cents, p.currency)}
                  </div>
                  <div className="text-xs text-navy-500">sold {p.sold_count}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
