-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- When a new employee profile row is created (on invite), automatically set
-- next_review_date to 6 months from today. Admin/leder can still change it
-- afterwards (protect_profile_columns already allows is_admin_or_manager()).

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, next_review_date)
  values (new.id, new.email, (current_date + interval '6 months')::date)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
