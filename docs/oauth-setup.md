# OAuth setup

One-time setup for Google and Microsoft sign-in (backbone §5). Takes about 30
minutes, most of it waiting on consent screens.

You need your **Supabase project ref** for every step. Find it in the Supabase
dashboard under Settings → General, or read it out of your project URL:
`https://<project-ref>.supabase.co`.

**The providers only ever learn one redirect URI**, and it is the same one for
both:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Not your district domain. Supabase receives the callback and then forwards the
user back to the district origin, which is configured separately in step 3.

---

## 1. Google

Google renamed all of this. What older guides (including an earlier version of
this file) call the **OAuth consent screen**, under *APIs & Services*, is now
**Google Auth Platform**, split across several pages.

Start here, with your project selected:

**https://console.cloud.google.com/auth/overview**

If the project has never been configured, that page runs a *Get started* flow
asking for app name, support email, audience and contact details. Complete it
and the rest of the navigation unlocks.

Then, page by page:

| Page | Direct link | What to do |
| --- | --- | --- |
| **Branding** | [/auth/branding](https://console.cloud.google.com/auth/branding) | App name, user support email, developer contact |
| **Audience** | [/auth/audience](https://console.cloud.google.com/auth/audience) | Choose **External**; see the trap below |
| **Data Access** | [/auth/scopes](https://console.cloud.google.com/auth/scopes) | Add `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` |
| **Clients** | [/auth/clients](https://console.cloud.google.com/auth/clients) | Create the OAuth client |

Choose **External** on Audience unless every user will be in your own Google
Workspace. Internal means only accounts in *your* Workspace can ever sign in,
which is wrong for a product serving other districts.

On **Clients → Create client**:

- Application type: **Web application**
- Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
- Authorized JavaScript origins: leave empty. Supabase handles the exchange;
  the browser never talks to Google directly from your domain.

Copy the **Client ID** and **Client secret**.

**Supabase dashboard → Authentication → Providers → Google**: enable, paste
both, save.

> **If you are hunting for "Credentials"**: *APIs & Services → Credentials*
> still exists, but it is now only for API keys and service accounts. OAuth
> client IDs moved to **Clients** under Google Auth Platform. This is the step
> most likely to have you going in circles.

### The Google trap

A new External app starts in **Testing**, which means:

- only accounts listed under **Test users** can sign in, up to 100
- refresh tokens expire after **7 days**, so people get silently signed out

Fine while you are the only user. Before a district touches it, hit **Publish
app** on the **Audience** page. Publishing is instant unless you request
sensitive scopes, and the three above are not sensitive, so there is no
verification review to wait on.

---

## 2. Microsoft

**Azure portal → Microsoft Entra ID → App registrations → New registration**

1. Name it whatever you like; users never see it.
2. **Supported account types**: *Accounts in any organizational directory
   (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft
   accounts*.

   This sounds far too open, and it is deliberate. Districts are on their own
   tenants, so single-tenant would only ever work for one customer. **The
   `sso_domain` check is the gate**, and it runs in the database
   (`claim_staff_membership`), not in the app. Anyone can authenticate with
   Microsoft; only an address on the district's domain gets a staff row, and
   without a staff row RLS returns nothing.
3. **Redirect URI**: platform **Web**, value
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Register, then from **Overview** copy the **Application (client) ID**.
5. **Certificates & secrets → Client secrets → New client secret**. Copy the
   **Value** column, not the Secret ID. The value is shown once and is
   unrecoverable afterwards; the Secret ID looks just as plausible and will
   fail at sign-in with an unhelpful error.
6. **API permissions**: Microsoft Graph, delegated: `openid`, `email`,
   `profile`, `User.Read`. `User.Read` is usually there already.

**Supabase dashboard → Authentication → Providers → Azure**: enable, paste the
client ID and the secret value. Leave **Azure Tenant URL** empty — setting it
locks you to one tenant, which is the opposite of what step 2 chose.

### The Microsoft trap

Personal Microsoft accounts sometimes return no email claim at all. The app
handles it (`/auth/denied?reason=no_email` says "we did not get an email
address, try the other button"), but it is why the `email` delegated permission
above is not optional.

---

## 3. Tell Supabase where to send people back to

**Authentication → URL Configuration**

**Site URL**: `https://breezebox.com`

**Redirect URLs** — add every one of these:

```
https://breezebox.com/**
https://*.breezebox.com/**
http://localhost:3000/**
http://*.localhost:3000/**
```

Then one line per custom district domain, as you add them:

```
https://leaders.sampleusd.org/**
```

Three things about this list:

- `*` matches **one** hostname label. `demo.breezebox.com` matches;
  `a.b.breezebox.com` does not. Same limit as the wildcard certificate.
- **Custom domains are not covered by the wildcard.** Miss one and that
  district works perfectly right up to the last hop of sign-in, then fails.
- `http://*.localhost:3000/**` is what makes local development work at all.

---

## 4. Create a district that can actually sign in

The seed only runs locally. On a hosted project, insert the row by hand — and
**`sso_domain` must be a domain you have a real account on**, or every sign-in
is refused by design.

```sql
insert into public.districts (slug, name, app_name, theme_color, sso_domain, status)
values ('demo', 'Demo Unified School District', 'Demo USD',
        '#4A7FB5', 'yourrealdomain.com', 'active');
```

Then sanity-check the hostname lookup before touching a browser:

```sql
select * from public.get_district_branding('demo.localhost:3000');
```

One row back means routing will work. No rows means the slug does not match.

---

## 5. Point local development at the hosted project

In `.env.local` at the repo root (values from Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / public key>
```

The anon key is safe in the browser. RLS is the boundary, not the key. Do **not**
put the service role key here: it bypasses RLS entirely.

Then:

```bash
pnpm dev
```

and open **http://demo.localhost:3000** — not `localhost:3000`. The shell
resolves the district from the hostname, and a bare `localhost` matches no
district.

---

## Order to test in

Work up, not down. Each step rules out everything below it.

1. **`demo.localhost:3000` shows the sign-in page** with the district name.
   If not, the problem is the district row or `get_district_branding`, and
   OAuth is not involved yet.
2. **Google sign-in in a desktop browser.** Fewest moving parts.
3. **Wrong-domain rejection.** Sign in with a personal Gmail account. You
   should land on a page naming the domain you should have used, and be signed
   out. If you get *in*, stop: `sso_domain` is wrong or empty.
4. **Microsoft sign-in in a desktop browser.**
5. **Both, in the installed app on a laptop.**
6. **Both, in the installed app on Android.**
7. **Both, in the installed app on iPhone.** Last, because per §5 this is the
   most likely thing to break, and you want everything else ruled out first.

## When it fails

| What you see | Almost always |
| --- | --- |
| `redirect_uri_mismatch` from Google | The provider has your district domain instead of the Supabase callback URL |
| Cannot find the OAuth consent screen at all | Google renamed it. It is **Google Auth Platform** now: console.cloud.google.com/auth/overview |
| Supabase says "requested path is invalid" | The district origin is missing from the Redirect URLs list in step 3 |
| Signed in, then bounced to `/auth/denied` | Working as designed: your email domain does not match `sso_domain` |
| "Sign-in is not switched on yet" | `sso_domain` is null on that district |
| Microsoft errors with an opaque code | You pasted the Secret **ID** instead of the secret **Value** |
| Works in browser, fails in the installed app | The installed app opens a different browsing context; check the redirect list covers the exact origin, including port |
