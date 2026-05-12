import { EmptyState } from '@/components/dashboard/empty-state';

export default function DomainsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Domains
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Register, transfer, and manage every domain in one place.
        </p>
      </div>
      <EmptyState
        title="No domains yet"
        body="Search for your first domain or transfer one in from another registrar. We support .com, .my, .net, .org, .io, and more."
        ctaLabel="Search for a domain"
        ctaHref="/search"
        secondaryLabel="Transfer in"
        secondaryHref="/transfer"
      />
    </div>
  );
}
