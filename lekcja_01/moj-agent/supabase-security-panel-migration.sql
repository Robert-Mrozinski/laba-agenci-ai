-- W10/W4: panel bezpieczenstwa i logi podejrzanych wiadomosci
-- Wklej calosc w Supabase Dashboard -> SQL Editor -> Run.

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  endpoint text not null default '/api/chat',
  message text not null,
  reason text not null,
  blocked boolean not null default false
);

create index if not exists message_logs_blocked_created_at_idx
  on public.message_logs(blocked, created_at desc);

create index if not exists message_logs_user_id_created_at_idx
  on public.message_logs(user_id, created_at desc);

alter table public.message_logs enable row level security;

drop policy if exists "Users can read own message logs" on public.message_logs;
drop policy if exists "Users can insert own message logs" on public.message_logs;

create policy "Users can read own message logs"
  on public.message_logs for select
  using (user_id = auth.uid());

create policy "Users can insert own message logs"
  on public.message_logs for insert
  with check (user_id = auth.uid());
