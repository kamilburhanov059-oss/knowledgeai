create table kai_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  collection_id uuid not null references kai_collections(id) on delete cascade,
  document_id uuid references kai_documents(id) on delete cascade,
  title text not null,
  format text not null check (format in ('multiple_choice','open_ended')),
  question_count int not null,
  status text not null default 'processing',
  error_message text,
  created_at timestamptz default now()
);

create table kai_test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references kai_tests(id) on delete cascade,
  order_index int not null,
  question text not null,
  options jsonb,
  correct_answer text not null,
  explanation text
);

create table kai_test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references kai_tests(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'in_progress',
  score int,
  answers jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table kai_tests enable row level security;
alter table kai_test_questions enable row level security;
alter table kai_test_attempts enable row level security;

create policy "Users manage own tests" on kai_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own test attempts" on kai_test_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- kai_test_questions has no user_id of its own; scope through the parent test.
create policy "Users manage questions of own tests" on kai_test_questions
  for all using (
    exists (select 1 from kai_tests t where t.id = kai_test_questions.test_id and t.user_id = auth.uid())
  )
  with check (
    exists (select 1 from kai_tests t where t.id = kai_test_questions.test_id and t.user_id = auth.uid())
  );
