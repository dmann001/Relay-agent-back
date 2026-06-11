-- Gmail metadata-cache sync.
-- Run this in the Supabase SQL editor (after schema.sql).
--
-- Relay DB stores email METADATA only (display cache). Full bodies are
-- fetched live from Gmail when the user opens an email.

-- ---------------------------------------------------------------------------
-- emails: metadata/display-cache columns
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

-- ---------------------------------------------------------------------------
-- drafts: link local drafts to Gmail drafts
-- ---------------------------------------------------------------------------

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
-- NULL gmail_draft_ids are treated as distinct, so local-only drafts are fine.
create unique index if not exists drafts_account_gmail_draft_uidx
  on public.drafts(account_id, gmail_draft_id);

-- ---------------------------------------------------------------------------
-- email_sync_state: per-mailbox sync bookkeeping
-- ---------------------------------------------------------------------------

alter table public.email_sync_state
  add column if not exists initial_sync_done boolean not null default false,
  add column if not exists trash_synced_at timestamptz;
