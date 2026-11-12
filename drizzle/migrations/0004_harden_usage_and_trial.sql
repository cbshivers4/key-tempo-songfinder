create or replace function public.consume_use_for(_user uuid, check_env text)
returns int language plpgsql security definer set search_path = public as $$
declare n int; lim constant int := 3;
begin
  if _user is null then raise exception 'not signed in'; end if;
  if check_env not in ('sandbox','live') then raise exception 'bad env'; end if;
  if public.has_active_subscription(_user, check_env) then return -1; end if;
  insert into public.daily_usage(user_id, day, uses) values (_user, current_date, 1)
  on conflict (user_id, day) do update set uses = daily_usage.uses + 1
  where daily_usage.uses < lim
  returning uses into n;
  if n is null then return null; end if;
  return lim - n;
end $$;
revoke execute on function public.consume_use_for(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_use_for(uuid, text) to service_role;
revoke execute on function public.consume_use(text, int) from authenticated;
comment on function public.consume_use(text, int) is 'DEPRECATED: replaced by consume_use_for (server-only)';