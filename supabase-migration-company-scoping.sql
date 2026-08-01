-- Company-scoped RLS: admins/managers only see data for companies they're
-- linked to via profile_companies. Hidden super-admin escape hatch for Eva.

alter table public.profiles add column if not exists is_super_admin boolean not null default false;
update public.profiles set is_super_admin = true where id = 'a9583905-b903-4a27-84d8-7e9d444fb714'; -- Eva Fossen Haugum

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_company_access(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.profile_companies
    where profile_id = auth.uid() and company_id = target_company_id
  )
$$;

create or replace function public.shares_company_with(target_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.profile_companies mine
    join public.profile_companies theirs on theirs.company_id = mine.company_id
    where mine.profile_id = auth.uid() and theirs.profile_id = target_profile_id
  )
$$;

-- contracts (direct company_id)
drop policy if exists mgr_select_contracts on public.contracts;
create policy mgr_select_contracts on public.contracts for select
  using (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_insert_contracts on public.contracts;
create policy mgr_insert_contracts on public.contracts for insert
  with check (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_update_contracts on public.contracts;
create policy mgr_update_contracts on public.contracts for update
  using (is_admin_or_manager() and has_company_access(company_id))
  with check (is_admin_or_manager() and has_company_access(company_id));

-- surveys (direct company_id). Also narrow the old blanket "everyone can
-- read all surveys" policy, which would otherwise silently defeat scoping
-- (permissive RLS policies OR together) -- employees still need to read a
-- survey they created or were sent, just not every company's surveys.
drop policy if exists "Alle kan lese undersokelser" on public.surveys;
create policy "Ansatte kan lese egne undersokelser" on public.surveys for select
  using (
    created_by = auth.uid()
    or exists (select 1 from public.survey_recipients sr where sr.survey_id = surveys.id and sr.profile_id = auth.uid())
  );

drop policy if exists mgr_select_surveys on public.surveys;
create policy mgr_select_surveys on public.surveys for select
  using (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_insert_surveys on public.surveys;
create policy mgr_insert_surveys on public.surveys for insert
  with check (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_update_surveys on public.surveys;
create policy mgr_update_surveys on public.surveys for update
  using (is_admin_or_manager() and has_company_access(company_id))
  with check (is_admin_or_manager() and has_company_access(company_id));

-- survey_recipients (scoped via parent survey's company_id)
drop policy if exists mgr_select_survey_recipients on public.survey_recipients;
create policy mgr_select_survey_recipients on public.survey_recipients for select
  using (is_admin_or_manager() and has_company_access((select company_id from public.surveys where id = survey_recipients.survey_id)));

drop policy if exists mgr_insert_survey_recipients on public.survey_recipients;
create policy mgr_insert_survey_recipients on public.survey_recipients for insert
  with check (is_admin_or_manager() and has_company_access((select company_id from public.surveys where id = survey_recipients.survey_id)));

drop policy if exists mgr_update_survey_recipients on public.survey_recipients;
create policy mgr_update_survey_recipients on public.survey_recipients for update
  using (is_admin_or_manager() and has_company_access((select company_id from public.surveys where id = survey_recipients.survey_id)))
  with check (is_admin_or_manager() and has_company_access((select company_id from public.surveys where id = survey_recipients.survey_id)));

-- cleaning_room_groups (direct company_id)
drop policy if exists mgr_select_cleaning_room_groups on public.cleaning_room_groups;
create policy mgr_select_cleaning_room_groups on public.cleaning_room_groups for select
  using (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_insert_cleaning_room_groups on public.cleaning_room_groups;
create policy mgr_insert_cleaning_room_groups on public.cleaning_room_groups for insert
  with check (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_update_cleaning_room_groups on public.cleaning_room_groups;
create policy mgr_update_cleaning_room_groups on public.cleaning_room_groups for update
  using (is_admin_or_manager() and has_company_access(company_id))
  with check (is_admin_or_manager() and has_company_access(company_id));

-- cleaning_assignments (direct company_id)
drop policy if exists mgr_select_cleaning_assignments on public.cleaning_assignments;
create policy mgr_select_cleaning_assignments on public.cleaning_assignments for select
  using (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_insert_cleaning_assignments on public.cleaning_assignments;
create policy mgr_insert_cleaning_assignments on public.cleaning_assignments for insert
  with check (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_update_cleaning_assignments on public.cleaning_assignments;
create policy mgr_update_cleaning_assignments on public.cleaning_assignments for update
  using (is_admin_or_manager() and has_company_access(company_id))
  with check (is_admin_or_manager() and has_company_access(company_id));

-- cleaning_rooms (via group_id -> cleaning_room_groups.company_id)
drop policy if exists mgr_select_cleaning_rooms on public.cleaning_rooms;
create policy mgr_select_cleaning_rooms on public.cleaning_rooms for select
  using (is_admin_or_manager() and has_company_access((select company_id from public.cleaning_room_groups where id = cleaning_rooms.group_id)));

drop policy if exists mgr_insert_cleaning_rooms on public.cleaning_rooms;
create policy mgr_insert_cleaning_rooms on public.cleaning_rooms for insert
  with check (is_admin_or_manager() and has_company_access((select company_id from public.cleaning_room_groups where id = cleaning_rooms.group_id)));

drop policy if exists mgr_update_cleaning_rooms on public.cleaning_rooms;
create policy mgr_update_cleaning_rooms on public.cleaning_rooms for update
  using (is_admin_or_manager() and has_company_access((select company_id from public.cleaning_room_groups where id = cleaning_rooms.group_id)))
  with check (is_admin_or_manager() and has_company_access((select company_id from public.cleaning_room_groups where id = cleaning_rooms.group_id)));

-- cleaning_checks (via room_id -> cleaning_rooms.group_id -> cleaning_room_groups.company_id)
drop policy if exists mgr_select_cleaning_checks on public.cleaning_checks;
create policy mgr_select_cleaning_checks on public.cleaning_checks for select
  using (
    is_admin_or_manager() and has_company_access((
      select crg.company_id from public.cleaning_rooms cr
      join public.cleaning_room_groups crg on crg.id = cr.group_id
      where cr.id = cleaning_checks.room_id
    ))
  );

-- reviews (scoped by the employee being reviewed)
drop policy if exists mgr_select_reviews on public.reviews;
create policy mgr_select_reviews on public.reviews for select
  using (is_admin_or_manager() and shares_company_with(employee_id));

drop policy if exists mgr_insert_reviews on public.reviews;
create policy mgr_insert_reviews on public.reviews for insert
  with check (is_admin_or_manager() and shares_company_with(employee_id));

drop policy if exists mgr_update_reviews on public.reviews;
create policy mgr_update_reviews on public.reviews for update
  using (is_admin_or_manager() and shares_company_with(employee_id))
  with check (is_admin_or_manager() and shares_company_with(employee_id));

-- review_tasks (via review_id -> reviews.employee_id)
drop policy if exists mgr_select_review_tasks on public.review_tasks;
create policy mgr_select_review_tasks on public.review_tasks for select
  using (is_admin_or_manager() and shares_company_with((select employee_id from public.reviews where id = review_tasks.review_id)));

drop policy if exists mgr_insert_review_tasks on public.review_tasks;
create policy mgr_insert_review_tasks on public.review_tasks for insert
  with check (is_admin_or_manager() and shares_company_with((select employee_id from public.reviews where id = review_tasks.review_id)));

drop policy if exists mgr_update_review_tasks on public.review_tasks;
create policy mgr_update_review_tasks on public.review_tasks for update
  using (is_admin_or_manager() and shares_company_with((select employee_id from public.reviews where id = review_tasks.review_id)))
  with check (is_admin_or_manager() and shares_company_with((select employee_id from public.reviews where id = review_tasks.review_id)));

-- uniform_issuances (keep existing self-view clause)
drop policy if exists mgr_select_uniform_issuances on public.uniform_issuances;
create policy mgr_select_uniform_issuances on public.uniform_issuances for select
  using ((is_admin_or_manager() and shares_company_with(profile_id)) or profile_id = auth.uid());

drop policy if exists mgr_insert_uniform_issuances on public.uniform_issuances;
create policy mgr_insert_uniform_issuances on public.uniform_issuances for insert
  with check (is_admin_or_manager() and shares_company_with(profile_id));

drop policy if exists mgr_update_uniform_issuances on public.uniform_issuances;
create policy mgr_update_uniform_issuances on public.uniform_issuances for update
  using ((is_admin_or_manager() and shares_company_with(profile_id)) or profile_id = auth.uid())
  with check ((is_admin_or_manager() and shares_company_with(profile_id)) or profile_id = auth.uid());

-- profiles: bootstrap carve-out -- a profile with zero company links yet
-- (brand new invite, or a legacy profile predating company assignment) stays
-- visible to any admin/manager so someone can assign it a company. Once it
-- has at least one company link, visibility narrows to overlapping companies.
drop policy if exists mgr_select_profiles on public.profiles;
create policy mgr_select_profiles on public.profiles for select
  using (
    is_admin_or_manager() and (
      shares_company_with(id)
      or not exists (select 1 from public.profile_companies pc where pc.profile_id = profiles.id)
    )
  );

drop policy if exists mgr_update_profiles on public.profiles;
create policy mgr_update_profiles on public.profiles for update
  using (
    is_admin_or_manager() and (
      shares_company_with(id)
      or not exists (select 1 from public.profile_companies pc where pc.profile_id = profiles.id)
    )
  )
  with check (
    is_admin_or_manager() and (
      shares_company_with(id)
      or not exists (select 1 from public.profile_companies pc where pc.profile_id = profiles.id)
    )
  );

-- profile_companies: a manager can only link a profile to a company they
-- themselves have access to (prevents granting access to companies outside
-- their own scope). Read stays as-is (existing blanket policy, low
-- sensitivity -- just company-membership metadata).
drop policy if exists mgr_insert_profile_companies on public.profile_companies;
create policy mgr_insert_profile_companies on public.profile_companies for insert
  with check (is_admin_or_manager() and has_company_access(company_id));

drop policy if exists mgr_update_profile_companies on public.profile_companies;
create policy mgr_update_profile_companies on public.profile_companies for update
  using (is_admin_or_manager() and has_company_access(company_id))
  with check (is_admin_or_manager() and has_company_access(company_id));

-- companies: leave SELECT broad (employees legitimately need to read company
-- names for their own profile/contract views, via the existing blanket
-- policy) -- only scope UPDATE, so a manager can't edit a company outside
-- their own access (e.g. changing another company's accountant email).
drop policy if exists mgr_update_companies on public.companies;
create policy mgr_update_companies on public.companies for update
  using (is_admin_or_manager() and has_company_access(id))
  with check (is_admin_or_manager() and has_company_access(id));
