-- Breeze Box :: 0015 learning_cycle_checkins
--
-- Data tool (§7) for the Learning Cycle Check-In. Senior directors record
-- where a school is in its learning cycle during principal coaching;
-- principals may record too.
--
-- Step 1 is a typed form. A later step adds photo capture of the paper
-- organizer that pre-fills this same record, which is why entry_method exists
-- from day one rather than being retrofitted.
--
-- §3: district_id on every row, RLS before any UI. §4: "which school" is
-- sites.id and "which person" is staff.id, never a local identifier.

create table public.learning_cycle_checkins (
  id uuid primary key default gen_random_uuid(),

  district_id uuid not null references public.districts (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete restrict,

  -- Nullable: the SSO-built staff list may not include this principal yet
  -- (§5 -- rows appear on first login, not from a roster upload).
  principal_staff_id uuid references public.staff (id) on delete set null,

  -- Set from the session by the RLS check, never from the form.
  created_by uuid not null references public.staff (id) on delete restrict,

  template_version text not null default 'LCC-v1',
  entry_method text not null default 'typed',

  checkin_date date not null,
  cycle_number smallint,
  stage text,

  practice text,
  student_need text,

  step_pick_level text,
  step_learn_level text,
  step_try_level text,
  step_see_level text,
  step_check_level text,

  step_pick_note text,
  step_learn_note text,
  step_try_note text,
  step_see_note text,
  step_check_note text,

  working text,
  barrier text,
  next_step text,
  district_support text,
  next_checkin_date date,

  -- Null means draft. Drafts are visible only to whoever is writing them.
  submitted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lcc_entry_method check (entry_method in ('typed', 'photo')),
  constraint lcc_cycle_number check (cycle_number is null or cycle_number between 1 and 4),
  constraint lcc_stage
    check (stage is null or stage in ('just_starting', 'in_the_middle', 'wrapping_up')),

  constraint lcc_step_pick_level
    check (step_pick_level is null or step_pick_level in ('not_yet', 'happening', 'routine')),
  constraint lcc_step_learn_level
    check (step_learn_level is null or step_learn_level in ('not_yet', 'happening', 'routine')),
  constraint lcc_step_try_level
    check (step_try_level is null or step_try_level in ('not_yet', 'happening', 'routine')),
  constraint lcc_step_see_level
    check (step_see_level is null or step_see_level in ('not_yet', 'happening', 'routine')),
  constraint lcc_step_check_level
    check (step_check_level is null or step_check_level in ('not_yet', 'happening', 'routine')),

  constraint lcc_template_version_not_blank check (length(btrim(template_version)) > 0)
);

create index lcc_district_site_idx
  on public.learning_cycle_checkins (district_id, site_id, checkin_date desc);
create index lcc_submitted_idx
  on public.learning_cycle_checkins (district_id, checkin_date desc)
  where submitted_at is not null;
create index lcc_drafts_idx
  on public.learning_cycle_checkins (created_by, updated_at desc)
  where submitted_at is null;
create index lcc_cycle_idx
  on public.learning_cycle_checkins (district_id, cycle_number)
  where submitted_at is not null;
create index lcc_principal_idx
  on public.learning_cycle_checkins (principal_staff_id)
  where principal_staff_id is not null;

create trigger lcc_set_updated_at
  before update on public.learning_cycle_checkins
  for each row execute function app.set_updated_at();

-- Every foreign row must belong to the same district as the check-in.
-- RLS scopes by district_id, so a mismatched site_id or principal would be a
-- row that reads as one district's but points at another's.
create or replace function app.assert_lcc_refs_in_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_district uuid;
begin
  select s.district_id into v_district from public.sites s where s.id = new.site_id;
  if v_district is distinct from new.district_id then
    raise exception 'site % does not belong to district %', new.site_id, new.district_id
      using errcode = 'check_violation';
  end if;

  if new.principal_staff_id is not null then
    select st.district_id into v_district
    from public.staff st where st.id = new.principal_staff_id;
    if v_district is distinct from new.district_id then
      raise exception 'principal % does not belong to district %',
        new.principal_staff_id, new.district_id
        using errcode = 'check_violation';
    end if;
  end if;

  select st.district_id into v_district
  from public.staff st where st.id = new.created_by;
  if v_district is distinct from new.district_id then
    raise exception 'created_by % does not belong to district %',
      new.created_by, new.district_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger lcc_assert_refs_in_district
  before insert or update of site_id, principal_staff_id, created_by, district_id
  on public.learning_cycle_checkins
  for each row execute function app.assert_lcc_refs_in_district();

comment on table public.learning_cycle_checkins is
  'Learning Cycle Check-In records (data tool, §7). One per coaching conversation.';
comment on column public.learning_cycle_checkins.submitted_at is
  'Null means draft. Drafts are readable only by their creator.';
comment on column public.learning_cycle_checkins.entry_method is
  'typed now; photo once the paper-capture step lands.';

-- ===========================================================================
-- RLS (§3) -- written before any UI exists
-- ===========================================================================

alter table public.learning_cycle_checkins enable row level security;

revoke all on public.learning_cycle_checkins from anon;

-- Read: own district, and a site you reach. A draft is half-formed thinking
-- about a named colleague's practice, so it stays with its author until it is
-- submitted.
create policy lcc_select
  on public.learning_cycle_checkins for select to authenticated
  using (
    district_id = app.current_district_id()
    and app.can_reach_site(site_id)
    and (submitted_at is not null or created_by = app.current_staff_id())
  );

-- Write: own district, a site you reach, and created_by is you. The form
-- cannot set an author.
create policy lcc_insert
  on public.learning_cycle_checkins for insert to authenticated
  with check (
    district_id = app.current_district_id()
    and app.can_reach_site(site_id)
    and created_by = app.current_staff_id()
  );

-- Edit: your own record at any time; anyone in reach may correct a submitted
-- one. Nobody may edit somebody else's unsubmitted draft.
create policy lcc_update
  on public.learning_cycle_checkins for update to authenticated
  using (
    district_id = app.current_district_id()
    and app.can_reach_site(site_id)
    and (created_by = app.current_staff_id() or submitted_at is not null)
  )
  with check (
    district_id = app.current_district_id()
    and app.can_reach_site(site_id)
  );

-- No delete policy: v1 does not delete from the app.

-- created_by and district_id are decided at insert and never moved afterwards.
revoke update on public.learning_cycle_checkins from authenticated;
grant update (
  site_id, principal_staff_id, template_version, entry_method, checkin_date,
  cycle_number, stage, practice, student_need,
  step_pick_level, step_learn_level, step_try_level, step_see_level, step_check_level,
  step_pick_note, step_learn_note, step_try_note, step_see_note, step_check_note,
  working, barrier, next_step, district_support, next_checkin_date, submitted_at
) on public.learning_cycle_checkins to authenticated;
