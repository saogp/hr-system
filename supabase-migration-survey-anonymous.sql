-- Anonymous surveys: admin sees who has/hasn't answered (for reminders), but
-- the answer content itself is shown unattributed to any name in the UI.
-- No RLS change needed — admin already reads survey_recipients.profile_id
-- (required for reminder tracking); the anonymity is enforced by the UI not
-- displaying profile_id alongside answer content when anonymous = true.
alter table public.surveys add column if not exists anonymous boolean not null default false;
