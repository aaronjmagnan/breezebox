-- Breeze Box :: legal library access rules
--
-- The Ed Code Assistant reads from three tables that break §3's shape: their
-- district_id is nullable, and null means shared. That is a deliberate
-- exception (state law is one copy for everyone), and an exception to the
-- tenancy rule is exactly the kind of thing that turns into a leak, so it is
-- pinned down here:
--
--   shared rows reach everybody
--   a district's board policy reaches that district and nobody else
--   no authenticated user can write to any of the three tables
--   the denormalized district_id cannot be set, forged, or left behind
--   search and lookup, which are SECURITY INVOKER, obey all of the above
--
-- Local stack only. Runs inside a transaction that rolls back.
--
--   pnpm --filter @breezebox/db test:legal

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

create function pg_temp.assert_text(label text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', label, coalesce(got, '<null>'), want;
  end if;
  raise notice 'ok    %', label;
end;
$$;

-- insufficient_privilege is RLS or a missing grant; check_violation and
-- foreign_key_violation are the guard triggers, which run first. All three
-- mean the statement was refused, which is what these assertions are about.
create function pg_temp.assert_denied(label text, stmt text)
returns void language plpgsql as $$
declare v_denied boolean := false;
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege or check_violation or foreign_key_violation
      or unique_violation then v_denied := true;
  end;
  if not v_denied then
    raise exception 'FAIL %: expected denial, but the statement succeeded', label;
  end if;
  raise notice 'ok    % (denied)', label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

\set dA '''aa000000-0000-4000-8000-0000000000aa'''
\set dB '''bb000000-0000-4000-8000-0000000000bb'''
\set sA '''11110000-0000-4000-8000-0000000000a1'''
\set sB '''22220000-0000-4000-8000-0000000000b1'''

\set u_a '''d0000000-0000-4000-8000-00000000e001'''
\set u_b '''d0000000-0000-4000-8000-00000000e002'''

\set src_ec '''ec000000-0000-4000-8000-0000000000ec'''
\set src_pa '''fa000000-0000-4000-8000-0000000000fa'''
\set src_pb '''fb000000-0000-4000-8000-0000000000fb'''

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  (:u_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'reader@alpha.test', now(), now()),
  (:u_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'reader@beta.test', now(), now());

insert into public.districts (id, slug, name, app_name, sso_domain, status) values
  (:dA, 'legal-alpha', 'Alpha USD', 'Alpha', 'alpha.test', 'active'),
  (:dB, 'legal-beta',  'Beta USD',  'Beta',  'beta.test',  'active');

insert into public.sites (id, district_id, name, site_type) values
  (:sA, :dA, 'Alpha Elementary', 'elementary'),
  (:sB, :dB, 'Beta Elementary',  'elementary');

insert into public.staff
  (district_id, site_id, district_wide, auth_user_id, name, email, role, status, created_via)
values
  (:dA, :sA, true, :u_a, 'Alpha Reader', 'reader@alpha.test', 'district_admin', 'active', 'sso_first_login'),
  (:dB, :sB, true, :u_b, 'Beta Reader',  'reader@beta.test',  'district_admin', 'active', 'sso_first_login');

-- One shared corpus and one board policy manual per district.
insert into public.legal_sources (id, district_id, kind, slug, title, publisher, retrieved_at)
values
  (:src_ec, null, 'ed_code', 'ca-education-code', 'California Education Code',
   'California Legislative Information', now()),
  (:src_pa, :dA, 'board_policy', 'board-policy', 'Alpha USD Board Policy', 'Alpha USD', now()),
  (:src_pb, :dB, 'board_policy', 'board-policy', 'Beta USD Board Policy',  'Beta USD',  now());

insert into public.legal_documents
  (source_id, citation, citation_key, designation, title, breadcrumb, body, sort_key, content_hash)
values
  (:src_ec, 'EC 48900', 'ec48900', '48900', 'Grounds for suspension or expulsion',
   'Division 4 > Part 27 > Chapter 6 > Article 1',
   'A pupil shall not be suspended from school unless the superintendent finds '
   'that the pupil committed an act of tobacco possession or caused physical injury.',
   '048900.000', 'h1'),
  (:src_ec, 'EC 48260', 'ec48260', '48260', 'Truancy defined',
   'Division 4 > Part 27 > Chapter 2 > Article 1',
   'A pupil absent from school without a valid excuse three full days is a truant.',
   '048260.000', 'h2'),
  (:src_pa, 'BP 5144.1', 'bp5144.1', '5144.1', 'Suspension and Expulsion (Alpha)',
   'Series 5000 Students',
   'The Alpha Board authorizes the principal to suspend a student for tobacco possession.',
   '5144.100', 'h3'),
  (:src_pb, 'BP 5144.1', 'bp5144.1', '5144.1', 'Suspension and Expulsion (Beta)',
   'Series 5000 Students',
   'The Beta Board reserves suspension authority for tobacco possession to the superintendent.',
   '5144.100', 'h4');

insert into public.legal_chunks (document_id, source_id, chunk_index, citation, title, heading, content)
select d.id, d.source_id, 0, d.citation, d.title, d.breadcrumb, d.body
from public.legal_documents d;

-- ---------------------------------------------------------------------------
-- 1. Alpha's reader: shared plus their own, never Beta's
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000e001","role":"authenticated","email":"reader@alpha.test"}',
  true);

do $$
begin
  perform pg_temp.assert_eq('alpha sees the shared corpus and its own manual',
    (select count(*) from public.legal_sources), 2);
  perform pg_temp.assert_eq('alpha sees no beta source',
    (select count(*) from public.legal_sources where title like 'Beta%'), 0);

  perform pg_temp.assert_eq('alpha sees two shared sections and one own policy',
    (select count(*) from public.legal_documents), 3);
  perform pg_temp.assert_eq('alpha sees no beta policy document',
    (select count(*) from public.legal_documents where title like '%(Beta)'), 0);

  perform pg_temp.assert_eq('alpha sees three chunks',
    (select count(*) from public.legal_chunks), 3);
  perform pg_temp.assert_eq('alpha sees no beta chunk',
    (select count(*) from public.legal_chunks where content like 'The Beta%'), 0);
end;
$$;

-- The library is a read surface and nothing else. Loading it is service-role
-- work; an authenticated session must not be able to plant a statute.
do $$
begin
  perform pg_temp.assert_denied('alpha cannot add a source',
    'insert into public.legal_sources (kind, slug, title)
     values (''ed_code'', ''forged'', ''Forged Code'')');

  perform pg_temp.assert_denied('alpha cannot add a document',
    format('insert into public.legal_documents
              (source_id, citation, citation_key, title, body, content_hash)
            values (%L, ''EC 99999'', ''ec99999'', ''Forged'', ''Anything goes.'', ''x'')',
           'ec000000-0000-4000-8000-0000000000ec'));

  perform pg_temp.assert_denied('alpha cannot rewrite a section',
    'update public.legal_documents set body = ''Suspension is always allowed.''
     where citation_key = ''ec48900''');

  perform pg_temp.assert_denied('alpha cannot delete a section',
    'delete from public.legal_documents where citation_key = ''ec48900''');

  perform pg_temp.assert_denied('alpha cannot delete a chunk',
    'delete from public.legal_chunks');
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Search and lookup are SECURITY INVOKER, so the same walls apply
-- ---------------------------------------------------------------------------

do $$
declare v_top text;
begin
  perform pg_temp.assert_eq('search finds the shared section and alpha''s policy',
    (select count(*) from public.search_legal_chunks(array['tobacco possession'])), 2);

  perform pg_temp.assert_eq('search never reaches beta''s policy',
    (select count(*) from public.search_legal_chunks(array['tobacco possession'])
     where content like 'The Beta%'), 0);

  perform pg_temp.assert_eq('kind filter narrows to state law',
    (select count(*) from public.search_legal_chunks(
       array['tobacco possession'], array['ed_code']::public.legal_source_kind[])), 1);

  perform pg_temp.assert_eq('kind filter narrows to board policy',
    (select count(*) from public.search_legal_chunks(
       array['tobacco possession'], array['board_policy']::public.legal_source_kind[])), 1);

  -- Phrases are ORed, so an expansion that guesses wrong on one term still
  -- returns what the other term found.
  perform pg_temp.assert_eq('phrases are ORed, not ANDed',
    (select count(*) from public.search_legal_chunks(array['truant', 'tobacco'])), 3);

  -- The citation carries weight A. Someone typing a number wants that section
  -- at the top, not the section that happens to mention the word most.
  select citation into v_top
  from public.search_legal_chunks(array['48260']) order by rank desc limit 1;
  perform pg_temp.assert_text('a bare number ranks its own section first', v_top, 'EC 48260');

  -- Claude produces the terms. Garbage and stop words must come back empty
  -- rather than raising, or a bad expansion becomes a 500.
  perform pg_temp.assert_eq('empty terms return nothing',
    (select count(*) from public.search_legal_chunks(array[]::text[])), 0);
  perform pg_temp.assert_eq('null terms return nothing',
    (select count(*) from public.search_legal_chunks(null)), 0);
  perform pg_temp.assert_eq('stop words alone return nothing',
    (select count(*) from public.search_legal_chunks(array['the and of'])), 0);
  perform pg_temp.assert_eq('tsquery punctuation does not raise',
    (select count(*) from public.search_legal_chunks(array['!!! & | <-> ()'])), 0);
  perform pg_temp.assert_eq('a blank phrase is skipped',
    (select count(*) from public.search_legal_chunks(array['   ', 'truant'])), 1);

  perform pg_temp.assert_eq('limit is honoured',
    (select count(*) from public.search_legal_chunks(array['truant', 'tobacco'], null, 2)), 2);

  -- Lookup: the same section, however it was written down.
  perform pg_temp.assert_eq('lookup by bare number',
    (select count(*) from public.lookup_legal_documents(array['48900'])), 1);
  perform pg_temp.assert_eq('lookup by full citation',
    (select count(*) from public.lookup_legal_documents(array['EC 48900'])), 1);
  perform pg_temp.assert_eq('lookup is case and punctuation insensitive',
    (select count(*) from public.lookup_legal_documents(array['ec 48900.'])), 1);
  perform pg_temp.assert_eq('lookup of alpha''s own policy',
    (select count(*) from public.lookup_legal_documents(array['BP 5144.1'])), 1);
  perform pg_temp.assert_eq('lookup never crosses into beta',
    (select count(*) from public.lookup_legal_documents(array['BP 5144.1'])
     where body like 'The Beta%'), 0);
  perform pg_temp.assert_eq('lookup of an unknown citation is empty, not an error',
    (select count(*) from public.lookup_legal_documents(array['EC 00000'])), 0);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 3. Beta's reader: the mirror image
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d0000000-0000-4000-8000-00000000e002","role":"authenticated","email":"reader@beta.test"}',
  true);

do $$
begin
  perform pg_temp.assert_eq('beta sees the shared corpus and its own manual',
    (select count(*) from public.legal_sources), 2);
  perform pg_temp.assert_eq('beta sees no alpha policy',
    (select count(*) from public.legal_documents where title like '%(Alpha)'), 0);
  perform pg_temp.assert_eq('beta''s search returns beta''s wording',
    (select count(*) from public.search_legal_chunks(array['tobacco possession'])
     where content like 'The Beta%'), 1);
  perform pg_temp.assert_eq('the shared section reaches beta too',
    (select count(*) from public.lookup_legal_documents(array['48900'])), 1);
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. anon: no reach at all
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  perform pg_temp.assert_denied('anon cannot read sources',
    'select count(*) from public.legal_sources');
  perform pg_temp.assert_denied('anon cannot read documents',
    'select count(*) from public.legal_documents');
  perform pg_temp.assert_denied('anon cannot read chunks',
    'select count(*) from public.legal_chunks');
  perform pg_temp.assert_denied('anon cannot search',
    'select count(*) from public.search_legal_chunks(array[''tobacco''])');
  perform pg_temp.assert_denied('anon cannot look up a citation',
    'select count(*) from public.lookup_legal_documents(array[''48900''])');
end;
$$;

reset role;

-- ---------------------------------------------------------------------------
-- 5. The shape of the exception itself
-- ---------------------------------------------------------------------------
--
-- Everything below runs as the owner, the way the ingest CLI does with the
-- service role. RLS is not in play here; these are the constraints and
-- triggers that keep the nullable district_id honest even for a writer that
-- can bypass RLS entirely.

do $$
declare
  v_ec uuid := 'ec000000-0000-4000-8000-0000000000ec';
  v_pa uuid := 'fa000000-0000-4000-8000-0000000000fa';
  v_dA uuid := 'aa000000-0000-4000-8000-0000000000aa';
  v_dB uuid := 'bb000000-0000-4000-8000-0000000000bb';
  v_other uuid := 'cc000000-0000-4000-8000-0000000000cc';
  v_doc uuid;
  v_moved uuid;
  v_got uuid;
begin
  -- State law belongs to nobody; a policy manual belongs to somebody.
  perform pg_temp.assert_denied('ed_code cannot be owned by a district',
    format('insert into public.legal_sources (district_id, kind, slug, title)
            values (%L, ''ed_code'', ''owned-code'', ''Owned Code'')', v_dA));
  perform pg_temp.assert_denied('board_policy cannot be ownerless',
    'insert into public.legal_sources (kind, slug, title)
     values (''board_policy'', ''orphan-policy'', ''Orphan Policy'')');

  -- Slug uniqueness has to hold across the null, or two "the Education Code"
  -- rows appear and answers start citing whichever one the planner picked.
  perform pg_temp.assert_denied('a shared slug cannot be taken twice',
    'insert into public.legal_sources (kind, slug, title)
     values (''ed_code'', ''ca-education-code'', ''Second Copy'')');

  -- ...but two districts naming their manual the same thing is normal.
  insert into public.legal_sources (district_id, kind, slug, title)
  values (v_dB, 'board_policy', 'admin-regulations', 'Beta AR');
  raise notice 'ok    two districts may use the same slug';

  -- district_id on documents and chunks is derived, never supplied. Passing a
  -- deliberate lie must be overwritten, not accepted.
  insert into public.legal_documents
    (source_id, district_id, citation, citation_key, title, body, content_hash)
  values (v_ec, v_dB, 'EC 49050', 'ec49050', 'Searches', 'No employee shall conduct a search.', 'h9')
  returning id into v_doc;

  select district_id into v_got from public.legal_documents where id = v_doc;
  if v_got is not null then
    raise exception 'FAIL: a shared document kept a forged district_id (%)', v_got;
  end if;
  raise notice 'ok    a forged district_id on a shared document is discarded';

  insert into public.legal_chunks
    (document_id, source_id, district_id, chunk_index, citation, title, content)
  values (v_doc, v_ec, v_dB, 0, 'EC 49050', 'Searches', 'No employee shall conduct a search.');

  select district_id into v_got from public.legal_chunks where document_id = v_doc;
  if v_got is not null then
    raise exception 'FAIL: a shared chunk kept a forged district_id (%)', v_got;
  end if;
  raise notice 'ok    a forged district_id on a shared chunk is discarded';

  -- A chunk filed under one source but pointing at another source's document
  -- would be reachable by the wrong tenant's kind filter.
  perform pg_temp.assert_denied('a chunk cannot disagree with its document about the source',
    format('insert into public.legal_chunks
              (document_id, source_id, chunk_index, citation, title, content)
            values (%L, %L, 1, ''EC 49050'', ''Searches'', ''Mismatched.'')', v_doc, v_pa));

  -- Moving a source has to take its rows with it, or the denormalized copies
  -- become a cross-tenant leak. 'other' is the only kind the scope constraint
  -- lets move, which is exactly why it is the one tested.
  insert into public.legal_sources (id, district_id, kind, slug, title)
  values (v_other, v_dB, 'other', 'county-handbook', 'County Handbook');

  insert into public.legal_documents
    (source_id, citation, citation_key, title, body, content_hash)
  values (v_other, 'CH 1', 'ch1', 'Handbook part one', 'County guidance.', 'h10')
  returning id into v_moved;

  insert into public.legal_chunks
    (document_id, source_id, chunk_index, citation, title, content)
  values (v_moved, v_other, 0, 'CH 1', 'Handbook part one', 'County guidance.');

  perform pg_temp.assert_eq('a district-owned source stamps its rows',
    (select count(*) from public.legal_chunks
     where source_id = v_other and district_id = v_dB), 1);

  update public.legal_sources set district_id = v_dA where id = v_other;
  perform pg_temp.assert_eq('documents follow their source to a new district',
    (select count(*) from public.legal_documents
     where source_id = v_other and district_id is distinct from v_dA), 0);
  perform pg_temp.assert_eq('chunks follow their source to a new district',
    (select count(*) from public.legal_chunks
     where source_id = v_other and district_id is distinct from v_dA), 0);

  update public.legal_sources set district_id = null where id = v_other;
  perform pg_temp.assert_eq('and released when it becomes shared',
    (select count(*) from public.legal_chunks
     where source_id = v_other and district_id is not null), 0);

  -- The constraint is the other half of this: state law can never be moved
  -- under a district in the first place.
  perform pg_temp.assert_denied('the Education Code cannot be handed to a district',
    format('update public.legal_sources set district_id = %L where id = %L', v_dA, v_ec));

  -- Deleting a district takes its policy manual with it and leaves state law
  -- standing.
  delete from public.districts where id = v_dB;
  perform pg_temp.assert_eq('a deleted district takes its manual',
    (select count(*) from public.legal_sources where slug = 'board-policy'), 1);
  perform pg_temp.assert_eq('a deleted district leaves state law alone',
    (select count(*) from public.legal_sources where slug = 'ca-education-code'), 1);
  perform pg_temp.assert_eq('and its chunks',
    (select count(*) from public.legal_chunks where content like 'The Beta%'), 0);
end;
$$;

rollback;
