'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@hostdaddy/ui';

const TABS = [
  { href: '', label: 'Overview', exact: true },
  { href: '/editor', label: 'Editor' },
  { href: '/pages', label: 'Pages' },
  { href: '/blog', label: 'Blog' },
  { href: '/forms', label: 'Forms' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/shop', label: 'Shop' },
  { href: '/orders', label: 'Orders' },
  { href: '/ai', label: 'AI agent' },
];

export function SiteTabs({ siteId }: { siteId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/sites/${siteId}`;
  return (
    <nav className="flex flex-wrap gap-1 overflow-x-auto border-b border-navy-100 pb-px">
      {TABS.map((tab) => {
        const href = base + tab.href;
        const active = tab.exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={tab.href || 'overview'}
            href={href}
            className={cn(
              'rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-electric-500 text-electric-700'
                : 'border-transparent text-navy-500 hover:text-navy-900',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
