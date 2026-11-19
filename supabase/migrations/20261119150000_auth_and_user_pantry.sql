create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (length(username) > 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to service_role;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(btrim(new.raw_user_meta_data ->> 'username'));
  if normalized_username is null or normalized_username = '' then
    raise exception 'A username is required.';
  end if;

  insert into public.profiles (user_id, username)
  values (new.id, normalized_username);
  return new;
end;
$$;

create trigger create_profile_after_auth_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create table public.pantry_stock (
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id text not null check (length(ingredient_id) > 0),
  quantity double precision not null check (quantity > 0),
  unit text not null check (unit in ('piece', 'clove', 'leaf', 'g', 'kg', 'oz', 'cup', 'tsp', 'tbsp')),
  primary key (user_id, ingredient_id)
);

alter table public.pantry_stock enable row level security;
revoke all on table public.pantry_stock from anon, authenticated;
grant select, insert, update, delete on table public.pantry_stock to authenticated;

create policy "Users can read their own pantry"
on public.pantry_stock for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add to their own pantry"
on public.pantry_stock for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own pantry"
on public.pantry_stock for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can remove from their own pantry"
on public.pantry_stock for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.replace_my_pantry(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Pantry items must be an array.' using errcode = '22023';
  end if;

  delete from public.pantry_stock
  where user_id = current_user_id;

  insert into public.pantry_stock (user_id, ingredient_id, quantity, unit)
  select current_user_id, item.ingredient_id, item.quantity, item.unit
  from jsonb_to_recordset(p_items) as item(
    ingredient_id text,
    quantity double precision,
    unit text
  );
end;
$$;

revoke all on function public.replace_my_pantry(jsonb) from public, anon;
grant execute on function public.replace_my_pantry(jsonb) to authenticated;
