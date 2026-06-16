import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8")
  .replace(/\s+/g, " ")
  .toLowerCase();

describe("Supabase schema security contract", () => {
  const userOwnedTables = ["email_accounts", "emails", "drafts"];

  it.each(userOwnedTables)("enables RLS for %s", (table) => {
    expect(schema).toContain(`alter table public.${table} enable row level security;`);
  });

  it("defines per-user select, insert, update, and delete policies", () => {
    expect(schema).toContain("for select using (auth.uid() = user_id)");
    expect(schema).toContain("for insert with check (auth.uid() = user_id)");
    expect(schema).toContain(
      "for update using (auth.uid() = user_id) with check (auth.uid() = user_id)",
    );
    expect(schema).toContain("for delete using (auth.uid() = user_id)");
  });

  it("derives sync-state ownership through the account owner", () => {
    expect(schema).toContain("create policy email_sync_state_select_own");
    expect(schema).toContain("public.current_user_owns_email_account(account_id)");
  });

  it("prevents duplicate provider messages and Gmail drafts", () => {
    expect(schema).toContain("unique (account_id, provider_message_id)");
    expect(schema).toContain(
      "create unique index if not exists drafts_account_gmail_draft_uidx",
    );
  });

  it("restricts provider and Gmail category values", () => {
    expect(schema).toContain("provider in ('gmail', 'outlook')");
    expect(schema).toContain(
      "gmail_category in ('primary', 'promotions', 'social', 'updates', 'forums')",
    );
  });

  it("defines durable user-scoped agent activity", () => {
    expect(schema).toContain("create table if not exists public.agent_runs");
    expect(schema).toContain("create table if not exists public.agent_activity_events");
    expect(schema).toContain("agent_runs_user_status_updated_idx");
    expect(schema).toContain("'awaiting_approval'");
    expect(schema).toContain("'partially_completed'");
    expect(schema).toContain("and (account_id is null or public.current_user_owns_email_account(account_id))");
    expect(schema).toContain("where agent_runs.id = agent_run_id and agent_runs.user_id = auth.uid()");
  });

  it("defines provider-neutral email commitments", () => {
    expect(schema).toContain("create table if not exists public.commitments");
    expect(schema).toContain("type in ('my_task', 'waiting_for_reply', 'waiting_for_artifact', 'follow_up')");
    expect(schema).toContain("status in ('active', 'needs_review', 'satisfied', 'dismissed', 'expired')");
    expect(schema).toContain("commitments_user_status_due_idx");
  });

  it("isolates calendar grants and links approved events to commitments", () => {
    expect(schema).toContain("create table if not exists public.calendar_connections");
    expect(schema).toContain("create table if not exists public.calendar_event_links");
    expect(schema).toContain("unique (user_id, account_id)");
    expect(schema).toContain("calendar_event_links_active_commitment_uidx");
    expect(schema).toContain("calendar_connections_all_own");
    expect(schema).toContain("calendar_event_links_all_own");
  });

  it("defines commitment monitors and durable meeting briefs", () => {
    expect(schema).toContain("create table if not exists public.commitment_monitors");
    expect(schema).toContain("create table if not exists public.meeting_briefs");
    expect(schema).toContain("commitment_monitors_due_idx");
    expect(schema).toContain("commitment_monitors_all_own");
    expect(schema).toContain("meeting_briefs_all_own");
  });
});
