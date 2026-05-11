'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@hostdaddy/ui';

const TLD_PILLS = [
  { tld: '.com', price: 'RM 49' },
  { tld: '.my', price: 'RM 69' },
  { tld: '.store', price: 'RM 19' },
  { tld: '.online', price: 'RM 9', highlight: true },
];

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    });
  }

  return (
    <section className="relative isolate overflow-hidden bg-navy-800 text-white">
      {/* Glow */}
      <div
        className="absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,#000_30%,transparent_70%)]"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(6,182,212,0.5),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(26,86,219,0.45),transparent_55%)]" />
      </div>

      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            100% Cloudflare-powered
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your Domain. <span className="text-cyan-400">Your Brand.</span> Your Growth.
          </h1>
          <p className="mt-5 text-lg text-navy-100 sm:text-xl">
            Register domains, host websites, and grow your business — all in one place.
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-10 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-electric-500/20 sm:flex-row"
            role="search"
            aria-label="Search for a domain"
          >
            <Input
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find your perfect domain..."
              className="h-14 border-0 text-base focus:ring-0 sm:flex-1"
              autoComplete="off"
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              isLoading={pending}
              className="h-14 px-8 text-base"
            >
              Search
            </Button>
          </form>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {TLD_PILLS.map(({ tld, price, highlight }) => (
              <li
                key={tld}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
                  highlight
                    ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200'
                    : 'border-white/15 bg-white/5 text-navy-100',
                ].join(' ')}
              >
                <span className="font-semibold text-white">{tld}</span>
                <span className="opacity-80">{price}/yr</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
