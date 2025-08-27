-- Lobby table for multiplayer lobbies with max players support
create table if not exists lobbies (
  code text primary key,
  host text,
  players jsonb,
  started boolean default false,
  currentPlayer text,
  state jsonb,
  map text,
  maxPlayers integer default 6
);

alter table lobbies enable row level security;
create policy "allow_select_lobbies" on lobbies
  for select using (true);

alter publication supabase_realtime add table lobbies;
