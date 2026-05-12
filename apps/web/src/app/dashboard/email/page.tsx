import { EmptyState } from '@/components/dashboard/empty-state';

export default function EmailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Email forwarding
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Forward info@yourdomain.com to any Gmail or Outlook inbox. Free on
          every plan.
        </p>
      </div>
      <EmptyState
        title="No email rules yet"
        body="Once you have a domain on HostDaddy.app, you can route any address on it to your personal inbox in under a minute."
        ctaLabel="Search for a domain"
        ctaHref="/search"
      />
    </div>
  );
}
