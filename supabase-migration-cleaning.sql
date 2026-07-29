-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Renhold (cleaning) module: rooms, monthly company responsibility plan,
-- a check-in history log, and email notification recipients.
-- Only admin/leder can see this data (is_admin_or_manager()). The public
-- per-room QR check-in flow writes through the service role via an API
-- route, so no anonymous RLS policy is needed on cleaning_checks.

create table if not exists public.cleaning_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cleaning_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cleaning_rooms(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  year int not null,
  month int not null,
  unique (room_id, year, month)
);

create table if not exists public.cleaning_checks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.cleaning_rooms(id) on delete cascade,
  check_date date not null default current_date,
  checked_at timestamptz not null default now(),
  checked_by_name text
);

create table if not exists public.cleaning_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.cleaning_rooms enable row level security;
alter table public.cleaning_assignments enable row level security;
alter table public.cleaning_checks enable row level security;
alter table public.cleaning_notification_recipients enable row level security;

drop policy if exists mgr_select_cleaning_rooms on public.cleaning_rooms;
drop policy if exists mgr_insert_cleaning_rooms on public.cleaning_rooms;
drop policy if exists mgr_update_cleaning_rooms on public.cleaning_rooms;
drop policy if exists admin_delete_cleaning_rooms on public.cleaning_rooms;
create policy mgr_select_cleaning_rooms on public.cleaning_rooms for select using (public.is_admin_or_manager());
create policy mgr_insert_cleaning_rooms on public.cleaning_rooms for insert with check (public.is_admin_or_manager());
create policy mgr_update_cleaning_rooms on public.cleaning_rooms for update using (public.is_admin_or_manager());
create policy admin_delete_cleaning_rooms on public.cleaning_rooms for delete using (public.is_admin());

drop policy if exists mgr_select_cleaning_assignments on public.cleaning_assignments;
drop policy if exists mgr_insert_cleaning_assignments on public.cleaning_assignments;
drop policy if exists mgr_update_cleaning_assignments on public.cleaning_assignments;
drop policy if exists admin_delete_cleaning_assignments on public.cleaning_assignments;
create policy mgr_select_cleaning_assignments on public.cleaning_assignments for select using (public.is_admin_or_manager());
create policy mgr_insert_cleaning_assignments on public.cleaning_assignments for insert with check (public.is_admin_or_manager());
create policy mgr_update_cleaning_assignments on public.cleaning_assignments for update using (public.is_admin_or_manager());
create policy admin_delete_cleaning_assignments on public.cleaning_assignments for delete using (public.is_admin());

drop policy if exists mgr_select_cleaning_checks on public.cleaning_checks;
drop policy if exists admin_delete_cleaning_checks on public.cleaning_checks;
create policy mgr_select_cleaning_checks on public.cleaning_checks for select using (public.is_admin_or_manager());
create policy admin_delete_cleaning_checks on public.cleaning_checks for delete using (public.is_admin());

drop policy if exists mgr_select_cleaning_notification_recipients on public.cleaning_notification_recipients;
drop policy if exists mgr_insert_cleaning_notification_recipients on public.cleaning_notification_recipients;
drop policy if exists admin_delete_cleaning_notification_recipients on public.cleaning_notification_recipients;
create policy mgr_select_cleaning_notification_recipients on public.cleaning_notification_recipients for select using (public.is_admin_or_manager());
create policy mgr_insert_cleaning_notification_recipients on public.cleaning_notification_recipients for insert with check (public.is_admin_or_manager());
create policy admin_delete_cleaning_notification_recipients on public.cleaning_notification_recipients for delete using (public.is_admin());

insert into public.cleaning_rooms (name, sort_order) values
  ('Dametoalett, kunde', 1),
  ('Herretoalett, kunde', 2),
  ('Handicaptoalett, kunde', 3),
  ('Damegarderobe/toalett, personal', 4),
  ('Herregarderobe/toalett, personal', 5),
  ('Personalrom (fellesrom)', 6)
on conflict (name) do nothing;
