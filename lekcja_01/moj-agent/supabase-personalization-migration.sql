-- W4: personalizacja profilu uzytkownika
-- Wklej calosc w Supabase Dashboard -> SQL Editor -> Run.

alter table public.user_profiles
  add column if not exists display_name text;

alter table public.user_profiles
  add column if not exists preferences jsonb default '{}'::jsonb;

alter table public.user_profiles
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'name'
  ) then
    update public.user_profiles
    set display_name = coalesce(display_name, name),
        updated_at = now()
    where display_name is null
      and name is not null;
  end if;
end $$;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
