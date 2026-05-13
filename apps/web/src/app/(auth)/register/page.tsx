'use client';

import { Suspense, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@hostdaddy/ui';
import { authApi, ApiHttpError } from '@/lib/api';

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl shadow-navy-900/30">
      <div className="h-7 w-48 animate-pulse rounded bg-navy-100" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-navy-100" />
      <div className="mt-6 space-y-4">
        <div className="h-10 animate-pulse rounded bg-navy-100" />
        <div className="h-10 animate-pulse rounded bg-navy-100" />
        <div className="h-10 animate-pulse rounded bg-navy-100" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 animate-pulse rounded bg-navy-100" />
          <div className="h-10 animate-pulse rounded bg-navy-100" />
        </div>
        <div className="h-11 animate-pulse rounded bg-navy-100" />
      </div>
    </div>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    franchiseCode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await authApi.register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        company: form.company.trim() || undefined,
        franchiseCode: form.franchiseCode.trim() || undefined,
      });
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
        Create your account
      </h1>
      <p className="mt-1 text-sm text-navy-500">
        Your digital home, ready in 60 seconds.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-800">
            Full name
          </label>
          <Input
            type="text"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Mohd Fadzil Hashim"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-800">
            Email
          </label>
          <Input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-800">
            Password
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="At least 8 characters"
          />
          <p className="mt-1 text-xs text-navy-500">
            Must contain a letter and a number.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Company <span className="text-navy-400">(optional)</span>
            </label>
            <Input
              type="text"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="Your business name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Franchise code{' '}
              <span className="text-navy-400">(optional)</span>
            </label>
            <Input
              type="text"
              value={form.franchiseCode}
              onChange={(e) => set('franchiseCode', e.target.value.toUpperCase())}
              placeholder="BB-KL01"
            />
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <Button type="submit" isLoading={pending} fullWidth size="lg" className="mt-2">
          Create account
        </Button>
        <p className="text-xs text-navy-500">
          By signing up you agree to our{' '}
          <Link
            href="/legal/terms"
            className="underline-offset-2 hover:underline"
          >
            Terms
          </Link>{' '}
          and{' '}
          <Link
            href="/legal/privacy"
            className="underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-navy-600">
        Already have an account?{' '}
        <Link
          href={{ pathname: '/login', query: next ? { next } : undefined }}
          className="font-medium text-electric-600 hover:text-electric-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
