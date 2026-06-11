-- Fix for sync failing with Postgres 42P10:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Run this in the Supabase SQL editor (after 20260611_gmail_metadata_sync.sql).
--
-- 1) The sync upserts emails with ON CONFLICT (account_id, provider_message_id).
--    Older databases may be missing that unique constraint - ensure a matching
--    unique index exists (deduplicating first so index creation cannot fail).
-- 2) The drafts upsert uses ON CONFLICT (account_id, gmail_draft_id), but the
--    previous migration created a PARTIAL unique index, which Postgres cannot
--    use for ON CONFLICT inference. Replace it with a full unique index
--    (NULL gmail_draft_ids are treated as distinct, so local-only drafts are fine).

-- ---------------------------------------------------------------------------
-- emails: ensure unique (account_id, provider_message_id)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'emails'
      and i.indisunique
      and i.indpred is null
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(i.indkey) with ordinality as k(attnum, ord)
        join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
      ) = array['account_id', 'provider_message_id']
  ) then
    -- Remove duplicates (keep one row per account/message) before adding the index.
    delete from public.emails a
    using public.emails b
    where a.ctid < b.ctid
      and a.account_id = b.account_id
      and a.provider_message_id = b.provider_message_id;

    create unique index emails_account_provider_message_uidx
      on public.emails(account_id, provider_message_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- drafts: replace the partial unique index with a full one
-- ---------------------------------------------------------------------------

drop index if exists public.drafts_account_gmail_draft_idx;

delete from public.drafts a
using public.drafts b
where a.ctid < b.ctid
  and a.account_id = b.account_id
  and a.gmail_draft_id = b.gmail_draft_id
  and a.gmail_draft_id is not null;

create unique index if not exists drafts_account_gmail_draft_uidx
  on public.drafts(account_id, gmail_draft_id);
