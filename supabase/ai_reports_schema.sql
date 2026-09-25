-- User reports on AI answers. Google Play's AI-Generated Content policy requires
-- an in-app way to flag offensive AI output; reports land here for review.
create table kai_ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  collection_id uuid references kai_collections(id) on delete set null,
  question text,
  answer text not null,
  reason text not null check (reason in ('offensive', 'incorrect', 'dangerous', 'other')),
  created_at timestamptz default now()
);

alter table kai_ai_reports enable row level security;

-- Users may file reports but never read them back; review happens via the
-- Supabase dashboard (service role bypasses RLS).
create policy "Users file own reports" on kai_ai_reports
  for insert with check (auth.uid() = user_id);
