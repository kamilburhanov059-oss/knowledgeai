-- New RPC that additionally returns page_number (from kai_chunks.metadata->>'page').
-- Created alongside the existing match_chunks (not replacing it) so the live chat
-- keeps working even if this needs to be tweaked later.
create or replace function match_chunks_v2(
  query_embedding vector(1536),
  collection_id_filter uuid,
  user_id_filter uuid,
  match_count int default 10,
  match_threshold float default 0.3
)
returns table (
  id uuid,
  content text,
  document_name text,
  page_number int,
  similarity float
)
language sql stable
as $$
  select
    kc.id,
    kc.content,
    kc.document_name,
    (kc.metadata->>'page')::int as page_number,
    1 - (kc.embedding <=> query_embedding) as similarity
  from kai_chunks kc
  where kc.collection_id = collection_id_filter
    and kc.user_id = user_id_filter
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;
