-- Persisted AI chat sessions and messages for Relay AI and Ask Relay.
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id text,
  message_id text,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_user_updated_idx
  on public.ai_chat_sessions (user_id, updated_at desc);

drop trigger if exists ai_chat_sessions_set_updated_at on public.ai_chat_sessions;
create trigger ai_chat_sessions_set_updated_at
  before update on public.ai_chat_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  tools jsonb not null default '[]'::jsonb,
  response_id text,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_session_created_idx
  on public.ai_chat_messages (session_id, created_at asc);

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;

drop policy if exists ai_chat_sessions_select_own on public.ai_chat_sessions;
create policy ai_chat_sessions_select_own on public.ai_chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_insert_own on public.ai_chat_sessions;
create policy ai_chat_sessions_insert_own on public.ai_chat_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_update_own on public.ai_chat_sessions;
create policy ai_chat_sessions_update_own on public.ai_chat_sessions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists ai_chat_sessions_delete_own on public.ai_chat_sessions;
create policy ai_chat_sessions_delete_own on public.ai_chat_sessions
  for delete using (auth.uid() = user_id);

drop policy if exists ai_chat_messages_select_own on public.ai_chat_messages;
create policy ai_chat_messages_select_own on public.ai_chat_messages
  for select using (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists ai_chat_messages_insert_own on public.ai_chat_messages;
create policy ai_chat_messages_insert_own on public.ai_chat_messages
  for insert with check (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists ai_chat_messages_delete_own on public.ai_chat_messages;
create policy ai_chat_messages_delete_own on public.ai_chat_messages
  for delete using (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
