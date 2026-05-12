import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Products',
    links: [
      { label: 'Domains', href: '/domains' as const },
      { label: 'Hosting', href: '/hosting' as const },
      { label: 'Email', href: '/email' as const },
      { label: 'Transfer in', href: '/transfer' as const },
      { label: 'Brainy Bunch bundle', href: '/franchise/brainy-bunch' as const },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' as const },
      { label: 'White Unicorn Ventures', href: 'https://whiteunicornventures.com' as const, external: true },
      { label: 'Careers', href: '/careers' as const },
      { label: 'Press', href: '/press' as const },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help centre', href: '/help' as const },
      { label: 'Contact us', href: '/contact' as const },
      { label: 'Status', href: 'https://status.hostdaddy.app' as const, external: true },
      { label: 'WhatsApp', href: 'https://wa.me/60123456789' as const, external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/legal/terms' as const },
      { label: 'Privacy (PDPA)', href: '/legal/privacy' as const },
      { label: 'Acceptable Use', href: '/legal/aup' as const },
      { label: 'Refund Policy', href: '/legal/refund' as const },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-navy-100 bg-navy-900 text-navy-100">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-white">
              <span
                className="inline-block h-7 w-7 rounded-md bg-gradient-to-br from-electric-500 to-cyan-500"
                aria-hidden
              />
              HostDaddy<span className="text-cyan-400">.app</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-navy-200">
              Domain registration, hosting, and AI-built websites — built entirely on Cloudflare.
              A White Unicorn Ventures venture.
            </p>
            <p className="mt-4 text-xs text-navy-300">
              HostDaddy.app is a brand of White Unicorn Ventures Sdn Bhd.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-navy-200 hover:text-white"
                      {...('external' in l && l.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-navy-300">
            © {new Date().getFullYear()} White Unicorn Ventures Sdn Bhd. All rights reserved.
          </p>
          <ul
            className="flex flex-wrap items-center gap-3 text-xs text-navy-300"
            aria-label="Accepted payment methods"
          >
            <li className="rounded border border-white/10 bg-white/5 px-2 py-1">Visa</li>
            <li className="rounded border border-white/10 bg-white/5 px-2 py-1">Mastercard</li>
            <li className="rounded border border-white/10 bg-white/5 px-2 py-1">FPX</li>
            <li className="rounded border border-white/10 bg-white/5 px-2 py-1">GrabPay</li>
            <li className="rounded border border-white/10 bg-white/5 px-2 py-1">TNG eWallet</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
