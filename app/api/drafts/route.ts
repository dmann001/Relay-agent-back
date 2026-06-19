// Drafts - autosaved to Gmail; the Relay DB stores only the gmailDraftId
// plus a small preview (to / subject / snippet / status).
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, requireUser } from "@/lib/server/supabase-admin";
import { getAuthorizedClient } from "@/lib/server/gmail-accounts";
import { listEmailAccounts } from "@/lib/server/email-accounts";
import { createDraft, deleteDraft, updateDraft } from "@/lib/server/gmail-api";
import { createOutlookDraft, deleteOutlookDraft, updateOutlookDraft } from "@/lib/server/outlook-api";
import { handleApiError } from "@/lib/server/api-utils";

const DRAFT_COLUMNS =
  "id, account_id, provider, provider_draft_id, gmail_draft_id, to_emails, cc_emails, subject, snippet, body, status, in_reply_to, last_edited_at";

const rowToDraft = (row: any) => ({
  id: row.id,
  providerDraftId: row.provider_draft_id || row.gmail_draft_id,
  gmailDraftId: row.provider === "gmail" ? row.provider_draft_id || row.gmail_draft_id : null,
  accountId: row.account_id,
  to: row.to_emails || [],
  cc: row.cc_emails || [],
  subject: row.subject || "",
  snippet: row.snippet || "",
  body: row.body || "",
  inReplyTo: row.in_reply_to || undefined,
  status: row.status || "saved",
  lastEdited: row.last_edited_at,
  provider: row.provider || "gmail",
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (accountId) {
      const accounts = await listEmailAccounts(userId);
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
      attachments,
    } = body;

    const accounts = await listEmailAccounts(userId);
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
    let providerDraftId: string | null = null;
    if (draftId) {
      const { data: existing } = await supabase
        .from("drafts")
        .select("provider_draft_id, gmail_draft_id")
        .eq("user_id", userId)
        .eq("id", draftId)
        .maybeSingle();
      providerDraftId = existing?.provider_draft_id ?? existing?.gmail_draft_id ?? null;
    }

    const draftParams = {
      to: to.length > 0 ? to : [account.email], // Gmail requires a To header in raw MIME
      cc: cc.length > 0 ? cc : undefined,
      subject,
      body: draftBody || " ",
      threadId,
      inReplyToMessageId,
      attachments,
    };

    let result: { draftId: string; messageId?: string | null };
    if (account.provider === "outlook") {
      const outlookDraft = providerDraftId
        ? await updateOutlookDraft(account, providerDraftId, draftParams)
        : await createOutlookDraft(account, draftParams);
      result = { draftId: outlookDraft.id, messageId: outlookDraft.id };
    } else {
      const client = await getAuthorizedClient(account as any);
      result = providerDraftId
        ? await updateDraft(client, providerDraftId, draftParams)
        : await createDraft(client, draftParams);
    }

    const snippet = draftBody
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    const row = {
      user_id: userId,
      account_id: account.id,
      provider: account.provider,
      provider_draft_id: result.draftId,
      gmail_draft_id: account.provider === "gmail" ? result.draftId : null,
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
      providerDraftId: result.draftId,
      gmailDraftId: account.provider === "gmail" ? result.draftId : null,
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
      .select("id, account_id, provider, provider_draft_id, gmail_draft_id")
      .eq("user_id", userId)
      .eq("id", draftId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const remoteDraftId = row.provider_draft_id || row.gmail_draft_id;
    if (remoteDraftId && row.account_id) {
      const accounts = await listEmailAccounts(userId);
      const account = accounts.find((a) => a.id === row.account_id);
      if (account) {
        try {
          if (account.provider === "outlook") await deleteOutlookDraft(account, remoteDraftId);
          else await deleteDraft(await getAuthorizedClient(account as any), remoteDraftId);
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
