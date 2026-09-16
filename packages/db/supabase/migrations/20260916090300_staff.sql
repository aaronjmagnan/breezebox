-- Breeze Box :: 0004 staff (backbone §4, §5)
--
-- Any tool that means "which person" points at staff.id (§4). Rows are created
-- on first SSO login (created_via = 'sso_first_login'), which is how the staff
-- list builds itself without a district pre-uploading a roster (§5).

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,

  -- §4: nullable, since some staff aren't site-bound.
  site_id uuid references public.sites (id) on delete set null,

  -- Not in §4. The link to Supabase Auth. Null until the person's first
  -- sign-in, which is what lets a district pre-enter staff by email
  -- (created_via = 'manual_entry') and have that row claimed on first login.
  auth_user_id uuid references auth.users (id) on delete set null,

  name text not null,
  email text not null,

  role public.staff_role not null default 'staff',

  -- Not in §4. Lets a district offboard someone without deleting history.
  status public.staff_status not null default 'active',

  created_via public.staff_created_via not null default 'manual_entry',

  last_seen_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_email_lowercase check (email = lower(email)),
  constraint staff_email_format check (email ~ '^[^@[:space:]]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  constraint staff_name_not_blank check (length(btrim(name)) > 0)
);

create index staff_district_id_idx on public.staff (district_id);
create index staff_site_id_idx on public.staff (site_id) where site_id is not null;

create unique index staff_district_email_key on public.staff (district_id, email);

-- One district per signed-in user. This is what makes app.current_staff()
-- unambiguous, and it matches the §8 tradeoff: anyone working across
-- districts signs into each separately.
create unique index staff_auth_user_id_key
  on public.staff (auth_user_id)
  where auth_user_id is not null;

-- A staff member's site must belong to the same district as the staff row.
create or replace function app.assert_site_in_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_district uuid;
begin
  if new.site_id is null then
    return new;
  end if;

  select s.district_id into v_site_district
  from public.sites s
  where s.id = new.site_id;

  if v_site_district is distinct from new.district_id then
    raise exception 'site % does not belong to district %', new.site_id, new.district_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger staff_assert_site_in_district
  before insert or update of site_id, district_id on public.staff
  for each row execute function app.assert_site_in_district();

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function app.set_updated_at();

comment on table public.staff is
  'People in a district. Canonical "which person" (§4). Created on first SSO login (§5).';
comment on column public.staff.auth_user_id is
  'Supabase Auth user. Null until first sign-in claims the row.';

alter table public.staff enable row level security;

revoke all on public.staff from anon;
