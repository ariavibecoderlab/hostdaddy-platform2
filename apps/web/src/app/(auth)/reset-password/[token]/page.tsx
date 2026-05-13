'use client';

export const runtime = 'edge';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input } from '@hostdaddy/ui';
import { authApi, ApiHttpError } from '@/lib/api';

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    startTransition(async () => {
      try {
        await authApi.resetPassword({ token: params.token, password });
        setDone(true);
        setTimeout(() => router.push('/login'), 1500);
      } catch (err) {
        if (err instanceof ApiHttpError) setError(err.message);
        else setError('Could not reach the server. Try again in a moment.');
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl shadow-navy-900/30">
      <h1 className="font-display text-2xl font-bold text-navy-900">
        Set a new password
      </h1>
      <p className="mt-1 text-sm text-navy-500">
        Choose something memorable but strong.
      </p>

      {done ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Password updated. Redirecting you to sign in&hellip;
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              New password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <p className="mt-1 text-xs text-navy-500">
              Must contain a letter and a number.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Confirm new password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
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
            Set new password
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-navy-600">
        Back to{' '}
        <Link
          href="/login"
          className="font-medium text-electric-600 hover:text-electric-700"
        >
          sign in
        </Link>
      </p>
    </div>
  );
}
