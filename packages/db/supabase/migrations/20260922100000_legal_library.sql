-- Breeze Box :: 0017 legal library (Ed Code Assistant)
--
-- The corpus the Ed Code Assistant answers from. Three tables:
--
--   legal_sources    a body of text kept as a unit (the Education Code; one
--                    district's board policy manual)
--   legal_documents  one addressable piece of it (a section; a policy)
--   legal_chunks     the retrieval unit, with the full-text index on it
--
-- §3 EXCEPTION, STATED ON PURPOSE
-- ------------------------------
-- §3 says every table carries district_id and an RLS policy on day one. These
-- carry district_id, but it is NULLABLE, and null means "shared, belongs to
-- no district". The Education Code is state law: one copy serves every
-- district, and copying it per district would mean re-ingesting 30,000
-- sections per customer and letting the copies drift.
--
-- The tenancy rule is therefore not "district_id = mine" but:
--
--     district_id is null OR district_id = mine
--
-- and it is written that way in every policy below. Board policy, which IS
-- district property, must have a district_id: the check constraint on
-- legal_sources refuses a board_policy source without one, and a trigger
-- copies the source's district_id down to documents and chunks so the three
-- tables can never disagree about who owns a row.
--
-- WRITES
-- ------
-- Nobody writes here through the app. There are no insert, update or delete
-- policies, so only the service role (used by the ingest CLI, run from a
-- laptop) can load a corpus. An authenticated user can read and nothing else.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.legal_source_kind as enum ('ed_code', 'board_policy', 'other');
create type public.legal_source_status as enum ('active', 'archived');

-- ---------------------------------------------------------------------------
-- legal_sources
-- ---------------------------------------------------------------------------

create table public.legal_sources (
  id uuid primary key default gen_random_uuid(),

  -- Null means shared across every district (see the §3 note above).
  district_id uuid references public.districts (id) on delete cascade,

  kind public.legal_source_kind not null,

  -- Stable handle used by the ingest CLI to re-load a corpus in place.
  slug text not null,
  title text not null,

  -- Who published it, and where a reader can check the original. Both end up
  -- in the answer's citation list, so an answer can always be verified.
  publisher text,
  home_url text,

  status public.legal_source_status not null default 'active',

  -- When the ingest CLI last read the publisher. Shown to the user, because a
  -- statute answer is only as current as the copy it came from.
  retrieved_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_sources_slug_format
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$'),
  constraint legal_sources_title_not_blank check (length(btrim(title)) > 0),

  -- State law is shared; a district's policy manual is not. 'other' is left
  -- open for whatever comes next (a county office handbook, say).
  constraint legal_sources_scope check (
    (kind = 'ed_code' and district_id is null)
    or (kind = 'board_policy' and district_id is not null)
    or kind = 'other'
  )
);

-- Two partial indexes rather than one over coalesce(): a null district_id is
-- not "some district", and unique(district_id, slug) would let the same shared
-- slug be inserted twice.
create unique index legal_sources_shared_slug_key
  on public.legal_sources (slug) where district_id is null;
create unique index legal_sources_district_slug_key
  on public.legal_sources (district_id, slug) where district_id is not null;

create index legal_sources_district_idx on public.legal_sources (district_id);

create trigger legal_sources_set_updated_at
  before update on public.legal_sources
  for each row execute function app.set_updated_at();

comment on table public.legal_sources is
  'A body of legal text kept as a unit. district_id null means shared statewide.';
comment on column public.legal_sources.district_id is
  'Null = shared across districts (the Education Code). Set = that district owns it.';

-- ---------------------------------------------------------------------------
-- legal_documents
-- ---------------------------------------------------------------------------

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null references public.legal_sources (id) on delete cascade,

  -- Mirrored from the source by a trigger, never set by the caller. Denormalized
  -- so the RLS policy on this table is a single-table predicate.
  district_id uuid references public.districts (id) on delete cascade,

  -- What a person would write down: 'EC 48900', 'BP 5144.1'.
  citation text not null,
  -- Punctuation and case removed, for exact lookup: 'ec48900'.
  citation_key text not null,
  -- The number alone: '48900', '5144.1'.
  designation text,

  title text not null,
  -- Where it sits: 'Division 4 > Part 27 > Chapter 6 > Article 1'.
  breadcrumb text,

  body text not null,
  url text,

  adopted_on date,
  revised_on date,

  -- Zero-padded so a plain text sort puts 48900 before 48900.5 before 48901.
  sort_key text,

  -- Lets a re-ingest skip rows whose text has not moved.
  content_hash text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_documents_citation_not_blank check (length(btrim(citation)) > 0),
  -- No leading or trailing dot: lookup_legal_documents() strips a trailing one
  -- off the caller's input ('48900.' is how the Legislature writes it), so a
  -- key stored with one could never be found.
  constraint legal_documents_citation_key_format
    check (citation_key ~ '^[a-z0-9]+(\.[a-z0-9]+)*$'),
  constraint legal_documents_body_not_blank check (length(btrim(body)) > 0)
);

create unique index legal_documents_source_citation_key
  on public.legal_documents (source_id, citation_key);
create index legal_documents_citation_key_idx on public.legal_documents (citation_key);
create index legal_documents_source_sort_idx on public.legal_documents (source_id, sort_key);
create index legal_documents_district_idx on public.legal_documents (district_id);

create trigger legal_documents_set_updated_at
  before update on public.legal_documents
  for each row execute function app.set_updated_at();

comment on table public.legal_documents is
  'One addressable piece of a source: an Education Code section, a board policy.';

-- ---------------------------------------------------------------------------
-- legal_chunks
-- ---------------------------------------------------------------------------
--
-- Section 48900 is thousands of words and 48900(k) is the part anyone ever
-- means. Ranking and prompting both work better on a paragraph than on a
-- whole section, so retrieval happens here and the answer cites the document.
--
-- citation and title are copied down from the document because a generated
-- column cannot read another table, and the search vector must carry them:
-- someone typing "48900" is searching for the number, not for its prose.

create table public.legal_chunks (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references public.legal_documents (id) on delete cascade,
  source_id uuid not null references public.legal_sources (id) on delete cascade,
  district_id uuid references public.districts (id) on delete cascade,

  chunk_index integer not null,

  citation text not null,
  title text not null,
  heading text,

  content text not null,

  search tsvector generated always as (
    setweight(to_tsvector('english', citation), 'A')
    || setweight(to_tsvector('english', title), 'B')
    || setweight(to_tsvector('english', coalesce(heading, '')), 'C')
    || setweight(to_tsvector('english', content), 'D')
  ) stored,

  created_at timestamptz not null default now(),

  constraint legal_chunks_content_not_blank check (length(btrim(content)) > 0),
  constraint legal_chunks_index_non_negative check (chunk_index >= 0)
);

create unique index legal_chunks_document_index_key
  on public.legal_chunks (document_id, chunk_index);
create index legal_chunks_search_idx on public.legal_chunks using gin (search);
create index legal_chunks_district_idx on public.legal_chunks (district_id);

comment on table public.legal_chunks is
  'Retrieval unit. One row per paragraph-sized piece of a document.';

-- ---------------------------------------------------------------------------
-- Ownership can only ever come from the source
-- ---------------------------------------------------------------------------
--
-- district_id is denormalized onto documents and chunks so each RLS policy is
-- a single-table predicate. Denormalized columns drift; this one cannot,
-- because nothing may set it. The trigger overwrites whatever was passed.

create or replace function app.sync_legal_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_district uuid;
  v_source uuid;
begin
  if tg_table_name = 'legal_chunks' then
    -- A chunk names both its document and its source. If those disagree the
    -- chunk would be filed under a source whose text it is not part of.
    select d.source_id into v_source
    from public.legal_documents d where d.id = new.document_id;
    if v_source is null then
      raise exception 'document % does not exist', new.document_id
        using errcode = 'foreign_key_violation';
    end if;
    if v_source is distinct from new.source_id then
      raise exception 'chunk source % does not match document source %',
        new.source_id, v_source
        using errcode = 'check_violation';
    end if;
  end if;

  select s.district_id into v_district
  from public.legal_sources s where s.id = new.source_id;

  new.district_id := v_district;
  return new;
end;
$$;

create trigger legal_documents_sync_district
  before insert or update of source_id, district_id on public.legal_documents
  for each row execute function app.sync_legal_district();

create trigger legal_chunks_sync_district
  before insert or update of source_id, document_id, district_id on public.legal_chunks
  for each row execute function app.sync_legal_district();

-- Moving a source between districts has to carry its rows with it, or the
-- denormalized copies become a cross-tenant leak.
create or replace function app.cascade_legal_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.district_id is distinct from old.district_id then
    update public.legal_documents set district_id = new.district_id
      where source_id = new.id;
    update public.legal_chunks set district_id = new.district_id
      where source_id = new.id;
  end if;
  return null;
end;
$$;

create trigger legal_sources_cascade_district
  after update of district_id on public.legal_sources
  for each row execute function app.cascade_legal_district();

-- ===========================================================================
-- RLS (§3) -- written before any UI exists
-- ===========================================================================

alter table public.legal_sources enable row level security;
alter table public.legal_documents enable row level security;
alter table public.legal_chunks enable row level security;

revoke all on public.legal_sources from anon;
revoke all on public.legal_documents from anon;
revoke all on public.legal_chunks from anon;

-- Read only, and only ever the shared corpus plus your own district's.
-- app.current_district_id() returns null for a request with no staff row, and
-- `district_id = null` is null rather than true, so a stranger still sees only
-- the shared rows -- which is the intent: the Education Code is public.
create policy legal_sources_select
  on public.legal_sources for select to authenticated
  using (district_id is null or district_id = app.current_district_id());

create policy legal_documents_select
  on public.legal_documents for select to authenticated
  using (district_id is null or district_id = app.current_district_id());

create policy legal_chunks_select
  on public.legal_chunks for select to authenticated
  using (district_id is null or district_id = app.current_district_id());

-- No insert, update or delete policies anywhere in this file. Loading a corpus
-- is a service-role job (the ingest CLI), never something the app can do.
revoke insert, update, delete on public.legal_sources from authenticated;
revoke insert, update, delete on public.legal_documents from authenticated;
revoke insert, update, delete on public.legal_chunks from authenticated;
