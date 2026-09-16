import Link from 'next/link';
import { SIGN_IN_PATH, deniedMessage, isAuthDeniedReason } from '@breezebox/auth';
import { requireDistrict } from '@/lib/district/server';

export const dynamic = 'force-dynamic';

/**
 * Shown after a sign-in was refused (backbone §5). By the time anyone gets
 * here the session has already been dropped in the callback route.
 *
 * Phone first.
 */
export default async function AuthDeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const district = await requireDistrict();
  const params = await searchParams;

  const raw = typeof params.reason === 'string' ? params.reason : null;
  const reason = isAuthDeniedReason(raw) ? raw : 'unknown';

  const message = deniedMessage(reason, {
    districtName: district.name,
    ssoDomain: district.sso_domain,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl">{message.title}</h1>
      <p className="mt-4 text-base leading-relaxed">{message.body}</p>

      <Link
        href={SIGN_IN_PATH}
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg border px-4 text-base"
      >
        Try a different account
      </Link>
    </main>
  );
}
