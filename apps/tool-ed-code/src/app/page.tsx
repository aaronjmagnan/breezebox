import { Card } from '@breezebox/ui';
import { requireToolSession } from '@/lib/session';
import { Ask } from '@/components/ask';

export const dynamic = 'force-dynamic';

/**
 * The whole tool is one screen: a question, an answer, and the passages the
 * answer came from.
 *
 * PHONE FIRST, unlike the check-in list. This gets used standing in a doorway
 * with a parent waiting, which is also why the answer streams rather than
 * appearing after twenty seconds of nothing.
 */
export default async function AskPage() {
  const session = await requireToolSession();

  const edCode = session.sources.find((s) => s.kind === 'ed_code');
  const boardPolicy = session.sources.find((s) => s.kind === 'board_policy');

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 print-sheet sm:px-6">
      <header className="mb-6 print-hide">
        <h1 className="text-2xl font-semibold text-bb-text">Ed Code Assistant</h1>
        <p className="mt-1 text-base leading-relaxed text-bb-muted">
          Ask about California school law and get the sections back, quoted and
          linked. Every answer is written from the text below and nothing else.
        </p>
      </header>

      {session.hasEdCode ? null : (
        <Card className="mb-6 border-accent-amber">
          <h2 className="text-base font-semibold text-bb-text">Nothing to search yet</h2>
          <p className="mt-2 text-base leading-relaxed text-bb-muted">
            The Education Code has not been loaded into this Breeze Box. Until it
            is, there is nothing for the assistant to answer from, and it will
            say so rather than answer from memory.
          </p>
        </Card>
      )}

      <Ask enabled={session.hasEdCode} hasBoardPolicy={session.hasBoardPolicy} />

      <section className="mt-8 print-hide">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-bb-muted">
          What it is reading
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {session.sources.length === 0 ? (
            <li className="text-base text-bb-muted">Nothing loaded yet.</li>
          ) : null}
          {session.sources.map((source) => (
            <li key={source.id}>
              <Card padding="sm">
                <p className="text-base font-semibold text-bb-text">{source.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-bb-muted">
                  {source.kind === 'ed_code'
                    ? 'California state law. The same copy every district reads.'
                    : source.kind === 'board_policy'
                      ? 'Your district’s own board policy. It can be stricter than state law, never looser.'
                      : 'Reference text loaded for this district.'}
                  {source.retrieved_at
                    ? ` Copy taken ${new Date(source.retrieved_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}.`
                    : ''}
                </p>
                {source.home_url ? (
                  <p className="mt-2 text-sm">
                    <a
                      className="text-bb-text underline underline-offset-2"
                      href={source.home_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Check the publisher
                    </a>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm leading-relaxed text-bb-muted">
          {edCode ? '' : 'The Education Code is missing. '}
          {boardPolicy
            ? ''
            : 'Your board policy manual is not loaded, so answers cover state law only. '}
          An answer is only as current as the copy it came from: check the
          publisher before you act on something time sensitive.
        </p>
      </section>
    </main>
  );
}
