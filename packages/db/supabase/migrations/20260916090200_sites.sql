-- Breeze Box :: 0003 sites (backbone §4)
--
-- Any tool that means "which school" points at sites.id. Tools never invent
-- their own site identifier (§4).

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,

  name text not null,
  site_type public.site_type not null default 'other',

  -- Not in §4. The district's own code for the school (state/SIS code);
  -- districts ask for it constantly on exports.
  code text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sites_name_not_blank check (length(btrim(name)) > 0)
);

create index sites_district_id_idx on public.sites (district_id);
create unique index sites_district_name_key
  on public.sites (district_id, lower(btrim(name)));
create unique index sites_district_code_key
  on public.sites (district_id, lower(code))
  where code is not null;

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function app.set_updated_at();

comment on table public.sites is
  'Schools and other buildings within a district. Canonical "which school" (§4).';

alter table public.sites enable row level security;

revoke all on public.sites from anon;
