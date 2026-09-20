-- Breeze Box :: 0016 learning_cycle_checkin_revisions
--
-- Document control for check-ins.
--
-- A check-in records a named principal's practice, in the words of whoever was
-- coaching them. Until now a submitted one could be edited by anyone in reach
-- with no record of what it said before or who changed it. For notes about a
-- named person, that is the gap worth closing first.
--
-- WHY A TRIGGER AND NOT APPLICATION CODE
-- An audit trail written by the app is an audit trail with a back door: any
-- write through the SQL editor, the service role, or a future admin panel
-- would simply not appear. This fires on the table itself, so every path is
-- covered whether or not it knows the trail exists.
--
-- WHY IT STARTS AT SUBMIT
-- The form autosaves to the server roughly every 1.2 seconds while someone
-- types. Recording each of those would bury the handful of edits that matter
-- under hundreds of keystroke saves. A draft is working state; the record
-- becomes controlled when it is submitted, and from then on every change is
-- kept.

create table public.learning_cycle_checkin_revisions (
  id uuid primary key default gen_random_uuid(),

  checkin_id uuid not null
    references public.learning_cycle_checkins (id) on delete cascade,

  -- §3: every table carries district_id.
  district_id uuid not null references public.districts (id) on delete cascade,

  -- Denormalised so the RLS policy can check reach without a subquery onto a
  -- table that has its own policies. It is also the site as it was at the time
  -- of the change, which is what an audit trail should record.
  site_id uuid not null references public.sites (id) on delete restrict,

  -- Null when the change came from outside a signed-in session: a migration,
  -- the service role, someone in the SQL editor. Null is itself information.
  changed_by uuid references public.staff (id) on delete set null,
  changed_at timestamptz not null default now(),

  action text not null,

  /*
   * { "practice": { "from": "...", "to": "..." }, ... }
   *
   * Only the fields that moved. The full prior state is reconstructable from
   * the current row plus the revisions, and changed-fields-only is what you
   * can actually read: "Dana changed Practice and Next step".
   */
  changes jsonb not null default '{}'::jsonb,

  constraint lcc_rev_action check (action in ('submitted', 'edited')),
  constraint lcc_rev_changes_is_object check (jsonb_typeof(changes) = 'object')
);

create index lcc_rev_checkin_idx
  on public.learning_cycle_checkin_revisions (checkin_id, changed_at desc);
create index lcc_rev_district_idx
  on public.learning_cycle_checkin_revisions (district_id, changed_at desc);

comment on table public.learning_cycle_checkin_revisions is
  'Append-only history of submitted check-ins: who changed what, and when.';
comment on column public.learning_cycle_checkin_revisions.changed_by is
  'Null means the change did not come from a signed-in session.';

-- ---------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------

create or replace function app.record_lcc_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb := to_jsonb(new);
  v_changes jsonb := '{}'::jsonb;
  v_action text;
  v_key text;
begin
  -- Drafts are working state, not a document. Nothing is recorded until the
  -- moment of submission.
  if new.submitted_at is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    -- Submitted outright, without ever being a draft.
    v_action := 'submitted';
  elsif old.submitted_at is null then
    -- The draft became a document. This is the first controlled version.
    v_action := 'submitted';
  else
    v_action := 'edited';
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);

    for v_key in select jsonb_object_keys(v_new)
    loop
      -- updated_at moves on every write and says nothing a timestamp on the
      -- revision does not already say.
      continue when v_key = 'updated_at';

      if v_old -> v_key is distinct from v_new -> v_key then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key)
        );
      end if;
    end loop;

    -- An update that changed nothing anyone would notice is not a revision.
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.learning_cycle_checkin_revisions
    (checkin_id, district_id, site_id, changed_by, action, changes)
  values
    (new.id, new.district_id, new.site_id, app.current_staff_id(), v_action, v_changes);

  return null;
end;
$$;

comment on function app.record_lcc_revision() is
  'AFTER trigger: appends a revision for every change to a submitted check-in.';

create trigger lcc_record_revision
  after insert or update on public.learning_cycle_checkins
  for each row execute function app.record_lcc_revision();

-- ---------------------------------------------------------------------------
-- RLS (§3)
-- ---------------------------------------------------------------------------

alter table public.learning_cycle_checkin_revisions enable row level security;

revoke all on public.learning_cycle_checkin_revisions from anon;

-- Readable by whoever can reach the site the record belongs to: the same
-- people who can read the check-in itself.
create policy lcc_rev_select
  on public.learning_cycle_checkin_revisions for select to authenticated
  using (
    district_id = app.current_district_id()
    and app.can_reach_site(site_id)
  );

-- Append-only, and not by hand. The trigger runs as the table owner, so it
-- writes regardless; nobody signed in can add, alter or remove a revision.
-- Without this an edit could be covered up by editing its own history.
revoke insert, update, delete
  on public.learning_cycle_checkin_revisions from authenticated;
