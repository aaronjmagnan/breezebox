-- Breeze Box :: 0001 private helper schema, shared enums, updated_at trigger
--
-- `app` is a private schema for helper functions used by RLS policies and
-- triggers. It is deliberately NOT in PostgREST's exposed schema list, so
-- nothing in here is reachable over the REST/GraphQL API.

create schema if not exists app;

comment on schema app is
  'Private helpers for RLS policies and triggers. Never exposed via PostgREST.';

revoke all on schema app from public;
grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Shared enums (backbone §4)
-- ---------------------------------------------------------------------------

-- §4: districts.status is active / expired / paid.
create type public.district_status as enum ('active', 'expired', 'paid');

create type public.site_type as enum (
  'elementary',
  'middle',
  'high',
  'combined',
  'district_office',
  'other'
);

-- §4 lists staff.role but not its values. These three are the minimum the
-- workflow-tool pattern in §7 needs.
create type public.staff_role as enum ('staff', 'site_admin', 'district_admin');

-- Not in §4. Added so an offboarded staff member can be denied sign-in
-- without deleting their historical rows.
create type public.staff_status as enum ('active', 'inactive');

-- §4: created_via is sso_first_login or manual_entry.
create type public.staff_created_via as enum ('sso_first_login', 'manual_entry');

-- §4 / §7: the three tool categories.
create type public.tool_type as enum ('data', 'workflow', 'impact');

-- §8 renders the district's *active* tool_instances.
create type public.tool_instance_status as enum ('active', 'disabled', 'coming_soon');

-- §6: the four accent colors. Used sparingly on a tile (icon, thin rule),
-- never as a background.
create type public.accent_color as enum ('blue', 'teal', 'amber', 'coral');

-- §9: single capture point, in-app widget or support email.
create type public.ticket_source as enum ('in_app', 'email');

create type public.ticket_status as enum (
  'open',
  'in_progress',
  'waiting_on_user',
  'resolved',
  'closed'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with now().';
