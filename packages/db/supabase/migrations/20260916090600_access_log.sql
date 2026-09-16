-- Breeze Box :: 0007 access_log (backbone §4, §10)
--
-- This is the super-admin audit trail, not a general app event log. Every time
-- the admin panel looks at a district's real (unmasked) data it writes a row
-- here -- including the platform owner's own access (§10).
--
-- Districts never write to this table. It is append-only: no update or delete
-- policy exists, and those privileges are revoked outright below, so not even
-- a compromised authenticated session can rewrite the trail. Inserts come from
-- the admin app using the service role.

create table public.access_log (
  id bigint generated always as identity primary key,

  -- The super-admin who looked. Not a staff row: admins are not district staff.
  admin_user_id uuid references auth.users (id) on delete set null,

  -- The district whose data was accessed.
  district_id uuid references public.districts (id) on delete set null,

  accessed_table text not null,

  -- §10: viewing real data requires an explicit action and a stated reason.
  reason text,

  -- §10: admin views default to masked. false means real values were shown.
  masked boolean not null default true,

  -- §4 calls this "timestamp"; named occurred_at here because `timestamp` is a
  -- type name and reads badly in generated clients.
  occurred_at timestamptz not null default now(),

  constraint access_log_accessed_table_not_blank
    check (length(btrim(accessed_table)) > 0),

  -- Unmasked access must be justified.
  constraint access_log_unmasked_requires_reason
    check (masked or length(btrim(coalesce(reason, ''))) > 0)
);

create index access_log_district_occurred_idx
  on public.access_log (district_id, occurred_at desc);
create index access_log_admin_occurred_idx
  on public.access_log (admin_user_id, occurred_at desc);
create index access_log_unmasked_idx
  on public.access_log (occurred_at desc) where not masked;

comment on table public.access_log is
  'Append-only audit trail of super-admin access to district data (§10).';
comment on column public.access_log.masked is
  'true when only masked/de-identified values were shown. false requires a reason.';

alter table public.access_log enable row level security;

revoke all on public.access_log from anon;
revoke update, delete on public.access_log from authenticated;
