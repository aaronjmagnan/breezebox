# @breezebox/db

Shared schema for the one Supabase project every district lives in (backbone §3),
plus the generated TypeScript types.

## Layout

```
supabase/
  config.toml                  local stack config (API, auth providers, seed)
  migrations/                  ordered, append-only
  seed.sql                     one "demo" district and two sites
  tests/rls_isolation.sql      proves cross-district isolation
src/
  types.ts                     GENERATED - do not hand-edit
  index.ts                     row/enum aliases and shared constants
```

## Commands

Run from the repo root:

| Command | What it does |
| --- | --- |
| `pnpm db:start` | Start the local Supabase stack (Docker required) |
| `pnpm db:reset` | Drop, re-run every migration, re-seed |
| `pnpm db:types` | Regenerate `src/types.ts` from the local database |
| `pnpm db:push` | Apply pending migrations to the linked remote project |
| `pnpm --filter @breezebox/db test` | Run the RLS isolation suite |

Regenerate types after every migration. `src/types.ts` is checked in so the
apps typecheck without a running database.

## Rules that do not bend (§3)

1. Every new table carries `district_id`.
2. Every new table gets RLS policies **before** any UI reads or writes it.
3. "Which school" is `sites.id`. "Which person" is `staff.id`. Never a
   locally invented identifier.

## Why there is a private `app` schema

RLS policies call `app.current_district_id()` and friends. Those functions are
`SECURITY DEFINER` so they can read `public.staff` without tripping that table's
own RLS, which is what stops the policies recursing. The `app` schema is not in
`config.toml`'s exposed `schemas` list, so nothing in it is reachable over the
API.

Consequence worth knowing: **never** put `force row level security` on
`public.staff`. The table owner would become subject to its own policies and
every helper lookup would recurse.
