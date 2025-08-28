-- Rename camelCase columns in lobbies and add lobby_chat table
alter table lobbies rename column currentplayer to current_player;
alter table lobbies rename column maxplayers to max_players;

create table if not exists lobby_chat (
  code text references lobbies(code) on delete cascade,
  id text,
  text text,
  created_at timestamptz default now()
);

alter table lobby_chat enable row level security;
create policy "allow_select_lobby_chat" on lobby_chat
  for select using (true);

alter publication supabase_realtime add table lobby_chat;
