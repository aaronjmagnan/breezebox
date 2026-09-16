-- Breeze Box :: 0008 RLS helpers (backbone §3)
--
-- These resolve the signed-in user to exactly one staff row, and from there to
-- exactly one district. Every policy in 0009 is written in terms of them.
--
-- They are SECURITY DEFINER so they can read public.staff without tripping
-- that table's own RLS -- which is what stops the policies from recursing.
-- For the same reason public.staff must NEVER get `force row level security`:
-- the table owner would then be subject to its own policies and every lookup
-- here would recurse.
--
-- search_path is pinned to '' so a caller cannot shadow `public` or `auth`
-- with their own objects; every reference below is schema-qualified.

-- Resolve the current staff row: by auth_user_id when the row has been
-- claimed, otherwise by the verified email on the JWT. The email path is what
-- lets a district pre-enter staff (created_via = 'manual_entry') and have
-- those rows work on the person's very first request.
create or replace function app.current_staff()
returns public.staff
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.staff s
  where s.status = 'active'
    and (
      (auth.uid() is not null and s.auth_user_id = auth.uid())
      or (
        s.auth_user_id is null
        and nullif(auth.jwt() ->> 'email', '') is not null
        and s.email = lower(auth.jwt() ->> 'email')
      )
    )
  -- Prefer the claimed row if both paths somehow match.
  order by (s.auth_user_id is not null) desc, s.created_at asc
  limit 1;
$$;

comment on function app.current_staff() is
  'The signed-in user''s staff row, matched on auth.uid() or verified JWT email.';

create or replace function app.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (app.current_staff()).id;
$$;

-- The tenant boundary. Null when the caller has no active staff row, and
-- every policy compares with `=`, so a null here denies rather than opens.
create or replace function app.current_district_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (app.current_staff()).district_id;
$$;

comment on function app.current_district_id() is
  'The signed-in user''s district. Null (therefore deny) when no active staff row exists.';

create or replace function app.is_district_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((app.current_staff()).role = 'district_admin', false);
$$;

-- Site admins and district admins. Used where a site lead legitimately needs a
-- wider view than a classroom teacher.
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (app.current_staff()).role in ('site_admin', 'district_admin'),
    false
  );
$$;

revoke all on function app.current_staff() from public;
revoke all on function app.current_staff_id() from public;
revoke all on function app.current_district_id() from public;
revoke all on function app.is_district_admin() from public;
revoke all on function app.is_admin() from public;

grant execute on function app.current_staff() to authenticated;
grant execute on function app.current_staff_id() to authenticated;
grant execute on function app.current_district_id() to authenticated;
grant execute on function app.is_district_admin() to authenticated;
grant execute on function app.is_admin() to authenticated;
