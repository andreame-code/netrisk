create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

alter table users enable row level security;

create policy "allow_select_users" on users for select using (true);
create policy "allow_insert_users" on users for insert with check (true);
