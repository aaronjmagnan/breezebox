/**
 * Parsing, with no I/O in it.
 *
 * Everything here is a pure function over a string, which is the only reason
 * any of it is trustworthy: this environment cannot reach leginfo.ca.gov or a
 * district website, so the adapters below were written against the published
 * shape of those pages rather than against the pages themselves. Splitting the
 * parsing out means it can be tested against fixtures now, and corrected from
 * one dry run later without touching the loader.
 *
 * `ingest.mjs --dry-run` prints what these functions found. That output is the
 * check that stands in for a live fetch here.
 */

// ---------------------------------------------------------------------------
// HTML to text
// ---------------------------------------------------------------------------

const BLOCK_TAGS =
  'address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|' +
  'footer|form|h1|h2|h3|h4|h5|h6|header|hr|li|main|nav|ol|p|pre|section|table|' +
  'tbody|td|tfoot|th|thead|tr|ul';

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  sect: '§',
  deg: '°',
  middot: '·',
  bull: '•',
};

export function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

function safeCodePoint(value) {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return '';
  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

/**
 * HTML to readable text.
 *
 * Block tags become newlines so paragraph structure survives, which matters
 * more here than anywhere else: chunking, section splitting and the citation
 * regex all key off line starts.
 */
export function htmlToText(html) {
  let text = String(html ?? '');

  // Anything that is not prose, first. Nav and footer go too: a district site
  // repeats its whole menu on every page, and a hundred copies of "Departments"
  // in the search index is a hundred false hits.
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  text = text.replace(/<(nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  text = text.replace(new RegExp(`<\\/?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text);

  return normalizeWhitespace(text);
}

export function normalizeWhitespace(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    // Trailing spaces make the section regex miss a line that looks fine.
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

/**
 * The key a citation is looked up by. This MUST match the normalization in
 * lookup_legal_documents(): lowercase, strip everything but letters, digits
 * and interior dots, then drop a trailing dot. The Legislature writes "48900."
 * with the period; a key stored that way would never be found.
 */
export function citationKey(citation) {
  return String(citation ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+$/, '');
}

/**
 * A key that sorts the way a person expects: 48900 before 48900.5 before
 * 48901, and 5144.1 after 5144. Plain text sort puts "48900.5" before "48901"
 * only by accident of ASCII; zero padding makes it deliberate.
 */
export function sortKey(designation) {
  const parts = String(designation ?? '')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .filter((p) => p.length > 0);
  if (parts.length === 0) return '';
  return parts.map((p) => p.padStart(6, '0')).join('.');
}

// ---------------------------------------------------------------------------
// leginfo.legislature.ca.gov
// ---------------------------------------------------------------------------
//
// An article page carries every section in that article, one after another,
// each beginning with its number and a period at the start of a line. The
// article's own heading names it, in the form:
//
//   ARTICLE 1. Grounds for Suspension or Expulsion [48900 - 48927]
//
// Splitting on the section number rather than on markup is deliberate: the
// numbers are the stable part of that page. Markup gets restyled; "48900." at
// the head of a paragraph has been the shape of a statute for a century.

/** Outermost first: a heading clears every level below its own. */
const HIERARCHY = ['TITLE', 'DIVISION', 'PART', 'CHAPTER', 'ARTICLE'];

const ARTICLE_HEADING =
  /^(ARTICLE|CHAPTER|PART|TITLE|DIVISION)\s+([0-9A-Za-z.]+)\.?\s*(.*?)\s*(?:\[[^\]]*\])?\s*$/i;

/** A section number at the start of a line, followed by its text. */
const SECTION_START = /^(\d+(?:\.\d+)*)\.[ \t]+(?=\S)/;

/**
 * Split an article page into sections.
 *
 * Returns [{ designation, body, heading }], where `heading` is the nearest
 * enclosing ARTICLE/CHAPTER line, used for the breadcrumb and the title.
 */
export function parseLeginfoSections(html) {
  const text = typeof html === 'string' && /<[a-z]/i.test(html) ? htmlToText(html) : normalizeWhitespace(html);
  const lines = text.split('\n');

  const sections = [];
  // Headings are tracked by level, not stacked: a new ARTICLE replaces the
  // previous ARTICLE and everything under it, while leaving the CHAPTER it
  // sits in alone. Stacking them grew the breadcrumb with every sibling
  // heading on the page.
  const levels = new Map();
  let current = null;

  const breadcrumb = () =>
    HIERARCHY.map((_, rank) => levels.get(rank)).filter((label) => label !== undefined);

  const flush = () => {
    if (!current) return;
    const body = normalizeWhitespace(current.lines.join('\n'));
    if (body.length > 0) {
      sections.push({ designation: current.designation, body, path: current.path });
    }
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(ARTICLE_HEADING);
    if (heading && !SECTION_START.test(line)) {
      flush();
      const level = heading[1].toUpperCase();
      const label = `${titleCase(level)} ${heading[2].replace(/\.$/, '')}${
        heading[3] ? `. ${heading[3]}` : ''
      }`;
      const rank = HIERARCHY.indexOf(level);
      if (rank === -1) continue;
      levels.set(rank, label);
      for (const existing of [...levels.keys()]) {
        if (existing > rank) levels.delete(existing);
      }
      continue;
    }

    const start = line.match(SECTION_START);
    if (start) {
      flush();
      current = {
        designation: start[1],
        path: breadcrumb(),
        lines: [line.slice(start[0].length)],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }

  flush();
  return sections;
}

function titleCase(word) {
  return word.charAt(0) + word.slice(1).toLowerCase();
}

/**
 * Links out of an expanded-branch table of contents. Returns absolute URLs to
 * the pages that actually hold text, in the order the page lists them.
 */
export function parseLeginfoLinks(html, baseUrl, { lawCode = 'EDC' } = {}) {
  const found = [];
  const seen = new Set();

  for (const match of String(html ?? '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = decodeEntities(match[1]);
    if (!/codes_display(Text|expandedbranch|Section)\.xhtml|cod(?:e|es)TOCSelected\.xhtml/i.test(raw)) {
      continue;
    }
    // Only this code. leginfo links every code from every page, and following
    // all of them would crawl the whole of California law.
    if (!new RegExp(`(?:lawCode|tocCode)=${lawCode}\\b`, 'i').test(raw)) continue;

    let url;
    try {
      url = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    found.push(url);
  }

  return found;
}

/** The public URL for one section, which is what a citation links to. */
export function leginfoSectionUrl(designation, lawCode = 'EDC') {
  return (
    'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml' +
    `?lawCode=${encodeURIComponent(lawCode)}&sectionNum=${encodeURIComponent(designation)}.`
  );
}

// ---------------------------------------------------------------------------
// A district's own web pages
// ---------------------------------------------------------------------------

/**
 * One board policy from one page.
 *
 * Board policy is published as prose under a heading, with no machine-readable
 * structure to rely on, so this takes the plain reading: the page's own title
 * and its text, with the site furniture removed. What it cannot do is invent a
 * policy number, so a page that does not carry one is loaded under a slug and
 * flagged, rather than guessed at.
 */
export function parsePolicyPage(html, { url } = {}) {
  const raw = String(html ?? '');

  const h1 = raw.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const heading = normalizeWhitespace(
    decodeEntities((h1?.[1] ?? titleTag?.[1] ?? '').replace(/<[^>]+>/g, ' ')),
  );

  // Prefer the page's main region when it declares one: a district CMS wraps
  // the policy in <main> and the menu outside it.
  const main =
    raw.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    raw.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    raw.match(/<div\b[^>]*\bid\s*=\s*["'](?:content|main|main-content)["'][^>]*>([\s\S]*)/i);

  const body = htmlToText(main ? main[1] : raw);

  // "BP 5144.1 Suspension and Expulsion", "AR 5144.1", "Board Policy 5131"
  const numbered = heading.match(
    /\b(?:(BP|AR|BB|E|Board\s+Policy|Administrative\s+Regulation|Board\s+Bylaw)\s*)?(\d{4}(?:\.\d+)*)\b/i,
  );

  const prefix = normalizePolicyPrefix(numbered?.[1]);
  const designation = numbered?.[2] ?? null;

  return {
    designation,
    citation: designation ? `${prefix} ${designation}` : null,
    title: stripLeadingCitation(heading) || heading,
    body,
    url: url ?? null,
  };
}

function normalizePolicyPrefix(prefix) {
  if (!prefix) return 'BP';
  const value = prefix.replace(/\s+/g, ' ').toLowerCase();
  if (value.startsWith('ar') || value.startsWith('administrative')) return 'AR';
  if (value.startsWith('bb') || value.startsWith('board bylaw')) return 'BB';
  if (value === 'e') return 'E';
  return 'BP';
}

function stripLeadingCitation(heading) {
  return normalizeWhitespace(
    heading.replace(
      /^(?:BP|AR|BB|E|Board\s+Policy|Administrative\s+Regulation|Board\s+Bylaw)?\s*\d{4}(?:\.\d+)*\s*[-:–—]?\s*/i,
      '',
    ),
  );
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Paragraph-aware chunking.
 *
 * Statutes break at (a), (b), (c), which is exactly where a reader would cut
 * them too, so paragraph boundaries are respected and only an oversized
 * paragraph is split mid-text. The overlap carries the tail of one chunk into
 * the head of the next, so a rule that straddles a boundary is still whole in
 * at least one of them.
 */
export function chunkText(text, { max = 1800, overlap = 200 } = {}) {
  const clean = normalizeWhitespace(text);
  if (clean.length === 0) return [];
  if (clean.length <= max) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks = [];
  let current = '';

  const push = () => {
    const value = current.trim();
    if (value.length > 0) chunks.push(value);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > max) {
      push();
      for (const piece of splitLong(paragraph, max, overlap)) chunks.push(piece);
      continue;
    }

    if (current.length === 0) {
      current = paragraph;
    } else if (current.length + 2 + paragraph.length <= max) {
      current = `${current}\n\n${paragraph}`;
    } else {
      push();
      current = paragraph;
    }
  }
  push();

  return chunks;
}

function splitLong(paragraph, max, overlap) {
  const pieces = [];
  let start = 0;

  while (start < paragraph.length) {
    let end = Math.min(start + max, paragraph.length);

    // Prefer a sentence end, then any space, so a chunk does not stop
    // mid-word. Only look in the last quarter, or a short sentence early on
    // would cut the chunk down to nothing.
    if (end < paragraph.length) {
      const window = paragraph.slice(start + Math.floor(max * 0.75), end);
      const sentence = window.lastIndexOf('. ');
      const space = window.lastIndexOf(' ');
      const offset = sentence >= 0 ? sentence + 1 : space;
      if (offset >= 0) end = start + Math.floor(max * 0.75) + offset;
    }

    pieces.push(paragraph.slice(start, end).trim());
    if (end >= paragraph.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return pieces.filter((p) => p.length > 0);
}
