-- Separate calendar grants from mailbox grants so incremental OAuth cannot
-- accidentally replace the tokens Relay uses to read and send email.
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  default_calendar_id text not null default 'primary',
  status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id)
);

create table if not exists public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  provider_calendar_id text not null,
  provider_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'active' check (status in ('active', 'deleted', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calendar_event_links_active_commitment_uidx
  on public.calendar_event_links(commitment_id) where status = 'active';
create unique index if not exists calendar_event_links_provider_event_uidx
  on public.calendar_event_links(connection_id, provider_calendar_id, provider_event_id);
create index if not exists calendar_event_links_user_status_idx
  on public.calendar_event_links(user_id, status, starts_at);

drop trigger if exists calendar_connections_set_updated_at on public.calendar_connections;
create trigger calendar_connections_set_updated_at before update on public.calendar_connections
  for each row execute function public.set_updated_at();
drop trigger if exists calendar_event_links_set_updated_at on public.calendar_event_links;
create trigger calendar_event_links_set_updated_at before update on public.calendar_event_links
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;

drop policy if exists calendar_connections_all_own on public.calendar_connections;
create policy calendar_connections_all_own on public.calendar_connections
  for all using (
    auth.uid() = user_id and public.current_user_owns_email_account(account_id)
  ) with check (
    auth.uid() = user_id and public.current_user_owns_email_account(account_id)
  );

drop policy if exists calendar_event_links_all_own on public.calendar_event_links;
create policy calendar_event_links_all_own on public.calendar_event_links
  for all using (
    auth.uid() = user_id and public.current_user_owns_email_account(account_id)
  ) with check (
    auth.uid() = user_id and public.current_user_owns_email_account(account_id)
  );
