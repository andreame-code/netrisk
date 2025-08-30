create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

alter table users enable row level security;

create policy "user_select_self" on users for select using (auth.uid() = id);
create policy "user_insert_self" on users for insert with check (auth.uid() = id);
