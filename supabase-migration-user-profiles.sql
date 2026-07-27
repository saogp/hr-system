-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Adds an email column synced from auth.users, and migrates the free-text
-- restaurant_name field on profiles to a proper companies relation.

-- 1) Email: add column + backfill + keep in sync going forward
alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();

-- 2) Companies: create real rows from existing restaurant_name values,
--    add company_id FK on profiles, backfill, then drop the free-text column.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into public.companies (name)
select distinct restaurant_name
from public.profiles
where restaurant_name is not null
on conflict (name) do nothing;

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id);

update public.profiles p
set company_id = c.id
from public.companies c
where p.restaurant_name = c.name
  and p.company_id is null;

alter table public.profiles
  drop column if exists restaurant_name;
