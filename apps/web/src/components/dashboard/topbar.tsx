'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authApi } from '@/lib/api';
import type { SessionUser } from '@/lib/api';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function DashboardTopbar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await authApi.logout();
    } catch {
      // ignore; we're logging out anyway
    }
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-100 bg-white/95 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-navy-900 md:hidden"
        >
          <span
            className="inline-block h-5 w-5 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
            aria-hidden
          />
          HostDaddy<span className="text-electric-500">.app</span>
        </Link>
      </div>
      <div className="relative flex items-center gap-3">
        <Link
          href="/dashboard/billing"
          className="hidden text-sm text-navy-600 hover:text-navy-900 md:inline"
        >
          Billing
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-full border border-navy-100 bg-white pl-3 pr-1.5 text-sm font-medium text-navy-800 transition-colors hover:bg-navy-50"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-electric-500 text-xs font-semibold text-white"
            aria-hidden
          >
            {initials(user.name)}
          </span>
        </button>
        {open ? (
          <div
            className="absolute right-0 top-12 z-40 w-56 rounded-lg border border-navy-100 bg-white p-1 shadow-lg shadow-navy-900/10"
            onMouseLeave={() => setOpen(false)}
          >
            <div className="border-b border-navy-100 p-3 text-xs">
              <p className="font-medium text-navy-900">{user.name}</p>
              <p className="text-navy-500">{user.email}</p>
            </div>
            <Link
              href="/dashboard/settings"
              className="block rounded-md px-3 py-2 text-sm text-navy-700 hover:bg-navy-50"
              onClick={() => setOpen(false)}
            >
              Account settings
            </Link>
            <Link
              href="/help"
              className="block rounded-md px-3 py-2 text-sm text-navy-700 hover:bg-navy-50"
            >
              Help centre
            </Link>
            <button
              onClick={handleLogout}
              disabled={pending}
              className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {pending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
