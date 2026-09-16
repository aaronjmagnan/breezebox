import { redirect } from 'next/navigation';
import { AppHeader, Card } from '@breezebox/ui';
import { deniedMessage, isAuthDeniedReason, safeNextPath } from '@breezebox/auth';
import { getSessionContext } from '@breezebox/auth/server';
import { requireDistrict } from '@/lib/district/server';
import { SignInButtons } from './sign-in-buttons';

export const dynamic = 'force-dynamic';

/**
 * PHONE FIRST. The one screen every user meets, usually on a phone, often on
 * school wifi, sometimes inside the installed app.
 *
 * `reason` on the query string is how an inactivity sign-out explains itself
 * when the user lands back here.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const district = await requireDistrict();
  const params = await searchParams;

  const next = safeNextPath(typeof params.next === 'string' ? params.next : '/');

  const session = await getSessionContext();
  if (session.signedIn && session.staff?.district_id === district.id) redirect(next);

  const rawReason = typeof params.reason === 'string' ? params.reason : null;
  const notice =
    rawReason === 'inactivity'
      ? {
          title: 'You were signed out',
          body: 'We signed you out because the app was idle for a while. Sign in again to pick up where you left off.',
        }
      : isAuthDeniedReason(rawReason)
        ? deniedMessage(rawReason, {
            districtName: district.name,
            ssoDomain: district.sso_domain,
          })
        : null;

  return (
    <>
      <AppHeader districtName={district.name} iconUrl={district.icon_url} />

      <main className="mx-auto flex w-full max-w-sm flex-col px-4 py-10">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-bb-muted">Use your district account.</p>

        {notice ? (
          <Card as="section" role="status" padding="sm" className="mt-6">
            <p className="text-base font-semibold">{notice.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-bb-muted">{notice.body}</p>
          </Card>
        ) : null}

        <SignInButtons next={next} />

        {district.sso_domain ? (
          <p className="mt-6 text-sm leading-relaxed text-bb-muted">
            Sign in with your @{district.sso_domain} address. Personal accounts
            will not work here.
          </p>
        ) : null}
      </main>
    </>
  );
}
