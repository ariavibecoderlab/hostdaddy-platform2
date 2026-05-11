import Link from 'next/link';
import { Button } from '@hostdaddy/ui';

export function BrainyBunchBanner() {
  return (
    <section className="bg-gradient-to-br from-electric-600 via-electric-500 to-cyan-500 py-16 text-white">
      <div className="container-page flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-100">
            For Brainy Bunch franchisees
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            Your school website + hosting bundle — <span className="text-navy-900">RM 49/month</span>.
          </h2>
          <p className="mt-3 max-w-xl text-base text-white/90">
            Custom site built by Cowork Claude on the official BB template. SEO-ready, parent
            portal–linked, English + Bahasa Malaysia. Mandatory for all franchisees.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
          <Link href="/franchise/brainy-bunch">
            <Button size="lg" variant="cyan">
              Activate franchise bundle
            </Button>
          </Link>
          <Link href="/franchise/brainy-bunch#faq">
            <Button size="lg" variant="ghost" className="text-white hover:bg-white/15">
              Learn more
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
