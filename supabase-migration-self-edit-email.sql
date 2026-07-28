-- Employees may now self-edit their own email (in addition to phone,
-- address, birth_date, and emergency contact) — remove email from the
-- admin-only protected column list. Note: profiles.email is a mirror of
-- auth.users.email (synced one-directionally by on_auth_user_email_sync);
-- editing it here does not change the actual login credential.
create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if not public.is_admin() then
    if new.full_name is distinct from old.full_name
      or new.role is distinct from old.role
      or new.manager_id is distinct from old.manager_id
      or new.title is distinct from old.title
      or new.employee_number is distinct from old.employee_number
      or new.employment_type is distinct from old.employment_type
      or new.position_percentage is distinct from old.position_percentage
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.next_review_date is distinct from old.next_review_date
    then
      raise exception 'Kun administrator kan endre dette feltet.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;
