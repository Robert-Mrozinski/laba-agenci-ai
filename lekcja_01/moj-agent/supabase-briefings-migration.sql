-- W9: poranny briefing generowany przez endpoint cron
-- Wklej calosc w Supabase Dashboard -> SQL Editor -> Run.
-- Endpoint /api/cron/morning najlepiej uruchamiac z SUPABASE_SERVICE_ROLE_KEY
-- ustawionym w .env.local po stronie serwera.

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  date date not null,
  user_id uuid references auth.users(id) on delete cascade
);

create index if not exists briefings_date_created_at_idx
  on public.briefings(date desc, created_at desc);

create index if not exists briefings_user_id_created_at_idx
  on public.briefings(user_id, created_at desc);

alter table public.briefings enable row level security;

drop policy if exists "Users can read own briefings" on public.briefings;
drop policy if exists "Users can read global briefings" on public.briefings;
drop policy if exists "Cron can insert global briefings" on public.briefings;

create policy "Users can read own briefings"
  on public.briefings for select
  using (user_id = auth.uid());

create policy "Users can read global briefings"
  on public.briefings for select
  using (user_id is null);

create policy "Cron can insert global briefings"
  on public.briefings for insert
  with check (user_id is null);
