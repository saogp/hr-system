-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Simplifies renhold: room names drop the ", kunde" / ", personal" suffix
-- (the group they belong to already says that), and the monthly rotating
-- ansvarsplan is replaced with one fixed company per group, still editable
-- any time via a single dropdown (Luna -> Personalrom, Peppes -> Kundetoaletter).

update public.cleaning_rooms set name = replace(name, ', kunde', '') where name like '%, kunde';
update public.cleaning_rooms set name = replace(name, ', personal', '') where name like '%, personal';

alter table public.cleaning_room_groups add column if not exists company_id uuid references public.companies(id) on delete set null;

update public.cleaning_room_groups
set company_id = (select id from public.companies where name ilike 'Luna' limit 1)
where name = 'Personalrom';

update public.cleaning_room_groups
set company_id = (select id from public.companies where name ilike 'Peppes' limit 1)
where name = 'Kundetoaletter';
