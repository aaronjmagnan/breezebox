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
