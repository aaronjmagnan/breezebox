/**
 * Tests for the parsing in scripts/lib/parse.mjs.
 *
 *   pnpm --filter @breezebox/tool-ed-code test:ingest
 *
 * These fixtures are written from the published shape of the pages, not
 * captured from them: the build environment cannot reach leginfo or a district
 * website. So what they prove is that the parser does the right thing with the
 * structure it expects, NOT that the real pages have that structure. The dry
 * run is what proves the second half, and it has to be run from a machine with
 * a normal internet connection.
 *
 * If a dry run comes back with zero sections, the fixture is wrong and these
 * tests are passing for nothing. That is the failure mode to watch for.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  chunkText,
  citationKey,
  decodeEntities,
  htmlToText,
  parseLeginfoLinks,
  parseLeginfoSections,
  parsePolicyPage,
  sortKey,
} from './lib/parse.mjs';

// ---------------------------------------------------------------------------

test('htmlToText keeps paragraph structure and drops furniture', () => {
  const html = `
    <html><head><title>x</title><style>p{color:red}</style></head>
    <body>
      <nav><a href="/departments">Departments</a></nav>
      <div><p>First paragraph.</p><p>Second&nbsp;paragraph &amp; more.</p></div>
      <script>console.log('nope')</script>
      <footer>Copyright</footer>
    </body></html>`;

  const text = htmlToText(html);
  assert.match(text, /First paragraph\./);
  assert.match(text, /Second paragraph & more\./);
  assert.doesNotMatch(text, /Departments/);
  assert.doesNotMatch(text, /console\.log/);
  assert.doesNotMatch(text, /Copyright/);
  assert.doesNotMatch(text, /color:red/);
  // Two paragraphs, separated by a blank line. chunkText splits on exactly
  // that, so the blank line is load bearing rather than cosmetic.
  assert.deepEqual(text.split(/\n{2,}/), ['First paragraph.', 'Second paragraph & more.']);
});

test('decodeEntities handles named, decimal and hex forms', () => {
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('&#167; 48900'), '§ 48900');
  assert.equal(decodeEntities('&#x2019;'), '’');
  assert.equal(decodeEntities('&notanentity;'), '&notanentity;');
});

// ---------------------------------------------------------------------------

test('citationKey matches the normalization in lookup_legal_documents', () => {
  assert.equal(citationKey('EC 48900'), 'ec48900');
  assert.equal(citationKey('48900.'), '48900');
  assert.equal(citationKey('BP 5144.1'), 'bp5144.1');
  assert.equal(citationKey('  ec  48900 . '), 'ec48900');
});

test('sortKey orders sections the way a reader expects', () => {
  const ordered = ['48900', '48900.5', '48901', '5144', '5144.1'].map(sortKey);
  assert.deepEqual(
    [...ordered].sort(),
    [sortKey('5144'), sortKey('5144.1'), sortKey('48900'), sortKey('48900.5'), sortKey('48901')],
  );
});

// ---------------------------------------------------------------------------

const LEGINFO_ARTICLE = `<html><body>
<div id="manylawsections">
<h5>EDUCATION CODE - EDC</h5>
<h6>DIVISION 4. Instruction and Services [46000 - 65001]</h6>
<h6>PART 27. Pupils [48000 - 49702]</h6>
<h6>CHAPTER 6. Suspension and Expulsion [48900 - 48927]</h6>
<h6>ARTICLE 1. Grounds for Suspension or Expulsion [48900 - 48900.9]</h6>
<div><p>48900.&nbsp; A pupil shall not be suspended from school or recommended for
expulsion unless the superintendent determines that the pupil has committed an act
as defined in subdivisions (a) to (r).</p>
<p>(h) Possessed or used tobacco, or products containing tobacco or nicotine
products, including, but not limited to, cigarettes, cigars, and electronic
cigarettes.</p></div>
<div><p>48900.5.&nbsp; Suspension, including supervised suspension, shall be imposed
only when other means of correction fail to bring about proper conduct.</p></div>
<div><p>48901.&nbsp; No school shall permit the smoking or use of tobacco by pupils
while under the supervision of school personnel.</p></div>
</div>
</body></html>`;

test('parseLeginfoSections splits an article page into its sections', () => {
  const sections = parseLeginfoSections(LEGINFO_ARTICLE);

  assert.deepEqual(
    sections.map((s) => s.designation),
    ['48900', '48900.5', '48901'],
  );

  const first = sections[0];
  assert.match(first.body, /^A pupil shall not be suspended/);
  assert.match(first.body, /electronic\ncigarettes\.|electronic cigarettes\./);
  // The next section's text must not have leaked into this one.
  assert.doesNotMatch(first.body, /other means of correction/);
});

test('parseLeginfoSections builds a breadcrumb that reads down the hierarchy', () => {
  const [first] = parseLeginfoSections(LEGINFO_ARTICLE);
  assert.deepEqual(first.path, [
    'Division 4. Instruction and Services',
    'Part 27. Pupils',
    'Chapter 6. Suspension and Expulsion',
    'Article 1. Grounds for Suspension or Expulsion',
  ]);
});

test('parseLeginfoSections replaces a sibling heading rather than stacking it', () => {
  const twoArticles = `
ARTICLE 1. Grounds for Suspension or Expulsion [48900 - 48900.9]
48900. First section text.
ARTICLE 2. Procedures [48910 - 48926]
48911. Second section text.`;

  const sections = parseLeginfoSections(twoArticles);
  assert.deepEqual(
    sections.map((s) => s.path.at(-1)),
    ['Article 1. Grounds for Suspension or Expulsion', 'Article 2. Procedures'],
  );
  assert.equal(sections[1].path.length, 1);
});

test('parseLeginfoSections ignores a bracketed range that is not a section', () => {
  const sections = parseLeginfoSections(`
CHAPTER 6. Suspension and Expulsion [48900 - 48927]
48900. Real text here.`);
  assert.deepEqual(sections.map((s) => s.designation), ['48900']);
});

test('parseLeginfoLinks returns absolute, deduplicated links for one code only', () => {
  const html = `
    <a href="/faces/codes_displayText.xhtml?lawCode=EDC&amp;division=4.">Article 1</a>
    <a href="/faces/codes_displayText.xhtml?lawCode=EDC&amp;division=4.">Article 1 again</a>
    <a href="/faces/codes_displayexpandedbranch.xhtml?tocCode=EDC&amp;division=4.">Branch</a>
    <a href="/faces/codes_displayText.xhtml?lawCode=PEN&amp;division=1.">Penal Code</a>
    <a href="/faces/billNavClient.xhtml">A bill</a>
    <a href="https://example.com/unrelated">Elsewhere</a>`;

  // Deduplicated, absolute, and nothing outside the Education Code: following
  // every code leginfo links from every page would crawl all of California law.
  assert.deepEqual(parseLeginfoLinks(html, 'https://leginfo.legislature.ca.gov/faces/x.xhtml'), [
    'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=EDC&division=4.',
    'https://leginfo.legislature.ca.gov/faces/codes_displayexpandedbranch.xhtml?tocCode=EDC&division=4.',
  ]);

  assert.deepEqual(
    parseLeginfoLinks(html, 'https://leginfo.legislature.ca.gov/faces/x.xhtml', {
      lawCode: 'PEN',
    }),
    ['https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=PEN&division=1.'],
  );
});

// ---------------------------------------------------------------------------

const POLICY_PAGE = `<html><head><title>BP 5144.1 Suspension And Expulsion | Sample USD</title></head>
<body>
<nav><ul><li><a href="/departments">Departments</a></li></ul></nav>
<main>
  <h1>BP 5144.1 Suspension And Expulsion/Due Process</h1>
  <p>The Governing Board desires to provide district students access to educational
  opportunities in an orderly school environment.</p>
  <p>The Superintendent or designee shall ensure that students are not suspended
  solely for a first offense, except as provided by law.</p>
</main>
<footer>Copyright Sample USD</footer>
</body></html>`;

test('parsePolicyPage pulls the number, the title and only the body', () => {
  const policy = parsePolicyPage(POLICY_PAGE, { url: 'https://example.org/bp-5144-1' });

  assert.equal(policy.designation, '5144.1');
  assert.equal(policy.citation, 'BP 5144.1');
  assert.equal(policy.title, 'Suspension And Expulsion/Due Process');
  assert.match(policy.body, /Governing Board desires/);
  assert.doesNotMatch(policy.body, /Departments/);
  assert.doesNotMatch(policy.body, /Copyright/);
  assert.equal(policy.url, 'https://example.org/bp-5144-1');
});

test('parsePolicyPage tells an administrative regulation from a policy', () => {
  const ar = parsePolicyPage('<h1>AR 5144.1 Suspension And Expulsion</h1><p>Text.</p>');
  assert.equal(ar.citation, 'AR 5144.1');

  const bylaw = parsePolicyPage('<h1>Board Bylaw 9320 Meetings</h1><p>Text.</p>');
  assert.equal(bylaw.citation, 'BB 9320');

  const spelled = parsePolicyPage('<h1>Board Policy 5131 Conduct</h1><p>Text.</p>');
  assert.equal(spelled.citation, 'BP 5131');
});

test('parsePolicyPage refuses to invent a number it cannot see', () => {
  const policy = parsePolicyPage('<h1>Welcome to the Board</h1><p>Some text.</p>');
  assert.equal(policy.designation, null);
  assert.equal(policy.citation, null);
  assert.equal(policy.title, 'Welcome to the Board');
});

// ---------------------------------------------------------------------------

test('chunkText leaves a short section whole', () => {
  assert.deepEqual(chunkText('One short paragraph.'), ['One short paragraph.']);
  assert.deepEqual(chunkText('   '), []);
});

test('chunkText breaks on paragraphs before it breaks on length', () => {
  const paragraphs = Array.from({ length: 8 }, (_, i) => `Paragraph ${i} `.repeat(30).trim());
  const chunks = chunkText(paragraphs.join('\n\n'), { max: 600 });

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 600, `chunk too long: ${chunk.length}`);
  // Nothing lost: every paragraph's opening survives somewhere.
  for (let i = 0; i < 8; i += 1) {
    assert.ok(chunks.some((c) => c.includes(`Paragraph ${i}`)), `lost paragraph ${i}`);
  }
});

test('chunkText splits an oversized paragraph without cutting a word', () => {
  const long = `${'word '.repeat(1000).trim()}.`;
  const chunks = chunkText(long, { max: 500, overlap: 50 });

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 500);
    assert.doesNotMatch(chunk, /^ord|wor$/);
  }
});

test('chunkText overlaps so a rule at a boundary survives in one piece', () => {
  const head = 'A '.repeat(240).trim();
  const marker = 'THE RULE THAT MUST NOT BE CUT IN HALF';
  const chunks = chunkText(`${head} ${marker} ${'B '.repeat(240).trim()}`, {
    max: 520,
    overlap: 120,
  });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.some((c) => c.includes(marker)), 'the marker was cut across every chunk');
});
