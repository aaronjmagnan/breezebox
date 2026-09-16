-- Breeze Box :: 0006 support_tickets (backbone §4, §9)

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),

  -- §4: nullable if internal (a ticket not attributable to a district).
  district_id uuid references public.districts (id) on delete set null,

  source public.ticket_source not null default 'in_app',
  body text not null,
  status public.ticket_status not null default 'open',

  -- §9: a batch job clusters similar open tickets for a digest. Plain grouping
  -- key, no cluster table yet.
  cluster_id uuid,

  -- Not in §4. Who filed it, so the reporter can see their own ticket and so
  -- follow-up has somewhere to go. Nullable: email tickets have no staff row.
  staff_id uuid references public.staff (id) on delete set null,
  contact_email text,

  -- §9: the widget captures device type, installed vs. browser, and app
  -- version automatically, since most PWA bugs are device-specific.
  device_info jsonb not null default '{}'::jsonb,

  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint support_tickets_body_not_blank check (length(btrim(body)) > 0),
  constraint support_tickets_contact_email_lowercase
    check (contact_email is null or contact_email = lower(contact_email)),
  constraint support_tickets_device_info_is_object
    check (jsonb_typeof(device_info) = 'object'),

  -- An internal ticket (no district) can't be attributed to district staff.
  constraint support_tickets_staff_requires_district
    check (staff_id is null or district_id is not null)
);

create index support_tickets_district_status_idx
  on public.support_tickets (district_id, status, created_at desc);
create index support_tickets_cluster_id_idx
  on public.support_tickets (cluster_id) where cluster_id is not null;
create index support_tickets_staff_id_idx
  on public.support_tickets (staff_id) where staff_id is not null;

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function app.set_updated_at();

comment on table public.support_tickets is
  'Single capture point for in-app widget and support email (§9).';
comment on column public.support_tickets.district_id is
  'Null for internal tickets. Internal tickets are invisible to every district (§4).';

alter table public.support_tickets enable row level security;

revoke all on public.support_tickets from anon;
