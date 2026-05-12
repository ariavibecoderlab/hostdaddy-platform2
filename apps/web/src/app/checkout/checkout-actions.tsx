'use client';

import { useState } from 'react';
import { Button } from '@hostdaddy/ui';
import { api, ApiHttpError } from '@/lib/api';
import type { PlanId, BillingCycle } from '@/lib/plans';

interface Props {
  plan: PlanId;
  cycle: BillingCycle;
}

export function CheckoutActions({ plan, cycle }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'stripe' | 'fpx' | null>(null);

  async function go(path: '/billing/checkout' | '/billing/checkout/fpx', kind: 'stripe' | 'fpx') {
    setError(null);
    setBusy(kind);
    try {
      const { url } = await api.post<{ url: string }>(path, { plan, cycle });
      window.location.href = url;
    } catch (err) {
      setBusy(null);
      if (err instanceof ApiHttpError) setError(err.message);
      else setError('Could not start checkout. Try again in a moment.');
    }
  }

  return (
    <div className="space-y-2 pt-2">
      <Button
        fullWidth
        size="lg"
        isLoading={busy === 'stripe'}
        onClick={() => go('/billing/checkout', 'stripe')}
      >
        Pay with card
      </Button>
      <Button
        fullWidth
        size="lg"
        variant="outline"
        isLoading={busy === 'fpx'}
        onClick={() => go('/billing/checkout/fpx', 'fpx')}
      >
        Pay with FPX / GrabPay / TNG
      </Button>
      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
