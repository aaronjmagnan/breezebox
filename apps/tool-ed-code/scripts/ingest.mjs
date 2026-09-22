#!/usr/bin/env node
/**
 * Load the Ed Code Assistant's library.
 *
 *   pnpm --filter @breezebox/tool-ed-code ingest ed-code --dry-run
 *   pnpm --filter @breezebox/tool-ed-code ingest ed-code
 *   pnpm --filter @breezebox/tool-ed-code ingest policy --district cvesd --url <page> --dry-run
 *   pnpm --filter @breezebox/tool-ed-code ingest status
 *
 * RUN THIS FROM A LAPTOP, not from a deployment. It needs
 * SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, and that key must never be
 * set on the shell or on any tool. Nothing in the app can write to the
 * library; loading it is deliberately a thing a person does on purpose.
 *
 * ALWAYS --dry-run FIRST. It fetches and parses exactly as the real run does
 * and prints what it found, without touching the database. The parsers were
 * written against the published shape of these pages rather than against the
 * pages themselves, so the dry run is the step that catches a page that has
 * been restyled since. Zero sections found means the selectors need fixing,
 * not that the page is empty.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  chunkText,
  citationKey,
  htmlToText,
  leginfoSectionUrl,
  parseLeginfoLinks,
  parseLeginfoSections,
  parsePolicyPage,
  sortKey,
} from './lib/parse.mjs';

const EDC_ROOT =
  'https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=EDC';
const EDC_HOME =
  'https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=EDC';

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = { _: [] };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[name] = true;
      continue;
    }
    // --url may be given more than once.
    if (flags[name] === undefined) flags[name] = next;
    else if (Array.isArray(flags[name])) flags[name].push(next);
    else flags[name] = [flags[name], next];
    i += 1;
  }

  return { command, flags };
}

function asList(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value : [value];
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function usage() {
  console.log(`
  Load the Ed Code Assistant's library.

  Commands
    ed-code                      Crawl leginfo and load the Education Code
    policy                       Load a district's board policy pages
    status                       Show what is loaded

  Common flags
    --dry-run                    Fetch and parse, print, write nothing
    --limit <n>                  Stop after n pages (default 4000 / 200)
    --delay <ms>                 Wait between requests (default 800)
    --from-dir <dir>             Read saved .html/.htm/.txt files instead of fetching
    --source-slug <slug>         Override the source slug
    --title "<title>"            Override the source title

  ed-code flags
    --root <url>                 Where to start the crawl

  policy flags
    --district <slug>            REQUIRED. districts.slug this manual belongs to
    --url <url>                  A policy page. Repeat for more.
    --url-file <file>            A file of policy page URLs, one per line

  Run --dry-run first, every time. It is the only check that the pages still
  look the way the parsers expect.
`);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function supabaseClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) die('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  if (!key) {
    die(
      'Set SUPABASE_SERVICE_ROLE_KEY. Find it under Project Settings > API in\n' +
        '  the Supabase dashboard. Do not put it in .env files that get committed,\n' +
        '  and never set it on a Vercel project.',
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(url, { delay, attempt = 1 } = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        // Say who this is. A district webmaster seeing unexplained traffic is
        // entitled to know, and it is the difference between a courtesy and a
        // nuisance.
        'user-agent':
          'BreezeBox-Ingest/1.0 (school district legal reference loader; one-time)',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt >= 3) throw new Error(`HTTP ${response.status} after 3 attempts`);
      const backoff = delay * 2 ** attempt;
      console.warn(`    HTTP ${response.status}, retrying in ${backoff}ms`);
      await sleep(backoff);
      return fetchPage(url, { delay, attempt: attempt + 1 });
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    if (attempt >= 3) throw error;
    await sleep(delay * 2 ** attempt);
    return fetchPage(url, { delay, attempt: attempt + 1 });
  }
}

function readDir(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isFile()) continue;
    if (!/\.(html?|txt|md)$/i.test(name)) continue;
    entries.push({ name, path, html: readFileSync(path, 'utf8') });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 32);

async function upsertSource(supabase, source) {
  // Found and then inserted or updated, rather than upserted: slug uniqueness
  // is enforced by two PARTIAL indexes (one for shared sources, one per
  // district), and onConflict cannot name a partial index. The lookup has to
  // use the same predicate as whichever index applies.
  const query =
    source.district_id === null
      ? supabase.from('legal_sources').select('id').eq('slug', source.slug).is('district_id', null)
      : supabase
          .from('legal_sources')
          .select('id')
          .eq('slug', source.slug)
          .eq('district_id', source.district_id);

  const { data: rows, error: findError } = await query;
  if (findError) die(`Could not look up the source: ${findError.message}`);

  const found = rows?.[0] ?? null;

  if (found) {
    const { error } = await supabase
      .from('legal_sources')
      .update({ ...source, retrieved_at: new Date().toISOString() })
      .eq('id', found.id);
    if (error) die(`Could not update the source: ${error.message}`);
    return found.id;
  }

  const { data, error } = await supabase
    .from('legal_sources')
    .insert({ ...source, retrieved_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) die(`Could not create the source: ${error.message}`);
  return data.id;
}

/**
 * Write one document and its chunks, skipping a document whose text has not
 * moved since last time. Re-running the whole crawl is therefore cheap, which
 * is the point: a corpus that is painful to refresh stops being refreshed.
 */
async function writeDocument(supabase, sourceId, doc, existingHashes) {
  const key = citationKey(doc.citation);
  if (existingHashes.get(key) === doc.content_hash) return 'unchanged';

  const { data: row, error } = await supabase
    .from('legal_documents')
    .upsert(
      {
        source_id: sourceId,
        citation: doc.citation,
        citation_key: key,
        designation: doc.designation,
        title: doc.title,
        breadcrumb: doc.breadcrumb,
        body: doc.body,
        url: doc.url,
        sort_key: sortKey(doc.designation ?? ''),
        content_hash: doc.content_hash,
      },
      { onConflict: 'source_id,citation_key' },
    )
    .select('id')
    .single();

  if (error) {
    console.error(`    ${doc.citation}: ${error.message}`);
    return 'failed';
  }

  // Replace rather than merge: chunk boundaries move when the text changes,
  // so a merge would leave paragraphs of the old version in the index.
  const { error: clearError } = await supabase
    .from('legal_chunks')
    .delete()
    .eq('document_id', row.id);
  if (clearError) {
    console.error(`    ${doc.citation}: could not clear old chunks: ${clearError.message}`);
    return 'failed';
  }

  const chunks = chunkText(doc.body).map((content, index) => ({
    document_id: row.id,
    source_id: sourceId,
    chunk_index: index,
    citation: doc.citation,
    title: doc.title,
    heading: doc.breadcrumb,
    content,
  }));

  if (chunks.length > 0) {
    const { error: chunkError } = await supabase.from('legal_chunks').insert(chunks);
    if (chunkError) {
      console.error(`    ${doc.citation}: could not write chunks: ${chunkError.message}`);
      return 'failed';
    }
  }

  return existingHashes.has(key) ? 'updated' : 'added';
}

async function loadHashes(supabase, sourceId) {
  const hashes = new Map();
  const size = 1000;

  for (let page = 0; ; page += 1) {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('citation_key, content_hash')
      .eq('source_id', sourceId)
      .range(page * size, page * size + size - 1);
    if (error) die(`Could not read existing documents: ${error.message}`);
    for (const row of data ?? []) hashes.set(row.citation_key, row.content_hash);
    if (!data || data.length < size) break;
  }

  return hashes;
}

// ---------------------------------------------------------------------------
// ed-code
// ---------------------------------------------------------------------------

async function ingestEdCode(flags) {
  const dryRun = Boolean(flags['dry-run']);
  const delay = Number.parseInt(flags.delay ?? '800', 10);
  const maxPages = Number.parseInt(flags.limit ?? '4000', 10);
  const fromDir = typeof flags['from-dir'] === 'string' ? flags['from-dir'] : null;

  const documents = new Map();
  let pages = 0;

  if (fromDir) {
    for (const file of readDir(fromDir)) {
      pages += 1;
      collectSections(file.html, documents, file.name);
    }
  } else {
    // Breadth first from the code's own table of contents, following only
    // Education Code links. Self-discovering on purpose: a hardcoded list of
    // divisions would be one more thing written blind and one more thing to
    // go stale.
    const root = typeof flags.root === 'string' ? flags.root : EDC_ROOT;
    const queue = [root];
    const seen = new Set(queue);

    while (queue.length > 0 && pages < maxPages) {
      const url = queue.shift();
      pages += 1;

      let html;
      try {
        html = await fetchPage(url, { delay });
      } catch (error) {
        console.error(`  ! ${url}\n    ${error.message}`);
        continue;
      }

      const before = documents.size;
      collectSections(html, documents, url);
      const found = documents.size - before;

      for (const link of parseLeginfoLinks(html, url, { lawCode: 'EDC' })) {
        if (seen.has(link)) continue;
        seen.add(link);
        queue.push(link);
      }

      if (pages % 25 === 0 || found > 0) {
        console.log(
          `  ${pages} pages, ${documents.size} sections, ${queue.length} queued` +
            (found > 0 ? `  (+${found})` : ''),
        );
      }

      await sleep(delay);
    }

    if (queue.length > 0) {
      console.warn(
        `\n  Stopped at the --limit of ${maxPages} pages with ${queue.length} still queued.`,
      );
    }
  }

  console.log(`\n  ${pages} pages read, ${documents.size} sections parsed.`);
  report([...documents.values()], dryRun);
  if (dryRun) return;

  if (documents.size === 0) {
    die(
      'No sections were parsed, so nothing was written. Run again with\n' +
        '  --dry-run --limit 3 and check whether the pages still look the way\n' +
        '  scripts/lib/parse.mjs expects.',
    );
  }

  const supabase = supabaseClient();
  const sourceId = await upsertSource(supabase, {
    district_id: null,
    kind: 'ed_code',
    slug: typeof flags['source-slug'] === 'string' ? flags['source-slug'] : 'ca-education-code',
    title: typeof flags.title === 'string' ? flags.title : 'California Education Code',
    publisher: 'California Legislative Information',
    home_url: EDC_HOME,
    status: 'active',
  });

  await writeAll(supabase, sourceId, [...documents.values()]);
}

function collectSections(html, documents, origin) {
  for (const section of parseLeginfoSections(html)) {
    const key = citationKey(`EC ${section.designation}`);
    // The same section appears on both the article page and its own page. The
    // longer text wins: a truncated copy would answer questions wrongly while
    // looking perfectly cited.
    const existing = documents.get(key);
    if (existing && existing.body.length >= section.body.length) continue;

    documents.set(key, {
      citation: `EC ${section.designation}`,
      designation: section.designation,
      // Ed Code sections carry no title of their own, only a number, so the
      // article they sit in is the most useful thing to call them.
      title: section.path.at(-1)?.replace(/^(?:Article|Chapter|Part|Division|Title) [^.]*\.\s*/, '') ||
        `Section ${section.designation}`,
      breadcrumb: section.path.join(' > '),
      body: section.body,
      url: leginfoSectionUrl(section.designation),
      content_hash: hash(section.body),
      origin,
    });
  }
}

// ---------------------------------------------------------------------------
// policy
// ---------------------------------------------------------------------------

async function ingestPolicy(flags) {
  const dryRun = Boolean(flags['dry-run']);
  const delay = Number.parseInt(flags.delay ?? '800', 10);
  const maxPages = Number.parseInt(flags.limit ?? '200', 10);
  const fromDir = typeof flags['from-dir'] === 'string' ? flags['from-dir'] : null;
  const districtSlug = typeof flags.district === 'string' ? flags.district : null;

  if (!districtSlug) {
    die('--district <slug> is required: a board policy manual belongs to one district.');
  }

  const urls = asList(flags.url);
  if (typeof flags['url-file'] === 'string') {
    for (const line of readFileSync(flags['url-file'], 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('#')) urls.push(trimmed);
    }
  }

  if (!fromDir && urls.length === 0) {
    die('Give at least one --url, or a --url-file, or a --from-dir of saved pages.');
  }

  const documents = new Map();
  const unnumbered = [];
  let pages = 0;

  const take = (html, origin, fallbackName) => {
    const policy = parsePolicyPage(html, { url: origin });
    if (!policy.citation) {
      unnumbered.push(fallbackName ?? origin);
      return;
    }
    if (policy.body.trim().length < 40) {
      unnumbered.push(`${fallbackName ?? origin} (no readable text)`);
      return;
    }
    documents.set(citationKey(policy.citation), {
      citation: policy.citation,
      designation: policy.designation,
      title: policy.title,
      breadcrumb: null,
      body: policy.body,
      url: policy.url,
      content_hash: hash(policy.body),
      origin: origin ?? fallbackName,
    });
  };

  if (fromDir) {
    for (const file of readDir(fromDir)) {
      pages += 1;
      take(file.html, null, file.name);
    }
  }

  for (const url of urls.slice(0, maxPages)) {
    pages += 1;
    try {
      const html = await fetchPage(url, { delay });
      take(html, url);
    } catch (error) {
      console.error(`  ! ${url}\n    ${error.message}`);
    }
    await sleep(delay);
  }

  console.log(`\n  ${pages} pages read, ${documents.size} policies parsed.`);
  if (unnumbered.length > 0) {
    console.log(
      `\n  ${unnumbered.length} page(s) skipped for having no policy number or no\n` +
        '  readable text. A number is not something to guess at, so these were\n' +
        '  left out rather than filed under a made-up citation:',
    );
    for (const name of unnumbered.slice(0, 20)) console.log(`    - ${name}`);
    if (unnumbered.length > 20) console.log(`    ... and ${unnumbered.length - 20} more`);
    console.log(
      '\n  If these are real policies, the page is probably rendered by\n' +
        '  JavaScript or published as a PDF. Save them to a folder and use\n' +
        '  --from-dir, converting any PDF first:  pdftotext -layout in.pdf out.txt',
    );
  }

  report([...documents.values()], dryRun);
  if (dryRun) return;
  if (documents.size === 0) die('Nothing was parsed, so nothing was written.');

  const supabase = supabaseClient();

  const { data: district, error: districtError } = await supabase
    .from('districts')
    .select('id, name')
    .eq('slug', districtSlug)
    .maybeSingle();
  if (districtError) die(`Could not look up the district: ${districtError.message}`);
  if (!district) die(`No district has the slug "${districtSlug}".`);

  const sourceId = await upsertSource(supabase, {
    district_id: district.id,
    kind: 'board_policy',
    slug: typeof flags['source-slug'] === 'string' ? flags['source-slug'] : 'board-policy',
    title: typeof flags.title === 'string' ? flags.title : `${district.name} Board Policy`,
    publisher: district.name,
    home_url: urls[0] ?? null,
    status: 'active',
  });

  await writeAll(supabase, sourceId, [...documents.values()]);
}

// ---------------------------------------------------------------------------
// Shared output
// ---------------------------------------------------------------------------

function report(documents, dryRun) {
  if (documents.length === 0) {
    console.log('\n  Nothing parsed.');
    return;
  }

  const sample = documents.slice(0, 5);
  console.log(`\n  First ${sample.length}, so you can see whether the parsing worked:\n`);
  for (const doc of sample) {
    console.log(`  ${doc.citation}  ${doc.title}`);
    if (doc.breadcrumb) console.log(`    ${doc.breadcrumb}`);
    console.log(`    ${doc.body.slice(0, 220).replace(/\n/g, ' ')}...`);
    console.log(`    ${doc.body.length} chars, ${chunkText(doc.body).length} chunk(s)`);
    console.log('');
  }

  const chunks = documents.reduce((total, doc) => total + chunkText(doc.body).length, 0);
  console.log(`  ${documents.length} documents, ${chunks} chunks in total.`);

  if (dryRun) {
    console.log('\n  Dry run: nothing was written. Drop --dry-run to load it.\n');
  }
}

async function writeAll(supabase, sourceId, documents) {
  const existing = await loadHashes(supabase, sourceId);
  const counts = { added: 0, updated: 0, unchanged: 0, failed: 0 };

  let done = 0;
  for (const doc of documents) {
    counts[await writeDocument(supabase, sourceId, doc, existing)] += 1;
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${documents.length} written`);
  }

  console.log(
    `\n  Done. ${counts.added} added, ${counts.updated} updated, ` +
      `${counts.unchanged} unchanged, ${counts.failed} failed.\n`,
  );
  if (counts.failed > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function showStatus() {
  const supabase = supabaseClient();

  const { data: sources, error } = await supabase
    .from('legal_sources')
    .select('id, slug, kind, title, status, retrieved_at, district_id')
    .order('kind');
  if (error) die(`Could not read the library: ${error.message}`);

  if (!sources || sources.length === 0) {
    console.log('\n  Nothing loaded.\n');
    return;
  }

  console.log('');
  for (const source of sources) {
    const [docs, chunks] = await Promise.all([
      supabase
        .from('legal_documents')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', source.id),
      supabase
        .from('legal_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('source_id', source.id),
    ]);

    console.log(`  ${source.title}`);
    console.log(
      `    ${source.kind}, ${source.district_id ? 'district-owned' : 'shared'}, ${source.status}`,
    );
    console.log(`    ${docs.count ?? 0} documents, ${chunks.count ?? 0} chunks`);
    console.log(
      `    retrieved ${source.retrieved_at ? source.retrieved_at.slice(0, 10) : 'never'}`,
    );
    console.log('');
  }
}

// ---------------------------------------------------------------------------

const { command, flags } = parseArgs(process.argv.slice(2));

if (command === 'ed-code') await ingestEdCode(flags);
else if (command === 'policy') await ingestPolicy(flags);
else if (command === 'status') await showStatus();
else {
  usage();
  if (command !== undefined && command !== '--help' && command !== 'help') {
    die(`Unknown command "${command}".`);
  }
}
