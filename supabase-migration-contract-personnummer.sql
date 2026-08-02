-- Personnummer is contract-specific, not stored on profiles, so it never
-- surfaces anywhere else in the app (person profile, directory, etc.) --
-- only visible within the one contract it was collected for.
alter table public.contracts add column if not exists personnummer text;
