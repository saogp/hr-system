-- Run this in the Supabase SQL Editor after supabase-migration-user-profiles.sql.
-- Some employees work at more than one restaurant/company, so profiles<->companies
-- needs to be many-to-many instead of a single company_id on profiles.

create table if not exists public.profile_companies (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (profile_id, company_id)
);

-- Backfill from the old single company_id column, if it's still there.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'company_id'
  ) then
    insert into public.profile_companies (profile_id, company_id)
    select id, company_id from public.profiles where company_id is not null
    on conflict do nothing;

    alter table public.profiles drop column company_id;
  end if;
end $$;
