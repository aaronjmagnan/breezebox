-- Breeze Box :: RLS isolation check (backbone §3)
--
-- Proves the claim in §3: a user in one district cannot read or write another
-- district's rows, enforced at the database layer. This is the SQL half of the
-- manual test checklist item "a user in one district cannot read another
-- district's rows".
--
-- Local stack only. Everything runs inside a transaction that rolls back, so
-- it leaves no fixtures behind:
--
--   pnpm db:test
--
-- Any failure raises and aborts. Success ends with "RLS isolation checks passed".

\set ON_ERROR_STOP on

begin;

\set alpha_district '''a0000000-0000-4000-8000-000000000001'''
\set beta_district  '''b0000000-0000-4000-8000-000000000002'''
\set alpha_user     '''11111111-1111-4111-8111-111111111111'''
\set beta_user      '''22222222-2222-4222-8222-222222222222'''

-- ---------------------------------------------------------------------------
-- Assertion helpers (pg_temp, gone with the session)
-- ---------------------------------------------------------------------------

create function pg_temp.assert_eq(label text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', label, got, want;
  end if;
  raise notice 'ok    %', label;
end;
$$;

create function pg_temp.assert_denied(label text, stmt text)
returns void language plpgsql as $$
declare
  v_denied boolean := false;
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then
    raise exception 'FAIL %: expected denial, but the statement succeeded', label;
  end if;
  raise notice 'ok    % (denied)', label;
end;
$$;

create function pg_temp.assert_rows_affected(label text, stmt text, want bigint)
returns void language plpgsql as $$
declare
  v_got bigint;
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
-- Fixtures, as the table owner (RLS does not apply to the owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at)
values
  (:alpha_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'teacher@alpha.test',
   '{"provider":"google","providers":["google"]}'::jsonb,
   '{"full_name":"Alpha Teacher"}'::jsonb, now(), now()),
  (:beta_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'teacher@beta.test',
   '{"provider":"azure","providers":["azure"]}'::jsonb,
   '{"name":"Beta Teacher"}'::jsonb, now(), now()),
  -- Signed in with Google but has no staff row yet: the §5 first-login path.
  ('55555555-5555-4555-8555-555555555555',
   '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'newhire@alpha.test',
   '{"provider":"google","providers":["google"]}'::jsonb,
   '{"full_name":"New Hire"}'::jsonb, now(), now()),
  -- Signed in with a personal address that matches no district.
  ('44444444-4444-4444-8444-444444444444',
   '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'stranger@gmail.com',
   '{"provider":"google","providers":["google"]}'::jsonb,
   '{"full_name":"Stranger"}'::jsonb, now(), now());

insert into public.districts (id, slug, name, app_name, sso_domain, status)
values
  (:alpha_district, 'rls-alpha', 'Alpha USD', 'Alpha', 'alpha.test', 'active'),
  (:beta_district,  'rls-beta',  'Beta USD',  'Beta',  'beta.test',  'active');

insert into public.sites (district_id, name, site_type) values
  (:alpha_district, 'Alpha Elementary', 'elementary'),
  (:alpha_district, 'Alpha High',       'high'),
  (:beta_district,  'Beta Elementary',  'elementary');

insert into public.staff (district_id, auth_user_id, name, email, role, created_via) values
  (:alpha_district, :alpha_user, 'Alpha Teacher', 'teacher@alpha.test',
   'staff', 'sso_first_login'),
  (:beta_district,  :beta_user,  'Beta Teacher',  'teacher@beta.test',
   'staff', 'sso_first_login'),
  -- Pre-entered and not yet claimed: exercises the email-match branch of
  -- app.current_staff().
  (:alpha_district, null, 'Alpha Principal', 'principal@alpha.test',
   'district_admin', 'manual_entry');

insert into public.tool_instances (district_id, tool_type, tool_slug, name) values
  (:alpha_district, 'data', 'alpha-tool', 'Alpha Tool'),
  (:beta_district,  'data', 'beta-tool',  'Beta Tool');

insert into public.support_tickets (district_id, source, body, staff_id)
values (:beta_district, 'in_app', 'Beta ticket',
        (select id from public.staff where email = 'teacher@beta.test'));

insert into public.access_log (admin_user_id, district_id, accessed_table, reason, masked)
values (null, :beta_district, 'staff', 'isolation fixture', true);

-- ---------------------------------------------------------------------------
-- 1. Anonymous: nothing but branding
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  t text;
begin
  -- anon has no policy on any core table AND no table privilege, so these
  -- fail at the privilege check rather than quietly returning zero rows.
  foreach t in array array['districts', 'sites', 'staff', 'tool_instances',
                           'support_tickets', 'access_log']
  loop
    perform pg_temp.assert_denied(
      format('anon cannot read %s', t),
      format('select count(*) from public.%I', t));
    perform pg_temp.assert_denied(
      format('anon cannot write %s', t),
      format('delete from public.%I', t));
  end loop;

  -- ...but hostname branding still resolves, which is what lets the shell
  -- render before anyone signs in (§8).
  perform pg_temp.assert_eq('anon resolves branding by subdomain',
    (select count(*) from public.get_district_branding('rls-alpha.localhost:3000')), 1);
  -- 1 IN parameter (host) + the declared OUT columns. If anyone widens the
  -- function to return the whole districts row, this fails. Contract dates
  -- and the inactivity timeout must never appear here.
  perform pg_temp.assert_eq('branding exposes exactly eight public fields',
    (select cardinality(p.proargnames) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_district_branding'), 9);
  perform pg_temp.assert_eq('branding leaks no contract or billing fields',
    (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(p.proargnames) as arg
     where n.nspname = 'public' and p.proname = 'get_district_branding'
       and arg in ('contract_start_date', 'free_period_end_date',
                   'inactivity_timeout_minutes', 'custom_domain')), 0);
  perform pg_temp.assert_eq('unknown hostname resolves to nothing',
    (select count(*) from public.get_district_branding('nope.localhost:3000')), 0);
  perform pg_temp.assert_eq('reserved hostname resolves to nothing',
    (select count(*) from public.get_district_branding('www.breezebox.com')), 0);
  perform pg_temp.assert_eq('apex hostname resolves to nothing',
    (select count(*) from public.get_district_branding('breezebox.com')), 0);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 2. Alpha teacher, resolved via auth.uid()
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"teacher@alpha.test"}',
  true
);

do $$
declare
  v_alpha uuid := 'a0000000-0000-4000-8000-000000000001';
  v_beta  uuid := 'b0000000-0000-4000-8000-000000000002';
begin
  perform pg_temp.assert_eq('alpha sees exactly one district',
    (select count(*) from public.districts), 1);
  perform pg_temp.assert_eq('alpha sees its own district',
    (select count(*) from public.districts where id = v_alpha), 1);
  perform pg_temp.assert_eq('alpha cannot see beta district',
    (select count(*) from public.districts where id = v_beta), 0);

  perform pg_temp.assert_eq('alpha sees only alpha sites',
    (select count(*) from public.sites), 2);
  perform pg_temp.assert_eq('alpha sees only alpha staff',
    (select count(*) from public.staff), 2);
  perform pg_temp.assert_eq('alpha sees only alpha tools',
    (select count(*) from public.tool_instances), 1);
  perform pg_temp.assert_eq('alpha cannot see beta tickets',
    (select count(*) from public.support_tickets), 0);
  perform pg_temp.assert_eq('non-admin sees no access_log',
    (select count(*) from public.access_log), 0);

  -- Writes aimed at another district are refused outright.
  perform pg_temp.assert_denied('alpha cannot insert a site into beta',
    format('insert into public.sites (district_id, name, site_type)
            values (%L, ''Trojan Horse'', ''other'')', v_beta));
  perform pg_temp.assert_denied('alpha cannot insert a tool into beta',
    format('insert into public.tool_instances (district_id, tool_type, tool_slug, name)
            values (%L, ''data'', ''trojan'', ''Trojan'')', v_beta));
  perform pg_temp.assert_denied('alpha cannot file a ticket against beta',
    format('insert into public.support_tickets (district_id, source, body)
            values (%L, ''in_app'', ''nope'')', v_beta));
  perform pg_temp.assert_denied('nobody signed in can write access_log',
    format('insert into public.access_log (district_id, accessed_table, masked)
            values (%L, ''staff'', true)', v_alpha));

  -- A non-admin cannot create a site even in their own district.
  perform pg_temp.assert_denied('non-admin cannot insert a site',
    format('insert into public.sites (district_id, name, site_type)
            values (%L, ''Unauthorized'', ''other'')', v_alpha));

  -- Updates aimed at another district are a no-op rather than an error: the
  -- rows are simply not in scope.
  perform pg_temp.assert_rows_affected('alpha update of beta district is a no-op',
    format('update public.districts set name = ''Pwned'' where id = %L', v_beta), 0);
  perform pg_temp.assert_rows_affected('alpha update of beta sites is a no-op',
    format('update public.sites set name = ''Pwned'' where district_id = %L', v_beta), 0);
  perform pg_temp.assert_rows_affected('alpha delete of beta staff is a no-op',
    format('delete from public.staff where district_id = %L', v_beta), 0);

  -- The guard trigger rather than RLS: the row is in scope, the column is not.
  perform pg_temp.assert_denied('teacher cannot promote themselves',
    'update public.staff set role = ''district_admin''
       where id = app.current_staff_id()');
  perform pg_temp.assert_denied('teacher cannot move their row to another district',
    format('update public.staff set district_id = %L where id = app.current_staff_id()', v_beta));
  perform pg_temp.assert_denied('teacher cannot rewrite their email',
    'update public.staff set email = ''someone@beta.test''
       where id = app.current_staff_id()');

  -- What they should be able to do still works.
  perform pg_temp.assert_rows_affected('teacher can rename themselves',
    'update public.staff set name = ''Renamed'' where id = app.current_staff_id()', 1);
  perform pg_temp.assert_rows_affected('teacher can file their own ticket',
    format('insert into public.support_tickets (district_id, source, body, staff_id)
            values (%L, ''in_app'', ''printer jam'', app.current_staff_id())', v_alpha), 1);
  perform pg_temp.assert_eq('teacher sees their own ticket and no others',
    (select count(*) from public.support_tickets), 1);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. Alpha principal: unclaimed row, resolved via the JWT email
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","email":"Principal@Alpha.TEST"}',
  true
);

do $$
declare
  v_beta uuid := 'b0000000-0000-4000-8000-000000000002';
begin
  -- Matched on email despite the mixed-case claim and a sub with no staff row.
  perform pg_temp.assert_eq('unclaimed row resolves by email',
    (select count(*) from public.staff), 2);
  perform pg_temp.assert_eq('district admin still cannot see beta district',
    (select count(*) from public.districts where id = v_beta), 0);
  perform pg_temp.assert_eq('district admin sees no beta access_log rows',
    (select count(*) from public.access_log), 0);

  -- Admin powers stop at the district boundary.
  perform pg_temp.assert_rows_affected('district admin can add a site',
    'insert into public.sites (district_id, name, site_type)
       values (app.current_district_id(), ''New Annex'', ''other'')', 1);
  perform pg_temp.assert_rows_affected('district admin can rebrand their district',
    'update public.districts set app_name = ''Alpha Schools''
       where id = app.current_district_id()', 1);
  perform pg_temp.assert_denied('district admin cannot change their slug',
    'update public.districts set slug = ''hijacked'' where id = app.current_district_id()');
  perform pg_temp.assert_denied('district admin cannot change billing status',
    'update public.districts set status = ''paid'' where id = app.current_district_id()');
  perform pg_temp.assert_denied('district admin cannot change their sso_domain',
    'update public.districts set sso_domain = ''gmail.com''
       where id = app.current_district_id()');
  perform pg_temp.assert_denied('district admin cannot switch on demo mode',
    'update public.districts set demo_mode = true
       where id = app.current_district_id()');
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. Wrong-domain sign-in is refused by the database, not just the app (§5)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","email":"stranger@gmail.com"}',
  true
);

do $$
begin
  perform pg_temp.assert_denied('outside address cannot claim an alpha staff row',
    'select public.claim_staff_membership(''a0000000-0000-4000-8000-000000000001'')');
  perform pg_temp.assert_eq('rejected user resolves to no district',
    (select count(*) from public.districts), 0);
  perform pg_temp.assert_eq('rejected user resolves to no staff row',
    (select count(*) from public.staff), 0);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 5. Valid domain: first login provisions a staff row (§5)
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","email":"NewHire@Alpha.test","user_metadata":{"full_name":"New Hire"}}',
  true
);

do $$
declare
  v_alpha uuid := 'a0000000-0000-4000-8000-000000000001';
  v_staff public.staff;
begin
  -- Before claiming, this user resolves to no district at all.
  perform pg_temp.assert_eq('unprovisioned user sees no district',
    (select count(*) from public.districts), 0);

  v_staff := public.claim_staff_membership(v_alpha);

  if v_staff.created_via <> 'sso_first_login' then
    raise exception 'FAIL: created_via is %, want sso_first_login', v_staff.created_via;
  end if;
  raise notice 'ok    first login sets created_via = sso_first_login';

  if v_staff.email <> 'newhire@alpha.test' then
    raise exception 'FAIL: email is %, want it lowercased', v_staff.email;
  end if;
  raise notice 'ok    first login lowercases the email';

  if v_staff.name <> 'New Hire' then
    raise exception 'FAIL: name is %, want New Hire', v_staff.name;
  end if;
  raise notice 'ok    first login takes the name from the OAuth profile';

  if v_staff.role <> 'staff' then
    raise exception 'FAIL: new staff got role %, want staff', v_staff.role;
  end if;
  raise notice 'ok    first login grants the least-privileged role';

  -- Now in scope, and only for their own district.
  perform pg_temp.assert_eq('provisioned user sees their district',
    (select count(*) from public.districts), 1);
  perform pg_temp.assert_eq('provisioned user sees only alpha sites',
    (select count(*) from public.sites), 3);

  -- Claiming twice is idempotent, not a duplicate row.
  perform public.claim_staff_membership(v_alpha);
  perform pg_temp.assert_eq('claiming twice creates no second row',
    (select count(*) from public.staff where email = 'newhire@alpha.test'), 1);

  -- The guard bypass must not survive the claim call.
  perform pg_temp.assert_denied('guard is armed again after claiming',
    'update public.staff set role = ''district_admin''
       where id = app.current_staff_id()');

  -- A second district cannot be claimed by the same auth user.
  perform pg_temp.assert_denied('one auth user cannot claim two districts',
    'select public.claim_staff_membership(''b0000000-0000-4000-8000-000000000002'')');
end;
$$;

reset role;

do $$ begin raise notice 'RLS isolation checks passed'; end; $$;

rollback;
