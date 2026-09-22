import { getSessionContext, serverClient } from '@breezebox/auth/server';
import { answerStream, claudeConfigured, planSearch } from '@/lib/claude';
import { retrieve } from '@/lib/retrieval';

/**
 * One question in, an answer and its citations out.
 *
 * Streamed as newline-delimited JSON rather than returned whole, because the
 * work has three stages and two of them take seconds. Sending the citations
 * as soon as retrieval finishes means the sources are on screen and clickable
 * while the answer is still being written, which is also the order a careful
 * reader wants them in.
 *
 * NOTHING HERE IS STORED. No question text, no answer text, no row saying who
 * asked what. "Can I suspend [name] for [conduct]" is a record about a
 * student the moment it lands in a table, with everything that follows from
 * that. The tool is more useful for being unable to keep one.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 1000;

type Event =
  | { type: 'stage'; stage: 'planning' | 'searching' | 'writing' }
  | { type: 'plan'; restated: string; scope: string }
  | { type: 'citations'; citations: unknown[] }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'refused'; message: string }
  | { type: 'error'; message: string };

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session.signedIn || !session.staff) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 });
  }

  if (!claudeConfigured()) {
    return Response.json(
      { error: 'This tool is not configured yet: ANTHROPIC_API_KEY is unset.' },
      { status: 503 },
    );
  }

  let question = '';
  try {
    const body = (await request.json()) as { question?: unknown };
    question = typeof body.question === 'string' ? body.question.trim() : '';
  } catch {
    return Response.json({ error: 'Could not read the request.' }, { status: 400 });
  }

  if (question.length === 0) {
    return Response.json({ error: 'Ask a question first.' }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Questions are limited to ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // Which corpora exist decides what the planner is allowed to ask for. RLS
  // already scopes this to the shared library plus their own district's.
  const supabase = await serverClient();
  const { data: sources } = await supabase
    .from('legal_sources')
    .select('kind, title')
    .eq('status', 'active');

  const boardPolicy = (sources ?? []).find((s) => s.kind === 'board_policy');
  const hasEdCode = (sources ?? []).some((s) => s.kind === 'ed_code');

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Event) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        if (!hasEdCode) {
          send({
            type: 'refused',
            message:
              'The Education Code has not been loaded into this Breeze Box yet, ' +
              'so there is nothing to answer from. Ask your administrator to run ' +
              'the ingest step.',
          });
          send({ type: 'done' });
          return;
        }

        send({ type: 'stage', stage: 'planning' });
        const plan = await planSearch(question, {
          hasBoardPolicy: Boolean(boardPolicy),
          boardPolicyTitle: boardPolicy?.title,
        });

        if (!plan.inScope) {
          send({
            type: 'refused',
            message:
              'This one is outside what I can help with. I only answer from the ' +
              'California Education Code and your district\'s board policy, so ' +
              'ask me about school rules, students, staff, or district operations.',
          });
          send({ type: 'done' });
          return;
        }

        send({ type: 'plan', restated: plan.restated, scope: plan.scope });
        send({ type: 'stage', stage: 'searching' });

        const { passages, citations } = await retrieve(plan);

        if (passages.length === 0) {
          send({
            type: 'refused',
            message:
              'Nothing in the loaded text matches that. Rather than guess at what ' +
              'the law says, I would rather tell you I came up empty: try naming ' +
              'the section number if you know it, or rephrasing in the words the ' +
              'code would use.',
          });
          send({ type: 'done' });
          return;
        }

        send({ type: 'citations', citations });
        send({ type: 'stage', stage: 'writing' });

        for await (const chunk of answerStream(question, plan, passages)) {
          send({ type: 'delta', text: chunk });
        }

        send({ type: 'done' });
      } catch (error) {
        // The message may quote the request, and the request is the question.
        console.error('[ed-code] ask failed:', error instanceof Error ? error.name : 'unknown');
        send({
          type: 'error',
          message: 'Something went wrong reaching the assistant. Try again in a moment.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      // Proxies that buffer would defeat the point of streaming.
      'x-accel-buffering': 'no',
    },
  });
}
