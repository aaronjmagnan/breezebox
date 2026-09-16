# Breeze Box

District software built as one installable Progressive Web App per district: a
shell plus a set of tools, sharing one login, one design system, and one
database.

Built against the Breeze Box architecture backbone. Section references below
(§2, §3, ...) point at it.

**Status: steps 1 and 2 of the build order are done.** The monorepo is set up
and the database layer, including every RLS policy, is written and tested.
Hostname routing, auth, shell UI, and PWA are next.

---

## Layout (§2)

```
apps/
  shell/            district landing page, PWA manifest, the only service worker
packages/
  ui/               shared design system components  (stub)
  db/               schema, migrations, RLS policies, generated types
  auth/             shared SSO logic                 (stub)
  pwa/              capture queue, update prompt, install guide  (stub)
```

Two apps from §2 are deliberately **not** here yet:

- **`apps/tool-template`** — the scaffold every new tool is copied from. It
  gets built alongside the first real tool, so it encodes a pattern that has
  actually shipped once rather than a guess.
- **`apps/admin`** — the super-admin control panel (§10). Separate domain, not
  a PWA, no service worker, laptop only. It is what creates district rows, so
  until it exists districts are created with SQL (see
  [Adding a district](#adding-a-district)).

Each tool deploys independently and is served under the district origin at
`/{tool-slug}` via Next.js multi-zones. The shell is the default zone; the
registry lives in `apps/shell/src/config/tool-zones.mjs` and is empty today.

## Local setup

Requirements: Node 20.11+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
cp .env.example .env.local

pnpm db:start          # starts local Supabase, prints the URL and anon key
# paste those into .env.local
pnpm db:reset          # runs every migration, then seeds the "demo" district
pnpm db:types          # regenerate packages/db/src/types.ts

pnpm dev
```

Then open **http://demo.localhost:3000**, not `localhost:3000`. The shell
resolves a district from the hostname (§8), and `*.localhost` subdomains
resolve to `127.0.0.1` in every current browser with no `/etc/hosts` edit.

### Verify database isolation

```bash
pnpm --filter @breezebox/db test
```

Runs `packages/db/supabase/tests/rls_isolation.sql`: 60 assertions covering
cross-district reads and writes, privilege escalation, wrong-domain sign-in,
and first-login provisioning. It runs inside a transaction that rolls back, so
it leaves your local data alone.

## Hostname routing (§8)

`apps/shell/src/middleware.ts` reads the `Host` header on every request, calls
`get_district_branding()`, and puts the result on an `x-breezebox-district`
request header. Server components read it with `getDistrict()` /
`requireDistrict()` from `@/lib/district/server`.

Any inbound copy of that header is stripped before the lookup, on every code
path, so a client cannot pick its own district by sending the header itself.

A hostname that matches no district is rewritten to `/district-not-found` with
a 404. The URL is preserved (rewrite, not redirect) and the page says nothing
about which districts exist.

Lookups are cached in memory per server instance: 60s for a hit, 10s for a
miss, capped at 500 entries so unknown hostnames cannot grow the map without
bound.

**Local dev** needs no `/etc/hosts` edit. Every current browser resolves
`*.localhost` to 127.0.0.1, so `http://demo.localhost:3000` reaches a district
seeded with `slug = 'demo'`. Bare `localhost:3000` resolves to nothing unless
you set `NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG`, which is also what makes Vercel
preview URLs usable.

## Auth setup (§5)

Sign-in is Google and Microsoft OAuth through Supabase Auth. All of it lives in
`packages/auth`; the shell and every tool import from there and never
reimplement login.

### The redirect chain

The providers only ever know **one** redirect URI: Supabase's own callback.
Supabase then returns the user to the district origin they started on.

```
demo.breezebox.com/sign-in
  → accounts.google.com  (redirect_uri = <project>.supabase.co/auth/v1/callback)
    → <project>.supabase.co/auth/v1/callback
      → demo.breezebox.com/auth/callback?code=...
```

That last hop is the one Supabase has to be told about.

### What to add in the Supabase dashboard

**Authentication → Providers**: enable Google and Azure (Microsoft).

In the **Google Cloud console**, the only authorized redirect URI you need is:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Same single URI in the **Azure app registration**. Note that with the default
`common` tenant, *any* Microsoft account can authenticate — which is exactly
why the `sso_domain` check exists and why it is enforced in the database.

**Authentication → URL Configuration → Site URL**:

```
https://breezebox.com
```

**Authentication → URL Configuration → Redirect URLs** — add all of these:

```
https://breezebox.com/**
https://*.breezebox.com/**
http://localhost:3000/**
http://*.localhost:3000/**
```

Plus one line per custom district domain:

```
https://leaders.sampleusd.org/**
```

And, if you deploy previews, your Vercel preview pattern:

```
https://*-<your-team>.vercel.app/**
```

Three things worth knowing about that list:

- `*` matches a single hostname label, `**` matches any path. So
  `https://*.breezebox.com/**` covers `demo.breezebox.com` but **not**
  `a.b.breezebox.com` — the same one-label limit as the wildcard certificate.
- Custom domains are not covered by the wildcard. Every district that maps its
  own domain needs its own line here, or sign-in breaks for that district only,
  after everything else about it already works.
- `http://*.localhost:3000/**` is what makes `demo.localhost:3000` work in
  development. Without it, local sign-in fails at the last hop.

### What happens after the callback

`/auth/callback` exchanges the code for a session, then calls
`claim_staff_membership(district_id)`. That function re-checks the email domain
against `districts.sso_domain` **in the database** and, on a first valid login,
creates the staff row with `created_via = 'sso_first_login'`.

If the domain does not match, the session is dropped immediately and the user
lands on `/auth/denied` with a message naming the domain they should be using.
The app-layer check is not the boundary: a user who somehow got past it still
resolves to no district, so RLS shows them nothing.

### Inactivity sign-out (§11)

`useInactivitySignOut` signs the user out after
`districts.inactivity_timeout_minutes` (default 30). Last-activity is shared
across tabs through `localStorage`, it polls coarsely rather than resetting a
timer on every pointer event, and it re-checks on `visibilitychange` so a phone
that slept past the timeout signs out as soon as the app comes back.

## Deploying: one Vercel project per app

| App | Vercel project | Domains |
| --- | --- | --- |
| `apps/shell` | its own | `*.breezebox.com` + apex `breezebox.com` |
| each tool | its own | none needed; the `.vercel.app` URL is enough |
| `apps/admin` | its own | its own domain, never a district subdomain |

Only the shell is reachable by a district. Tools are never visited directly:
the shell proxies `/{tool-slug}/*` to the tool's deployment with a Next
rewrite, so the browser only ever talks to the district origin. That is what
makes one session cover every tool (§5) and one service worker cover the whole
app (§11).

Wiring a tool up is three things:

1. The tool sets `basePath: '/{tool-slug}'` in its own `next.config`.
2. Add an entry to `apps/shell/src/config/tool-zones.mjs` and set the env var
   it names on the **shell** project, pointing at the tool's deployment origin.
3. Insert a `tool_instances` row for each district that gets the tool.

Two things that will bite you:

- **Deployment Protection** is on by default for new Vercel projects. It will
  block the shell's server-side proxy requests to a tool, which shows up as a
  401 page inside the tile rather than an obvious error. Turn it off for tool
  projects, or use a protection bypass secret.
- The tool env vars on the shell are **per environment**. Point preview at the
  tool's preview URL and production at its production URL, or preview traffic
  will proxy into production.

## Applying the schema to a hosted Supabase project

Two ways, depending on whether the project is linked to the CLI.

**Linked project (preferred).** Migrations are tracked, so the next one knows
where to start:

```bash
supabase link --project-ref <your-project-ref> --workdir packages/db
pnpm db:push
```

**SQL editor.** For a project you have not linked, generate one script and
paste it in:

```bash
pnpm --filter @breezebox/db bundle     # writes packages/db/supabase/bundle.sql
```

It concatenates all 12 migrations in order inside a single transaction, so a
failure anywhere leaves the project untouched. Run it once against a project
that does not already have these objects.

Caveat worth knowing: the bundle does **not** record anything in Supabase's
migration history. If you start with the bundle and later switch to
`pnpm db:push`, the CLI will try to re-run everything. Pick one and stay with
it, or run `supabase migration repair --status applied <version>` for each
file after bundling.

Do **not** run `seed.sql` against a real project: it creates the fake "demo"
district. `tests/rls_isolation.sql` is safe anywhere (it rolls back), but run
it on staging rather than production.

## Environment variables

See `.env.example` for the annotated list. The ones that matter:

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | shell | From `pnpm db:start` locally |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | shell | Safe in the browser; RLS is the boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | **Bypasses RLS.** Never `NEXT_PUBLIC_`, never in the shell |
| `NEXT_PUBLIC_ROOT_DOMAIN` | shell | Apex to strip when extracting a district slug |
| `SUPABASE_PROJECT_ID` | CLI only | For `db:push` and `types:remote` |

## Adding a district

Until `apps/admin` exists (§10), insert the row directly:

```sql
insert into public.districts (slug, name, app_name, icon_url, theme_color,
                              sso_domain, contract_start_date,
                              free_period_end_date, status)
values ('sampleusd', 'Sample Unified School District', 'Sample USD',
        'https://.../icon-512.png', '#4A7FB5', 'sampleusd.org',
        current_date, current_date + interval '90 days', 'active');
```

What each field does:

- **`slug`** — the subdomain. `sampleusd.breezebox.com`. Lowercase, DNS-safe,
  and it cannot be one of the reserved labels (`www`, `app`, `api`, `admin`,
  `auth`, `static`, `assets`, `cdn`).
- **`sso_domain`** — the district's verified email domain, bare and lowercase
  (`sampleusd.org`, not `@sampleusd.org`). **Sign-in is impossible until this
  is set**, and an address outside it is refused by the database, not just the
  app (§5).
- **`app_name`** — what the installed app is called on a home screen (§11).
- **`theme_color`** — hex, drives the manifest and the browser chrome.
- **`inactivity_timeout_minutes`** — defaults to 30 (§11). Override per
  district here.

Then add sites, and tool instances for whatever the district is buying:

```sql
insert into public.sites (district_id, name, site_type)
select id, 'Sample High School', 'high' from public.districts where slug = 'sampleusd';

insert into public.tool_instances (district_id, tool_type, tool_slug, name, accent)
select id, 'data', 'coaching-tracker', 'Coaching Tracker', 'teal'
from public.districts where slug = 'sampleusd';
```

Staff rows create themselves on first SSO login (§5). No roster upload.

### Custom domains

Set `districts.custom_domain` to the full hostname (`leaders.sampleusd.org`,
lowercase, no scheme), add it to the Vercel project, and have the district
point a CNAME at Vercel. `get_district_branding()` matches custom domains
before it tries the subdomain slug, and it tolerates a `www.` prefix.

## Vercel wildcard domain

The shell needs `*.breezebox.com` so a new district is live the moment its row
exists, with no per-district DNS work.

1. Add `breezebox.com` to the Vercel project.
2. **Move the domain's nameservers to Vercel.** A wildcard certificate cannot
   be issued through the CNAME/A-record setup; Vercel has to run DNS. This is
   the step that surprises people, and it means any existing records for the
   domain have to be recreated in Vercel DNS first. Do that before switching,
   or mail and anything else on the domain goes down.
3. Add `*.breezebox.com` as a domain on the shell project. Vercel issues the
   wildcard certificate once nameservers have propagated (minutes to a few
   hours).
4. Add the apex `breezebox.com` too, pointing at whatever the marketing site
   should be. The shell treats the apex as "no district" (§8).
5. Custom district domains are added individually to the same project. They do
   not need Vercel nameservers, only a CNAME, since each gets its own
   certificate.

Note that a wildcard certificate covers exactly one label:
`sampleusd.breezebox.com` works, `a.b.breezebox.com` does not.

## Rules that do not bend

From §3, and they are the ones most likely to get skipped under deadline
pressure:

1. Every new table carries `district_id`.
2. Every new table gets RLS policies **before** any UI reads or writes it.
3. "Which school" is `sites.id`. "Which person" is `staff.id`. Never a locally
   re-invented identifier.
4. Only the shell registers a service worker (§11). Tools never do.
5. District data from Supabase is network-only. Never cached by the service
   worker (§11).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the shell |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Typecheck every package |
| `pnpm db:start` / `pnpm db:stop` | Local Supabase stack |
| `pnpm db:reset` | Re-run every migration and reseed |
| `pnpm db:types` | Regenerate `packages/db/src/types.ts` |
| `pnpm db:push` | Apply migrations to the linked remote project |
| `pnpm --filter @breezebox/db test` | RLS isolation suite |
