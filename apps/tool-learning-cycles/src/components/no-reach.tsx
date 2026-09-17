import { Card } from '@breezebox/ui';

/**
 * Shown to someone whose staff row has neither a site nor district-wide reach.
 *
 * This is the state a brand new SSO user lands in, by design: §5 creates staff
 * rows on first sign-in with no site, and reach is granted rather than
 * inferred. They are a legitimate member of the district who has not been
 * assigned yet, so this explains rather than accuses, and does not leak how
 * many schools or records exist.
 */
export function NoReach() {
  return (
    <Card as="section">
      <h2 className="text-base font-semibold">You are not set up for this yet</h2>
      <p className="mt-2 text-sm leading-relaxed text-bb-muted">
        Learning Cycle Check-In shows records for a school you are assigned to.
        Your account is not linked to a school yet.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-bb-muted">
        Ask your district office to add you to a school, or to give you
        district-wide access if you work across schools.
      </p>
    </Card>
  );
}
