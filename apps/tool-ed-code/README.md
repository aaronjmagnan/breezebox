# Ed Code Assistant

Ask a question about California school law in your own words, get an answer
built from the actual sections, with every claim linked to the text it came
from.

Served under the district origin at `/ed-code` (§2 multi-zone). The shell owns
sign-in, branding, the manifest and the service worker; this app owns one
screen.

---

## The rule the whole thing is built around

**It never answers from memory.**

A model that has read the Education Code can produce a fluent, confident, and
entirely invented citation, and the person reading it is a principal deciding
whether to send a child home. So the model is not the source of truth here:
the database is. Every answer goes through the same three steps.

1. **Plan.** Claude turns the question into the vocabulary the statute uses.
   Staff say "kid", "kicked out", "vaping"; the code says "pupil", "expulsion",
   "products containing tobacco or nicotine". Nothing from this step is shown
   as an answer; it only feeds the query.
2. **Retrieve.** Postgres full-text search over the loaded sections, plus an
   exact lookup for any citation the question named.
3. **Answer.** Claude is handed the passages that came back and is told, in the
   system prompt, that they are the only sources it has. A sentence that states
   a rule and carries no citation is a bug.

If retrieval comes back empty, the tool says so rather than falling back on the
model. "I came up empty" is a useful answer. A fabricated section number is not.

The citation markers in the answer are checked against the sources actually on
the page before they are rendered as links, so a marker pointing at a source
that is not there stays as plain text. A dead citation reads like a real one.

## Why full-text search and not embeddings

Anthropic has no embeddings API, so "use Claude's vectors" would mean adding a
second vendor and shipping a copy of the corpus to them. That is a real cost
for a real benefit, and the benefit is smaller here than it looks: statutes are
written in a fixed vocabulary, and the hard part is translating the *question*
into that vocabulary, not matching meanings once it has been translated.
Claude does the translation, Postgres does the matching, and the corpus stays
in the database we already run.

If recall turns out to be the limit in practice, this is the seam to change:
add an embedding column to `legal_chunks` and combine the scores. Nothing else
has to move.

## Privacy: nothing is stored

There is no history, no saved answer, no row recording who asked what. That is
deliberate rather than unfinished.

"Can I suspend [name] for [conduct]" is a record about a student the moment it
lands in a table, with everything that follows from that: retention, discovery,
a subject access request, a breach. The tool is more useful for being unable to
keep one. The question box says so, and asks people to leave names out.

---

## Loading the library

The app cannot write to the library. There are no insert, update or delete
policies on any of the three tables, so loading a corpus needs the service role
and is done on purpose, by a person, from a laptop:

```bash
export SUPABASE_URL='https://<project>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service role key>'

pnpm --filter @breezebox/tool-ed-code ingest ed-code --dry-run --limit 5
pnpm --filter @breezebox/tool-ed-code ingest ed-code
pnpm --filter @breezebox/tool-ed-code ingest status
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It belongs in your shell for the
length of one command. It must never be set on the shell project, on this tool's
project, or in anything with a `NEXT_PUBLIC_` prefix.

### Always dry run first

The parsers in `scripts/lib/parse.mjs` were written against the published shape
of leginfo's pages, not against the pages themselves: the environment they were
written in could not reach `leginfo.legislature.ca.gov`. The unit tests
(`pnpm --filter @breezebox/tool-ed-code test:ingest`) prove the parser does the
right thing with the structure it expects. They cannot prove the real pages have
that structure.

`--dry-run` fetches and parses exactly as a real run does, prints the first five
sections it found and the chunk counts, and writes nothing. **Zero sections found
means the selectors need fixing, not that the page is empty.** Paste the dry run
output and the fix is a small one, confined to that one file.

### Board policy

A district's board policy manual is loaded the same way, per district:

```bash
pnpm --filter @breezebox/tool-ed-code ingest policy \
  --district <district-slug> \
  --url 'https://www.example.org/board-policies/bp-5144-1' \
  --url 'https://www.example.org/board-policies/bp-5131' \
  --dry-run
```

`--url-file <file>` takes a list, one URL per line, `#` for comments.

Board policy that a district publishes as web pages needs nothing from anyone
at the district: the pages are public and the crawler reads them like a browser
would. Two things commonly get in the way, and both have the same answer:

- the page is rendered by JavaScript, so a plain fetch gets an empty shell
- the policy is published as a PDF rather than a page

Save the pages to a folder and point the CLI at it:

```bash
# For PDFs, convert first: pdftotext -layout BP-5144-1.pdf BP-5144-1.txt
pnpm --filter @breezebox/tool-ed-code ingest policy \
  --district <district-slug> --from-dir ./board-policy --dry-run
```

It reads `.html`, `.htm`, `.txt` and `.md`.

A page with no policy number on it is skipped and listed, rather than filed
under a guessed citation. A citation that is wrong is worse than a policy that
is missing: the first one gets acted on.

---

## Tenancy, and the §3 exception

§3 says every table carries `district_id` and an RLS policy on day one. The
three tables here carry `district_id`, but it is **nullable**, and null means
"shared, belongs to no district".

The Education Code is state law. One copy serves every district. Copying it per
district would mean re-ingesting 30,000 sections per customer and letting the
copies drift, which is a worse outcome than the exception. So the tenancy rule
is not `district_id = mine` but:

```sql
district_id is null or district_id = app.current_district_id()
```

and it is written that way in every policy. Board policy, which *is* district
property, must have a `district_id`: a check constraint refuses a
`board_policy` source without one, the Education Code can never be moved under
a district, and a trigger copies the source's `district_id` down onto its
documents and chunks so the three tables cannot disagree about who owns a row.

`packages/db/supabase/tests/legal_library_rls.sql` pins all of it down: 53
assertions covering cross-district reads, the read-only surface, the derived
`district_id`, and the fact that `search_legal_chunks()` and
`lookup_legal_documents()` are SECURITY INVOKER and so obey the same walls.

```bash
pnpm --filter @breezebox/db test:legal
```

---

## Environment

On this tool's Vercel project:

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | the shared project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | or `NEXT_PUBLIC_SUPABASE_ANON_KEY`; both names work |
| `ANTHROPIC_API_KEY` | **no `NEXT_PUBLIC_` prefix.** It is a server secret |
| `ED_CODE_PLAN_MODEL` | optional; defaults to Haiku 4.5 |
| `ED_CODE_ANSWER_MODEL` | optional; defaults to Sonnet 5 |

On the **shell** project: `TOOL_ED_CODE_ORIGIN`, set to this deployment's bare
origin. Not the URL with `/ed-code` on the end: the rewrite adds that back, and
the double prefix produces a 404 a long way from its cause.

`SUPABASE_SERVICE_ROLE_KEY` is not in that table and must not be added to it.

---

## Tests

```bash
pnpm --filter @breezebox/tool-ed-code test       # answer markup, stream framing
pnpm --filter @breezebox/tool-ed-code test:ingest # the parsers, against fixtures
pnpm --filter @breezebox/db test:legal            # RLS and retrieval
```

What none of them cover: that the real leginfo and district pages still look
the way the parsers expect. Only a dry run covers that.
