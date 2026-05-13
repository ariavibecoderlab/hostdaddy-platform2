'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, Input } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type HostingPlanSummary } from '@/lib/api';

const TEMPLATES = [
  { id: 'blank', label: 'Blank canvas', body: 'Start empty and build from scratch.' },
  {
    id: 'founder_personal',
    label: 'Founder personal',
    body: 'About, work, blog, contact.',
  },
  {
    id: 'islamic_school',
    label: 'Islamic school',
    body: 'Programs, curriculum, parents, admissions.',
  },
  { id: 'fnb', label: 'F&B', body: 'Menu, locations, online order, gallery.' },
  { id: 'service', label: 'Service / coaching', body: 'Offer, bookings, testimonials.' },
];

export function NewSiteForm({ plans }: { plans: HostingPlanSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [template, setTemplate] = useState<string>('blank');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please give your site a name.');
      return;
    }
    if (!planId) {
      setError('Pick a hosting plan.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await sitesApi.create({
        name: name.trim(),
        hosting_plan_id: planId,
        template: template === 'blank' ? null : template,
      });
      router.push(`/dashboard/sites/${res.site.id}`);
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Could not create site.');
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy-700">
              Site name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My new site"
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-navy-500">
              You can rename anytime. We use this for the dashboard label.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-navy-700">
              Hosting plan
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="block w-full rounded-md border border-navy-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planLabel(p)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-navy-700">
              Starter template
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplate(t.id)}
                  className={
                    'rounded-lg border p-3 text-left transition-colors ' +
                    (template === t.id
                      ? 'border-electric-500 bg-electric-50'
                      : 'border-navy-200 bg-white hover:border-navy-300')
                  }
                >
                  <div className="text-sm font-semibold text-navy-900">{t.label}</div>
                  <div className="mt-0.5 text-xs text-navy-500">{t.body}</div>
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create site'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => history.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function planLabel(p: HostingPlanSummary): string {
  const price = (p.price_cents / 100).toFixed(2);
  const limit = p.sites_limit === -1 ? 'unlimited sites' : `${p.sites_limit} sites`;
  return `${p.plan_type} · ${p.billing_cycle} · RM ${price} · ${limit} · ${p.status}`;
}
