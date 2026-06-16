-- Durable, provider-neutral execution history for Relay's visible agent work.
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.email_accounts(id) on delete set null,
  agent_type text not null check (
    agent_type in (
      'commitment_monitor',
      'calendar_event_create',
      'calendar_event_update',
      'calendar_event_delete',
      'meeting_brief_prepare',
      'meeting_brief_refresh'
    )
  ),
  source_type text check (
    source_type is null or source_type in ('email', 'thread', 'commitment', 'calendar_event', 'meeting')
  ),
  source_id text,
  title text not null,
  summary text not null default '',
  status text not null default 'queued' check (
    status in (
      'draft',
      'awaiting_approval',
      'scheduled',
      'queued',
      'running',
      'needs_input',
      'completed',
      'partially_completed',
      'failed',
      'cancelled'
    )
  ),
  current_stage text,
  progress_current int not null default 0 check (progress_current >= 0),
  progress_total int check (progress_total is null or progress_total > 0),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 3 check (max_attempts > 0),
  idempotency_key text,
  input_manifest jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

drop trigger if exists agent_runs_set_updated_at on public.agent_runs;
create trigger agent_runs_set_updated_at
  before update on public.agent_runs
  for each row execute function public.set_updated_at();

create table if not exists public.agent_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  event_type text not null check (
    event_type in ('created', 'scheduled', 'started', 'stage', 'input_required', 'completed', 'failed', 'cancelled', 'retried')
  ),
  stage text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_user_status_updated_idx
  on public.agent_runs(user_id, status, updated_at desc);
create index if not exists agent_runs_user_scheduled_idx
  on public.agent_runs(user_id, scheduled_for)
  where status = 'scheduled';
create index if not exists agent_activity_events_run_created_idx
  on public.agent_activity_events(agent_run_id, created_at asc);

alter table public.agent_runs enable row level security;
alter table public.agent_activity_events enable row level security;

drop policy if exists agent_runs_select_own on public.agent_runs;
create policy agent_runs_select_own on public.agent_runs
  for select using (auth.uid() = user_id);
drop policy if exists agent_runs_insert_own on public.agent_runs;
create policy agent_runs_insert_own on public.agent_runs
  for insert with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists agent_runs_update_own on public.agent_runs;
create policy agent_runs_update_own on public.agent_runs
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (account_id is null or public.current_user_owns_email_account(account_id))
  );
drop policy if exists agent_runs_delete_own on public.agent_runs;
create policy agent_runs_delete_own on public.agent_runs
  for delete using (auth.uid() = user_id);

drop policy if exists agent_activity_events_select_own on public.agent_activity_events;
create policy agent_activity_events_select_own on public.agent_activity_events
  for select using (auth.uid() = user_id);
drop policy if exists agent_activity_events_insert_own on public.agent_activity_events;
create policy agent_activity_events_insert_own on public.agent_activity_events
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_run_id and agent_runs.user_id = auth.uid()
    )
  );

