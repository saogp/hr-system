-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Adds an optional deviation (avvik) note + up to 3 photos to each cleaning
-- check-in. Photos are stored in a private bucket; only admin/leder can
-- read them (via signed URLs generated server-side), and they are meant to
-- be auto-deleted after 30 days by a scheduled cleanup route.

alter table public.cleaning_checks add column if not exists deviation_note text;
alter table public.cleaning_checks add column if not exists deviation_photos jsonb not null default '[]';

insert into storage.buckets (id, name, public)
values ('cleaning-photos', 'cleaning-photos', false)
on conflict (id) do nothing;
