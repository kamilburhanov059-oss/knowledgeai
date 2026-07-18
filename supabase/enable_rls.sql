-- Currently these 4 tables have RLS disabled, so the public anon key (embedded
-- in the client bundle) can read/write ANY user's rows, not just their own.
-- This enables RLS and restricts every operation to rows owned by the caller
-- (auth.uid() = user_id). Server-side code using SUPABASE_SERVICE_ROLE_KEY
-- bypasses RLS entirely, so the worker and API routes are unaffected.

alter table kai_collections enable row level security;
alter table kai_documents enable row level security;
alter table kai_chunks enable row level security;
alter table kai_chat_messages enable row level security;

-- kai_collections.user_id and kai_chat_messages.user_id are stored as text
-- (legacy from the old n8n flow's "demo-user" fallback), so auth.uid() needs
-- an explicit cast there. kai_documents/kai_chunks.user_id are already uuid.
create policy "Users manage own collections" on kai_collections
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create policy "Users manage own documents" on kai_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own chunks" on kai_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own chat messages" on kai_chat_messages
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
