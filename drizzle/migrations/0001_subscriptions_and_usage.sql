create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid and environment = check_env
    and (
      (status in ('active','trialing','past_due') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

create table public.daily_usage (
  user_id uuid not null,
  day date not null default current_date,
  uses int not null default 0,
  primary key (user_id, day)
);
grant select on public.daily_usage to authenticated;
grant all on public.daily_usage to service_role;
alter table public.daily_usage enable row level security;
create policy "Users can view own usage" on public.daily_usage for select to authenticated using (auth.uid() = user_id);

-- Atomically consume one free use; subscribers are always allowed. Returns remaining (-1 = unlimited, null = blocked).
create or replace function public.consume_use(check_env text, free_limit int default 3)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if public.has_active_subscription(auth.uid(), check_env) then return -1; end if;
  insert into public.daily_usage(user_id, day, uses) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set uses = daily_usage.uses + 1
  where daily_usage.uses < free_limit
  returning uses into n;
  if n is null then return null; end if;
  return free_limit - n;
end $$;
revoke execute on function public.consume_use(text, int) from public, anon;
grant execute on function public.consume_use(text, int) to authenticated;