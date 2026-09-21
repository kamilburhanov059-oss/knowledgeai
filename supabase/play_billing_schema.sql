-- Adds Google Play Billing support alongside the existing Click.uz flow.
-- kai_subscriptions already exists (billing_schema.sql) with a unique user_id —
-- we just tag which provider activated it, for support/debugging purposes.
alter table kai_subscriptions add column if not exists provider text not null default 'click' check (provider in ('click', 'play'));

-- Audit trail of Play purchase tokens, mirrors kai_payments' role for Click.
create table kai_play_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purchase_token text not null unique,
  product_id text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'invalid')),
  expiry_time timestamptz,
  created_at timestamptz default now()
);

alter table kai_play_purchases enable row level security;

create policy "Users manage own play purchases" on kai_play_purchases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
