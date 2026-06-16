create table if not exists public.commitment_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused')),
  cadence_hours int not null default 24 check (cadence_hours between 1 and 168),
  next_check_at timestamptz not null,
  last_checked_at timestamptz,
  last_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, commitment_id)
);

create table if not exists public.meeting_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  title text not null,
  meeting_at timestamptz not null,
  status text not null default 'ready' check (status in ('ready', 'failed')),
  overview text not null default '',
  objectives jsonb not null default '[]'::jsonb,
  context_points jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  suggested_talking_points jsonb not null default '[]'::jsonb,
  source_message_ids jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commitment_monitors_due_idx
  on public.commitment_monitors(status, next_check_at) where status = 'active';
create index if not exists meeting_briefs_user_meeting_idx
  on public.meeting_briefs(user_id, meeting_at desc);

drop trigger if exists commitment_monitors_set_updated_at on public.commitment_monitors;
create trigger commitment_monitors_set_updated_at before update on public.commitment_monitors
  for each row execute function public.set_updated_at();
drop trigger if exists meeting_briefs_set_updated_at on public.meeting_briefs;
create trigger meeting_briefs_set_updated_at before update on public.meeting_briefs
  for each row execute function public.set_updated_at();

alter table public.commitment_monitors enable row level security;
alter table public.meeting_briefs enable row level security;
drop policy if exists commitment_monitors_all_own on public.commitment_monitors;
create policy commitment_monitors_all_own on public.commitment_monitors for all
  using (auth.uid() = user_id and public.current_user_owns_email_account(account_id))
  with check (auth.uid() = user_id and public.current_user_owns_email_account(account_id));
drop policy if exists meeting_briefs_all_own on public.meeting_briefs;
create policy meeting_briefs_all_own on public.meeting_briefs for all
  using (auth.uid() = user_id and public.current_user_owns_email_account(account_id))
  with check (auth.uid() = user_id and public.current_user_owns_email_account(account_id));
