'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button, Input } from '@hostdaddy/ui';
import { authApi, ApiHttpError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await authApi.forgotPassword({ email: email.trim().toLowerCase() });
        setSent(true);
      } catch (err) {
        if (err instanceof ApiHttpError) setError(err.message);
        else setError('Could not reach the server. Try again in a moment.');
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl shadow-navy-900/30">
      <h1 className="font-display text-2xl font-bold text-navy-900">
        Forgot your password?
      </h1>
      <p className="mt-1 text-sm text-navy-500">
        Enter your email and we&apos;ll send a reset link.
      </p>

      {sent ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          If an account exists for <strong>{email}</strong>, a reset email is on
          its way. Check your inbox in the next minute or two — the link works
          for one hour.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}
          <Button type="submit" isLoading={pending} fullWidth size="lg">
            Send reset link
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-navy-600">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-medium text-electric-600 hover:text-electric-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
