-- Account-scoped AI controls and writing preferences.
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

alter table public.ai_account_preferences enable row level security;

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
