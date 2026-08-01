create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('cleaning_daily_summary_enabled', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

create policy mgr_select_app_settings on public.app_settings for select
  using (is_admin_or_manager());

create policy mgr_update_app_settings on public.app_settings for update
  using (is_admin_or_manager())
  with check (is_admin_or_manager());
