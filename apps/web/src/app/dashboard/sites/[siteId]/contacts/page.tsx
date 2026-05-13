import { cookies } from 'next/headers';
import { Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type SiteContact } from '@/lib/api';

export const runtime = 'edge';

function money(cents: number, currency = 'MYR'): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function fmtDate(value: number | string | null): string {
  if (!value) return '—';
  const ms = typeof value === 'number' ? value * 1000 : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString();
}

export default async function ContactsIndex({ params }: { params: { siteId: string } }) {
  const cookieHeader = cookies().toString();
  let contacts: SiteContact[] = [];
  let loadError: string | null = null;
  try {
    const res = await sitesApi.listContacts(params.siteId, { cookie: cookieHeader });
    contacts = res.contacts;
  } catch (err) {
    loadError = err instanceof ApiHttpError ? err.message : 'Could not load contacts.';
  }

  const totalLtv = contacts.reduce((s, c) => s + c.ltv_cents, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-navy-900">Contacts</h2>
        <div className="text-sm text-navy-500">
          {contacts.length} contact{contacts.length === 1 ? '' : 's'} · LTV{' '}
          <span className="font-semibold text-navy-900">{money(totalLtv)}</span>
        </div>
      </div>

      {loadError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{loadError}</CardContent>
        </Card>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-navy-500">
            No contacts yet. Form submissions and orders populate this list
            automatically.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-navy-50 text-xs uppercase tracking-wide text-navy-500">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">LTV</th>
                  <th className="px-4 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      {c.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-navy-700">{c.email}</td>
                    <td className="px-4 py-3 text-navy-500">{c.source}</td>
                    <td className="px-4 py-3 text-right text-navy-700">{c.order_count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy-900">
                      {money(c.ltv_cents)}
                    </td>
                    <td className="px-4 py-3 text-navy-500">{fmtDate(c.created_at)}</td>
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
