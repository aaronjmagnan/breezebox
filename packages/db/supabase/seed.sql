-- Breeze Box :: local seed
--
-- One test district ("demo") and two sites. Runs on `pnpm db:reset`.
-- Idempotent, so it is safe to re-run against an existing local database.
--
-- Reachable locally at http://demo.localhost:3000 (§8 hostname routing).
--
-- sso_domain below is a placeholder. To test real Google / Microsoft sign-in,
-- change it to a domain you actually have an account on, e.g.:
--   update public.districts set sso_domain = 'yourdomain.com' where slug = 'demo';

insert into public.districts (
  slug, name, app_name, icon_url, theme_color, sso_domain,
  contract_start_date, free_period_end_date, status, inactivity_timeout_minutes
)
values (
  'demo',
  'Demo Unified School District',
  'Demo USD',
  '/icons/district-default-512.png',
  '#4A7FB5',
  'demoschools.org',
  current_date,
  current_date + interval '90 days',
  'active',
  30
)
on conflict (slug) do update
  set name = excluded.name,
      app_name = excluded.app_name,
      icon_url = excluded.icon_url,
      theme_color = excluded.theme_color,
      sso_domain = excluded.sso_domain,
      status = excluded.status;

insert into public.sites (district_id, name, site_type, code)
select d.id, v.name, v.site_type, v.code
from public.districts d
cross join (values
  ('Riverside Elementary', 'elementary'::public.site_type, 'RIV'),
  ('Summit High School',   'high'::public.site_type,       'SUM')
) as v(name, site_type, code)
where d.slug = 'demo'
on conflict do nothing;

-- No tool_instances on purpose: a fresh district lands on the shell's empty
-- state (§8). Uncomment to see the tile grid once a tool exists.
--
-- insert into public.tool_instances (
--   district_id, tool_type, tool_slug, name, description, icon, accent, sort_order
-- )
-- select d.id, 'data', 'coaching-tracker', 'Coaching Tracker',
--        'Log and review instructional coaching visits.', 'clipboard', 'teal', 10
-- from public.districts d
-- where d.slug = 'demo'
-- on conflict (district_id, tool_slug) do nothing;

-- ---------------------------------------------------------------------------
-- Learning Cycle Check-In (data tool, §7)
-- ---------------------------------------------------------------------------

insert into public.tool_instances (
  district_id, tool_type, tool_slug, name, description, icon, accent, sort_order
)
select d.id, 'data', 'learning-cycles', 'Learning Cycle Check-In',
       'Where each school is in its learning cycle.', 'clipboard', 'teal', 10
from public.districts d
where d.slug = 'demo'
on conflict (district_id, tool_slug) do nothing;

-- A few check-ins, including one draft, so the list, chart and print view all
-- have something to show. created_by needs a staff row, so this only fills in
-- once someone has signed in; it is skipped cleanly on a fresh database.
insert into public.learning_cycle_checkins (
  district_id, site_id, created_by, checkin_date, cycle_number, stage,
  practice, student_need,
  step_pick_level, step_learn_level, step_try_level, step_see_level, step_check_level,
  step_pick_note, working, barrier, next_step, submitted_at
)
select d.id, s.id, st.id, v.dt, v.cycle, v.stage, v.practice, v.need,
       v.l1, v.l2, v.l3, v.l4, v.l5, v.note, v.working, v.barrier, v.next, v.submitted
from public.districts d
join public.sites s on s.district_id = d.id
join lateral (
  select id from public.staff where district_id = d.id order by created_at limit 1
) st on true
cross join lateral (values
  (current_date - 21, 1::smallint, 'in_the_middle',
   'Small-group reading instruction', 'Third graders below benchmark in fluency',
   'routine', 'routine', 'happening', 'happening', 'not_yet',
   'Chosen from the winter screener.',
   'Teachers are planning together every week.',
   'Coverage during small-group time.',
   'Try a shared schedule for two weeks.',
   now() - interval '21 days'),
  (current_date - 7, 2::smallint, 'just_starting',
   'Checking for understanding mid-lesson', 'Students not asking questions when stuck',
   'routine', 'happening', 'not_yet', 'not_yet', 'not_yet',
   'Picked after walkthroughs.',
   'Staff are curious about it.',
   'Not enough time to practise before observations.',
   'Run one practice session before the next visit.',
   now() - interval '7 days'),
  (current_date, null::smallint, null,
   null, null, null, null, null, null, null, null, null, null, null, null)
) as v(dt, cycle, stage, practice, need, l1, l2, l3, l4, l5, note, working, barrier, next, submitted)
where d.slug = 'demo'
  and s.name = case when v.cycle = 2 then 'Summit High School' else 'Riverside Elementary' end
on conflict do nothing;
