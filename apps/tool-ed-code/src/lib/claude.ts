import Anthropic from '@anthropic-ai/sdk';

/**
 * The two Claude calls this tool makes, and the reason there are two.
 *
 * A principal asks "can I send a kid home for vaping". The Education Code does
 * not contain the word "vaping" and does not contain the word "kid". A lexical
 * index cannot bridge that on its own, and an answer written from memory
 * cannot be checked. So the work is split:
 *
 *   1. plan    Claude turns the question into the vocabulary the statute
 *              actually uses, and pulls out any citation the asker named.
 *              Nothing it produces reaches the user; it only feeds the query.
 *   2. answer  Postgres has returned real passages by then, and Claude's only
 *              job is to read them and cite them. It is told, in the strongest
 *              terms available, that anything outside them is off limits.
 *
 * Between the two sits the database, which is what makes an answer checkable:
 * every citation on screen came out of a row, not out of the model.
 *
 * PRIVACY: the question is never written to the database, to a log line, or to
 * an error message. "Can I suspend [name] for X" is a record about a student
 * the moment it is stored, and this tool has no business holding one.
 */

/** Fast and cheap: this call only has to produce search terms. */
const PLAN_MODEL = process.env.ED_CODE_PLAN_MODEL ?? 'claude-haiku-4-5-20251001';
/** The one that has to read carefully and not overstate. */
const ANSWER_MODEL = process.env.ED_CODE_ANSWER_MODEL ?? 'claude-sonnet-5';

let client: Anthropic | null = null;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ---------------------------------------------------------------------------
// 1. Plan
// ---------------------------------------------------------------------------

export type SearchPlan = {
  /** False for anything that is not a California school law question. */
  inScope: boolean;
  /** The question in statutory language, shown back so the asker can correct it. */
  restated: string;
  /** Phrases for search_legal_chunks(). ORed against each other. */
  terms: string[];
  /** Citations the asker named, for the exact-lookup path. */
  citations: string[];
  /** Which corpora to search. */
  scope: 'law' | 'policy' | 'both';
};

const PLAN_TOOL: Anthropic.Tool = {
  name: 'plan_search',
  description:
    'Translate a school staff question into a search over the California ' +
    'Education Code and district board policy.',
  input_schema: {
    type: 'object',
    properties: {
      in_scope: {
        type: 'boolean',
        description:
          'True if this is a question about California school law, district ' +
          'board policy, or how a school or district must operate. False for ' +
          'anything else, including general legal questions with no school ' +
          'connection, coding, and small talk.',
      },
      restated: {
        type: 'string',
        description:
          'One sentence restating the question in the vocabulary a statute ' +
          'would use. Do not include any person\'s name.',
      },
      terms: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Three to eight short search phrases in the language the Education ' +
          'Code itself uses, not the language of the question. Each phrase is ' +
          'matched as a unit and the phrases are ORed together, so include ' +
          'both the broad term and the narrow one. For "can I send a kid home ' +
          'for vaping": ["suspension", "tobacco products", "electronic ' +
          'cigarette", "grounds for suspension", "other means of correction"].',
      },
      citations: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Any section or policy number the question named, verbatim, e.g. ' +
          '["48900", "BP 5144.1"]. Empty when none was named. Do not invent ' +
          'one you merely believe is relevant; the search will find it.',
      },
      scope: {
        type: 'string',
        enum: ['law', 'policy', 'both'],
        description:
          '"law" when the question is purely about what state law requires, ' +
          '"policy" when it is about what this district has decided, "both" ' +
          'when either could answer it. Prefer "both" when unsure.',
      },
    },
    required: ['in_scope', 'restated', 'terms', 'citations', 'scope'],
  },
};

const PLAN_SYSTEM =
  'You prepare searches over the California Education Code and a school ' +
  "district's board policy manual. You never answer the question yourself. " +
  'Your only output is a call to plan_search.\n\n' +
  'The search index is lexical: it matches the words in the statute, not the ' +
  'meaning of the question. Your value is entirely in the translation. School ' +
  'staff write "kid", "kicked out", "IEP meeting", "sub"; the code writes ' +
  '"pupil", "expulsion", "individualized education program", "substitute ' +
  'employee". Produce the code\'s words.';

export async function planSearch(
  question: string,
  context: { hasBoardPolicy: boolean; boardPolicyTitle?: string },
): Promise<SearchPlan> {
  const available = context.hasBoardPolicy
    ? `The district's own board policy manual (${context.boardPolicyTitle ?? 'board policy'}) is loaded and searchable alongside the Education Code.`
    : 'Only the Education Code is loaded. This district has not loaded its board policy manual, so "policy" scope would find nothing: use "law".';

  const message = await anthropic().messages.create({
    model: PLAN_MODEL,
    max_tokens: 1024,
    system: PLAN_SYSTEM,
    tools: [PLAN_TOOL],
    tool_choice: { type: 'tool', name: 'plan_search' },
    messages: [{ role: 'user', content: `${available}\n\nQuestion: ${question}` }],
  });

  const block = message.content.find((c) => c.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('the planning step returned no plan');
  }

  const raw = block.input as Record<string, unknown>;
  const terms = Array.isArray(raw.terms) ? raw.terms.filter(isNonEmpty) : [];
  const citations = Array.isArray(raw.citations) ? raw.citations.filter(isNonEmpty) : [];

  let scope: SearchPlan['scope'] =
    raw.scope === 'law' || raw.scope === 'policy' || raw.scope === 'both' ? raw.scope : 'both';
  // The plan is a suggestion; what is loaded is a fact. Asking for a corpus
  // that is not there would return nothing and read as "the law is silent".
  if (!context.hasBoardPolicy) scope = 'law';

  return {
    inScope: raw.in_scope !== false,
    restated: typeof raw.restated === 'string' ? raw.restated : question,
    // The question's own words are kept as one more phrase. The translation is
    // usually better, but not always, and the phrases are ORed anyway.
    terms: terms.length > 0 ? terms.slice(0, 8) : [question],
    citations: citations.slice(0, 6),
    scope,
  };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// 2. Answer
// ---------------------------------------------------------------------------

const ANSWER_SYSTEM = `You are the Ed Code Assistant inside Breeze Box, used by California school district staff: principals, directors, and office managers who need to know what the rules are before they act.

You answer ONLY from the numbered passages you are given. Those passages are the complete set of sources available to you for this question. You have no others.

Rules, in order of importance:

1. Never state a rule that is not in the passages. Not one you remember, not one you are confident about, not one that is "standard". If the passages do not answer the question, say exactly that, and say what would answer it.

2. Cite every claim with the bracketed number of the passage it came from, like [2]. A sentence that states a rule and carries no citation is a bug.

3. If you believe a relevant section exists but it is not among the passages, you may name it as worth checking. You may not describe what it says.

4. Keep state law and district policy apart. Board policy may be stricter than the Education Code but never looser. When both appear, say which is which, and say so in those words.

5. Lead with the direct answer in one or two sentences. Then the conditions, exceptions, and required steps, as a short list. Someone is reading this on a phone between meetings.

6. If the question names a student, a family, or an employee, answer the general rule and do not repeat the name.

7. Where the passages give a deadline, a notice requirement, or a required finding, say so plainly. Those are the parts people get wrong.

8. End with one line: that this is a research aid rather than legal advice, and that the district's counsel or HR makes the call.

Write in plain sentences. No preamble, no restating the question back, no "great question".`;

export type AnswerPassage = {
  ref: number;
  citation: string;
  title: string;
  sourceTitle: string;
  kind: string;
  breadcrumb: string | null;
  retrievedAt: string | null;
  content: string;
};

export async function* answerStream(
  question: string,
  plan: SearchPlan,
  passages: AnswerPassage[],
): AsyncGenerator<string> {
  const rendered = passages
    .map((p) =>
      [
        `[${p.ref}] ${p.citation} -- ${p.title}`,
        `Source: ${p.sourceTitle} (${p.kind === 'ed_code' ? 'California state law' : 'district board policy'})`,
        p.breadcrumb ? `Located in: ${p.breadcrumb}` : null,
        p.retrievedAt ? `Copy retrieved: ${p.retrievedAt.slice(0, 10)}` : null,
        '',
        p.content,
      ]
        .filter((line) => line !== null)
        .join('\n'),
    )
    .join('\n\n---\n\n');

  const stream = anthropic().messages.stream({
    model: ANSWER_MODEL,
    max_tokens: 2048,
    system: ANSWER_SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `Question: ${question}\n\n` +
          `Read as: ${plan.restated}\n\n` +
          `Passages:\n\n${rendered}`,
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
