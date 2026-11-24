-- NOM Trip Planner foundation
-- Apply this in the NOM Supabase project's SQL editor after reviewing.
-- These tables are private to their owning authenticated member.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 100),
  destination text not null check (char_length(trim(destination)) between 2 and 160),
  start_date date,
  end_date date,
  notes text not null default '' check (char_length(notes) <= 2000),
  budget_amount numeric(12,2) check (budget_amount is null or budget_amount >= 0),
  budget_currency text not null default 'USD' check (budget_currency ~ '^[A-Z]{3}$'),
  ai_enabled boolean not null default false,
  status text not null default 'planning' check (status in ('planning','upcoming','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_order check (start_date is null or end_date is null or end_date >= start_date),
  constraint trips_id_owner_unique unique (id, owner_id)
);

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  day_date date,
  item_type text not null default 'place' check (item_type in ('flight','stay','activity','place','transport','meal','note')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  location text not null default '' check (char_length(location) <= 200),
  start_time time,
  end_time time,
  notes text not null default '' check (char_length(notes) <= 1500),
  external_url text,
  source_place_key text,
  latitude double precision,
  longitude double precision,
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_items_trip_owner_fkey foreign key (trip_id, owner_id)
    references public.trips(id, owner_id) on delete cascade,
  constraint trip_items_time_order check (start_time is null or end_time is null or end_time >= start_time)
);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid,
  category text not null default 'other' check (category in ('flight','accommodation','food','transport','activities','shopping','other')),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(12,2) not null check (amount >= 0),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint trip_expenses_trip_owner_fkey foreign key (trip_id, owner_id)
    references public.trips(id, owner_id) on delete cascade,
  constraint trip_expenses_item_trip_fkey foreign key (item_id, trip_id, owner_id)
    references public.trip_items(id, trip_id, owner_id) on delete set null
);

create index if not exists trips_owner_created_idx on public.trips(owner_id, created_at desc);
create index if not exists trip_items_trip_day_sort_idx on public.trip_items(trip_id, day_date, sort_order, start_time);
create index if not exists trip_expenses_trip_date_idx on public.trip_expenses(trip_id, expense_date desc);

alter table public.trips enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_expenses enable row level security;

drop policy if exists "Members can view their own trips" on public.trips;
create policy "Members can view their own trips" on public.trips
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Members can create their own trips" on public.trips;
create policy "Members can create their own trips" on public.trips
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can update their own trips" on public.trips;
create policy "Members can update their own trips" on public.trips
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can delete their own trips" on public.trips;
create policy "Members can delete their own trips" on public.trips
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Members can view their own trip items" on public.trip_items;
create policy "Members can view their own trip items" on public.trip_items
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Members can create their own trip items" on public.trip_items;
create policy "Members can create their own trip items" on public.trip_items
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can update their own trip items" on public.trip_items;
create policy "Members can update their own trip items" on public.trip_items
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can delete their own trip items" on public.trip_items;
create policy "Members can delete their own trip items" on public.trip_items
  for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Members can view their own trip expenses" on public.trip_expenses;
create policy "Members can view their own trip expenses" on public.trip_expenses
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Members can create their own trip expenses" on public.trip_expenses;
create policy "Members can create their own trip expenses" on public.trip_expenses
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can update their own trip expenses" on public.trip_expenses;
create policy "Members can update their own trip expenses" on public.trip_expenses
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Members can delete their own trip expenses" on public.trip_expenses;
create policy "Members can delete their own trip expenses" on public.trip_expenses
  for delete to authenticated using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_items to authenticated;
grant select, insert, update, delete on public.trip_expenses to authenticated;
