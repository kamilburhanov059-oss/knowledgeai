create table kai_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  status text not null default 'inactive' check (status in ('inactive','active')),
  current_period_end timestamptz,
  created_at timestamptz default now()
);

create table kai_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  merchant_trans_id text not null unique,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending','prepared','paid','failed')),
  click_trans_id text,
  error_note text,
  created_at timestamptz default now()
);

alter table kai_subscriptions enable row level security;
alter table kai_payments enable row level security;

create policy "Users manage own subscription" on kai_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own payments" on kai_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
