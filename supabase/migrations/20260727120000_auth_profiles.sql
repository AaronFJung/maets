-- Auth: profiles table, signup trigger, and avatar storage policies.
--
-- Every auth user gets exactly one public.profiles row (created automatically by
-- the on_auth_user_created trigger). The username is supplied at signup via the
-- auth user's metadata (options.data.username on the client).

-- ---------------------------------------------------------------------------
-- profiles table
-- ---------------------------------------------------------------------------

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null unique check (char_length(username) between 3 and 24),
    avatar_url text,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Data API roles get no privileges on new public tables by default (see
-- auto_expose_new_tables in config.toml), and RLS policies only filter rows a
-- role already has privileges on. Without these grants every PostgREST query
-- fails with "permission denied for table profiles" before RLS is consulted.
grant select, insert, update on public.profiles to authenticated;

-- Any signed-in user can read profiles (the lobby roster shows usernames/avatars).
create policy "Profiles are viewable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

-- Users may only insert/update their own row.
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, username)
    values (new.id, new.raw_user_meta_data ->> 'username');
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- avatar storage policies (bucket "avatars" is declared in supabase/config.toml)
--
-- Objects live at avatars/<user-id>/avatar-<timestamp>.webp. A user may only
-- read or write within their own <user-id> folder.
--
-- Avatars still render for everyone: the bucket is public, so file *contents*
-- are served from /storage/v1/object/public/avatars/..., which bypasses RLS.
-- Policies on storage.objects only govern listing and metadata, so this SELECT
-- is scoped to the owner. An unscoped `using (bucket_id = 'avatars')` would let
-- anyone -- including anon, since a policy without a `to` clause applies to
-- every role -- enumerate every user's id and avatar history via list().
-- ---------------------------------------------------------------------------

create policy "Users can read their own avatar objects"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their own avatar"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own avatar"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own avatar"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);
