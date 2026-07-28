-- W3: webhook events analizowane przez agenta
-- Wklej calosc w Supabase Dashboard -> SQL Editor -> Run.

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('feedback', 'alert', 'order')),
  data jsonb not null,
  analysis text not null
);

create index if not exists webhook_events_type_created_at_idx
  on public.webhook_events(type, created_at desc);

alter table public.webhook_events enable row level security;

drop policy if exists "Webhooks can insert events" on public.webhook_events;
drop policy if exists "Authenticated users can read webhook events" on public.webhook_events;

create policy "Webhooks can insert events"
  on public.webhook_events for insert
  with check (true);

create policy "Authenticated users can read webhook events"
  on public.webhook_events for select
  using (auth.role() = 'authenticated');
