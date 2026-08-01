-- Fix infinite recursion: surveys' self-read policy queries survey_recipients,
-- whose mgr_* policies queried back into surveys via a plain subquery (which
-- is itself subject to surveys' RLS, re-triggering it -> cycle). Break the
-- cycle with a security-definer lookup that bypasses RLS internally, same
-- pattern as has_company_access/shares_company_with.

create or replace function public.survey_company_id(target_survey_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.surveys where id = target_survey_id
$$;

drop policy if exists mgr_select_survey_recipients on public.survey_recipients;
create policy mgr_select_survey_recipients on public.survey_recipients for select
  using (is_admin_or_manager() and has_company_access(public.survey_company_id(survey_recipients.survey_id)));

drop policy if exists mgr_insert_survey_recipients on public.survey_recipients;
create policy mgr_insert_survey_recipients on public.survey_recipients for insert
  with check (is_admin_or_manager() and has_company_access(public.survey_company_id(survey_recipients.survey_id)));

drop policy if exists mgr_update_survey_recipients on public.survey_recipients;
create policy mgr_update_survey_recipients on public.survey_recipients for update
  using (is_admin_or_manager() and has_company_access(public.survey_company_id(survey_recipients.survey_id)))
  with check (is_admin_or_manager() and has_company_access(public.survey_company_id(survey_recipients.survey_id)));
