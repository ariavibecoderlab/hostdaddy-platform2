import Link from 'next/link';
import { Button } from '@hostdaddy/ui';

/**
 * GoDaddy-style promo hero.
 * Full-bleed dark scene with one big offer + one CTA + fine print.
 * Designed to swap in seasonal campaigns by editing this file only.
 */
export function HeroPromo() {
  return (
    <section
      aria-label="Launch promotion"
      className="relative isolate overflow-hidden bg-navy-900 text-white"
    >
      {/* Atmospheric backdrop — replace with brand photography when ready */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse at 25% 30%, rgba(26,86,219,0.40), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(6,182,212,0.32), transparent 60%), linear-gradient(135deg, #0A1628 0%, #050B16 55%, #0A1628 100%)',
          }}
        />
        {/* Soft mesh dots, mimics depth without using a photo */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Lower vignette to anchor copy */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              'linear-gradient(to top, rgba(5,11,22,0.55), transparent)',
          }}
        />
      </div>

      <div className="container-page relative py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden />
            Limited launch promo
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Get a <span className="text-cyan-300">.com</span> for{' '}
            <span className="text-cyan-300">RM 9</span>.
            <br />
            First year only.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Renews at RM 49/yr — fair pricing forever, no surprise hikes. Built on
            Cloudflare, made in Malaysia, halal & trusted.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href={{ pathname: '/search', query: { promo: 'launch' } }}>
              <Button
                size="xl"
                className="rounded-full bg-white px-8 text-navy-900 hover:bg-white/90 active:bg-white/80"
              >
                Claim your .com
              </Button>
            </Link>
            <p className="text-xs text-white/55">
              3-year purchase required. SST applies. Premium domains excluded.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom-left product pills */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-between px-6 sm:px-10">
        <div className="pointer-events-auto flex gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
            Domains
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
            Hosting
          </span>
          <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur sm:inline">
            Websites
          </span>
        </div>
        <p className="hidden text-xs text-white/40 sm:block">
          Powered by Cloudflare · 300+ cities
        </p>
      </div>
    </section>
  );
}
