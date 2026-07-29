-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Extend the shared people-directory RPC (used by non-admin employees) with
-- a privacy-safe is_birthday_today flag, so employees can see colleague
-- birthdays in the "Visste du at" dashboard card without exposing the
-- actual birth date (and therefore age) of every employee.

drop function if exists public.get_people_directory();
create function public.get_people_directory()
returns table(
  id uuid,
  full_name text,
  title text,
  role text,
  email text,
  phone text,
  employee_number int,
  avatar_url text,
  is_birthday_today boolean
)
language sql stable security definer set search_path to 'public'
as $$
  select
    id, full_name, title, role, email, phone, employee_number, avatar_url,
    (
      birth_date is not null
      and extract(month from birth_date) = extract(month from current_date)
      and extract(day from birth_date) = extract(day from current_date)
    ) as is_birthday_today
  from public.profiles;
$$;
