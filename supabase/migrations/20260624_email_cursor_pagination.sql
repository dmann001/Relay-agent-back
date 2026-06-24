-- Stable cursor pagination for mailbox list views.
-- These indexes match /api/emails keyset ordering:
--   received_at desc, provider_message_id desc

create index if not exists emails_user_inbox_cursor_idx
  on public.emails(user_id, is_inbox, is_trashed, received_at desc, provider_message_id desc);
create index if not exists emails_user_inbox_category_cursor_idx
  on public.emails(user_id, gmail_category, is_inbox, is_trashed, received_at desc, provider_message_id desc);
create index if not exists emails_user_account_inbox_cursor_idx
  on public.emails(user_id, account_id, is_inbox, is_trashed, received_at desc, provider_message_id desc);
create index if not exists emails_user_sent_cursor_idx
  on public.emails(user_id, is_sent, is_trashed, received_at desc, provider_message_id desc);
create index if not exists emails_user_archive_cursor_idx
  on public.emails(user_id, is_archived, is_trashed, received_at desc, provider_message_id desc);
create index if not exists emails_user_trash_cursor_idx
  on public.emails(user_id, is_trashed, received_at desc, provider_message_id desc);
