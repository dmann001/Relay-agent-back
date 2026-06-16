-- User-confirmed email commitments. Provider IDs are retained so a commitment
-- remains traceable even if cached email rows are later removed.
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete set null,
  source_email_id uuid references public.emails(id) on delete set null,
  source_thread_id uuid references public.email_threads(id) on delete set null,
  provider text check (provider is null or provider in ('gmail', 'outlook')),
  provider_message_id text,
  provider_thread_id text,
  type text not null check (type in ('my_task', 'waiting_for_reply', 'waiting_for_artifact', 'follow_up')),
  title text not null,
  description text not null default '',
  expected_outcome text not null default '',
  owner_name text not null default '',
  owner_email citext,
  due_at timestamptz,
  timezone text not null default 'UTC',
  evidence text not null default '',
  status text not null default 'active' check (
    status in ('active', 'needs_review', 'satisfied', 'dismissed', 'expired')
  ),
  snoozed_until timestamptz,
  confirmed_at timestamptz not null default now(),
  satisfied_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists commitments_set_updated_at on public.commitments;
create trigger commitments_set_updated_at
  before update on public.commitments
  for each row execute function public.set_updated_at();

create index if not exists commitments_user_status_due_idx
  on public.commitments(user_id, status, due_at);
create index if not exists commitments_user_account_idx
  on public.commitments(user_id, account_id, updated_at desc);
create index if not exists commitments_source_message_idx
  on public.commitments(account_id, provider_message_id);

alter table public.commitments enable row level security;

drop policy if exists commitments_select_own on public.commitments;
create policy commitments_select_own on public.commitments
  for select using (auth.uid() = user_id);
drop policy if exists commitments_insert_own on public.commitments;
create policy commitments_insert_own on public.commitments
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists commitments_update_own on public.commitments;
create policy commitments_update_own on public.commitments
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists commitments_delete_own on public.commitments;
create policy commitments_delete_own on public.commitments
  for delete using (auth.uid() = user_id);

