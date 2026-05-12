import { EmptyState } from '@/components/dashboard/empty-state';

export default function HostingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Hosting
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Cloudflare-powered hosting. Free SSL, global CDN, instant deploys.
        </p>
      </div>
      <EmptyState
        title="No active hosting plans"
        body="Pick a plan to get your first site live. Starter, Business, or Agency — all on Cloudflare's global edge."
        ctaLabel="Choose a plan"
        ctaHref="/hosting"
      />
    </div>
  );
}
