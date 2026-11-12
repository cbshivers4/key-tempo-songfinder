-- Named accounts that get Pro without paying (owner access).
create table public.pro_grants (
  user_id uuid primary key references auth.users(id) on delete cascade not null,
  note text,
  created_at timestamptz default now()
);

grant select on public.pro_grants to authenticated;
grant all on public.pro_grants to service_role;

alter table public.pro_grants enable row level security;

create policy "Users can read their own free access grant"
on public.pro_grants for select to authenticated
using (auth.uid() = user_id);

create policy "Admins can read all free access grants"
on public.pro_grants for select to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- A free-access grant counts as an active subscription in every environment.
create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pro_grants where user_id = user_uuid
  ) or exists (
    select 1 from public.subscriptions
    where user_id = user_uuid and environment = check_env
    and (
      (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;