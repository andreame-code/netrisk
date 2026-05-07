export const supabaseSchemaSql =
  `
create table if not exists public.users (
  id text primary key,
  username text not null unique,
  role text not null default 'user',
  profile_json jsonb not null default '{}'::jsonb,
  credentials_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists users_username_lower_idx
  on public.users (lower(username));

create table if not exists public.sessions (
  token text primary key,
  user_id text not null references public.users(id) on delete cascade,
  created_at bigint not null
);

create table if not exists public.games (
  id text primary key,
  name text not null,
  version integer not null default 1,
  creator_user_id text references public.users(id) on delete set null,
  state_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists games_updated_at_idx
  on public.games (updated_at desc);

create table if not exists public.app_state (
  key text primary key,
  value_json jsonb not null
);

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.games enable row level security;
alter table public.app_state enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.users, public.sessions, public.games, public.app_state from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.users, public.sessions, public.games, public.app_state from authenticated;
  end if;
end $$;
`.trim() + "\n";

export function getSupabaseSchemaSql(): string {
  return supabaseSchemaSql;
}
