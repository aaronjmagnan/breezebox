/**
 * The answer's shape, worked out away from React so it can be tested.
 *
 * Claude writes short markdown-flavoured prose, so this covers exactly what it
 * actually produces -- paragraphs, bullets, headings, bold, and the bracketed
 * citation markers -- rather than pulling in a markdown library to handle
 * syntax that never arrives. Anything unrecognised falls through as plain
 * text, which is the right failure: a stray asterisk is a blemish, a crashed
 * answer is not.
 *
 * The citation markers are the part that matters. [3] becomes a link to the
 * third source, so a claim is one tap from the text it came from, and a marker
 * pointing at a source that is not there stays as plain text rather than
 * becoming a dead link. A dead citation is worse than none.
 */

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

export type Token =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'citation'; refs: number[] };

const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,4}\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  for (const raw of text.split(/\n{2,}/)) {
    if (raw.trim().length === 0) continue;

    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) continue;

    const bulleted = lines.every((line) => BULLET.test(line));
    const numbered = !bulleted && lines.every((line) => NUMBERED.test(line));

    if (bulleted || numbered) {
      blocks.push({
        kind: 'list',
        ordered: numbered,
        items: lines.map((line) => line.replace(bulleted ? BULLET : NUMBERED, '')),
      });
      continue;
    }

    const heading = raw.match(HEADING);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] ?? raw });
      continue;
    }

    // A wrapped paragraph is one paragraph: single newlines inside a block are
    // the model's line width, not a break the reader should see.
    blocks.push({ kind: 'paragraph', text: raw.replace(/\n/g, ' ') });
  }

  return blocks;
}

/** Split on bold and citation markers at once, so they cannot nest badly. */
export function parseInline(text: string, citationCount: number): Token[] {
  const tokens: Token[] = [];

  for (const part of text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g)) {
    if (!part) continue;

    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold?.[1]) {
      tokens.push({ kind: 'bold', text: bold[1] });
      continue;
    }

    const marker = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (marker?.[1]) {
      const refs = marker[1]
        .split(',')
        .map((n) => Number.parseInt(n.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= citationCount);

      if (refs.length > 0) {
        tokens.push({ kind: 'citation', refs });
        continue;
      }
    }

    // Merge with the previous run so a rejected marker does not split a
    // sentence into three fragments.
    const last = tokens.at(-1);
    if (last?.kind === 'text') last.text += part;
    else tokens.push({ kind: 'text', text: part });
  }

  return tokens;
}
