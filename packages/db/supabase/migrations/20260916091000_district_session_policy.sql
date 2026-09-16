-- Breeze Box :: 0011 per-district inactivity timeout (backbone §11 session safety)
--
-- "Auto sign-out after a period of inactivity (configurable per district,
-- default 30 minutes)." Deliberately NOT added to get_district_branding():
-- the timeout only matters once someone is signed in, and a signed-in user can
-- read their own district row under districts_select_own.

alter table public.districts
  add column inactivity_timeout_minutes integer not null default 30;

alter table public.districts
  add constraint districts_inactivity_timeout_range
    check (inactivity_timeout_minutes between 5 and 480);

comment on column public.districts.inactivity_timeout_minutes is
  'Minutes of inactivity before auto sign-out. Default 30, per-district (§11).';
