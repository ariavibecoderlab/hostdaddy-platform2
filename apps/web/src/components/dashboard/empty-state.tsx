import Link from 'next/link';
import { Button, Card, CardContent } from '@hostdaddy/ui';

interface EmptyStateProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function EmptyState({
  title,
  body,
  ctaLabel,
  ctaHref,
  secondaryHref,
  secondaryLabel,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-electric-50 text-electric-600"
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
            className="h-6 w-6"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-semibold text-navy-900">
          {title}
        </h2>
        <p className="max-w-md text-sm text-navy-600">{body}</p>
        <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
          <Link href={ctaHref}>
            <Button>{ctaLabel}</Button>
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref}>
              <Button variant="ghost">{secondaryLabel}</Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
