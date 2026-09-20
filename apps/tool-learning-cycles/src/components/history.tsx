import { Card } from '@breezebox/ui';
import { readableChanges, type Revision } from '@/lib/revisions';
import type { Template } from '@/lib/template';

/**
 * The history of a submitted check-in.
 *
 * On screen only, not in print or the Word export: those are the record as it
 * stands now, which is what someone takes into a meeting. The history is for
 * the question "has this changed since I read it?", which is asked here.
 *
 * Shown to anyone who can read the check-in. That is deliberate -- a coaching
 * note about a named principal should not be quietly editable by a colleague
 * with only the author able to tell.
 */

function when(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function History({
  revisions,
  template,
}: {
  revisions: Revision[];
  template: Template;
}) {
  if (revisions.length === 0) return null;

  return (
    <section aria-labelledby="history" className="print-hide">
      <h2 id="history" className="text-base font-semibold">
        History
      </h2>
      <p className="mt-1 text-sm text-bb-muted">
        Every change since this was submitted.
      </p>

      <ol className="mt-3 flex flex-col gap-2">
        {revisions.map((revision) => {
          const changes = readableChanges(revision, template);

          return (
            <li key={revision.id}>
              <Card padding="sm">
                <p className="text-sm">
                  <span className="font-semibold">
                    {revision.action === 'submitted' ? 'Submitted' : 'Edited'}
                  </span>{' '}
                  by {revision.changed_by?.name ?? 'someone outside the app'}
                  {' · '}
                  <time dateTime={revision.changed_at}>{when(revision.changed_at)}</time>
                </p>

                {changes.length > 0 ? (
                  <dl className="mt-2 flex flex-col gap-2">
                    {changes.map((change) => (
                      <div key={change.column}>
                        <dt className="text-sm font-semibold">{change.label}</dt>
                        <dd className="text-sm leading-relaxed text-bb-muted">
                          {change.from === null ? (
                            'changed'
                          ) : (
                            <>
                              <span className="line-through">{change.from}</span>
                              {' → '}
                              <span className="text-bb-text">{change.to}</span>
                            </>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
