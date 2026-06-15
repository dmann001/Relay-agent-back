-- Outlook / Microsoft Graph provider support.
alter table public.drafts add column if not exists provider_draft_id text;
update public.drafts set provider_draft_id = gmail_draft_id
where provider_draft_id is null and gmail_draft_id is not null;
create unique index if not exists drafts_account_provider_draft_uidx
  on public.drafts(account_id, provider_draft_id);

-- Graph delta links are opaque and can be larger than typical tokens. Existing
-- pagination_token is text and stores a JSON map keyed by mailbox.
comment on column public.email_sync_state.pagination_token is
  'Opaque provider cursors encoded as JSON; Gmail page tokens or Outlook delta/next links.';
