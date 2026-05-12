import { getSession } from '@/lib/auth';
import { SettingsForms } from './settings-forms';

export const runtime = 'edge';

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) return null; // layout will have redirected already

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Manage your profile and password.
        </p>
      </div>
      <SettingsForms user={user} />
    </div>
  );
}
