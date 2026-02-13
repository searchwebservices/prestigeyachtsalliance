-- Luxury Reservation Control + Team Oversight (Phase B)
-- Run this script in Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.guest_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  preferred_name text not null default '',
  email text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  nationality text not null default '',
  preferred_language text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_details (
  id uuid primary key default gen_random_uuid(),
  booking_uid_current text not null unique,
  booking_uid_history text[] not null default '{}',
  yacht_slug text not null,
  yacht_name text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'booked',
  guest_profile_id uuid references public.guest_profiles(id) on delete set null,
  guest_count integer,
  adult_count integer,
  kids_count integer,
  kids_notes text not null default '',
  staying_multiple_places boolean not null default false,
  allergies text[] not null default '{}',
  preferences text[] not null default '{}',
  dietary_notes text not null default '',
  mobility_notes text not null default '',
  occasion_notes text not null default '',
  concierge_notes text not null default '',
  internal_notes text not null default '',
  source text not null default 'internal_calendar_v2',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_stays (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservation_details(id) on delete cascade,
  property_name text not null default '',
  location_label text not null default '',
  check_in_date date,
  check_out_date date,
  unit_or_room text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_change_log (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservation_details(id) on delete cascade,
  booking_uid text not null,
  action text not null,
  actor_user_id uuid references auth.users(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservation_details_yacht_start
  on public.reservation_details (yacht_slug, start_at);

create index if not exists idx_reservation_details_guest_profile
  on public.reservation_details (guest_profile_id);

create index if not exists idx_reservation_stays_reservation_sort
  on public.reservation_stays (reservation_id, sort_order);

create index if not exists idx_reservation_change_log_actor_created
  on public.reservation_change_log (actor_user_id, created_at desc);

drop trigger if exists trg_guest_profiles_updated_at on public.guest_profiles;
create trigger trg_guest_profiles_updated_at
before update on public.guest_profiles
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_reservation_details_updated_at on public.reservation_details;
create trigger trg_reservation_details_updated_at
before update on public.reservation_details
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_reservation_stays_updated_at on public.reservation_stays;
create trigger trg_reservation_stays_updated_at
before update on public.reservation_stays
for each row execute function public.set_row_updated_at();

alter table public.guest_profiles enable row level security;
alter table public.reservation_details enable row level security;
alter table public.reservation_stays enable row level security;
alter table public.reservation_change_log enable row level security;

drop policy if exists guest_profiles_select_team on public.guest_profiles;
create policy guest_profiles_select_team
on public.guest_profiles
for select
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'staff')
  )
);

drop policy if exists guest_profiles_admin_write on public.guest_profiles;
create policy guest_profiles_admin_write
on public.guest_profiles
for all
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists reservation_details_select_team on public.reservation_details;
create policy reservation_details_select_team
on public.reservation_details
for select
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'staff')
  )
);

drop policy if exists reservation_details_admin_write on public.reservation_details;
create policy reservation_details_admin_write
on public.reservation_details
for all
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists reservation_stays_select_team on public.reservation_stays;
create policy reservation_stays_select_team
on public.reservation_stays
for select
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'staff')
  )
);

drop policy if exists reservation_stays_admin_write on public.reservation_stays;
create policy reservation_stays_admin_write
on public.reservation_stays
for all
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

drop policy if exists reservation_change_log_select_team on public.reservation_change_log;
create policy reservation_change_log_select_team
on public.reservation_change_log
for select
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'staff')
  )
);

drop policy if exists reservation_change_log_admin_write on public.reservation_change_log;
create policy reservation_change_log_admin_write
on public.reservation_change_log
for all
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
);

commit;
