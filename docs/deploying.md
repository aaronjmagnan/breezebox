# Deploying

One Vercel **project** per deployable app, all from this one repo. Different
Root Directory per project; same git history.

| App | Root Directory | Domains |
| --- | --- | --- |
| `apps/shell` | `apps/shell` | the wildcard, later |
| each tool | `apps/tool-{name}` | none; the shell proxies to it |
| `apps/admin` | `apps/admin` | its own, never a district subdomain |

Only the shell is ever reached directly by a district. Tools are proxied
server-side through the shell's multi-zone rewrites, so the browser only ever
talks to the district origin. That is what makes one session cover every tool
(§5) and one service worker cover the whole app (§11).

---

## Deploying the shell

### 1. Create the project

Import the repo in Vercel, then:

- **Root Directory**: `apps/shell`
- **Include source files outside of the Root Directory**: **on**. Without it
  the build cannot see `packages/`, and it fails at install with unresolved
  workspace dependencies.
- Framework, install and build commands come from `apps/shell/vercel.json`;
  leave the dashboard on defaults.

### 2. Environment variables

| Variable | Value | Environments |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | all |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key | all |
| `NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG` | `demo` | **preview + development only** |

The anon key is safe in the browser; RLS is the boundary. **Never** add
`SUPABASE_SERVICE_ROLE_KEY` to the shell — it bypasses RLS entirely and the
shell has no use for it.

`VERCEL_GIT_COMMIT_SHA` is supplied automatically and becomes the service
worker's cache version, so every deploy invalidates the old cache.

#### If the app says Supabase is unset when it plainly is not

Supabase has been renaming the anon key to the **publishable key**, and a newer
dashboard hands you that name. A variable called
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted, but anything else — say
`NEXT_PUBLIC_SUPABASE_KEY` — is invisible to the app, which then reports it as
unset while the dashboard shows it sitting there looking correct.

Check the name character for character before anything else. The runtime log
line names both accepted spellings.

#### The one to be careful with

`NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG` exists because a `.vercel.app` hostname
contains no district slug. Set it and previews resolve to your demo district.

**Take it off Production the day a real wildcard domain starts resolving.** It
turns "district not found" into "quietly serve the fallback district", so a
typo'd or retired subdomain would show someone else's app instead of an error.
The shell logs a warning every time the fallback fires in production, which is
your reminder.

Until you have a domain, Production *is* the `.vercel.app` URL, so it needs to
be set there too. Just remember it is temporary.

### 3. Tell Supabase about the deployment URL

**This is the step that breaks sign-in if you skip it.** Supabase → Authentication
→ URL Configuration → Redirect URLs:

```
https://<your-project>.vercel.app/**
```

Preview deployments get a fresh URL per branch, so add the team pattern too:

```
https://*-<your-team-slug>.vercel.app/**
```

Without these, sign-in completes at the provider and then dies at the last hop
with "requested path is invalid".

### 4. Deployment Protection

New Vercel projects have it on for preview deployments. Two consequences:

- You cannot test a preview on a phone without being signed in to Vercel there
- Later, it will block the **shell's server-side proxy** to a tool, which shows
  up as a 401 rendered inside the tile rather than an obvious error

Turn it off for tool projects. For the shell, turn it off on whichever
environment you want to test from a phone.

---

## Adding a tool later

1. The tool sets `basePath: '/{tool-slug}'` in its own `next.config`
2. Add an entry to `apps/shell/src/config/tool-zones.mjs`
3. Set the env var that entry names **on the shell project**, pointing at the
   tool's deployment origin
4. Insert a `tool_instances` row per district that gets the tool

Tool env vars on the shell are **per environment**. Point preview at the tool's
preview URL and production at production, or preview traffic silently proxies
into production data.

`ignoreCommand` in `vercel.json` runs `turbo-ignore`, so a project only
rebuilds when its own code or its dependencies changed. Editing a tool will not
redeploy the shell.

---

## Custom domain, when you have one

Nothing in the code is pinned to a domain: the shell resolves the district from
whatever hostname arrives. Switching is DNS plus Supabase's redirect list.

1. Add the domain to Vercel and **move its nameservers to Vercel**. A wildcard
   certificate is issued over DNS-01, so Vercel has to control the zone.
2. **Before flipping nameservers**, recreate every existing record in Vercel
   DNS — `MX`, plus SPF, DKIM and DMARC `TXT`. Mail records are the ones that
   bite: a missing MX bounces loudly and you fix it in an hour, a missing DKIM
   quietly routes your mail to spam and you find out a week later.
   Drop TTLs to 300s the day before so a mistake is five minutes to undo.
3. Assign `*.example.com` to the **shell** project.
4. Assign the apex and `www` to a **separate marketing project**. Pointing the
   apex at the shell means visitors to your front door get "We could not find
   that district".
5. Add `https://*.example.com/**` to Supabase's redirect list.
6. Remove `NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG` from Production.

A wildcard certificate covers exactly one label: `demo.example.com` works,
`a.b.example.com` does not.

Custom district domains (`districts.custom_domain`) are added individually to
the shell project. They do not need Vercel nameservers, only a CNAME, since
each gets its own certificate — but **each one needs its own line in Supabase's
redirect list**, or that district works perfectly until the last hop of
sign-in.

---

## First deploy checklist

- [ ] Root Directory `apps/shell`, "include files outside root" on
- [ ] Supabase URL + anon key set, service role key **not** set
- [ ] `NEXT_PUBLIC_DEFAULT_DISTRICT_SLUG` set
- [ ] `https://<project>.vercel.app/**` in Supabase's redirect list
- [ ] Deployment Protection off, or you are signed in on the test phone
- [ ] A district row exists with your real `sso_domain`
- [ ] Visit the deployment: sign-in page with the district name
- [ ] Then run [the manual test checklist](manual-test-checklist.md) — the
      installed-mode sections are the whole reason to deploy this early
