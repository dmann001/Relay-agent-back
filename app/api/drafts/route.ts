// Drafts - autosaved to Gmail; the Relay DB stores only the gmailDraftId
// plus a small preview (to / subject / snippet / status).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireUser } from "@/lib/server/supabase-admin";
import {
  listGmailAccounts,
  getAuthorizedClient,
} from "@/lib/server/gmail-accounts";
import { createDraft, deleteDraft, updateDraft } from "@/lib/server/gmail-api";
import { handleApiError } from "@/lib/server/api-utils";

const DRAFT_COLUMNS =
  "id, account_id, gmail_draft_id, to_emails, cc_emails, subject, snippet, body, status, in_reply_to, last_edited_at";

const rowToDraft = (row: any) => ({
  id: row.id,
  gmailDraftId: row.gmail_draft_id,
  accountId: row.account_id,
  to: row.to_emails || [],
  cc: row.cc_emails || [],
  subject: row.subject || "",
  snippet: row.snippet || "",
  body: row.body || "",
  inReplyTo: row.in_reply_to || undefined,
  status: row.status || "saved",
  lastEdited: row.last_edited_at,
  provider: "gmail" as const,
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (accountId) {
      const accounts = await listGmailAccounts(userId);
      if (!accounts.some((account) => account.id === accountId)) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 },
        );
      }
    }

    let query = getSupabaseAdmin()
      .from("drafts")
      .select(DRAFT_COLUMNS)
      .eq("user_id", userId);
    if (accountId) query = query.eq("account_id", accountId);
    const { data, error } = await query.order("last_edited_at", {
      ascending: false,
    });
    if (error) throw error;

    return NextResponse.json({ drafts: (data || []).map(rowToDraft) });
  } catch (error) {
    return handleApiError(error);
  }
}

// Create or update (autosave) a draft. Saves to Gmail first, then caches the
// preview in the DB.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const {
      draftId, // Relay DB draft id when updating
      accountId,
      to = [],
      cc = [],
      subject = "",
      body: draftBody = "",
      threadId,
      inReplyToMessageId,
    } = body;

    const accounts = await listGmailAccounts(userId);
    const account = accountId
      ? accounts.find((a) => a.id === accountId)
      : accounts[0];
    if (!account) {
      return NextResponse.json(
        { error: "No Gmail account connected", code: "NO_ACCOUNT" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const client = await getAuthorizedClient(account);

    let gmailDraftId: string | null = null;
    if (draftId) {
      const { data: existing } = await supabase
        .from("drafts")
        .select("gmail_draft_id")
        .eq("user_id", userId)
        .eq("id", draftId)
        .maybeSingle();
      gmailDraftId = existing?.gmail_draft_id ?? null;
    }

    const draftParams = {
      to: to.length > 0 ? to : [account.email], // Gmail requires a To header in raw MIME
      cc: cc.length > 0 ? cc : undefined,
      subject,
      body: draftBody || " ",
      threadId,
      inReplyToMessageId,
    };

    const gmailResult = gmailDraftId
      ? await updateDraft(client, gmailDraftId, draftParams)
      : await createDraft(client, draftParams);

    const snippet = draftBody
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    const row = {
      user_id: userId,
      account_id: account.id,
      provider: "gmail" as const,
      gmail_draft_id: gmailResult.draftId,
      to_emails: to,
      cc_emails: cc,
      subject,
      snippet,
      body: draftBody,
      in_reply_to: inReplyToMessageId ?? null,
      status: "saved" as const,
      last_edited_at: new Date().toISOString(),
    };

    let savedId = draftId as string | undefined;
    if (draftId) {
      const { error } = await supabase
        .from("drafts")
        .update(row)
        .eq("user_id", userId)
        .eq("id", draftId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("drafts")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      savedId = data.id;
    }

    return NextResponse.json({
      success: true,
      draftId: savedId,
      gmailDraftId: gmailResult.draftId,
      status: "saved",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const draftId = request.nextUrl.searchParams.get("id");
    if (!draftId) {
      return NextResponse.json(
        { error: "Draft id is required" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from("drafts")
      .select("id, account_id, gmail_draft_id")
      .eq("user_id", userId)
      .eq("id", draftId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (row.gmail_draft_id && row.account_id) {
      const accounts = await listGmailAccounts(userId);
      const account = accounts.find((a) => a.id === row.account_id);
      if (account) {
        try {
          const client = await getAuthorizedClient(account);
          await deleteDraft(client, row.gmail_draft_id);
        } catch (error: any) {
          // Draft may already be gone in Gmail; still remove the cache row.
          if (error?.code !== 404 && error?.response?.status !== 404) {
            console.error(
              "[Drafts] Gmail delete failed (non-fatal):",
              error?.message,
            );
          }
        }
      }
    }

    const { error } = await supabase
      .from("drafts")
      .delete()
      .eq("user_id", userId)
      .eq("id", draftId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
