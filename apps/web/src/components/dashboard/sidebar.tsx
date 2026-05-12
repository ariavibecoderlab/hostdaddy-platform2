'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@hostdaddy/ui';

const NAV = [
  { label: 'Overview', href: '/dashboard' as const, icon: 'home' },
  { label: 'Domains', href: '/dashboard/domains' as const, icon: 'globe' },
  { label: 'Hosting', href: '/dashboard/hosting' as const, icon: 'server' },
  { label: 'Email', href: '/dashboard/email' as const, icon: 'mail' },
  { label: 'Billing', href: '/dashboard/billing' as const, icon: 'credit-card' },
  { label: 'Settings', href: '/dashboard/settings' as const, icon: 'sliders' },
];

function Icon({ name, className }: { name: string; className?: string }) {
  const props = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
      );
    case 'server':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="8" rx="2" />
          <rect x="2" y="13" width="20" height="8" rx="2" />
          <line x1="6" y1="7" x2="6.01" y2="7" />
          <line x1="6" y1="17" x2="6.01" y2="17" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      );
    case 'credit-card':
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'sliders':
      return (
        <svg {...props}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    default:
      return null;
  }
}

export function DashboardSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden border-r border-navy-100 bg-white md:flex md:w-60 md:flex-col">
      <div className="flex h-14 items-center px-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold text-navy-900"
        >
          <span
            className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
            aria-hidden
          />
          HostDaddy<span className="text-electric-500">.app</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Dashboard">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-electric-50 text-electric-700'
                  : 'text-navy-700 hover:bg-navy-50',
              )}
            >
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-navy-100 p-4 text-xs text-navy-500">
        Need help? <Link href="/help" className="font-medium text-electric-600">Help centre</Link>
      </div>
    </aside>
  );
}
