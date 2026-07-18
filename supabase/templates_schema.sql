create table kai_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  original_filename text not null,
  storage_path text not null,
  mode text not null check (mode in ('placeholder','freeform')),
  placeholder_names jsonb,
  created_at timestamptz default now()
);

create table kai_template_generations (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references kai_templates(id) on delete cascade,
  user_id uuid not null,
  instruction text not null,
  status text not null default 'processing',
  output_storage_path text,
  applied_count int,
  skipped jsonb,
  error_message text,
  created_at timestamptz default now()
);

alter table kai_templates enable row level security;
alter table kai_template_generations enable row level security;

create policy "Users manage own templates" on kai_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own template generations" on kai_template_generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
