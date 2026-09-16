-- Breeze Box :: 0010 get_district_branding (backbone §8, §11)
--
-- The shell must resolve a district from the hostname BEFORE anyone signs in,
-- to render the landing page and the PWA manifest. The districts table stays
-- closed to anon (no policy, privileges revoked). This function is the only
-- anonymous read path, and it returns branding fields only -- never contract
-- dates, never the row itself.
--
-- SECURITY DEFINER with search_path pinned to '', so a caller cannot shadow
-- `public` with their own districts table.

create or replace function public.get_district_branding(host text)
returns table (
  id uuid,
  name text,
  app_name text,
  icon_url text,
  theme_color text,
  sso_domain text,
  status public.district_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_host text;
  v_slug text;
begin
  if host is null then
    return;
  end if;

  -- Strip port, lowercase, drop a trailing dot (fully-qualified form).
  v_host := lower(btrim(host));
  v_host := split_part(v_host, ':', 1);
  v_host := regexp_replace(v_host, '\.$', '');

  if v_host = '' then
    return;
  end if;

  -- 1. Custom domain, exact match, with or without a www. prefix.
  return query
    select d.id, d.name, d.app_name, d.icon_url, d.theme_color, d.sso_domain, d.status
    from public.districts d
    where d.custom_domain is not null
      and d.custom_domain in (v_host, regexp_replace(v_host, '^www\.', ''))
    limit 1;

  if found then
    return;
  end if;

  -- 2. Subdomain slug: {slug}.breezebox.com, {slug}.localhost, previews.
  if strpos(v_host, '.') = 0 then
    return;
  end if;

  v_slug := split_part(v_host, '.', 1);

  -- These are shell/platform hostnames, never a district.
  if v_slug in ('www', 'app', 'api', 'admin', 'auth', 'static', 'assets', 'cdn') then
    return;
  end if;

  return query
    select d.id, d.name, d.app_name, d.icon_url, d.theme_color, d.sso_domain, d.status
    from public.districts d
    where d.slug = v_slug
    limit 1;

  return;
end;
$$;

comment on function public.get_district_branding(text) is
  'Public branding for a hostname. The only anonymous read path into districts (§8).';

revoke all on function public.get_district_branding(text) from public;
grant execute on function public.get_district_branding(text)
  to anon, authenticated, service_role;
