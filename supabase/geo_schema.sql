create table kai_user_geo (
  user_id uuid primary key,
  country text,
  updated_at timestamptz default now()
);

alter table kai_user_geo enable row level security;

create policy "Users manage own geo" on kai_user_geo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
