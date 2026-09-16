-- Breeze Box :: 0005 tool_instances (backbone §4, §8)
--
-- One row per tool turned on for a district. The shell renders a tile per
-- active row, linking to /{tool_slug} on the same origin (§8).

create table public.tool_instances (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts (id) on delete cascade,

  tool_type public.tool_type not null,
  tool_slug text not null,
  status public.tool_instance_status not null default 'active',

  -- Not in §4. §8 says the shell renders a tile per tool; a tile needs a
  -- label. Kept per-instance so a district can rename a tool locally.
  name text not null,
  description text,

  -- Icon name from the shared icon set in /packages/ui, not a URL.
  icon text,

  -- §6: one of the four accents, used sparingly on the tile.
  accent public.accent_color not null default 'blue',

  sort_order integer not null default 0,

  -- Per-district tool configuration (the tool's own template config).
  config jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tool_instances_slug_lowercase check (tool_slug = lower(tool_slug)),
  constraint tool_instances_slug_format
    check (tool_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$'),

  -- Shell-owned paths can never be taken by a tool zone (§8).
  constraint tool_instances_slug_not_reserved
    check (tool_slug not in (
      'api', 'auth', 'manifest', 'sw', 'offline', 'icons', 'assets',
      'static', '_next', 'signin', 'sign-in', 'signout', 'sign-out', 'support'
    )),

  constraint tool_instances_name_not_blank check (length(btrim(name)) > 0),
  constraint tool_instances_config_is_object check (jsonb_typeof(config) = 'object')
);

create index tool_instances_district_id_idx on public.tool_instances (district_id);
create unique index tool_instances_district_slug_key
  on public.tool_instances (district_id, tool_slug);
create index tool_instances_district_active_idx
  on public.tool_instances (district_id, sort_order)
  where status = 'active';

create trigger tool_instances_set_updated_at
  before update on public.tool_instances
  for each row execute function app.set_updated_at();

comment on table public.tool_instances is
  'Tools enabled for a district. Drives the shell tile grid (§8).';
comment on column public.tool_instances.tool_slug is
  'Path segment under the district origin: /{tool_slug}. Also the multi-zone rewrite key (§2).';

alter table public.tool_instances enable row level security;

revoke all on public.tool_instances from anon;
