-- Breeze Box :: 0018 legal search
--
-- Retrieval for the Ed Code Assistant. Two functions, both SECURITY INVOKER so
-- the RLS policies in 0017 do the tenant filtering: a caller can only ever be
-- handed the shared corpus plus their own district's board policy.
--
-- Why full-text search and not embeddings: the answer has to be checkable
-- against a citation, and statutes are written in a fixed vocabulary that a
-- lexical index handles well once the QUESTION has been translated into that
-- vocabulary. The translation is Claude's job before the call ("can I send a
-- kid home for vaping" -> "suspension", "tobacco", "48900"); the ranking is
-- Postgres's. That keeps the whole corpus in the database we already run,
-- with no second vendor holding a copy of it.

-- ---------------------------------------------------------------------------
-- search_legal_chunks
-- ---------------------------------------------------------------------------
--
-- p_terms is a list of PHRASES, not one query string. Each phrase is ANDed
-- within itself and ORed against the others, so ['school bus', 'suspension']
-- matches a chunk about either, ranking a chunk about both highest. Terms come
-- from Claude's expansion of the question.
--
-- websearch_to_tsquery is used rather than to_tsquery because it never raises
-- on arbitrary input. A phrase that reduces to nothing (all stop words) is
-- dropped instead of failing the call.

create or replace function public.search_legal_chunks(
  p_terms text[],
  p_kinds public.legal_source_kind[] default null,
  p_limit integer default 12
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_slug text,
  source_title text,
  kind public.legal_source_kind,
  citation text,
  title text,
  heading text,
  breadcrumb text,
  url text,
  retrieved_at timestamptz,
  chunk_index integer,
  content text,
  rank real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_term text;
  v_part tsquery;
  v_query tsquery := null;
begin
  foreach v_term in array coalesce(p_terms, array[]::text[]) loop
    continue when v_term is null or length(btrim(v_term)) = 0;
    v_part := websearch_to_tsquery('english', v_term);
    if v_part is not null and numnode(v_part) > 0 then
      -- || is OR on tsquery (&& is AND). Phrases widen the net; the ranking
      -- below decides which of them mattered.
      v_query := case when v_query is null then v_part else v_query || v_part end;
    end if;
  end loop;

  if v_query is null then
    return;
  end if;

  return query
  select
    c.id,
    c.document_id,
    s.slug,
    s.title,
    s.kind,
    c.citation,
    c.title,
    c.heading,
    d.breadcrumb,
    d.url,
    s.retrieved_at,
    c.chunk_index,
    c.content,
    -- Weights are {D,C,B,A}: a hit on the citation itself outranks a hit
    -- buried in the prose, which is what "what does 48900 say" needs.
    ts_rank_cd(array[0.1, 0.2, 0.4, 1.0]::real[], c.search, v_query, 32) as rank
  from public.legal_chunks c
  join public.legal_documents d on d.id = c.document_id
  join public.legal_sources s on s.id = c.source_id
  where c.search @@ v_query
    and s.status = 'active'
    and (p_kinds is null or s.kind = any (p_kinds))
  order by rank desc, c.citation, c.chunk_index
  limit greatest(1, least(coalesce(p_limit, 12), 50));
end;
$$;

comment on function public.search_legal_chunks(text[], public.legal_source_kind[], integer) is
  'Ranked passage search over the legal library. SECURITY INVOKER: RLS scopes it.';

-- ---------------------------------------------------------------------------
-- lookup_legal_documents
-- ---------------------------------------------------------------------------
--
-- The other half of the question. "What does 48900(k) actually say" is not a
-- search, it is a lookup, and ranking has nothing to add to it. Citations are
-- normalized the same way the ingest CLI normalizes citation_key, so
-- 'EC 48900', 'ec 48900' and '48900' all land on the same row.

create or replace function public.lookup_legal_documents(
  p_citations text[],
  p_limit integer default 8
)
returns table (
  document_id uuid,
  source_slug text,
  source_title text,
  kind public.legal_source_kind,
  citation text,
  title text,
  breadcrumb text,
  url text,
  retrieved_at timestamptz,
  body text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with wanted as (
    -- Interior dots are part of the number ('5144.1'); a trailing one is how
    -- the Legislature writes a section ('48900.') and how half the people
    -- quoting it do too. Same normalization the ingest CLI applies to
    -- citation_key, so the two always meet.
    select distinct
      regexp_replace(regexp_replace(lower(c), '[^a-z0-9.]', '', 'g'), '\.+$', '') as key
    from unnest(coalesce(p_citations, array[]::text[])) as c
    where c is not null and length(btrim(c)) > 0
  )
  select
    d.id, s.slug, s.title, s.kind, d.citation, d.title,
    d.breadcrumb, d.url, s.retrieved_at, d.body
  from public.legal_documents d
  join public.legal_sources s on s.id = d.source_id
  join wanted w
    -- A bare '48900' should find 'EC 48900', whose key is 'ec48900'. An
    -- already-prefixed key matches directly.
    on d.citation_key = w.key
    or d.citation_key = 'ec' || w.key
    or d.citation_key = 'bp' || w.key
    or d.citation_key = 'ar' || w.key
  where s.status = 'active' and length(w.key) > 0
  order by d.sort_key, d.citation
  limit greatest(1, least(coalesce(p_limit, 8), 25));
$$;

comment on function public.lookup_legal_documents(text[], integer) is
  'Exact citation lookup over the legal library. SECURITY INVOKER: RLS scopes it.';

revoke all on function public.search_legal_chunks(text[], public.legal_source_kind[], integer) from anon;
revoke all on function public.lookup_legal_documents(text[], integer) from anon;
grant execute on function public.search_legal_chunks(text[], public.legal_source_kind[], integer) to authenticated;
grant execute on function public.lookup_legal_documents(text[], integer) to authenticated;
