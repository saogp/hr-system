-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Adds room GROUPS (Kundetoaletter / Personalrom) so there are only 2 QR
-- codes instead of one per room. The employee scans a group's QR code and
-- checks off which specific room(s) within that group they cleaned, so
-- status/history stay tracked per individual room. The monthly
-- responsibility plan (ansvarsplan) now also works per group, not per room.

create table if not exists public.cleaning_room_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  questions jsonb not null default '[]'
);

alter table public.cleaning_room_groups add column if not exists questions jsonb not null default '[]';
alter table public.cleaning_rooms add column if not exists group_id uuid references public.cleaning_room_groups(id) on delete set null;
alter table public.cleaning_checks add column if not exists checklist jsonb not null default '[]';

-- cleaning_assignments is recreated against group_id instead of room_id.
-- Safe to drop/recreate: this table was only just introduced and holds no
-- assignments worth preserving yet.
drop table if exists public.cleaning_assignments;
create table public.cleaning_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.cleaning_room_groups(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  year int not null,
  month int not null,
  unique (group_id, year, month)
);

alter table public.cleaning_room_groups enable row level security;
alter table public.cleaning_assignments enable row level security;

drop policy if exists mgr_select_cleaning_room_groups on public.cleaning_room_groups;
drop policy if exists mgr_insert_cleaning_room_groups on public.cleaning_room_groups;
drop policy if exists mgr_update_cleaning_room_groups on public.cleaning_room_groups;
drop policy if exists admin_delete_cleaning_room_groups on public.cleaning_room_groups;
create policy mgr_select_cleaning_room_groups on public.cleaning_room_groups for select using (public.is_admin_or_manager());
create policy mgr_insert_cleaning_room_groups on public.cleaning_room_groups for insert with check (public.is_admin_or_manager());
create policy mgr_update_cleaning_room_groups on public.cleaning_room_groups for update using (public.is_admin_or_manager());
create policy admin_delete_cleaning_room_groups on public.cleaning_room_groups for delete using (public.is_admin());

drop policy if exists mgr_select_cleaning_assignments on public.cleaning_assignments;
drop policy if exists mgr_insert_cleaning_assignments on public.cleaning_assignments;
drop policy if exists mgr_update_cleaning_assignments on public.cleaning_assignments;
drop policy if exists admin_delete_cleaning_assignments on public.cleaning_assignments;
create policy mgr_select_cleaning_assignments on public.cleaning_assignments for select using (public.is_admin_or_manager());
create policy mgr_insert_cleaning_assignments on public.cleaning_assignments for insert with check (public.is_admin_or_manager());
create policy mgr_update_cleaning_assignments on public.cleaning_assignments for update using (public.is_admin_or_manager());
create policy admin_delete_cleaning_assignments on public.cleaning_assignments for delete using (public.is_admin());

insert into public.cleaning_room_groups (name, sort_order) values
  ('Kundetoaletter', 1),
  ('Personalrom', 2)
on conflict (name) do nothing;

update public.cleaning_rooms set group_id = (select id from public.cleaning_room_groups where name = 'Kundetoaletter')
where name in ('Dametoalett, kunde', 'Herretoalett, kunde', 'Handicaptoalett, kunde');

update public.cleaning_rooms set group_id = (select id from public.cleaning_room_groups where name = 'Personalrom')
where name in ('Damegarderobe/toalett, personal', 'Herregarderobe/toalett, personal', 'Personalrom (fellesrom)');
