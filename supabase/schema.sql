-- Relay app database schema.
-- Run this in the Supabase SQL editor before using the app.
--
-- Design notes:
-- - `relay_user_data` is kept for backwards compatibility with the current app.
-- - New application data should live in the normalized tables below.
-- - Email vectors belong in `email_embedding_chunks`, not as full email records in a
--   generic `embeddings` table. Store only searchable text chunks plus metadata there.
-- - `embeddings` and `match_embeddings` are kept as a compatibility layer for the
--   current server/services/vector_store.ts implementation.

create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- User profile and settings
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  relayed_mode boolean not null default false,
  user_context text not null default '',
  ai_features jsonb not null default '{
    "autoSummarize": true,
    "autoLabel": true,
    "smartReplies": true,
    "priorityInbox": false,
    "sentimentAnalysis": true,
    "taskExtraction": true,
    "meetingDetection": true,
    "autoArchive": false
  }'::jsonb,
  agent_config jsonb not null default '{
    "priorityThreshold": 70,
    "archiveAfterDays": 30,
    "maxReplySuggestions": 3,
    "preferredLanguage": "en",
    "customCategories": [],
    "vipSenders": []
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create table if not exists public.agent_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  summary text not null default '',
  recent_commands text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agent_memory_set_updated_at on public.agent_memory;
create trigger agent_memory_set_updated_at
  before update on public.agent_memory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Connected mail accounts and sync state
-- ---------------------------------------------------------------------------

create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  provider_account_id text,
  email citext not null,
  display_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

drop trigger if exists email_accounts_set_updated_at on public.email_accounts;
create trigger email_accounts_set_updated_at
  before update on public.email_accounts
  for each row execute function public.set_updated_at();

create table if not exists public.ai_account_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid primary key references public.email_accounts(id) on delete cascade,
  writing_style text not null default 'Concise, clear, warm, and professional.',
  signature text not null default '',
  draft_instructions text not null default '',
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ai_account_preferences_set_updated_at on public.ai_account_preferences;
create trigger ai_account_preferences_set_updated_at
  before update on public.ai_account_preferences
  for each row execute function public.set_updated_at();


create table if not exists public.email_sync_state (
  account_id uuid primary key references public.email_accounts(id) on delete cascade,
  history_id text,
  pagination_token text,
  last_successful_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_sync_state_set_updated_at on public.email_sync_state;
create trigger email_sync_state_set_updated_at
  before update on public.email_sync_state
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mail data
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  avatar_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  provider_thread_id text not null,
  subject text not null default '',
  last_message_at timestamptz,
  unread_count int not null default 0 check (unread_count >= 0),
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider_thread_id)
);

drop trigger if exists email_threads_set_updated_at on public.email_threads;
create trigger email_threads_set_updated_at
  before update on public.email_threads
  for each row execute function public.set_updated_at();

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  thread_id uuid references public.email_threads(id) on delete set null,
  provider text not null check (provider in ('gmail', 'outlook')),
  provider_message_id text not null,
  provider_thread_id text,
  rfc_message_id text,
  subject text not null default '',
  from_name text,
  from_email citext,
  body_html text,
  body_plain text,
  snippet text,
  sent_at timestamptz,
  received_at timestamptz,
  is_read boolean not null default false,
  is_archived boolean not null default false,
  archived_at timestamptz,
  has_attachments boolean not null default false,
  gmail_category text check (
    gmail_category is null or
    gmail_category in ('primary', 'promotions', 'social', 'updates', 'forums')
  ),
  intent text check (
    intent is null or
    intent in ('decision', 'info_request', 'meeting', 'action_item', 'update', 'relationship', 'unknown')
  ),
  requires_response boolean,
  response_deadline timestamptz,
  last_interaction_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider_message_id)
);

drop trigger if exists emails_set_updated_at on public.emails;
create trigger emails_set_updated_at
  before update on public.emails
  for each row execute function public.set_updated_at();

create table if not exists public.email_recipients (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('to', 'cc', 'bcc', 'reply_to')),
  recipient_name text,
  recipient_email citext not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_attachment_id text,
  filename text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0 check (byte_size >= 0),
  storage_bucket text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete cascade,
  provider_label_id text,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, name)
);

drop trigger if exists email_labels_set_updated_at on public.email_labels;
create trigger email_labels_set_updated_at
  before update on public.email_labels
  for each row execute function public.set_updated_at();

create table if not exists public.email_label_assignments (
  email_id uuid not null references public.emails(id) on delete cascade,
  label_id uuid not null references public.email_labels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (email_id, label_id)
);

-- ---------------------------------------------------------------------------
-- AI enrichment and vector search
-- ---------------------------------------------------------------------------

create table if not exists public.email_ai_enrichments (
  email_id uuid primary key references public.emails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_summary text,
  ai_labels text[] not null default '{}',
  sentiment text check (sentiment is null or sentiment in ('positive', 'negative', 'neutral')),
  urgency text check (urgency is null or urgency in ('low', 'medium', 'high', 'critical')),
  sentiment_confidence real check (sentiment_confidence is null or sentiment_confidence between 0 and 1),
  emotions text[] not null default '{}',
  priority_score int check (priority_score is null or priority_score between 0 and 100),
  meeting_request jsonb,
  model_name text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_ai_enrichments_set_updated_at on public.email_ai_enrichments;
create trigger email_ai_enrichments_set_updated_at
  before update on public.email_ai_enrichments
  for each row execute function public.set_updated_at();

create table if not exists public.email_embedding_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete cascade,
  email_id uuid references public.emails(id) on delete cascade,
  provider_message_id text,
  chunk_index int not null default 0 check (chunk_index >= 0),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_id, chunk_index)
);

drop trigger if exists email_embedding_chunks_set_updated_at on public.email_embedding_chunks;
create trigger email_embedding_chunks_set_updated_at
  before update on public.email_embedding_chunks
  for each row execute function public.set_updated_at();

-- Vector ANN indexes are intentionally not created in the main schema because
-- Supabase SQL editor sessions often have maintenance_work_mem = 32MB. Building
-- IVFFlat/HNSW indexes against existing embeddings can fail with:
-- "memory required is ... MB, maintenance_work_mem is 32 MB".
--
-- Semantic search still works without this index; it is just slower on large
-- datasets. Add an ANN index later from a migration/session with enough memory,
-- or after trimming/rebuilding old embeddings.
--
-- create index concurrently email_embedding_chunks_vector_idx
--   on public.email_embedding_chunks
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 10);

create or replace function public.match_email_embedding_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  target_user_id uuid default auth.uid()
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
  where chunks.user_id = target_user_id
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Compatibility table for the current VectorStore implementation.
-- Prefer `email_embedding_chunks` for new code because it is user scoped.
create table if not exists public.embeddings (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content text,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.embeddings
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists embedding_model text not null default 'text-embedding-3-small';

drop trigger if exists embeddings_set_updated_at on public.embeddings;
create trigger embeddings_set_updated_at
  before update on public.embeddings
  for each row execute function public.set_updated_at();

-- Compatibility table ANN index. Keep disabled for the same reason as above.
--
-- create index concurrently embeddings_vector_idx
--   on public.embeddings
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 10);

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5,
  target_user_id uuid default null
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
  where embeddings.embedding is not null
    and (target_user_id is null or embeddings.user_id = target_user_id)
    and 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- User workflow data
-- ---------------------------------------------------------------------------

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete set null,
  email_id uuid references public.emails(id) on delete set null,
  thread_id uuid references public.email_threads(id) on delete set null,
  provider text not null check (provider in ('gmail', 'outlook')),
  to_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  subject text not null default '',
  body text not null default '',
  in_reply_to text,
  ai_generated boolean not null default false,
  last_edited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists drafts_set_updated_at on public.drafts;
create trigger drafts_set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_email_id uuid references public.emails(id) on delete set null,
  title text not null,
  description text,
  deadline timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id uuid references public.emails(id) on delete cascade,
  thread_id uuid references public.email_threads(id) on delete cascade,
  reminder_at timestamptz not null,
  reason text not null,
  type text not null check (type in ('no_reply', 'follow_up', 'deadline', 'custom')),
  active boolean not null default true,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists reminders_set_updated_at on public.reminders;
create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

create table if not exists public.smart_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  natural_language_query text not null,
  parsed_rules jsonb not null default '[]'::jsonb,
  action jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  match_count int not null default 0 check (match_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists smart_filters_set_updated_at on public.smart_filters;
create trigger smart_filters_set_updated_at
  before update on public.smart_filters
  for each row execute function public.set_updated_at();

create table if not exists public.archive_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  conditions jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  archived_count int not null default 0 check (archived_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists archive_rules_set_updated_at on public.archive_rules;
create trigger archive_rules_set_updated_at
  before update on public.archive_rules
  for each row execute function public.set_updated_at();

create table if not exists public.reply_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id uuid references public.emails(id) on delete cascade,
  suggestions jsonb not null default '[]'::jsonb,
  cached boolean not null default true,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email_id)
);

drop trigger if exists reply_suggestions_set_updated_at on public.reply_suggestions;
create trigger reply_suggestions_set_updated_at
  before update on public.reply_suggestions
  for each row execute function public.set_updated_at();

create table if not exists public.usage_daily_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  stat_date date not null default current_date,
  emails_processed int not null default 0 check (emails_processed >= 0),
  ai_calls int not null default 0 check (ai_calls >= 0),
  smart_replies_generated int not null default 0 check (smart_replies_generated >= 0),
  emails_summarized int not null default 0 check (emails_summarized >= 0),
  emails_categorized int not null default 0 check (emails_categorized >= 0),
  tasks_extracted int not null default 0 check (tasks_extracted >= 0),
  meetings_detected int not null default 0 check (meetings_detected >= 0),
  sentiment_analyzed int not null default 0 check (sentiment_analyzed >= 0),
  filters_applied int not null default 0 check (filters_applied >= 0),
  emails_archived int not null default 0 check (emails_archived >= 0),
  bulk_actions_performed int not null default 0 check (bulk_actions_performed >= 0),
  estimated_time_saved_minutes numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, stat_date)
);

drop trigger if exists usage_daily_stats_set_updated_at on public.usage_daily_stats;
create trigger usage_daily_stats_set_updated_at
  before update on public.usage_daily_stats
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Backwards-compatible JSON app state.
-- ---------------------------------------------------------------------------

create table if not exists public.relay_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists email_accounts_user_idx on public.email_accounts(user_id);
create index if not exists contacts_user_email_idx on public.contacts(user_id, email);
create index if not exists email_threads_user_last_message_idx on public.email_threads(user_id, last_message_at desc);
create index if not exists emails_user_received_idx on public.emails(user_id, received_at desc);
create index if not exists emails_account_provider_message_idx on public.emails(account_id, provider_message_id);
create index if not exists emails_user_archived_idx on public.emails(user_id, is_archived, received_at desc);
create index if not exists emails_user_from_idx on public.emails(user_id, from_email);
create index if not exists email_recipients_email_idx on public.email_recipients(email_id);
create index if not exists email_recipients_user_recipient_idx on public.email_recipients(user_id, recipient_email);
create index if not exists email_attachments_email_idx on public.email_attachments(email_id);
create index if not exists email_labels_user_idx on public.email_labels(user_id);
create index if not exists email_label_assignments_label_idx on public.email_label_assignments(label_id);
create index if not exists email_embedding_chunks_user_email_idx on public.email_embedding_chunks(user_id, email_id);
create index if not exists tasks_user_completed_deadline_idx on public.tasks(user_id, completed, deadline);
create index if not exists reminders_user_active_due_idx on public.reminders(user_id, active, reminder_at);
create index if not exists smart_filters_user_enabled_idx on public.smart_filters(user_id, enabled);
create index if not exists archive_rules_user_enabled_idx on public.archive_rules(user_id, enabled);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.agent_memory enable row level security;
alter table public.ai_account_preferences enable row level security;
alter table public.email_accounts enable row level security;
alter table public.email_sync_state enable row level security;
alter table public.contacts enable row level security;
alter table public.email_threads enable row level security;
alter table public.emails enable row level security;
alter table public.email_recipients enable row level security;
alter table public.email_attachments enable row level security;
alter table public.email_labels enable row level security;
alter table public.email_label_assignments enable row level security;
alter table public.email_ai_enrichments enable row level security;
alter table public.email_embedding_chunks enable row level security;
alter table public.drafts enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.smart_filters enable row level security;
alter table public.archive_rules enable row level security;
alter table public.reply_suggestions enable row level security;
alter table public.usage_daily_stats enable row level security;
alter table public.relay_user_data enable row level security;
alter table public.embeddings enable row level security;

create or replace function public.current_user_owns_email_account(account_id uuid)
returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.email_accounts accounts
    where accounts.id = account_id
      and accounts.user_id = auth.uid()
  );
$$;

-- Simple owner policies for tables with a direct user_id column.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'app_settings',
    'agent_memory',
    'email_accounts',
    'contacts',
    'email_threads',
    'emails',
    'email_recipients',
    'email_attachments',
    'email_labels',
    'email_label_assignments',
    'email_ai_enrichments',
    'email_embedding_chunks',
    'drafts',
    'tasks',
    'reminders',
    'smart_filters',
    'archive_rules',
    'reply_suggestions',
    'usage_daily_stats',
    'relay_user_data'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      table_name || '_select_own',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      table_name || '_insert_own',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name || '_update_own',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      table_name || '_delete_own',
      table_name
    );
  end loop;
end $$;


-- AI preferences are account-scoped and must match both the user and owned account.
drop policy if exists ai_account_preferences_select_own on public.ai_account_preferences;
create policy ai_account_preferences_select_own on public.ai_account_preferences
  for select using (auth.uid() = user_id and public.current_user_owns_email_account(account_id));
drop policy if exists ai_account_preferences_insert_own on public.ai_account_preferences;
create policy ai_account_preferences_insert_own on public.ai_account_preferences
  for insert with check (auth.uid() = user_id and public.current_user_owns_email_account(account_id));
drop policy if exists ai_account_preferences_update_own on public.ai_account_preferences;
create policy ai_account_preferences_update_own on public.ai_account_preferences
  for update using (auth.uid() = user_id and public.current_user_owns_email_account(account_id))
  with check (auth.uid() = user_id and public.current_user_owns_email_account(account_id));
drop policy if exists ai_account_preferences_delete_own on public.ai_account_preferences;
create policy ai_account_preferences_delete_own on public.ai_account_preferences
  for delete using (auth.uid() = user_id and public.current_user_owns_email_account(account_id));

-- email_sync_state ownership is derived through email_accounts.
drop policy if exists email_sync_state_select_own on public.email_sync_state;
create policy email_sync_state_select_own
  on public.email_sync_state
  for select
  using (public.current_user_owns_email_account(account_id));

drop policy if exists email_sync_state_insert_own on public.email_sync_state;
create policy email_sync_state_insert_own
  on public.email_sync_state
  for insert
  with check (public.current_user_owns_email_account(account_id));

drop policy if exists email_sync_state_update_own on public.email_sync_state;
create policy email_sync_state_update_own
  on public.email_sync_state
  for update
  using (public.current_user_owns_email_account(account_id))
  with check (public.current_user_owns_email_account(account_id));

drop policy if exists email_sync_state_delete_own on public.email_sync_state;
create policy email_sync_state_delete_own
  on public.email_sync_state
  for delete
  using (public.current_user_owns_email_account(account_id));

-- Compatibility embeddings policy. Rows without user_id are visible only to
-- service-role clients because anon/authenticated clients cannot satisfy these.
drop policy if exists embeddings_select_own on public.embeddings;
create policy embeddings_select_own
  on public.embeddings
  for select
  using (user_id = auth.uid());

drop policy if exists embeddings_insert_own on public.embeddings;
create policy embeddings_insert_own
  on public.embeddings
  for insert
  with check (user_id = auth.uid());

drop policy if exists embeddings_update_own on public.embeddings;
create policy embeddings_update_own
  on public.embeddings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists embeddings_delete_own on public.embeddings;
create policy embeddings_delete_own
  on public.embeddings
  for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Gmail metadata-cache sync (see supabase/migrations/20260611_gmail_metadata_sync.sql)
-- Relay DB stores email METADATA only; full bodies are fetched live from Gmail.
-- ---------------------------------------------------------------------------

alter table public.emails
  add column if not exists is_starred boolean not null default false,
  add column if not exists is_trashed boolean not null default false,
  add column if not exists trashed_at timestamptz,
  add column if not exists is_inbox boolean not null default false,
  add column if not exists is_sent boolean not null default false,
  add column if not exists labels text[] not null default '{}',
  add column if not exists to_recipients jsonb not null default '[]'::jsonb;

create index if not exists emails_user_inbox_idx
  on public.emails(user_id, is_inbox, is_trashed, received_at desc);
create index if not exists emails_user_sent_idx
  on public.emails(user_id, is_sent, received_at desc);
create index if not exists emails_user_trash_idx
  on public.emails(user_id, is_trashed, received_at desc);

alter table public.drafts
  add column if not exists gmail_draft_id text,
  add column if not exists snippet text not null default '',
  add column if not exists status text not null default 'saved';

alter table public.drafts
  drop constraint if exists drafts_status_check;
alter table public.drafts
  add constraint drafts_status_check check (status in ('saved', 'saving', 'failed'));

-- Full (non-partial) unique index: Postgres ON CONFLICT inference cannot use
-- partial indexes, and the drafts sync upserts on (account_id, gmail_draft_id).
drop index if exists public.drafts_account_gmail_draft_idx;
create unique index if not exists drafts_account_gmail_draft_uidx
  on public.drafts(account_id, gmail_draft_id);

alter table public.email_sync_state
  add column if not exists initial_sync_done boolean not null default false,
  add column if not exists trash_synced_at timestamptz;
