-- Breeze Box :: 0002 districts (backbone §4, §8)

create table public.districts (
  id uuid primary key default gen_random_uuid(),

  -- §8: {slug}.breezebox.com
  slug text not null,

  name text not null,

  -- §8: a district may later map its own domain, e.g. leaders.sampleusd.org
  custom_domain text,

  -- §11: installed app label; drives manifest name / short_name
  app_name text not null,
  icon_url text,
  theme_color text not null default '#4A7FB5',

  -- §5: sign-in is restricted to this verified email domain
  sso_domain text,

  contract_start_date date,
  free_period_end_date date,

  status public.district_status not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint districts_slug_lowercase check (slug = lower(slug)),
  constraint districts_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$'),

  -- Reserved hostnames that must never resolve to a district.
  constraint districts_slug_not_reserved
    check (slug not in ('www', 'app', 'api', 'admin', 'auth', 'static', 'assets', 'cdn')),

  constraint districts_custom_domain_lowercase
    check (custom_domain is null or custom_domain = lower(custom_domain)),
  constraint districts_custom_domain_format
    check (custom_domain is null or custom_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),

  constraint districts_theme_color_hex check (theme_color ~ '^#[0-9a-fA-F]{6}$'),

  -- Stored bare and lowercase, e.g. 'sampleusd.org' (no @, no scheme).
  constraint districts_sso_domain_format
    check (sso_domain is null or sso_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$')
);

create unique index districts_slug_key on public.districts (slug);
create unique index districts_custom_domain_key
  on public.districts (custom_domain)
  where custom_domain is not null;

create trigger districts_set_updated_at
  before update on public.districts
  for each row execute function app.set_updated_at();

comment on table public.districts is
  'One row per district tenant. Every other table scopes to one of these (§3).';
comment on column public.districts.slug is
  'Subdomain label: {slug}.breezebox.com (§8).';
comment on column public.districts.sso_domain is
  'Verified email domain for SSO, bare and lowercase, e.g. sampleusd.org (§5).';
comment on column public.districts.app_name is
  'Installed-app label; becomes manifest name and short_name (§11).';

-- RLS on from birth. Policies land in 0008; until then this table denies
-- everything to anon and authenticated. Branding for the pre-sign-in shell
-- comes from public.get_district_branding() in 0009, never from open reads.
alter table public.districts enable row level security;

revoke all on public.districts from anon;
