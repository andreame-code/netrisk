do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lobbies'
      and polname = 'allow_insert_lobbies'
  ) then
    create policy "allow_insert_lobbies" on lobbies for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lobbies'
      and polname = 'allow_update_lobbies'
  ) then
    create policy "allow_update_lobbies" on lobbies for update using (true) with check (true);
  end if;
end
$$;
