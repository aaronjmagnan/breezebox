-- Breeze Box :: 0012 claim_staff_membership (backbone §5)
--
-- Called once by /packages/auth right after OAuth returns, with the district
-- the hostname resolved to. It is the single trusted path that:
--   * re-checks the email domain against districts.sso_domain, so the §5 rule
--     holds even if the app-layer check is bypassed,
--   * claims a pre-entered staff row (created_via = 'manual_entry') by setting
--     auth_user_id,
--   * or creates the row on first login with created_via = 'sso_first_login',
--     which is how the staff list builds itself without a roster upload.
--
-- The app layer still does its own check and signs the user out with a clear
-- message; this is the backstop, and it is what actually stops a wrong-domain
-- user from ever getting a staff row -- and therefore a district.

create or replace function public.claim_staff_membership(p_district_id uuid)
returns public.staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_email text;
  v_email_domain text;
  v_name text;
  v_district public.districts;
  v_staff public.staff;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  v_email := lower(btrim(coalesce(v_claims ->> 'email', '')));
  if v_email = '' or strpos(v_email, '@') = 0 then
    raise exception 'sign-in provider returned no email address'
      using errcode = 'insufficient_privilege';
  end if;
  v_email_domain := split_part(v_email, '@', 2);

  select d.* into v_district
  from public.districts d
  where d.id = p_district_id;

  if not found then
    raise exception 'unknown district' using errcode = 'insufficient_privilege';
  end if;

  -- §5: sign-in is restricted to the district's verified email domain. A
  -- district with no sso_domain set is not open for sign-in yet.
  if v_district.sso_domain is null then
    raise exception 'district % is not configured for sign-in yet', v_district.slug
      using errcode = 'insufficient_privilege';
  end if;

  if v_email_domain <> lower(v_district.sso_domain) then
    raise exception 'email domain % is not allowed for this district', v_email_domain
      using errcode = 'insufficient_privilege',
            detail = format('expected @%s', v_district.sso_domain);
  end if;

  -- One district per signed-in user (§8 tradeoff, enforced by the unique index
  -- on staff.auth_user_id). Catch it here with a readable message.
  select s.* into v_staff
  from public.staff s
  where s.auth_user_id = v_uid;

  if found and v_staff.district_id <> p_district_id then
    raise exception 'this account is already linked to a different district'
      using errcode = 'insufficient_privilege';
  end if;

  if not found then
    select s.* into v_staff
    from public.staff s
    where s.district_id = p_district_id
      and s.email = v_email;
  end if;

  if found and v_staff.status = 'inactive' then
    raise exception 'this account has been deactivated for %', v_district.name
      using errcode = 'insufficient_privilege';
  end if;

  -- Best effort display name from the OAuth profile; Google sends full_name,
  -- Microsoft sends name. Fall back to the local part of the email.
  v_name := btrim(coalesce(
    nullif(btrim(v_claims -> 'user_metadata' ->> 'full_name'), ''),
    nullif(btrim(v_claims -> 'user_metadata' ->> 'name'), ''),
    split_part(v_email, '@', 1)
  ));

  -- Raise the guard bypass only around the writes below. Transaction-local.
  perform set_config('app.guard_bypass', 'on', true);

  if v_staff.id is null then
    insert into public.staff (
      district_id, name, email, role, status, created_via, auth_user_id, last_seen_at
    )
    values (
      p_district_id, v_name, v_email, 'staff', 'active', 'sso_first_login', v_uid, now()
    )
    returning * into v_staff;
  else
    update public.staff s
    set auth_user_id = v_uid,
        name = case when length(btrim(s.name)) = 0 then v_name else s.name end,
        last_seen_at = now()
    where s.id = v_staff.id
    returning * into v_staff;
  end if;

  perform set_config('app.guard_bypass', 'off', true);

  return v_staff;
exception
  when others then
    perform set_config('app.guard_bypass', 'off', true);
    raise;
end;
$$;

comment on function public.claim_staff_membership(uuid) is
  'Domain-checked first-login staff provisioning for the district a hostname resolved to (§5).';

revoke all on function public.claim_staff_membership(uuid) from public;
grant execute on function public.claim_staff_membership(uuid) to authenticated;

-- Heartbeat for the §11 inactivity timeout. Cheap, self-scoped, and the only
-- write a plain staff member makes to their own row on a normal request.
create or replace function public.touch_current_staff()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.staff s
  set last_seen_at = now()
  where s.id = app.current_staff_id();
$$;

revoke all on function public.touch_current_staff() from public;
grant execute on function public.touch_current_staff() to authenticated;
