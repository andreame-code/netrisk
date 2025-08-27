-- Schema for NetRisk server authoritative multiplayer
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

-- Enable row level security
alter table matches enable row level security;
alter table players enable row level security;
alter table game_states enable row level security;
alter table events enable row level security;

-- Allow anonymous clients to read but not write
create policy "allow_select_matches" on matches
  for select using (true);
create policy "allow_select_players" on players
  for select using (true);
create policy "allow_select_game_states" on game_states
  for select using (true);
create policy "allow_select_events" on events
  for select using (true);

-- Enable realtime
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_states;
alter publication supabase_realtime add table events;
