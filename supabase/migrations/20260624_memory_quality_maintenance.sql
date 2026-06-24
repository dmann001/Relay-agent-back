-- Memory quality controls and maintenance metadata.

alter table public.memory_items
  add column if not exists fingerprint text,
  add column if not exists occurrence_count int not null default 1 check (occurrence_count > 0),
  add column if not exists last_seen_at timestamptz,
  add column if not exists superseded_by uuid references public.memory_items(id) on delete set null;

update public.memory_items
set last_seen_at = coalesce(last_seen_at, updated_at, created_at)
where last_seen_at is null;

create index if not exists memory_items_user_fingerprint_idx
  on public.memory_items(user_id, fingerprint)
  where fingerprint is not null;

create unique index if not exists memory_items_active_fingerprint_uidx
  on public.memory_items(
    user_id,
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(contact_id, '00000000-0000-0000-0000-000000000000'::uuid),
    type,
    fingerprint
  )
  where status in ('pending', 'accepted') and fingerprint is not null;
