/**
 * Tests for the parts of the client that are easy to get subtly wrong and
 * impossible to notice: the answer's markup and the stream's framing.
 *
 *   pnpm --filter @breezebox/tool-ed-code test
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { parseBlocks, parseInline } from './markup.ts';
import { createNdjsonParser } from './ndjson.ts';

// ---------------------------------------------------------------------------
// markup
// ---------------------------------------------------------------------------

test('parseBlocks separates paragraphs, headings and lists', () => {
  const blocks = parseBlocks(
    'Yes, with conditions. [1]\n\n' +
      '## What has to be true\n\n' +
      '- The conduct is related to school activity [1]\n' +
      '- Other means of correction were tried [2]\n\n' +
      '1. Hold an informal conference\n' +
      '2. Notify the parent\n\n' +
      'This is a research aid, not legal advice.',
  );

  assert.deepEqual(
    blocks.map((b) => b.kind),
    ['paragraph', 'heading', 'list', 'list', 'paragraph'],
  );
  assert.deepEqual(blocks[1], { kind: 'heading', text: 'What has to be true' });
  assert.deepEqual(blocks[2], {
    kind: 'list',
    ordered: false,
    items: [
      'The conduct is related to school activity [1]',
      'Other means of correction were tried [2]',
    ],
  });
  assert.deepEqual(blocks[3], {
    kind: 'list',
    ordered: true,
    items: ['Hold an informal conference', 'Notify the parent'],
  });
});

test('parseBlocks joins a wrapped paragraph back into one line', () => {
  const [block] = parseBlocks('A pupil may be suspended\nwhen the conduct is related\nto school.');
  assert.deepEqual(block, {
    kind: 'paragraph',
    text: 'A pupil may be suspended when the conduct is related to school.',
  });
});

test('parseBlocks ignores blank input', () => {
  assert.deepEqual(parseBlocks(''), []);
  assert.deepEqual(parseBlocks('\n\n   \n\n'), []);
});

test('parseBlocks does not turn a half-written list into a paragraph', () => {
  // The answer streams, so every intermediate state gets rendered.
  const blocks = parseBlocks('- One item so far');
  assert.deepEqual(blocks, [{ kind: 'list', ordered: false, items: ['One item so far'] }]);
});

test('parseInline finds bold and citation markers', () => {
  assert.deepEqual(parseInline('**Yes**, within five schooldays [3].', 4), [
    { kind: 'bold', text: 'Yes' },
    { kind: 'text', text: ', within five schooldays ' },
    { kind: 'citation', refs: [3] },
    { kind: 'text', text: '.' },
  ]);
});

test('parseInline handles a grouped citation', () => {
  assert.deepEqual(parseInline('Both apply [1, 2].', 3), [
    { kind: 'text', text: 'Both apply ' },
    { kind: 'citation', refs: [1, 2] },
    { kind: 'text', text: '.' },
  ]);
});

test('parseInline refuses a marker with no source behind it', () => {
  // A citation pointing at a source that is not on the page would be a dead
  // link, which reads as a real citation and is not one.
  assert.deepEqual(parseInline('See section 48900 [9].', 3), [
    { kind: 'text', text: 'See section 48900 [9].' },
  ]);
  assert.deepEqual(parseInline('Mixed [2, 9].', 3), [
    { kind: 'text', text: 'Mixed ' },
    { kind: 'citation', refs: [2] },
    { kind: 'text', text: '.' },
  ]);
});

test('parseInline leaves stray punctuation as text', () => {
  assert.deepEqual(parseInline('A * lone asterisk and [not a number].', 2), [
    { kind: 'text', text: 'A * lone asterisk and [not a number].' },
  ]);
});

// ---------------------------------------------------------------------------
// ndjson
// ---------------------------------------------------------------------------

test('createNdjsonParser reassembles events split across chunks', () => {
  const parser = createNdjsonParser<{ type: string; text?: string }>();

  assert.deepEqual(parser.push('{"type":"stage","'), []);
  assert.deepEqual(parser.push('text":"planning"}\n{"type":"de'), [
    { type: 'stage', text: 'planning' },
  ]);
  assert.deepEqual(parser.push('lta","text":"A pupil"}\n'), [
    { type: 'delta', text: 'A pupil' },
  ]);
});

test('createNdjsonParser handles several events in one chunk', () => {
  const parser = createNdjsonParser<{ n: number }>();
  assert.deepEqual(parser.push('{"n":1}\n{"n":2}\n{"n":3}\n'), [{ n: 1 }, { n: 2 }, { n: 3 }]);
});

test('createNdjsonParser survives a newline inside a string value', () => {
  const parser = createNdjsonParser<{ text: string }>();
  // JSON escapes a real newline, so this must stay one event.
  assert.deepEqual(parser.push('{"text":"line one\\nline two"}\n'), [
    { text: 'line one\nline two' },
  ]);
});

test('createNdjsonParser drops one bad line, not the rest', () => {
  const parser = createNdjsonParser<{ n: number }>();
  assert.deepEqual(parser.push('{"n":1}\nnot json\n{"n":2}\n'), [{ n: 1 }, { n: 2 }]);
});

test('createNdjsonParser flushes a stream that ended without a newline', () => {
  const parser = createNdjsonParser<{ type: string }>();
  assert.deepEqual(parser.push('{"type":"done"}'), []);
  assert.deepEqual(parser.flush(), [{ type: 'done' }]);
  assert.deepEqual(parser.flush(), []);
});
