/**
 * Why a sign-in was refused, and what to tell the person (backbone §5).
 *
 * The messages are written for a teacher on a phone who has just been bounced
 * out of an app, not for a developer. They say what went wrong and what to do
 * next, and they never hint at whether an account exists.
 */
export const AUTH_DENIED_REASONS = [
  'wrong_domain',
  'district_not_configured',
  'account_deactivated',
  'other_district',
  'no_email',
  'exchange_failed',
  'unknown',
] as const;

export type AuthDeniedReason = (typeof AUTH_DENIED_REASONS)[number];

export function isAuthDeniedReason(value: string | null): value is AuthDeniedReason {
  return value !== null && (AUTH_DENIED_REASONS as readonly string[]).includes(value);
}

type DeniedMessage = { title: string; body: string };

export function deniedMessage(
  reason: AuthDeniedReason,
  context: { districtName?: string; ssoDomain?: string | null } = {},
): DeniedMessage {
  const district = context.districtName ?? 'this district';

  switch (reason) {
    case 'wrong_domain':
      return {
        title: 'That account is not part of this district',
        body: context.ssoDomain
          ? `Sign in with your ${district} email address, the one ending in @${context.ssoDomain}. Personal accounts will not work here.`
          : `Sign in with your ${district} work email address. Personal accounts will not work here.`,
      };
    case 'district_not_configured':
      return {
        title: 'Sign-in is not switched on yet',
        body: `${district} is not set up for sign-in yet. Your district office will know when it is ready.`,
      };
    case 'account_deactivated':
      return {
        title: 'This account has been turned off',
        body: `Your access to ${district} has been turned off. Your district office can turn it back on.`,
      };
    case 'other_district':
      return {
        title: 'That account belongs to another district',
        body: 'This account is already set up with a different district. Sign in at that district’s web address instead.',
      };
    case 'no_email':
      return {
        title: 'We did not get an email address',
        body: 'The sign-in provider did not share an email address with us, so we cannot tell which district you are in. Try the other sign-in button.',
      };
    case 'exchange_failed':
      return {
        title: 'That sign-in link did not work',
        body: 'The link may have expired or already been used. Start again from the sign-in page.',
      };
    case 'unknown':
    default:
      return {
        title: 'Something went wrong signing in',
        body: 'Please try again. If it keeps happening, let your district office know.',
      };
  }
}

/**
 * Map a claim_staff_membership() failure onto a reason.
 *
 * The database raises these with errcode insufficient_privilege and a message
 * naming the cause; the wording lives in one place (the migration) and is
 * matched here rather than re-implemented.
 */
export function reasonFromClaimError(message: string): AuthDeniedReason {
  const text = message.toLowerCase();
  if (text.includes('is not allowed for this district')) return 'wrong_domain';
  if (text.includes('not configured for sign-in')) return 'district_not_configured';
  if (text.includes('has been deactivated')) return 'account_deactivated';
  if (text.includes('already linked to a different district')) return 'other_district';
  if (text.includes('returned no email')) return 'no_email';
  return 'unknown';
}
