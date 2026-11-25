create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_username text not null,
  body text not null default '',
  dish_name text,
  image_path text,
  created_at timestamptz not null default now(),
  constraint community_posts_body_length check (length(body) <= 2000),
  constraint community_posts_dish_name_length check (
    dish_name is null or length(btrim(dish_name)) between 1 and 120
  ),
  constraint community_posts_has_content check (
    length(btrim(body)) > 0 or dish_name is not null or image_path is not null
  )
);

create index community_posts_created_at_idx
on public.community_posts (created_at desc);

alter table public.community_posts enable row level security;
revoke all on table public.community_posts from anon, authenticated;
grant select on table public.community_posts to anon, authenticated;
grant insert, delete on table public.community_posts to authenticated;

create policy "Anyone can read community posts"
on public.community_posts for select
to anon, authenticated
using (true);

create policy "Users can create their own community posts"
on public.community_posts for insert
to authenticated
with check ((select auth.uid()) = author_id);

create policy "Users can delete their own community posts"
on public.community_posts for delete
to authenticated
using ((select auth.uid()) = author_id);

create function public.set_community_post_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  if new.author_id is null then
    raise exception 'Sign in is required to post.' using errcode = '42501';
  end if;

  select profile.username
  into new.author_username
  from public.profiles as profile
  where profile.user_id = new.author_id;

  if new.author_username is null then
    raise exception 'A community author profile could not be found.';
  end if;

  return new;
end;
$$;

revoke all on function public.set_community_post_author() from public, anon, authenticated;

create trigger set_community_post_author_before_insert
before insert on public.community_posts
for each row execute function public.set_community_post_author();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view community images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'community-images');

create policy "Users can upload their own community images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own community images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
