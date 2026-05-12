import Link from 'next/link';
import { Button } from '@hostdaddy/ui';

const PRIMARY_NAV = [
  { label: 'Domains', href: '/domains' as const },
  { label: 'Hosting', href: '/hosting' as const },
  { label: 'Websites', href: '/websites' as const },
  { label: 'Email', href: '/email' as const },
  { label: 'Transfer', href: '/transfer' as const },
  { label: 'Pricing', href: '/pricing' as const },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900 text-white">
      <div className="container-page flex h-14 items-center justify-between gap-6">
        {/* Brand + primary nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-bold text-white"
            aria-label="HostDaddy.app home"
          >
            <span
              className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
              aria-hidden
            />
            HostDaddy<span className="text-cyan-400">.app</span>
          </Link>
          <nav
            className="hidden items-center gap-6 lg:flex"
            aria-label="Primary"
          >
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-white/85 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: support + auth + cart */}
        <div className="flex items-center gap-5">
          <Link
            href="/contact"
            className="hidden text-sm text-white/85 hover:text-white md:inline"
          >
            Contact us
          </Link>
          <Link
            href="/help"
            className="hidden text-sm text-white/85 hover:text-white md:inline"
          >
            Help
          </Link>
          <Link
            href="/login"
            className="text-sm text-white/85 hover:text-white"
          >
            Sign in
          </Link>
          <Link href="/register">
            <Button size="sm" variant="cyan">
              Get started
            </Button>
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span
              className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-semibold text-navy-900"
              aria-hidden
            >
              0
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
