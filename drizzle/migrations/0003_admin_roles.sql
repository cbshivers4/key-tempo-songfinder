create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "Users can read their own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Admins can read all subscriptions"
on public.subscriptions for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can read all daily usage"
on public.daily_usage for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can read all library songs"
on public.library_songs for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'subscribers', (select count(*) from public.subscriptions where status in ('active','trialing','past_due')),
    'trialing', (select count(*) from public.subscriptions where status = 'trialing'),
    'canceled', (select count(*) from public.subscriptions where status = 'canceled'),
    'uses_today', (select coalesce(sum(uses), 0) from public.daily_usage where day = current_date),
    'songs_saved', (select count(*) from public.library_songs)
  ) into result;
  return result;
end;
$$;