-- Profile picture upload: public "avatars" bucket, one file per user at
-- {profile_id}/avatar, path-based ownership check via storage.foldername.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar or admin any" on storage.objects;
create policy "Users can upload own avatar or admin any"
on storage.objects for insert
with check (
  bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Users can update own avatar or admin any" on storage.objects;
create policy "Users can update own avatar or admin any"
on storage.objects for update
using (
  bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Users can delete own avatar or admin any" on storage.objects;
create policy "Users can delete own avatar or admin any"
on storage.objects for delete
using (
  bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

-- Expose avatar_url through the shared directory view too.
drop function if exists public.get_people_directory();
create function public.get_people_directory()
returns table(id uuid, full_name text, title text, role text, email text, phone text, employee_number int, avatar_url text)
language sql stable security definer set search_path to 'public'
as $$
  select id, full_name, title, role, email, phone, employee_number, avatar_url
  from public.profiles;
$$;
