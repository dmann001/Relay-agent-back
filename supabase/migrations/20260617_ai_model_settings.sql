-- User-level default model and hosted tool settings for Relay AI.
create table if not exists public.ai_model_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_model text not null default 'gpt-5.4-mini',
  enabled_tools jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ai_model_settings_set_updated_at on public.ai_model_settings;
create trigger ai_model_settings_set_updated_at
  before update on public.ai_model_settings
  for each row execute function public.set_updated_at();

alter table public.ai_model_settings enable row level security;

drop policy if exists ai_model_settings_select_own on public.ai_model_settings;
create policy ai_model_settings_select_own on public.ai_model_settings
  for select using (auth.uid() = user_id);

drop policy if exists ai_model_settings_insert_own on public.ai_model_settings;
create policy ai_model_settings_insert_own on public.ai_model_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists ai_model_settings_update_own on public.ai_model_settings;
create policy ai_model_settings_update_own on public.ai_model_settings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists ai_model_settings_delete_own on public.ai_model_settings;
create policy ai_model_settings_delete_own on public.ai_model_settings
  for delete using (auth.uid() = user_id);
