-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- A single editable email template sent to the cleaning notification
-- recipients whenever someone submits a check-in via a QR code.

create table if not exists public.cleaning_email_template (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Renhold - kvittering',
  body text not null default 'Rom: {{rom}}
Dato: {{dato}}
Registrert av: {{navn}}

Sjekkpunkter:
{{sjekkpunkter}}

Avvik: {{avvik}}'
);

insert into public.cleaning_email_template (subject, body)
select 'Renhold - kvittering', 'Rom: {{rom}}
Dato: {{dato}}
Registrert av: {{navn}}

Sjekkpunkter:
{{sjekkpunkter}}

Avvik: {{avvik}}'
where not exists (select 1 from public.cleaning_email_template);

alter table public.cleaning_email_template enable row level security;

drop policy if exists mgr_select_cleaning_email_template on public.cleaning_email_template;
drop policy if exists mgr_update_cleaning_email_template on public.cleaning_email_template;
create policy mgr_select_cleaning_email_template on public.cleaning_email_template for select using (public.is_admin_or_manager());
create policy mgr_update_cleaning_email_template on public.cleaning_email_template for update using (public.is_admin_or_manager());
