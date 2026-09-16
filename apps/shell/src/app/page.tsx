import { requireDistrict } from '@/lib/district/server';

/**
 * Placeholder. The real landing page -- district name and icon over a grid of
 * tiles from the district's active tool_instances (§8) -- is step 5, and is
 * built from @breezebox/ui components only.
 *
 * Phone first.
 */
export default async function Page() {
  const district = await requireDistrict();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl">{district.name}</h1>
      <p className="mt-2 text-base">
        Hostname routing works. The tile grid is step 5.
      </p>
      <dl className="mt-8 text-sm">
        <div className="flex gap-2">
          <dt>App name</dt>
          <dd>{district.app_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Sign-in domain</dt>
          <dd>{district.sso_domain ?? 'not configured'}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Status</dt>
          <dd>{district.status}</dd>
        </div>
      </dl>
    </main>
  );
}
