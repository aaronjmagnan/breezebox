# Manual test checklist

The things that cannot be tested from a terminal. Everything else already has
automated coverage: 60 RLS assertions in `pnpm --filter @breezebox/db test`,
and 22 service-worker and capture-queue assertions in a headless browser.

Work **top to bottom**. Each section assumes the ones above it passed, so a
failure tells you where to look instead of leaving you guessing.

Track it per release. A pass on Chrome desktop says nothing about an installed
app on an iPhone, which is the combination §5 flags as most likely to break.

---

## 0. Before you start

- [ ] Both providers enabled in Supabase → Authentication → Providers
- [ ] Redirect URLs list includes `http://*.localhost:3000/**` and
      `https://*.breezebox.com/**`
- [ ] A district row exists whose `sso_domain` is a domain you have a **real
      account on**:

  ```sql
  select slug, name, sso_domain, status from public.districts;
  ```

- [ ] Hostname resolution works before any browser is involved:

  ```sql
  select * from public.get_district_branding('demo.localhost:3000');
  ```

  One row back. Zero rows means the slug does not match and nothing below will
  work.

- [ ] `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never the service role key)

---

## 1. Routing, before any sign-in

| | Test | Expected |
| --- | --- | --- |
| [ ] | `http://demo.localhost:3000` | Sign-in page, **district's real name** in the header |
| [ ] | `http://nope.localhost:3000` | "We could not find that district", **404** status, URL unchanged |
| [ ] | `http://localhost:3000` | Same not-found page (bare localhost is not a district) |
| [ ] | View source on the not-found page | No district names anywhere |

If the district name is wrong or missing, stop. That is `get_district_branding`,
not auth.

---

## 2. Sign-in, desktop browser

Do Google first: fewest moving parts.

| | Test | Expected |
| --- | --- | --- |
| [ ] | Continue with Google, valid district address | Lands on the tile grid, "Signed in as <your name>" |
| [ ] | Check `staff` table after first login | A new row, `created_via = 'sso_first_login'`, role `staff` |
| [ ] | Sign in **again** with the same account | No duplicate row; `last_seen_at` updated |
| [ ] | Continue with Microsoft, valid district address | Same, and **still one staff row** if the email matches |
| [ ] | Reload the page while signed in | Stays signed in, no flash of the sign-in page |
| [ ] | Close the tab, reopen the district URL | Still signed in |

```sql
select email, role, created_via, last_seen_at from public.staff order by created_at desc;
```

---

## 3. Wrong-domain rejection (§5)

**The one to do carefully.** This is the boundary that keeps districts apart.

| | Test | Expected |
| --- | --- | --- |
| [ ] | Sign in with a personal Gmail address | Bounced to a page naming the domain you should have used |
| [ ] | Same, with a personal Microsoft account | Same |
| [ ] | After rejection, navigate to `/` | Sign-in page, **not** the tile grid |
| [ ] | Check the `staff` table | **No row created** for the rejected address |
| [ ] | Check Supabase → Authentication → Users | An auth user may exist; that is expected and harmless without a staff row |

```sql
select count(*) from public.staff where email like '%@gmail.com';  -- expect 0
```

If a wrong-domain account gets **in**, stop everything. Check `sso_domain` is
set and spelled correctly, bare and lowercase, no `@`.

---

## 4. Installed mode

§5 is explicit that installed-app redirects are where PWA setups break, and
that Microsoft on iPhone is the worst offender. Do all six cells.

Sign out fully between each, or you are testing the cookie, not the flow.

| Device | Google | Microsoft |
| --- | --- | --- |
| Laptop (Chrome or Edge, installed) | [ ] | [ ] |
| Android (installed to home screen) | [ ] | [ ] |
| **iPhone (Add to Home Screen)** | [ ] | [ ] |

For each cell:

- [ ] Sign-in completes **inside** the installed app, not by kicking you out to
      a browser tab and stranding you there
- [ ] You land back on the tile grid, signed in
- [ ] The app title and icon are the district's, not "Breeze Box"
- [ ] Force-quit and reopen: still signed in

If iOS opens Safari and leaves you there signed in, but the installed app is
still signed out, that is the classic failure. It means the session cookie
landed on a different browsing context.

---

## 5. Install experience (§11)

| | Device | Test | Expected |
| --- | --- | --- | --- |
| [ ] | Android / desktop Chrome | Visit signed in | "Install app" card appears |
| [ ] | | Tap it | Browser's own install prompt |
| [ ] | | After installing | Card is gone, not just hidden |
| [ ] | iPhone Safari | First visit | "Add this to your home screen" guide, three steps |
| [ ] | | Dismiss with "Got it", reload | Guide does **not** come back |
| [ ] | | Open the installed app | No guide (already installed) |
| [ ] | Chrome **on iOS** | Visit | No guide (it cannot add to home screen) |

---

## 6. PWA behaviour (§11)

**Update prompt**

- [ ] Deploy a change, then reopen the installed app
- [ ] "New version available, tap to refresh" appears
- [ ] It does **not** appear on a first-ever install
- [ ] Tapping it reloads once and shows the new version
- [ ] Nothing reloads by itself while you are looking at a form

**Offline**

- [ ] Sign in, then enable airplane mode
- [ ] Navigate: the offline page appears, not a browser error
- [ ] It lists queued captures (none yet, so the empty message)
- [ ] Turn the network back on, tap "Try again": normal app

**Never cached** — the rule most worth checking by hand:

- [ ] DevTools → Application → Cache Storage
- [ ] One cache, `breezebox-shell-<version>`
- [ ] It contains `/offline` and `/_next/static/...` only
- [ ] **No entry whose URL contains `supabase`**
- [ ] No entry for `/`, `/sign-in` or any rendered page

---

## 7. Session safety (§11)

- [ ] Set a short timeout to test without waiting half an hour:

  ```sql
  update public.districts set inactivity_timeout_minutes = 5 where slug = 'demo';
  ```

- [ ] Sign in, leave the tab untouched for 4 minutes
- [ ] A countdown appears with "Stay signed in"
- [ ] Tapping it dismisses the warning and you stay signed in
- [ ] Leave it again and let it run out: signed out, with "You were signed out"
- [ ] Open two tabs, work in one: the **other does not sign you out**
- [ ] On a phone: lock the screen past the timeout, reopen → signed out
      immediately, not after a delay

- [ ] **Put it back**: `update public.districts set inactivity_timeout_minutes = 30 ...`

**Sign-out clears the device**

- [ ] Sign out via the header button
- [ ] DevTools → Application → IndexedDB: `breezebox-captures` empty or gone
- [ ] Cache Storage: no `breezebox-` caches, or only the re-precached offline page
- [ ] Back button does not show a signed-in page from history

---

## 8. Cross-district isolation (§3)

The database half is automated and takes seconds:

```bash
pnpm --filter @breezebox/db test
```

- [ ] Ends with "RLS isolation checks passed" and no FAIL lines

That covers reads, writes, privilege escalation and wrong-domain claims across
two districts. The part it **cannot** cover is two real accounts in two real
districts, so do that once by hand before any district goes live:

- [ ] Create a second district with a different `slug` and a different
      `sso_domain`
- [ ] Sign in to district B in a separate browser profile
- [ ] In district B, confirm you see **only** B's tiles and B's staff
- [ ] With B's session, visit **A's hostname**: you are not signed in there
- [ ] Confirm from SQL that neither user can see the other's rows:

  ```sql
  -- as each user's JWT, via the API rather than the SQL editor
  select count(*) from public.districts;  -- expect 1, always
  ```

- [ ] Delete the test district afterwards

---

## What to record

For anything that fails, capture: device, OS version, browser, installed or
browser tab, provider, and what the screen actually said. PWA bugs are
device-specific, which is why the in-app support widget captures the same
fields automatically (§9).
