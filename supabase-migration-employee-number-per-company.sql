-- Ansattnummer moves from a single profiles.employee_number to being
-- per-company (an employee working at multiple companies can have a
-- different number at each). profiles.employee_number is left in place
-- (not dropped) as a safety net for old data on profiles linked to zero or
-- multiple companies, which can't be unambiguously migrated automatically.

alter table public.profile_companies add column if not exists employee_number integer;

-- Backfill: profiles with exactly one company link get their existing
-- profiles.employee_number copied onto that single profile_companies row.
update public.profile_companies pc
set employee_number = p.employee_number
from public.profiles p
where pc.profile_id = p.id
  and p.employee_number is not null
  and pc.employee_number is null
  and (select count(*) from public.profile_companies pc2 where pc2.profile_id = p.id) = 1;
