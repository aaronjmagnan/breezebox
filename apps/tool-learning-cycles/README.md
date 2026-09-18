# Learning Cycle Check-In

Data tool (§7). Senior directors record where a school is in its learning cycle
during principal coaching; principals may record too.

Slug `learning-cycles`, `basePath: '/learning-cycles'`, served under the
district origin by the shell's multi-zone rewrite. **`offline: "none"`** — this
app registers no service worker. The shell owns the only one (§11).

## Which URL

```
https://{district}/learning-cycles                  ← what people use
https://{tool-deployment}/learning-cycles           ← the tool's own root
https://{tool-deployment}/                          ← redirects to the above
```

Because of `basePath`, this app has **no route at `/`**. Its own deployment URL
404s at the root, which reads like a failed deploy and is not. `vercel.json`
redirects `/` to `/learning-cycles` so that dead end stops costing anyone ten
minutes.

Nobody should be visiting the tool's deployment directly in normal use. It has
no domain, and the shell proxies to it so the session cookie stays on the
district origin.

## Schema

One table, `public.learning_cycle_checkins`, in the shared Supabase project.
Migration: `packages/db/supabase/migrations/20260917110100_*.sql`.

Worth knowing:

- **`entry_method`** (`typed` | `photo`) exists from day one. Step 2 photographs
  the paper organizer and pre-fills this same record, and retrofitting a
  discriminator onto rows already written is worse than carrying one unused
  column.
- **`template_version`** defaults to `LCC-v1`. If a step's wording changes
  meaning, bump it, so old records keep the words they were answered against.
- **`submitted_at` null means draft.** Not a status column, because there are
  exactly two states and a timestamp answers "when" as well as "whether".
- The enum-like fields use check constraints rather than Postgres enums, so a
  sixth level or a fifth stage is an `alter constraint`, not a type migration.

`created_by` and `district_id` are withheld from the `UPDATE` grant, so neither
can be moved after insert even by someone with edit rights.

## Per-district wording

A district may rename anything people read: section titles, the five step
titles and hints, the three level labels and their meanings, and the stage
names. Overrides live in `tool_instances.config`, which §4 put there for
exactly this.

```sql
update public.tool_instances
set config = '{
  "labels": {
    "sections": { "cycle": "The work" },
    "steps":    { "pick": { "title": "Choose a focus",
                            "hint": "Based on what student data shows" } },
    "levels":   { "routine": { "label": "Embedded",
                               "meaning": "just how we work now" } },
    "stages":   { "just_starting": "Getting going" }
  }
}'::jsonb
where tool_slug = 'learning-cycles'
  and district_id = (select id from public.districts where slug = 'demo');
```

Every key is optional. Anything missing, misspelled or of the wrong type falls
back to the default silently, so a district cannot break its own tool with a
bad config, and an older deployment tolerates a config written for a newer one.
Titles cap at 60 characters and hints at 160, because a label is a phrase and
an uncapped one breaks the table, the segmented control and the print layout at
once.

### What districts cannot change

Not the **number** of steps, their **order**, their **keys**, or their **box
labels**.

That line is the product decision, not a limitation. The five steps are the
method, and the chart's whole job is to compare schools on the same five. If
one district drops "Try it" and another adds two, "three of five are Routine"
stops meaning anything. What a district calls a step is vocabulary; how many
there are and what they measure is meaning.

So districts change words and the platform changes structure. A structural
change is a new `template_version` authored centrally, and records keep the
version they were answered against.

Renames apply to existing records too, deliberately: a district renaming "Pick
one practice" to "Choose a focus" is using new words for the same question, and
showing old records in the old vocabulary would be confusing. A change that
alters what the question *means* is a new template version, not a label
override.

## Access rules

RLS, in `20260917110100_*.sql`. The tool does not filter by district or site
anywhere — RLS does, and duplicating the filter in queries would hide a policy
bug instead of surfacing one.

| Who | Sees |
| --- | --- |
| `district_wide = true` | every site in their district |
| `site_id` set | that site only |
| neither | nothing |

The third row is the one that matters. `claim_staff_membership()` creates staff
rows on first SSO login with **no site**, because §5's whole point is that the
staff list builds itself with no roster upload. The original spec said "no
`site_id` means district-level", which would have given every person who ever
signed in district-wide reach over notes about named colleagues' practice.
Reach is granted, never inferred.

Also:

- `created_by` must equal the signed-in user's `staff.id` on insert
- **drafts are readable only by their author** — a draft is half-formed
  thinking about a named colleague, so it stays private until submitted
- no delete policy: v1 does not delete from the app

Tests: `pnpm --filter @breezebox/db test:lcc` — 20 assertions, including both
things the spec named plus drafts, authorship and site self-reassignment.

## Screens

| Route | Device | What |
| --- | --- | --- |
| `/` | laptop first | Table, sorting, filters, CSV export, your drafts |
| `/new` | **phone first** | The form |
| `/[id]` | both | Read view, and the print layout |
| `/[id]/edit` | phone first | Same form, initial values |
| `/chart` | laptop first | Stacked bar per school for one cycle |

Filter and sort state both live in the URL, so a view is shareable, survives a
reload, works without JavaScript, and the CSV export reuses the same query
string instead of reimplementing either.

Sorting a filtered view keeps the filter. Everything on the check-in sorts in
Postgres; school name sorts in JS, because it lives on a joined row and
PostgREST's ordering across a relationship is fragile enough that a silent
wrong order is a real risk -- and an order that is wrong but plausible is worse
than one that is slower.

## Getting a record out

| Format | How | Why |
| --- | --- | --- |
| **PDF** | `Print or save as PDF` -> the browser's print dialog | The print stylesheet renders the same markup as the read view, so the two cannot drift |
| **Word** | `Download Word` -> `/[id]/docx` | People paste a check-in into a board packet, add a paragraph, track changes. A PDF cannot do that |
| **CSV** | `Export CSV` on the list | Whatever the list is filtered and sorted to |

There is deliberately **no server-side PDF**. It would need headless Chromium
on a serverless function -- slow cold starts, bundle size limits, ongoing
maintenance -- to produce something the browser already does from a stylesheet
that cannot fall out of step with the screen.

The Word export reads its headings, hints and 1a-4e box labels from
`lib/template`, the same constant everything else reads, so it stays aligned
with the paper organizer. It runs the same RLS-scoped query as the page, so the
file can never hold a record the person could not already open.

## Autosave

Debounced to the **server**, never to `localStorage` or IndexedDB. A check-in
names a school and a named principal's practice, and §11 keeps district data
off the device. There is no offline capture here; that is what
`offline: "capture"` is for, and this tool is `"none"`.

The first render does not save. Otherwise opening the form and walking away
would leave an empty draft behind for anyone who glanced at it.

## How the photo step plugs in

`CheckInForm` takes `initialValues`. That is the whole extension point.

```
photo -> extraction -> CheckInFormValues -> <CheckInForm initialValues={...} />
```

Step 2 builds a `CheckInFormValues` object from a photographed organizer and
renders the same form for review. The form does not know a photo was involved,
and the review screen is the form people already know rather than a second
thing to learn.

Two pieces already exist for it:

- `valuesFromRecord()` in `lib/form-state.ts` — the record → values direction,
  used by Edit. The photo step needs the mirror of it.
- `entry_method` on the table — set it to `'photo'` when creating from a scan.

The capture queue in `@breezebox/pwa` is built and unused. If step 2 captures
photos offline, that is where they go, and this tool's config changes to
`offline: "capture"`.

## Local development

```bash
pnpm --filter @breezebox/tool-learning-cycles dev   # port 3001
pnpm --filter @breezebox/shell dev                  # port 3000
```

Then open **http://demo.localhost:3000/learning-cycles**.

**Not** `localhost:3001` directly. The session cookie belongs to the district
origin, so hitting the tool's own port looks signed out. The shell proxies to
3001 and forwards the cookie, which is the same path production takes.

You also need reach, or the tool correctly shows you nothing:

```sql
update public.staff set district_wide = true where email = 'you@yourdomain.com';
```
