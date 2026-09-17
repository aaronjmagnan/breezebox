-- Breeze Box :: 0014 staff.district_wide
--
-- Data scope, kept separate from `role`.
--
-- `role` is about administrative power: who may edit sites, branding, and
-- other people's roles. `district_wide` is about reach: whether this person's
-- work covers one school or all of them. A senior director doing principal
-- coaching needs the second without the first.
--
-- Default false, deliberately. claim_staff_membership() creates staff rows on
-- first SSO login with site_id null, because §5's whole point is that the
-- staff list builds itself with no roster upload. If "no site" meant "sees
-- everything", every person who ever signed in would start with district-wide
-- reach, silently. So reach is granted, never inferred:
--
--   district_wide = true  -> every site in the district
--   site_id is set        -> that site only
--   neither               -> nothing, until someone assigns one

alter table public.staff
  add column district_wide boolean not null default false;

comment on column public.staff.district_wide is
  'Data reach across every site in the district. Granted explicitly; never inferred from a null site_id.';

create index staff_district_wide_idx
  on public.staff (district_id) where district_wide;

-- ---------------------------------------------------------------------------
-- Close a hole this column exposes
-- ---------------------------------------------------------------------------
-- Until now a staff member could edit their own site_id: it was neither
-- immutable nor admin-only, and staff_update_self_or_admin lets someone write
-- their own row. That was harmless while site_id was only a label. Now that it
-- decides which school's records you can read, self-service reassignment is a
-- privilege escalation: set site_id to another school, read its data.
--
-- site_id and district_wide both move to district-admin only.

create or replace function app.guard_staff_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.created_via = 'sso_first_login' then
      raise exception 'created_via sso_first_login is set by the sign-in flow only'
        using errcode = 'insufficient_privilege';
    end if;
    if new.auth_user_id is not null then
      raise exception 'auth_user_id is set by the sign-in flow only'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.district_id is distinct from old.district_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
     or new.created_via is distinct from old.created_via
  then
    raise exception 'district_id, auth_user_id, email and created_via are immutable here'
      using errcode = 'insufficient_privilege';
  end if;

  -- Anything that decides privilege or data reach is a district admin's call.
  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.site_id is distinct from old.site_id
      or new.district_wide is distinct from old.district_wide)
     and not app.is_district_admin()
  then
    raise exception
      'only a district admin can change staff role, status, site or district_wide'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scope helpers, for any tool that stores per-site records
-- ---------------------------------------------------------------------------

create or replace function app.current_site_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (app.current_staff()).site_id;
$$;

create or replace function app.is_district_wide()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((app.current_staff()).district_wide, false);
$$;

-- True when the caller may see records for this site. Null site, or a caller
-- with neither reach nor a site, is false rather than null: deny, not open.
create or replace function app.can_reach_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_site_id is not null
     and (app.is_district_wide() or p_site_id = app.current_site_id());
$$;

revoke all on function app.current_site_id() from public;
revoke all on function app.is_district_wide() from public;
revoke all on function app.can_reach_site(uuid) from public;

grant execute on function app.current_site_id() to authenticated;
grant execute on function app.is_district_wide() to authenticated;
grant execute on function app.can_reach_site(uuid) to authenticated;
