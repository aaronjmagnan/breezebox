import { AppHeader, Button, Card } from '@breezebox/ui';
import { SIGN_IN_PATH, deniedMessage, isAuthDeniedReason } from '@breezebox/auth';
import { requireDistrict } from '@/lib/district/server';

export const dynamic = 'force-dynamic';

/**
 * Shown after a sign-in was refused (backbone §5). The session was already
 * dropped in the callback route, so nobody reaches this page still holding a
 * token.
 *
 * PHONE FIRST.
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
    <>
      <AppHeader districtName={district.name} iconUrl={district.icon_url} />

      <main className="mx-auto flex w-full max-w-sm flex-col px-4 py-10">
        <Card as="section">
          <h1 className="text-lg font-semibold">{message.title}</h1>
          <p className="mt-3 text-base leading-relaxed text-bb-muted">{message.body}</p>
          <Button variant="primary" fullWidth href={SIGN_IN_PATH} className="mt-6">
            Try a different account
          </Button>
        </Card>
      </main>
    </>
  );
}
