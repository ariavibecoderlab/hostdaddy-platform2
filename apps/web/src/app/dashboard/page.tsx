import Link from 'next/link';
import { Card, CardContent, Badge } from '@hostdaddy/ui';
import { getSession } from '@/lib/auth';

const STATS = [
  { label: 'Active Domains', value: '0', href: '/dashboard/domains' as const },
  { label: 'Active Sites', value: '0', href: '/dashboard/hosting' as const },
  { label: 'Next Renewal', value: '—', href: '/dashboard/billing' as const },
];

const QUICK_ACTIONS = [
  { label: 'Register a domain', href: '/search' as const, accent: 'electric' },
  { label: 'Add hosting', href: '/hosting' as const, accent: 'navy' },
  { label: 'Transfer in', href: '/transfer' as const, accent: 'navy' },
  { label: 'Manage DNS', href: '/dashboard/domains' as const, accent: 'navy' },
] as const;

export default async function DashboardOverviewPage() {
  const user = await getSession();
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-electric-600">Dashboard</p>
        <h1 className="font-display text-3xl font-bold text-navy-900">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Here&apos;s a snapshot of your HostDaddy.app account.
        </p>
      </div>

      <section
        aria-label="Account snapshot"
        className="grid gap-4 sm:grid-cols-3"
      >
        {STATS.map((s) => (
          <Link key={s.label} href={s.href} className="group block">
            <Card className="transition-shadow group-hover:shadow-glow">
              <CardContent className="px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-navy-500">
                  {s.label}
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-navy-900">
                  {s.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section aria-label="Quick actions">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold text-navy-900">
            Quick actions
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className={
                a.accent === 'electric'
                  ? 'rounded-xl border border-electric-300 bg-electric-50 px-5 py-4 text-sm font-medium text-electric-700 transition-colors hover:bg-electric-100'
                  : 'rounded-xl border border-navy-100 bg-white px-5 py-4 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50'
              }
            >
              {a.label} <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Status">
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="info">Phase 2 · Soft launch</Badge>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-navy-900">
                Domain registration is opening soon.
              </h3>
              <p className="mt-1 max-w-xl text-sm text-navy-600">
                Your dashboard is ready. Domain search, DNS editing, and
                transfers open in Phase 3 — we&apos;ll email you the moment they
                go live.
              </p>
            </div>
            <Link
              href="/search"
              className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Browse TLDs
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
