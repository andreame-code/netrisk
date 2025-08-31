-- Combined schema for NetRisk multiplayer and lobby system
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  name text,
  color text,
  created_at timestamptz default now()
);

create table if not exists game_states (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid,
  action jsonb,
  result jsonb,
  created_at timestamptz default now()
);

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

create table if not exists lobby_chat (
  code text references lobbies(code) on delete cascade,
  id text,
  text text,
  created_at timestamptz default now()
);

-- Enable row level security
alter table matches enable row level security;
alter table players enable row level security;
alter table game_states enable row level security;
alter table events enable row level security;
alter table lobbies enable row level security;
alter table lobby_chat enable row level security;

-- Policies
create policy "allow_select_matches" on matches for select using (true);
create policy "allow_select_players" on players for select using (true);
create policy "allow_select_game_states" on game_states for select using (true);
create policy "allow_select_events" on events for select using (true);
create policy "allow_select_lobbies" on lobbies for select using (true);
create policy "allow_select_lobby_chat" on lobby_chat for select using (true);
create policy "allow_insert_lobby_chat" on lobby_chat for insert with check (true);

-- Enable realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_states;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table lobbies;
alter publication supabase_realtime add table lobby_chat;
