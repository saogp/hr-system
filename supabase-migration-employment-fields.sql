-- Employment detail fields + column-level protection on profiles.
-- Employee number is auto-assigned (serial), never user-editable.

alter table public.profiles add column if not exists employee_number serial unique;
alter table public.profiles add column if not exists employment_type text check (employment_type in ('fast', 'tilkalling'));
alter table public.profiles add column if not exists position_percentage numeric(5,2) check (position_percentage >= 0 and position_percentage <= 100);
alter table public.profiles add column if not exists start_date date;
alter table public.profiles add column if not exists end_date date;

-- The existing "Ansatte kan oppdatere egen profil" RLS policy allows a non-admin
-- to update ANY column on their own row (RLS only gates which rows, not which
-- columns). Add a trigger so only phone/birth_date remain self-editable; every
-- other column requires is_admin().
create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if not public.is_admin() then
    if new.full_name is distinct from old.full_name
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.manager_id is distinct from old.manager_id
      or new.title is distinct from old.title
      or new.employee_number is distinct from old.employee_number
      or new.employment_type is distinct from old.employment_type
      or new.position_percentage is distinct from old.position_percentage
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.next_review_date is distinct from old.next_review_date
    then
      raise exception 'Kun administrator kan endre dette feltet.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profile_columns_trigger on public.profiles;
create trigger protect_profile_columns_trigger
before update on public.profiles
for each row execute function public.protect_profile_columns();

-- interests/fun_fact removed from the shared directory view (feature dropped);
-- employee_number added so everyone can see colleagues' employee numbers.
drop function if exists public.get_people_directory();
create function public.get_people_directory()
returns table(id uuid, full_name text, title text, role text, email text, phone text, employee_number int)
language sql stable security definer set search_path to 'public'
as $$
  select id, full_name, title, role, email, phone, employee_number
  from public.profiles;
$$;
