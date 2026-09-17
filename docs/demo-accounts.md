# Demo accounts

How to sign in as a teacher, a site admin and a district admin without needing
a real Google or Microsoft account for each role.

**This is not a backdoor.** A demo account is an ordinary Supabase user with an
ordinary `staff` row. Sign-in still calls `claim_staff_membership()`, so the
email domain is still checked against `districts.sso_domain` in the database,
and RLS still decides what each role can see. The only difference from SSO is
which credential proved who you are.

Two things keep it off real districts:

- The password form renders only when the resolved district has
  `demo_mode = true`
- `signInWithPassword` re-checks the flag and refuses to leave a session in
  place otherwise

`demo_mode` is super-admin only. A district admin cannot switch it on — the
guard trigger blocks it, alongside `slug`, `sso_domain` and billing status.

---

## 1. Flag the district

```sql
update public.districts set demo_mode = true where slug = 'demo';
```

## 2. Enable email sign-in in Supabase

Authentication → Providers → **Email**: on.

Turn **Confirm email** off, or create the users with auto-confirm in step 3.
Leave **Allow new users to sign up** off — you are creating these by hand, and
open signup on a district origin is not something you want.

## 3. Create the accounts

Authentication → **Users → Add user**, one per role. Tick **Auto Confirm User**.

The addresses must be on the district's `sso_domain`, or the domain check
refuses them exactly as it would a stranger. Fictional is fine — nothing is
ever sent to them.

| Email | Password | Role it will get |
| --- | --- | --- |
| `teacher@yourssodomain.com` | your choice | `staff` |
| `principal@yourssodomain.com` | your choice | `site_admin` |
| `supt@yourssodomain.com` | your choice | `district_admin` |

## 4. Sign in once as each

Go to the district, **Use a demo account**, sign in. First sign-in creates the
`staff` row automatically with `created_via = 'sso_first_login'` and role
`staff` — same path a real user takes.

## 5. Promote two of them

Roles are not self-assigned, so set them after the first sign-in:

```sql
update public.staff set role = 'site_admin'     where email = 'principal@yourssodomain.com';
update public.staff set role = 'district_admin' where email = 'supt@yourssodomain.com';
```

Run this as the service role or from the SQL editor. A district admin can
change roles through the API; a teacher cannot, and the guard trigger will say
so if you try.

## What each role sees

| | `staff` | `site_admin` | `district_admin` |
| --- | --- | --- | --- |
| Tile grid, own district | yes | yes | yes |
| Staff directory | yes | yes | yes |
| All the district's support tickets | own only | yes | yes |
| Add or edit sites | no | no | yes |
| Add or edit tool instances | no | no | yes |
| Change another person's role | no | no | yes |
| Edit district branding | no | no | yes |
| Read the district's `access_log` | no | no | yes |

Nobody, at any role, can see another district's rows. That is enforced in the
database, not the UI, and the isolation suite proves it:

```bash
pnpm --filter @breezebox/db test
```

## Turning it off

```sql
update public.districts set demo_mode = false where slug = 'demo';
```

The password form disappears. Delete the users in Authentication → Users if you
want them gone entirely; their `staff` rows keep the history and can be set to
`status = 'inactive'` instead.
