-- Lobby table for multiplayer lobbies with max players support
create table if not exists lobbies (
  code text primary key,
  host text,
  players jsonb,
  started boolean default false,
  current_player text,
  state jsonb,
  map text,
  max_players integer default 6
);

alter table lobbies enable row level security;
create policy "allow_select_lobbies" on lobbies
  for select using (true);

alter publication supabase_realtime add table lobbies;

-- Rename existing camelCase columns to snake_case if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lobbies'
      and column_name = 'currentplayer'
  ) then
    alter table lobbies rename column currentplayer to current_player;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lobbies'
      and column_name = 'maxplayers'
  ) then
    alter table lobbies rename column maxplayers to max_players;
  end if;
end $$;

-- Chat messages for lobbies
create table if not exists lobby_chat (
  code text references lobbies(code) on delete cascade,
  id text,
  text text,
  created_at timestamptz default now()
);

alter table lobby_chat enable row level security;
create policy "allow_select_lobby_chat" on lobby_chat
  for select using (true);
create policy "allow_insert_lobby_chat" on lobby_chat
  for insert to authenticated, service_role with check (true);
