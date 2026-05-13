import { cookies } from 'next/headers';
import { Badge, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SiteOrder } from '@/lib/api';

export const runtime = 'edge';

function money(cents: number, currency = 'MYR'): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function payVariant(s: SiteOrder['payment_status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (s === 'paid') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'failed' || s === 'refunded' || s === 'partial_refund') return 'danger';
  return 'neutral';
}

function fulVariant(
  s: SiteOrder['fulfillment_status'],
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (s === 'delivered' || s === 'shipped') return 'success';
  if (s === 'processing') return 'info';
  if (s === 'cancelled') return 'danger';
  return 'warning';
}

function fmtDate(value: number | string | null): string {
  if (!value) return '—';
  const ms = typeof value === 'number' ? value * 1000 : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString();
}

export default async function OrdersIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let orders: SiteOrder[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listOrders(params.siteId, { cookie: cookieHeader });
    orders = res.orders;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load orders.';
  }

  const paid = orders.filter((o) => o.payment_status === 'paid');
  const revenue = paid.reduce((s, o) => s + o.total_cents, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">Orders</h2>
          <p className="text-sm text-navy-500">
            {orders.length} order{orders.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-navy-900">{money(revenue)}</span> paid
          </p>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No orders yet. The Phase F sales worker will populate this view as
            customers buy from your shop.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-4 py-2 text-left">Order</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Payment</th>
                  <th className="px-4 py-2 text-left">Fulfillment</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3 font-semibold text-navy-900">#{o.order_number}</td>
                    <td className="px-4 py-3">
                      <div className="text-navy-900">{o.end_customer_name}</div>
                      <div className="text-xs text-navy-500">{o.end_customer_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={payVariant(o.payment_status)}>{o.payment_status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={fulVariant(o.fulfillment_status)}>
                        {o.fulfillment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy-900">
                      {money(o.total_cents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-navy-500">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
