import Link from 'next/link';
import { Button } from '@hostdaddy/ui';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-navy-900">
          <span
            className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
            aria-hidden
          />
          HostDaddy<span className="text-electric-500">.ai</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          <Link href="/domains" className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Domains
          </Link>
          <Link href="/hosting" className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Hosting
          </Link>
          <Link href="/email" className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Email
          </Link>
          <Link href="/transfer" className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Transfer
          </Link>
          <Link href="/help" className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Help
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-navy-700 hover:text-navy-900 sm:inline"
          >
            Sign in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
