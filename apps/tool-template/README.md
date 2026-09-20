# Tool template

The scaffold every new tool is cut from (backbone §2, §12). Never start a tool
from scratch, and never copy an existing tool: this carries the decisions that
were expensive to learn, and an existing tool carries its domain with them.

**This is not a workspace package.** Its files hold `__TOOL_*__` placeholders,
so it is excluded in `pnpm-workspace.yaml`. Do not run `pnpm install` expecting
to see it.

## Cutting a new tool

```bash
pnpm new-tool coaching-tracker "Coaching Tracker"
```

That copies the scaffold, substitutes the names, picks a free dev port, and
prints the steps that cannot be automated. It refuses a slug that is not
URL-safe or that the shell reserves.

It deliberately does **not** register the tool in the shell or create a
`tool_instances` row. Both are decisions, and both are in the printed list.

## What is in here, and why

| File | The decision it carries |
| --- | --- |
| `supabase/migration.sql.template` | `district_id` on the table, RLS policies, and the cross-district trigger, written before any UI (§3) |
| `supabase/test.sql.template` | The four isolation properties to prove |
| `src/lib/session.ts` | Reach: `district_wide`, or a site, or nothing. Never "null means everything" |
| `src/lib/routes.ts` | The basePath rule for `next/link` versus a plain anchor |
| `src/lib/format.ts` | Why a `date` must not go through `new Date()` |
| `src/lib/csv.ts` | CSV quoting and spreadsheet formula injection |
| `src/app/globals.css` | Print styles, so PDF is the read view rather than a second template |
| `template.config.mjs` | Category (§7) and offline mode (§11), in one readable place |

Four of those exist because they went wrong once:

- **Reach.** The first draft of the check-in tool read "no `site_id` means
  district-level" from a spec. Since `claim_staff_membership()` creates staff
  rows with no site, that would have given every person who ever signed in
  district-wide access to notes about named colleagues. Reach is granted,
  never inferred.
- **basePath.** `next/link` prefixes it; a plain `<a>` does not, and the shared
  `Button` renders a plain anchor. Getting it backwards produces
  `/slug/slug/page`, which the `[id]` route then matches happily — and the
  first symptom is Postgres rejecting an invalid uuid, a long way from the
  cause.
- **Dates.** `new Date('2026-09-18')` parses as UTC midnight, so everyone west
  of UTC sees the day before. Silent, and wrong on exactly the field that
  records when something happened.
- **CSV.** A note beginning `=see attached` executes as a formula when the
  export is opened in Excel.

## The order that matters

1. **Schema and RLS policies**
2. **Tests that prove the isolation**
3. Then the UI

§3 calls that the rule most likely to get skipped under deadline pressure and
the most costly to retrofit. It is also the one nothing reminds you about: a
table with no policies works perfectly in development, where you are the only
district and have district-wide reach.

## Before it ships (§12)

- [ ] Category set in `template.config.mjs` — data, workflow or impact (§7)
- [ ] Every new table carries `district_id` and has policies (§3)
- [ ] "Which school" is `sites.id`, "which person" is `staff.id` (§4)
- [ ] Auth through `@breezebox/auth`; login is not reimplemented (§5)
- [ ] UI from `@breezebox/ui` only (§6)
- [ ] `basePath` set, zone registered in `apps/shell/src/config/tool-zones.mjs`
- [ ] `offline` set, and **no service worker registered here** (§11)
- [ ] Every screen marked phone first or laptop first, and tested installed
- [ ] Works at 360px, tap targets 44px, nothing hover-only (§6)
- [ ] A workflow or impact tool extends an existing schema by addition, never
      by restructuring it (§7)
