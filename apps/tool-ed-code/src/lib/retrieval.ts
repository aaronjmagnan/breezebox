import { serverClient } from '@breezebox/auth/server';
import type { LegalSourceKind } from '@breezebox/db';
import type { AnswerPassage, SearchPlan } from './claude';

/**
 * Turning a plan into passages.
 *
 * Two paths, because there are two kinds of question. "What does 48900 say"
 * is a lookup and ranking has nothing to add to it; "can I suspend for
 * vaping" is a search. Both run, and a question that named a section gets
 * that section whole, at the top, ahead of whatever the ranking found.
 *
 * Both calls are SECURITY INVOKER functions, so the tenant filtering is the
 * RLS policy and not anything written here. There is deliberately no
 * district_id in this file: adding one would imply the boundary lives in the
 * app, and it does not.
 */

/** Enough to answer from; few enough that the answer stays readable. */
const MAX_PASSAGES = 12;
/** 48900 runs past 4,000 words. Nobody needs all of it to answer one question. */
const MAX_CHARS_PER_PASSAGE = 6000;
const MAX_TOTAL_CHARS = 60000;

export type Citation = {
  ref: number;
  citation: string;
  title: string;
  sourceTitle: string;
  kind: LegalSourceKind;
  breadcrumb: string | null;
  url: string | null;
  retrievedAt: string | null;
  /** True when the whole section was pulled, false when it is one passage of it. */
  whole: boolean;
};

export type Retrieved = {
  passages: AnswerPassage[];
  citations: Citation[];
};

function kindsFor(scope: SearchPlan['scope']): LegalSourceKind[] | null {
  if (scope === 'law') return ['ed_code'];
  if (scope === 'policy') return ['board_policy'];
  return null;
}

function truncate(text: string): string {
  if (text.length <= MAX_CHARS_PER_PASSAGE) return text;
  return `${text.slice(0, MAX_CHARS_PER_PASSAGE)}\n\n[...this section continues; the rest was not loaded]`;
}

export async function retrieve(plan: SearchPlan): Promise<Retrieved> {
  const supabase = await serverClient();

  const [lookups, hits] = await Promise.all([
    plan.citations.length > 0
      ? supabase.rpc('lookup_legal_documents', { p_citations: plan.citations, p_limit: 6 })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc('search_legal_chunks', {
      p_terms: plan.terms,
      p_kinds: kindsFor(plan.scope),
      p_limit: 24,
    }),
  ]);

  // Never put the question in a log line, here or anywhere: the terms can
  // carry it almost verbatim.
  if (lookups.error) console.error('[ed-code] citation lookup failed:', lookups.error.message);
  if (hits.error) console.error('[ed-code] passage search failed:', hits.error.message);

  const passages: AnswerPassage[] = [];
  const citations: Citation[] = [];
  const seenDocuments = new Set<string>();
  let total = 0;

  const add = (
    body: string,
    meta: Omit<Citation, 'ref'> & { documentId: string },
  ): boolean => {
    if (passages.length >= MAX_PASSAGES) return false;
    const text = truncate(body);
    if (total + text.length > MAX_TOTAL_CHARS) return false;

    const ref = passages.length + 1;
    total += text.length;
    passages.push({
      ref,
      citation: meta.citation,
      title: meta.title,
      sourceTitle: meta.sourceTitle,
      kind: meta.kind,
      breadcrumb: meta.breadcrumb,
      retrievedAt: meta.retrievedAt,
      content: text,
    });
    citations.push({
      ref,
      citation: meta.citation,
      title: meta.title,
      sourceTitle: meta.sourceTitle,
      kind: meta.kind,
      breadcrumb: meta.breadcrumb,
      url: meta.url,
      retrievedAt: meta.retrievedAt,
      whole: meta.whole,
    });
    return true;
  };

  // Named sections first, whole, so "what does 48900 say" is answered from
  // 48900 rather than from whichever paragraph of it ranked highest.
  for (const row of lookups.data ?? []) {
    if (seenDocuments.has(row.document_id)) continue;
    seenDocuments.add(row.document_id);
    add(row.body, {
      documentId: row.document_id,
      citation: row.citation,
      title: row.title,
      sourceTitle: row.source_title,
      kind: row.kind,
      breadcrumb: row.breadcrumb,
      url: row.url,
      retrievedAt: row.retrieved_at,
      whole: true,
    });
  }

  for (const row of hits.data ?? []) {
    // A section already pulled whole has nothing to gain from one of its own
    // paragraphs arriving again under a second number.
    if (seenDocuments.has(row.document_id)) continue;
    seenDocuments.add(row.document_id);
    if (
      !add(row.content, {
        documentId: row.document_id,
        citation: row.citation,
        title: row.title,
        sourceTitle: row.source_title,
        kind: row.kind,
        breadcrumb: row.breadcrumb,
        url: row.url,
        retrievedAt: row.retrieved_at,
        whole: false,
      })
    ) {
      break;
    }
  }

  return { passages, citations };
}
