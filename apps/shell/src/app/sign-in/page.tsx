import { redirect } from 'next/navigation';
import { deniedMessage, isAuthDeniedReason, safeNextPath } from '@breezebox/auth';
import { getSessionContext } from '@breezebox/auth/server';
import { requireDistrict } from '@/lib/district/server';
import { SignInButtons } from './sign-in-buttons';

export const dynamic = 'force-dynamic';

/**
 * Phone first. Works from 360px up.
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

  const session = await getSessionContext();
  const nextParam = typeof params.next === 'string' ? params.next : '/';
  const next = safeNextPath(nextParam);

  if (session.signedIn && session.staff) redirect(next);

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl">{district.name}</h1>
      <p className="mt-2 text-base">Sign in with your district account.</p>

      {notice ? (
        <div role="status" className="mt-6 rounded-lg border p-4">
          <p className="text-base">{notice.title}</p>
          <p className="mt-1 text-sm leading-relaxed">{notice.body}</p>
        </div>
      ) : null}

      <SignInButtons next={next} />

      {district.sso_domain ? (
        <p className="mt-6 text-sm leading-relaxed">
          Use your @{district.sso_domain} address. Personal accounts will not
          work here.
        </p>
      ) : null}
    </main>
  );
}
