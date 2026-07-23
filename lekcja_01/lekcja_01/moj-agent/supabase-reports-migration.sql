-- W8: zapisywanie raportow uzytkownika
-- Wklej calosc w Supabase Dashboard -> SQL Editor -> Run.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_user_id_created_at_idx
  on public.reports(user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Users can read own reports" on public.reports;
drop policy if exists "Users can insert own reports" on public.reports;
drop policy if exists "Users can update own reports" on public.reports;
drop policy if exists "Users can delete own reports" on public.reports;

create policy "Users can read own reports"
  on public.reports for select
  using (user_id = auth.uid());

create policy "Users can insert own reports"
  on public.reports for insert
  with check (user_id = auth.uid());

create policy "Users can update own reports"
  on public.reports for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own reports"
  on public.reports for delete
  using (user_id = auth.uid());
