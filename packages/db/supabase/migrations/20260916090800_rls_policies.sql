-- Breeze Box :: 0009 RLS policies for every core table (backbone §3)
--
-- The rule from §3: a user can never see another district's rows, enforced at
-- the database layer. Every policy below is `to authenticated` and pivots on
-- app.current_district_id(), which is null when the caller has no active staff
-- row -- and `district_id = null` is null, not true, so the default is deny.
--
-- anon has no policy on any table and its table privileges were revoked in the
-- table migrations. Pre-sign-in branding comes from get_district_branding()
-- (0010), which is the only anonymous read path into districts.
--
-- Row-level scoping is not enough on its own: two BEFORE UPDATE guards below
-- stop an authenticated user from editing columns their row-level access would
-- otherwise let through (self-promotion to district_admin, moving a staff row
-- to another district, flipping a district's billing status).

-- ===========================================================================
-- Write guards (column-level protection that RLS alone cannot express)
-- ===========================================================================

-- True only for a real end-user request that the guards should police.
--
-- Two things are deliberately not policed:
--   * Service-role calls and direct SQL (migrations, seeds, the admin app)
--     carry no `sub`, so auth.uid() is null and the guards stand aside.
--   * public.claim_staff_membership() (0012) sets app.guard_bypass for the
--     duration of its transaction. It is the one trusted path that must write
--     auth_user_id and created_via = 'sso_first_login', and it re-checks the
--     email domain itself before it does. The flag is transaction-local and
--     there is no way to set a GUC through PostgREST, so a signed-in client
--     cannot raise it on its own.
create or replace function app.is_end_user_request()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and coalesce(current_setting('app.guard_bypass', true), 'off') <> 'on';
$$;

revoke all on function app.is_end_user_request() from public;
grant execute on function app.is_end_user_request() to authenticated;

create or replace function app.guard_district_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_end_user_request() then
    return new;
  end if;

  -- Identity, tenancy and billing belong to the super-admin panel (§10).
  if new.id is distinct from old.id
     or new.slug is distinct from old.slug
     or new.custom_domain is distinct from old.custom_domain
     or new.sso_domain is distinct from old.sso_domain
     or new.status is distinct from old.status
     or new.contract_start_date is distinct from old.contract_start_date
     or new.free_period_end_date is distinct from old.free_period_end_date
  then
    raise exception
      'slug, custom_domain, sso_domain, status and contract dates are managed by Breeze Box admin'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger districts_guard_update
  before update on public.districts
  for each row execute function app.guard_district_update();

create or replace function app.guard_staff_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Only the SSO claim path (0011) may set created_via = 'sso_first_login'.
    if new.created_via = 'sso_first_login' then
      raise exception 'created_via sso_first_login is set by the sign-in flow only'
        using errcode = 'insufficient_privilege';
    end if;
    -- An invited row is claimed at sign-in, never pre-linked by hand.
    if new.auth_user_id is not null then
      raise exception 'auth_user_id is set by the sign-in flow only'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- UPDATE. Nobody signed in may move a staff row between districts, relink it
  -- to a different auth user, rewrite its email, or rewrite its provenance.
  if new.district_id is distinct from old.district_id
     or new.auth_user_id is distinct from old.auth_user_id
     or new.email is distinct from old.email
     or new.created_via is distinct from old.created_via
  then
    raise exception 'district_id, auth_user_id, email and created_via are immutable here'
      using errcode = 'insufficient_privilege';
  end if;

  -- Privilege and access changes are district-admin only. Without this a
  -- teacher could edit their own row and become a district_admin.
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not app.is_district_admin()
  then
    raise exception 'only a district admin can change staff role or status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger staff_guard_write
  before insert or update on public.staff
  for each row execute function app.guard_staff_write();

-- ===========================================================================
-- districts
-- ===========================================================================

create policy districts_select_own
  on public.districts for select to authenticated
  using (id = app.current_district_id());

-- Branding self-service. The guard above narrows this to name, app_name,
-- icon_url, theme_color and the inactivity timeout.
create policy districts_update_own
  on public.districts for update to authenticated
  using (id = app.current_district_id() and app.is_district_admin())
  with check (id = app.current_district_id());

-- No insert or delete policy: districts are created by the admin panel (§10)
-- using the service role.

-- ===========================================================================
-- sites
-- ===========================================================================

create policy sites_select_own_district
  on public.sites for select to authenticated
  using (district_id = app.current_district_id());

create policy sites_insert_own_district
  on public.sites for insert to authenticated
  with check (district_id = app.current_district_id() and app.is_district_admin());

create policy sites_update_own_district
  on public.sites for update to authenticated
  using (district_id = app.current_district_id() and app.is_district_admin())
  with check (district_id = app.current_district_id());

create policy sites_delete_own_district
  on public.sites for delete to authenticated
  using (district_id = app.current_district_id() and app.is_district_admin());

-- ===========================================================================
-- staff
-- ===========================================================================

-- A district's staff directory is visible district-wide: tools assign work to
-- colleagues and need to name them.
create policy staff_select_own_district
  on public.staff for select to authenticated
  using (district_id = app.current_district_id());

create policy staff_insert_own_district
  on public.staff for insert to authenticated
  with check (district_id = app.current_district_id() and app.is_district_admin());

-- Your own row, or anyone's row if you're a district admin. The guard trigger
-- decides which columns actually move.
create policy staff_update_self_or_admin
  on public.staff for update to authenticated
  using (
    district_id = app.current_district_id()
    and (id = app.current_staff_id() or app.is_district_admin())
  )
  with check (district_id = app.current_district_id());

-- Admins cannot delete themselves out of their own district.
create policy staff_delete_own_district
  on public.staff for delete to authenticated
  using (
    district_id = app.current_district_id()
    and app.is_district_admin()
    and id <> app.current_staff_id()
  );

-- ===========================================================================
-- tool_instances
-- ===========================================================================

-- Everyone in the district can read every instance, including disabled ones;
-- the shell filters to status = 'active' for the tile grid (§8).
create policy tool_instances_select_own_district
  on public.tool_instances for select to authenticated
  using (district_id = app.current_district_id());

create policy tool_instances_insert_own_district
  on public.tool_instances for insert to authenticated
  with check (district_id = app.current_district_id() and app.is_district_admin());

create policy tool_instances_update_own_district
  on public.tool_instances for update to authenticated
  using (district_id = app.current_district_id() and app.is_district_admin())
  with check (district_id = app.current_district_id());

create policy tool_instances_delete_own_district
  on public.tool_instances for delete to authenticated
  using (district_id = app.current_district_id() and app.is_district_admin());

-- ===========================================================================
-- support_tickets
-- ===========================================================================
-- district_id is nullable (§4: null for internal tickets). `null = uuid` is
-- null, so internal tickets match no district policy and stay invisible.

create policy support_tickets_select_own
  on public.support_tickets for select to authenticated
  using (
    district_id = app.current_district_id()
    and (app.is_admin() or staff_id = app.current_staff_id())
  );

-- A signed-in user files for themselves, in their own district, from the
-- in-app widget. Email-sourced tickets are ingested with the service role.
create policy support_tickets_insert_own
  on public.support_tickets for insert to authenticated
  with check (
    district_id = app.current_district_id()
    and staff_id = app.current_staff_id()
    and source = 'in_app'
  );

create policy support_tickets_update_own
  on public.support_tickets for update to authenticated
  using (
    district_id = app.current_district_id()
    and (
      app.is_district_admin()
      or (staff_id = app.current_staff_id() and status in ('open', 'waiting_on_user'))
    )
  )
  with check (district_id = app.current_district_id());

-- Column grants keep an update from re-homing a ticket or forging its source
-- or cluster, without needing a third trigger.
revoke update on public.support_tickets from authenticated;
grant update (body, status, device_info, contact_email)
  on public.support_tickets to authenticated;

-- No delete policy: tickets are the support record.

-- ===========================================================================
-- access_log
-- ===========================================================================
-- Append-only, written by the admin panel with the service role (§10).
-- Districts get read-only visibility into access against their own district,
-- which is the point of keeping the trail. Nobody signed in can write it.

create policy access_log_select_own_district
  on public.access_log for select to authenticated
  using (
    district_id = app.current_district_id()
    and app.is_district_admin()
  );

revoke insert, update, delete on public.access_log from authenticated;
