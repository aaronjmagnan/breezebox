# Learning Cycle Check-In

Data tool (§7). Senior directors record where a school is in its learning cycle
during principal coaching; principals may record too.

Slug `learning-cycles`, `basePath: '/learning-cycles'`, served under the
district origin by the shell's multi-zone rewrite. **`offline: "none"`** — this
app registers no service worker. The shell owns the only one (§11).

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
| `/` | laptop first | Table, filters, CSV export, your drafts |
| `/new` | **phone first** | The form |
| `/[id]` | both | Read view, and the print layout |
| `/[id]/edit` | phone first | Same form, initial values |
| `/chart` | laptop first | Stacked bar per school for one cycle |

Filter state lives in the URL, so a filtered view is shareable and the CSV
export reuses the same query string instead of reimplementing the filter.

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
