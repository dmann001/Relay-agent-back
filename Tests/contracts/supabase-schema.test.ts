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
});
