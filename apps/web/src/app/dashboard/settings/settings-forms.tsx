'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
} from '@hostdaddy/ui';
import { authApi, meApi, ApiHttpError, type SessionUser } from '@/lib/api';

interface Props {
  user: SessionUser;
}

function Banner({ kind, children }: { kind: 'success' | 'error'; children: React.ReactNode }) {
  const colour =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${colour}`}>
      {children}
    </div>
  );
}

export function SettingsForms({ user }: Props) {
  return (
    <div className="space-y-6">
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}

function ProfileForm({ user }: { user: SessionUser }) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? '',
    company: user.company ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await meApi.update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
        });
        setSuccess(true);
      } catch (err) {
        if (err instanceof ApiHttpError) setError(err.message);
        else setError('Could not save. Try again in a moment.');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Visible on your invoices and email receipts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Full name
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoComplete="name"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-800">
                Phone
              </label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+60 12 345 6789"
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-navy-800">
                Company
              </label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Your business name"
                autoComplete="organization"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Email <span className="text-navy-400">(contact support to change)</span>
            </label>
            <Input value={user.email} disabled />
          </div>
          {error ? <Banner kind="error">{error}</Banner> : null}
          {success ? <Banner kind="success">Profile updated.</Banner> : null}
          <div className="flex justify-end">
            <Button type="submit" isLoading={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match');
      return;
    }
    startTransition(async () => {
      try {
        await authApi.changePassword({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        });
        setSuccess(true);
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
      } catch (err) {
        if (err instanceof ApiHttpError) setError(err.message);
        else setError('Could not update password. Try again in a moment.');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Keep your account safe. Minimum 8 characters with a letter and a number.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              Current password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={form.currentPassword}
              onChange={(e) =>
                setForm({ ...form, currentPassword: e.target.value })
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-navy-800">
              New password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            />
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
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>
          {error ? <Banner kind="error">{error}</Banner> : null}
          {success ? <Banner kind="success">Password updated.</Banner> : null}
          <div className="flex justify-end">
            <Button type="submit" isLoading={pending}>
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
