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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.netrisk_compare_and_set_app_state(text, text, text) from authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.netrisk_compare_and_set_app_state(text, text, text) from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.netrisk_compare_and_set_app_state(text, text, text) to service_role;
  end if;
end $$;
