-- Breeze Box :: Learning Cycle Check-In access rules
--
-- Proves the two things the tool prompt asks for by name:
--   a user in district A cannot see district B's rows
--   a site-level user cannot see another site's rows
--
-- plus the things that turned out to matter while writing the policies:
-- drafts, authorship, and the site_id self-reassignment hole.
--
-- Local stack only. Runs inside a transaction that rolls back.
--
--   pnpm --filter @breezebox/db test:lcc

\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_eq(label text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', label, got, want;
  end if;
  raise notice 'ok    %', label;
end;
$$;

-- Two error classes count as a denial here, and which one fires is a detail
-- of ordering rather than of intent: a BEFORE trigger runs ahead of the RLS
-- WITH CHECK, so a cross-district reference is caught as check_violation while
-- an out-of-reach one is caught as insufficient_privilege. Both mean refused.
create function pg_temp.assert_denied(label text, stmt text)
returns void language plpgsql as $$
declare v_denied boolean := false;
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege or check_violation then v_denied := true;
  end;
  if not v_denied then
    raise exception 'FAIL %: expected denial, but the statement succeeded', label;
  end if;
  raise notice 'ok    % (denied)', label;
end;
$$;

create function pg_temp.assert_rows_affected(label text, stmt text, want bigint)
returns void language plpgsql as $$
declare v_got bigint;
begin
  execute stmt;
  get diagnostics v_got = row_count;
  if v_got is distinct from want then
    raise exception 'FAIL %: % rows affected, want %', label, v_got, want;
  end if;
  raise notice 'ok    % (% rows)', label, v_got;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: district A with two sites, district B with one
-- ---------------------------------------------------------------------------

\set dA '''aa000000-0000-4000-8000-00000000000a'''
\set dB '''bb000000-0000-4000-8000-00000000000b'''
\set s1 '''11110000-0000-4000-8000-000000000001'''
\set s2 '''22220000-0000-4000-8000-000000000002'''
\set sB '''33330000-0000-4000-8000-000000000003'''

\set u_dir      '''d0000000-0000-4000-8000-00000000d001'''
\set u_prin1    '''d0000000-0000-4000-8000-00000000d002'''
\set u_prin2    '''d0000000-0000-4000-8000-00000000d003'''
\set u_new      '''d0000000-0000-4000-8000-00000000d004'''
\set u_bdir     '''d0000000-0000-4000-8000-00000000d005'''

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  (:u_dir,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'director@alpha.test',  now(), now()),
  (:u_prin1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'principal1@alpha.test', now(), now()),
  (:u_prin2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'principal2@alpha.test', now(), now()),
  (:u_new,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'newteacher@alpha.test', now(), now()),
  (:u_bdir,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'director@beta.test',   now(), now());

insert into public.districts (id, slug, name, app_name, sso_domain, status) values
  (:dA, 'lcc-alpha', 'Alpha USD', 'Alpha', 'alpha.test', 'active'),
  (:dB, 'lcc-beta',  'Beta USD',  'Beta',  'beta.test',  'active');

insert into public.sites (id, district_id, name, site_type) values
  (:s1, :dA, 'Riverside Elementary', 'elementary'),
  (:s2, :dA, 'Summit High',          'high'),
  (:sB, :dB, 'Beta Elementary',      'elementary');

insert into public.staff (district_id, auth_user_id, site_id, district_wide, name, email, role, created_via) values
  -- Senior director: no site, explicit district-wide reach.
  (:dA, :u_dir,   null, true,  'Alpha Director',   'director@alpha.test',   'staff', 'manual_entry'),
  -- Principals: bound to one site each.
  (:dA, :u_prin1, :s1,  false, 'Riverside Principal', 'principal1@alpha.test', 'staff', 'manual_entry'),
  (:dA, :u_prin2, :s2,  false, 'Summit Principal',    'principal2@alpha.test', 'staff', 'manual_entry'),
  -- Exactly what claim_staff_membership() creates on a first SSO login:
  -- no site, no reach. This row is the whole reason district_wide exists.
  (:dA, :u_new,   null, false, 'New Teacher',      'newteacher@alpha.test', 'staff', 'sso_first_login'),
  (:dB, :u_bdir,  null, true,  'Beta Director',    'director@beta.test',    'staff', 'manual_entry');

-- Submitted check-ins, one per site, authored by each site's principal.
insert into public.learning_cycle_checkins
  (district_id, site_id, created_by, checkin_date, cycle_number, stage,
   step_pick_level, submitted_at)
values
  (:dA, :s1, (select id from public.staff where email = 'principal1@alpha.test'),
   current_date, 1, 'in_the_middle', 'routine', now()),
  (:dA, :s2, (select id from public.staff where email = 'principal2@alpha.test'),
   current_date, 1, 'just_starting', 'not_yet', now()),
  (:dB, :sB, (select id from public.staff where email = 'director@beta.test'),
   current_date, 1, 'in_the_middle', 'happening', now());

-- A draft belonging to Riverside's principal.
insert into public.learning_cycle_checkins
  (district_id, site_id, created_by, checkin_date, submitted_at)
values
  (:dA, :s1, (select id from public.staff where email = 'principal1@alpha.test'),
   current_date, null);

-- ---------------------------------------------------------------------------
-- 1. Senior director: district-wide reach
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000d001","role":"authenticated","email":"director@alpha.test"}',
  true);

do $$
declare
  v_s1 uuid := '11110000-0000-4000-8000-000000000001';
  v_sB uuid := '33330000-0000-4000-8000-000000000003';
begin
  perform pg_temp.assert_eq('director sees both alpha sites, submitted only',
    (select count(*) from public.learning_cycle_checkins), 2);
  perform pg_temp.assert_eq('director cannot see beta rows',
    (select count(*) from public.learning_cycle_checkins where district_id
       = 'bb000000-0000-4000-8000-00000000000b'), 0);
  perform pg_temp.assert_eq('director cannot see another author''s draft',
    (select count(*) from public.learning_cycle_checkins where submitted_at is null), 0);

  perform pg_temp.assert_rows_affected('director can record at any site in reach',
    format('insert into public.learning_cycle_checkins
              (district_id, site_id, created_by, checkin_date, submitted_at)
            values (app.current_district_id(), %L, app.current_staff_id(),
                    current_date, now())', v_s1), 1);

  perform pg_temp.assert_denied('director cannot record against another district''s site',
    format('insert into public.learning_cycle_checkins
              (district_id, site_id, created_by, checkin_date)
            values (app.current_district_id(), %L, app.current_staff_id(), current_date)',
           v_sB));

  perform pg_temp.assert_denied('nobody can forge created_by',
    format('insert into public.learning_cycle_checkins
              (district_id, site_id, created_by, checkin_date)
            values (app.current_district_id(), %L,
                    (select id from public.staff where email = ''principal2@alpha.test''),
                    current_date)', v_s1));
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 2. Site-bound principal: one site only
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000d002","role":"authenticated","email":"principal1@alpha.test"}',
  true);

do $$
declare
  v_s2 uuid := '22220000-0000-4000-8000-000000000002';
begin
  -- Riverside has: one submitted, one own draft, plus the director's new one.
  perform pg_temp.assert_eq('principal sees only their own site',
    (select count(*) from public.learning_cycle_checkins
     where site_id <> '11110000-0000-4000-8000-000000000001'), 0);
  perform pg_temp.assert_eq('principal sees their own draft',
    (select count(*) from public.learning_cycle_checkins where submitted_at is null), 1);

  perform pg_temp.assert_denied('principal cannot record against another site',
    format('insert into public.learning_cycle_checkins
              (district_id, site_id, created_by, checkin_date)
            values (app.current_district_id(), %L, app.current_staff_id(), current_date)',
           v_s2));

  perform pg_temp.assert_rows_affected('principal cannot edit another site''s record',
    format('update public.learning_cycle_checkins set practice = ''tampered''
            where site_id = %L', v_s2), 0);

  -- The escalation this column closes: move yourself to the other school.
  perform pg_temp.assert_denied('principal cannot reassign their own site',
    format('update public.staff set site_id = %L where id = app.current_staff_id()', v_s2));
  perform pg_temp.assert_denied('principal cannot grant themselves district reach',
    'update public.staff set district_wide = true where id = app.current_staff_id()');
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. A brand new SSO user: no site, no reach, nothing
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000d004","role":"authenticated","email":"newteacher@alpha.test"}',
  true);

do $$
declare
  v_s1 uuid := '11110000-0000-4000-8000-000000000001';
begin
  -- The point of the whole design: a first login grants no reach at all.
  perform pg_temp.assert_eq('a new SSO user sees no check-ins',
    (select count(*) from public.learning_cycle_checkins), 0);
  perform pg_temp.assert_eq('...but is a normal member of the district',
    (select count(*) from public.districts), 1);
  perform pg_temp.assert_denied('a new SSO user cannot record anything',
    format('insert into public.learning_cycle_checkins
              (district_id, site_id, created_by, checkin_date)
            values (app.current_district_id(), %L, app.current_staff_id(), current_date)',
           v_s1));
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. The other district, from the other side
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000d005","role":"authenticated","email":"director@beta.test"}',
  true);

do $$
begin
  perform pg_temp.assert_eq('beta sees only its own row',
    (select count(*) from public.learning_cycle_checkins), 1);
  perform pg_temp.assert_eq('beta sees no alpha rows',
    (select count(*) from public.learning_cycle_checkins
     where district_id = 'aa000000-0000-4000-8000-00000000000a'), 0);
  perform pg_temp.assert_rows_affected('beta update of alpha rows is a no-op',
    'update public.learning_cycle_checkins set practice = ''tampered''
     where district_id = ''aa000000-0000-4000-8000-00000000000a''', 0);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 5. Anonymous
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  perform pg_temp.assert_denied('anon cannot read check-ins',
    'select count(*) from public.learning_cycle_checkins');
  perform pg_temp.assert_denied('anon cannot write check-ins',
    'delete from public.learning_cycle_checkins');
end;
$$;

reset role;

do $$ begin raise notice 'Learning Cycle Check-In access checks passed'; end; $$;

rollback;
