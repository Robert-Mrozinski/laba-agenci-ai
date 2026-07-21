-- Supabase Auth + prywatne rozmowy i dokumenty
-- Wklej całość w Supabase Dashboard -> SQL Editor -> Run.

alter table public.conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists conversations_user_id_updated_at_idx
  on public.conversations(user_id, updated_at desc);

create index if not exists documents_user_id_title_idx
  on public.documents(user_id, title);

-- Usuń stare, anonimowe dane z warsztatów.
delete from public.messages
where conversation_id in (
  select id from public.conversations where user_id is null
);

delete from public.conversations where user_id is null;
delete from public.documents where user_id is null;

alter table public.conversations
  alter column user_id set not null;

alter table public.documents
  alter column user_id set not null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "Users can read own conversations" on public.conversations;
drop policy if exists "Users can insert own conversations" on public.conversations;
drop policy if exists "Users can update own conversations" on public.conversations;
drop policy if exists "Users can delete own conversations" on public.conversations;

create policy "Users can read own conversations"
  on public.conversations for select
  using (user_id = auth.uid());

create policy "Users can insert own conversations"
  on public.conversations for insert
  with check (user_id = auth.uid());

create policy "Users can update own conversations"
  on public.conversations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own conversations"
  on public.conversations for delete
  using (user_id = auth.uid());

drop policy if exists "Users can read own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Users can delete own messages" on public.messages;

create policy "Users can read own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert own messages"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

create policy "Users can delete own messages"
  on public.messages for delete
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

drop policy if exists "Users can read own documents" on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can update own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;

create policy "Users can read own documents"
  on public.documents for select
  using (user_id = auth.uid());

create policy "Users can insert own documents"
  on public.documents for insert
  with check (user_id = auth.uid());

create policy "Users can update own documents"
  on public.documents for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own documents"
  on public.documents for delete
  using (user_id = auth.uid());

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

-- Jeśli masz funkcję match_documents z wcześniejszej lekcji, upewnij się,
-- że działa jako security invoker albo filtruje documents.user_id = auth.uid().
-- Kod aplikacji dodatkowo odrzuca cudze wyniki po metadata.user_id.
