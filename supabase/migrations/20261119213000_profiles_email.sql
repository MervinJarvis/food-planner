alter table public.profiles
add column email text;

update public.profiles as profile
set email = lower(auth_user.email)
from auth.users as auth_user
where auth_user.id = profile.user_id;

alter table public.profiles
alter column email set not null;

create unique index profiles_email_lower_unique
on public.profiles (lower(email));

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text;
  normalized_email text;
begin
  normalized_username := lower(btrim(new.raw_user_meta_data ->> 'username'));
  normalized_email := lower(btrim(new.email));
  if normalized_username is null or normalized_username = '' then
    raise exception 'A username is required.';
  end if;
  if normalized_email is null or normalized_email = '' then
    raise exception 'An email address is required.';
  end if;

  insert into public.profiles (user_id, username, email)
  values (new.id, normalized_username, normalized_email);
  return new;
end;
$$;

create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = lower(btrim(new.email))
  where user_id = new.id;
  return new;
end;
$$;

create trigger sync_profile_email_after_auth_email_update
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

comment on column public.profiles.email is
'Lowercase copy of the account email for profile lookup. Supabase Auth remains the source of truth.';
