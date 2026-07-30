create table if not exists public.survey_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  questions jsonb not null default '[]'::jsonb,
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.survey_templates enable row level security;

create policy mgr_select_survey_templates on public.survey_templates
  for select using (is_admin_or_manager());

create policy mgr_insert_survey_templates on public.survey_templates
  for insert with check (is_admin_or_manager());

create policy mgr_update_survey_templates on public.survey_templates
  for update using (is_admin_or_manager()) with check (is_admin_or_manager());

create policy admin_delete_survey_templates on public.survey_templates
  for delete using (is_admin());
