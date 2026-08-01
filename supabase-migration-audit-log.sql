-- Change-history log for people-management actions (profile edits,
-- activate/deactivate, delete, company assignment). No FKs on actor_id /
-- target_profile_id -- audit rows are historical records and must survive
-- deletion of the profiles they describe; details jsonb carries a durable
-- human-readable snapshot (name/email) captured at the time of the action.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  target_profile_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy admin_select_audit_log on public.audit_log for select
  using (is_admin() and (target_profile_id is null or shares_company_with(target_profile_id)));

create policy actor_insert_audit_log on public.audit_log for insert
  with check (actor_id = auth.uid() and is_admin_or_manager());
