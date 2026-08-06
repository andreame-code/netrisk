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

create or replace function public.netrisk_compare_and_set_app_state(
  app_state_key text,
  expected_value_json text,
  next_value_json text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  update public.app_state
  set value_json = to_jsonb(next_value_json)
  where key = app_state_key
    and value_json = to_jsonb(expected_value_json);

  get diagnostics affected_rows = row_count;
  if affected_rows = 1 then
    return true;
  end if;

  if expected_value_json = 'null' then
    insert into public.app_state (key, value_json)
    values (app_state_key, to_jsonb(next_value_json))
    on conflict (key) do nothing;

    get diagnostics affected_rows = row_count;
    return affected_rows = 1;
  end if;

  return false;
end;
$$;

revoke all on function public.netrisk_compare_and_set_app_state(text, text, text) from public;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.games enable row level security;
alter table public.app_state enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.users, public.sessions, public.games, public.app_state from anon;
    revoke all on function public.netrisk_compare_and_set_app_state(text, text, text) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.users, public.sessions, public.games, public.app_state from authenticated;
    revoke all on function public.netrisk_compare_and_set_app_state(text, text, text) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.netrisk_compare_and_set_app_state(text, text, text) to service_role;
  end if;
end $$;
`.trim() + "\n";

export function getSupabaseSchemaSql(): string {
  return supabaseSchemaSql;
}
