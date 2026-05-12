'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@hostdaddy/ui';
import { authApi, ApiHttpError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await authApi.login({ email: email.trim().toLowerCase(), password });
      startTransition(() => {
        router.push(next.startsWith('/') ? next : '/dashboard');
        router.refresh();
      });
    } catch (err) {
      if (err instanceof ApiHttpError) {
        setError(err.message);
      } else {
        setError('Could not reach the server. Try again in a moment.');
      }
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl shadow-navy-900/30">
      <h1 className="font-display text-2xl font-bold text-navy-900">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-navy-500">
        Sign in to your HostDaddy.app dashboard.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-navy-800"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-navy-800"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-electric-600 hover:text-electric-700"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
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

        <Button
          type="submit"
          isLoading={pending}
          fullWidth
          size="lg"
          className="mt-2"
        >
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-navy-600">
        New to HostDaddy.app?{' '}
        <Link
          href={{ pathname: '/register', query: next ? { next } : undefined }}
          className="font-medium text-electric-600 hover:text-electric-700"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
