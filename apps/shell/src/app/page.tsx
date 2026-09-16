import { AppHeader, Card, Tile } from '@breezebox/ui';
import { requireDistrictSession } from '@/lib/session';
import { listActiveTools } from '@/lib/tools';
import { InactivityWatcher } from '@/components/inactivity-watcher';
import { InstallPrompt } from '@/components/install-prompt';
import { SignOutButton } from '@/components/sign-out-button';
import { UpdatePrompt } from '@/components/update-prompt';

export const dynamic = 'force-dynamic';

/**
 * The district landing page (backbone §8).
 *
 * PHONE FIRST. A teacher opening the installed app on a phone between classes
 * is the design target; the laptop view is the same grid with more columns.
 *
 * Deliberately absent, per §8: no roster picker, no cross-tool search, no data
 * query bar. Those are workflow and impact tier features, not shell features.
 */
export default async function Page() {
  const { district, staff, inactivityTimeoutMinutes } = await requireDistrictSession();
  const tools = await listActiveTools();

  return (
    <>
      <AppHeader
        districtName={district.name}
        iconUrl={district.icon_url}
        asHeading
        actions={<SignOutButton />}
      />

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <h2 className="text-xl font-semibold">Your apps</h2>
        <p className="mt-1 text-sm text-bb-muted">Signed in as {staff.name}</p>

        {tools.length === 0 ? (
          <Card as="section" className="mt-6">
            <h2 className="text-base font-semibold">No apps yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-bb-muted">
              Nothing has been switched on for {district.name} yet. When your
              district adds an app it will show up here, and you will not need
              to install anything new.
            </p>
          </Card>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tools.map((tool) => (
              <li key={tool.id} className="flex">
                <Tile
                  href={`/${tool.tool_slug}`}
                  name={tool.name}
                  description={tool.description}
                  icon={tool.icon}
                  accent={tool.accent}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        )}
        <InstallPrompt />
      </main>

      <UpdatePrompt />
      <InactivityWatcher timeoutMinutes={inactivityTimeoutMinutes} />
    </>
  );
}
