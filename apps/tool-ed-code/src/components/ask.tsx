'use client';

import { useRef, useState } from 'react';
import { Button, Card, Field, Textarea } from '@breezebox/ui';
import { createNdjsonParser } from '@/lib/ndjson';
import { appHref } from '@/lib/routes';
import { Answer } from './answer';

/**
 * Ask, watch it work, read the answer, check the sources.
 *
 * The stages are shown rather than hidden behind one spinner because they are
 * the argument for trusting the answer: the assistant translated the question,
 * searched, found these sections, and only then wrote anything. A user who
 * sees that is in a better position to spot when it has gone looking in the
 * wrong place.
 *
 * Nothing here is kept. There is no history, no saved answer, no draft: the
 * server stores no question and neither does the browser.
 */

type Citation = {
  ref: number;
  citation: string;
  title: string;
  sourceTitle: string;
  kind: 'ed_code' | 'board_policy' | 'other';
  breadcrumb: string | null;
  url: string | null;
  retrievedAt: string | null;
  whole: boolean;
};

type Stage = 'idle' | 'planning' | 'searching' | 'writing' | 'done';

const STAGE_LABEL: Record<Exclude<Stage, 'idle' | 'done'>, string> = {
  planning: 'Working out what to look for…',
  searching: 'Searching the text…',
  writing: 'Reading the sections…',
};

export function Ask({
  enabled,
  hasBoardPolicy,
}: {
  enabled: boolean;
  hasBoardPolicy: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [restated, setRestated] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  // One request at a time. A second submit abandons the first rather than
  // interleaving two streams into the same answer box.
  const abort = useRef<AbortController | null>(null);

  const busy = stage === 'planning' || stage === 'searching' || stage === 'writing';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length === 0 || busy) return;

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    setStage('planning');
    setRestated(null);
    setCitations([]);
    setAnswer('');
    setNotice(null);
    setError(null);
    setAsked(text);

    try {
      // appHref, not a bare path: fetch resolves against the district origin,
      // which is the shell, not this zone.
      const response = await fetch(appHref('/api/ask'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: text }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'The assistant could not be reached.');
        setStage('idle');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createNdjsonParser<Record<string, unknown>>();

      const apply = (event: Record<string, unknown>) => {
        switch (event.type) {
          case 'stage':
            setStage(event.stage as Stage);
            break;
          case 'plan':
            setRestated(event.restated as string);
            break;
          case 'citations':
            setCitations(event.citations as Citation[]);
            break;
          case 'delta':
            setAnswer((current) => current + (event.text as string));
            break;
          case 'refused':
            setNotice(event.message as string);
            break;
          case 'error':
            setError(event.message as string);
            break;
          default:
            break;
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) apply(event);
      }
      for (const event of parser.flush()) apply(event);

      setStage('done');
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') return;
      setError('The connection dropped before the answer finished.');
      setStage('idle');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card as="section" className="print-hide">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label="What do you need to know?"
            hint={
              hasBoardPolicy
                ? 'State law and your board policy. Ask in your own words. Leave student and staff names out: the answer is the rule, not the case.'
                : 'State law only, until your board policy is loaded. Ask in your own words, and leave student and staff names out.'
            }
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                maxLength={1000}
                disabled={!enabled}
                placeholder="Can a student be suspended for something that happened off campus?"
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={!enabled || busy}>
              {busy ? 'Working…' : 'Ask'}
            </Button>
            {answer.length > 0 || notice ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  abort.current?.abort();
                  setQuestion('');
                  setAnswer('');
                  setCitations([]);
                  setRestated(null);
                  setNotice(null);
                  setError(null);
                  setAsked(null);
                  setStage('idle');
                }}
              >
                Start over
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {/* One live region for the whole exchange, so a screen reader hears the
          stages and then the answer instead of nothing until it is finished. */}
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-6">
        {busy ? (
          <p className="text-base text-bb-muted">{STAGE_LABEL[stage as keyof typeof STAGE_LABEL]}</p>
        ) : null}

        {error ? (
          <Card className="border-accent-coral" role="alert">
            <p className="text-base leading-relaxed text-bb-text">{error}</p>
          </Card>
        ) : null}

        {notice ? (
          <Card className="border-accent-amber">
            <p className="text-base leading-relaxed text-bb-text">{notice}</p>
          </Card>
        ) : null}

        {answer.length > 0 ? (
          <Card as="article">
            {asked ? (
              <p className="mb-4 border-l-2 border-accent-blue pl-3 text-sm leading-relaxed text-bb-muted">
                {asked}
              </p>
            ) : null}
            <Answer text={answer} citationCount={citations.length} />
          </Card>
        ) : null}

        {citations.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-bb-muted">
              Where this came from
            </h2>
            {restated ? (
              <p className="mt-2 text-sm leading-relaxed text-bb-muted">
                Searched as: {restated}
              </p>
            ) : null}
            <ol className="mt-3 flex flex-col gap-3">
              {citations.map((source) => (
                <li key={source.ref} id={`source-${source.ref}`}>
                  <Card padding="sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-accent-blue-ink">
                        {source.ref}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-bb-text">
                          {source.citation} {source.title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-bb-muted">
                          {source.kind === 'ed_code' ? 'State law' : 'District board policy'}
                          {' · '}
                          {source.sourceTitle}
                          {source.whole ? '' : ' · one passage of this section'}
                        </p>
                        {source.breadcrumb ? (
                          <p className="mt-1 text-sm text-bb-muted">{source.breadcrumb}</p>
                        ) : null}
                        {source.url ? (
                          <p className="mt-2 text-sm">
                            <a
                              className="text-bb-text underline underline-offset-2"
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Read the full text
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
