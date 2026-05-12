'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@hostdaddy/ui';

/**
 * GoDaddy-style persistent search band. Sits directly under the nav,
 * always visible on the marketing site. The hero below it carries the
 * promo, but the search is always one tap away.
 */
export function SearchBand() {
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
    <section
      aria-label="Domain search"
      className="border-b border-navy-100 bg-white"
    >
      <div className="container-page flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
        <form
          onSubmit={onSubmit}
          role="search"
          aria-label="Search for a domain"
          className="flex flex-1 items-center gap-2 sm:gap-3"
        >
          <div className="flex h-12 flex-1 items-center rounded-full border border-navy-200 bg-white px-4 transition-colors focus-within:border-electric-500 focus-within:ring-2 focus-within:ring-electric-500/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 flex-none text-navy-400"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type the domain you want..."
              autoComplete="off"
              className="ml-3 h-full w-full bg-transparent text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none sm:text-base"
              aria-label="Domain name"
            />
          </div>
          <Button
            type="submit"
            isLoading={pending}
            className="h-12 rounded-full px-6 sm:px-8"
          >
            Search domains
          </Button>
        </form>

        <div className="hidden items-center gap-3 border-l border-navy-100 pl-6 lg:flex">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-electric-50 text-electric-600"
            aria-hidden
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
            >
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9" />
              <path d="m3 7 9 6 9-6" />
              <circle cx="18" cy="18" r="3" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-navy-900">RM 49 / 1st year</p>
            <p className="text-xs text-navy-500">Fair renewals forever.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
