-- Breeze Box :: 0013 demo mode
--
-- A district flagged demo_mode may additionally sign in with email and
-- password, so the platform can be shown and role behaviour exercised without
-- a real Google or Microsoft account per role.
--
-- This is NOT a bypass. A demo account is an ordinary Supabase user with an
-- ordinary staff row. It still goes through claim_staff_membership(), still
-- has its email domain checked against sso_domain, and still sees only what
-- RLS allows. The flag controls one thing: whether the shell offers the
-- password form at all.
--
-- It is deliberately super-admin only (see the guard below). A district admin
-- cannot switch their own district into demo mode.

alter table public.districts
  add column demo_mode boolean not null default false;

comment on column public.districts.demo_mode is
  'Allows email+password sign-in alongside SSO, for demos. Super-admin only.';

-- ---------------------------------------------------------------------------
-- Keep demo_mode out of a district admin's reach
-- ---------------------------------------------------------------------------

create or replace function app.guard_district_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_end_user_request() then
    return new;
  end if;

  -- Identity, tenancy, billing and demo mode belong to the super-admin
  -- panel (§10).
  if new.id is distinct from old.id
     or new.slug is distinct from old.slug
     or new.custom_domain is distinct from old.custom_domain
     or new.sso_domain is distinct from old.sso_domain
     or new.status is distinct from old.status
     or new.contract_start_date is distinct from old.contract_start_date
     or new.free_period_end_date is distinct from old.free_period_end_date
     or new.demo_mode is distinct from old.demo_mode
  then
    raise exception
      'slug, custom_domain, sso_domain, status, contract dates and demo_mode are managed by Breeze Box admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Branding has to carry demo_mode
-- ---------------------------------------------------------------------------
-- The sign-in page decides whether to render the password form, and it renders
-- before anyone is signed in. So the flag has to come through the one
-- anonymous read path. It reveals only that a district is a demo, which is not
-- a secret -- and a demo district holds no real student or staff data.
--
-- Dropped and recreated rather than replaced: the return type changes.

drop function if exists public.get_district_branding(text);

create function public.get_district_branding(host text)
returns table (
  id uuid,
  name text,
  app_name text,
  icon_url text,
  theme_color text,
  sso_domain text,
  status public.district_status,
  demo_mode boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_host text;
  v_slug text;
begin
  if host is null then
    return;
  end if;

  -- Strip port, lowercase, drop a trailing dot (fully-qualified form).
  v_host := lower(btrim(host));
  v_host := split_part(v_host, ':', 1);
  v_host := regexp_replace(v_host, '\.$', '');

  if v_host = '' then
    return;
  end if;

  -- 1. Custom domain, exact match, with or without a www. prefix.
  return query
    select d.id, d.name, d.app_name, d.icon_url, d.theme_color, d.sso_domain,
           d.status, d.demo_mode
    from public.districts d
    where d.custom_domain is not null
      and d.custom_domain in (v_host, regexp_replace(v_host, '^www\.', ''))
    limit 1;

  if found then
    return;
  end if;

  -- 2. Subdomain slug: {slug}.breezebox.com, {slug}.localhost, previews.
  if strpos(v_host, '.') = 0 then
    return;
  end if;

  v_slug := split_part(v_host, '.', 1);

  -- These are shell/platform hostnames, never a district.
  if v_slug in ('www', 'app', 'api', 'admin', 'auth', 'static', 'assets', 'cdn') then
    return;
  end if;

  return query
    select d.id, d.name, d.app_name, d.icon_url, d.theme_color, d.sso_domain,
           d.status, d.demo_mode
    from public.districts d
    where d.slug = v_slug
    limit 1;

  return;
end;
$$;

comment on function public.get_district_branding(text) is
  'Public branding for a hostname. The only anonymous read path into districts (§8).';

revoke all on function public.get_district_branding(text) from public;
grant execute on function public.get_district_branding(text)
  to anon, authenticated, service_role;
