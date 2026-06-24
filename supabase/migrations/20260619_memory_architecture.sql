-- Relay personalization memory foundation.

alter table public.agent_memory
  add column if not exists writing_profile jsonb not null default '{}'::jsonb,
  add column if not exists recent_context jsonb not null default '[]'::jsonb,
  add column if not exists profile_version int not null default 1,
  add column if not exists learning_enabled boolean not null default true,
  add column if not exists confirmed_learning_only boolean not null default true;

create table if not exists public.memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email_id uuid references public.emails(id) on delete set null,
  thread_id uuid references public.email_threads(id) on delete set null,
  type text not null check (type in ('preference', 'style', 'contact', 'project', 'recent_context', 'fact')),
  scope text not null default 'global' check (scope in ('global', 'account', 'contact')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'archived')),
  text text not null,
  source text not null default 'inferred',
  confidence real check (confidence is null or confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists memory_items_set_updated_at on public.memory_items;
create trigger memory_items_set_updated_at
  before update on public.memory_items
  for each row execute function public.set_updated_at();

create table if not exists public.draft_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete cascade,
  email_id uuid references public.emails(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  generated_draft_id text,
  generated_body text,
  final_body text not null,
  accepted_without_edit boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists memory_items_user_status_idx
  on public.memory_items(user_id, status, updated_at desc);
create index if not exists memory_items_user_account_idx
  on public.memory_items(user_id, account_id, status, updated_at desc);
create index if not exists memory_items_user_contact_idx
  on public.memory_items(user_id, contact_id, status, updated_at desc);
create index if not exists memory_items_user_expiry_idx
  on public.memory_items(user_id, expires_at)
  where expires_at is not null;
create index if not exists draft_feedback_user_created_idx
  on public.draft_feedback(user_id, created_at desc);
create index if not exists draft_feedback_user_account_idx
  on public.draft_feedback(user_id, account_id, created_at desc);
create index if not exists contacts_user_last_seen_idx
  on public.contacts(user_id, last_seen_at desc nulls last);
create index if not exists email_embedding_chunks_user_account_idx
  on public.email_embedding_chunks(user_id, account_id, created_at desc);

alter table public.memory_items enable row level security;
alter table public.draft_feedback enable row level security;

drop policy if exists memory_items_select_own on public.memory_items;
create policy memory_items_select_own on public.memory_items
  for select using (auth.uid() = user_id);
drop policy if exists memory_items_insert_own on public.memory_items;
create policy memory_items_insert_own on public.memory_items
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists memory_items_update_own on public.memory_items;
create policy memory_items_update_own on public.memory_items
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists memory_items_delete_own on public.memory_items;
create policy memory_items_delete_own on public.memory_items
  for delete using (auth.uid() = user_id);

drop policy if exists draft_feedback_select_own on public.draft_feedback;
create policy draft_feedback_select_own on public.draft_feedback
  for select using (auth.uid() = user_id);
drop policy if exists draft_feedback_insert_own on public.draft_feedback;
create policy draft_feedback_insert_own on public.draft_feedback
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists draft_feedback_update_own on public.draft_feedback;
create policy draft_feedback_update_own on public.draft_feedback
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists draft_feedback_delete_own on public.draft_feedback;
create policy draft_feedback_delete_own on public.draft_feedback
  for delete using (auth.uid() = user_id);

create or replace function public.match_email_embedding_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  target_user_id uuid default auth.uid(),
  target_account_id uuid default null
)
returns table (
  id uuid,
  email_id uuid,
  provider_message_id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.email_id,
    chunks.provider_message_id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.email_embedding_chunks chunks
  where target_user_id is not null
    and chunks.user_id = target_user_id
    and (target_account_id is null or chunks.account_id = target_account_id)
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  target_user_id uuid default auth.uid()
)
returns table (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    embeddings.id,
    embeddings.content,
    embeddings.metadata,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from public.embeddings
  where target_user_id is not null
    and embeddings.embedding is not null
    and embeddings.user_id = target_user_id
    and 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;
