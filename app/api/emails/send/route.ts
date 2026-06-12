// Send email via Gmail. Tokens are resolved server-side from the user's
// connected account. After sending, the sent message's metadata is cached in
// the DB so it appears in the Sent list immediately.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { listGmailAccounts, getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { fetchMessageMetadataBatch, sendDraft, sendMessage, updateDraft } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';
import { GmailMessageMetadata } from '@/lib/server/gmail-api';
import { upsertEmailRows } from '@/lib/server/email-sync';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const {
      accountId,
      to,
      cc,
      subject,
      body: emailBody,
      threadId,
      inReplyToMessageId,
      attachments,
      draftId, // Relay DB draft id (optional - sending a saved draft)
    } = body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!emailBody) {
      return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
    }

    const accounts = await listGmailAccounts(userId);
    const account = accountId
      ? accounts.find((a) => a.id === accountId)
      : accounts[0];
    if (!account) {
      return NextResponse.json(
        { error: 'No Gmail account connected', code: 'NO_ACCOUNT' },
        { status: 400 }
      );
    }

    const client = await getAuthorizedClient(account);
    const supabase = getSupabaseAdmin();

    // If this came from a saved draft, sync the latest content into the Gmail
    // draft and send the draft itself (so Gmail cleans it up server-side).
    let gmailDraftId: string | null = null;
    if (draftId) {
      const { data: draftRow } = await supabase
        .from('drafts')
        .select('id, gmail_draft_id')
        .eq('user_id', userId)
        .eq('id', draftId)
        .maybeSingle();
      gmailDraftId = draftRow?.gmail_draft_id ?? null;
    }

    let sent: { id?: string | null; threadId?: string | null };
    if (gmailDraftId) {
      await updateDraft(client, gmailDraftId, {
        to,
        cc,
        subject,
        body: emailBody,
        threadId,
        inReplyToMessageId,
      });
      sent = await sendDraft(client, gmailDraftId);
    } else {
      sent = await sendMessage(client, {
        to,
        cc,
        subject,
        body: emailBody,
        threadId,
        inReplyToMessageId,
        attachments,
      });
    }

    // Remove the draft from the Relay DB now that it's sent.
    if (draftId) {
      await supabase.from('drafts').delete().eq('user_id', userId).eq('id', draftId);
    }

    // Cache the sent message metadata so the Sent list updates immediately.
    if (sent.id) {
      try {
        const [meta] = await fetchMessageMetadataBatch(client, [sent.id]);
        if (meta) {
          await upsertSentMetadata(userId, account.id, meta);
        }
      } catch (error) {
        console.error('[Send] Failed to cache sent metadata (non-fatal):', error);
      }
    }

    return NextResponse.json({
      success: true,
      messageId: sent.id,
      threadId: sent.threadId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function upsertSentMetadata(userId: string, accountId: string, meta: GmailMessageMetadata) {
  await upsertEmailRows([
    {
      user_id: userId,
      account_id: accountId,
      provider: 'gmail',
      provider_message_id: meta.gmailMessageId,
      provider_thread_id: meta.gmailThreadId,
      rfc_message_id: meta.rfcMessageId ?? null,
      subject: meta.subject,
      from_name: meta.from.name,
      from_email: meta.from.email,
      snippet: meta.snippet,
      sent_at: meta.date,
      received_at: meta.date,
      is_read: true,
      is_archived: false,
      is_starred: meta.isStarred,
      is_trashed: false,
      trashed_at: null,
      is_inbox: meta.isInbox,
      is_sent: true,
      labels: meta.labels,
      to_recipients: meta.to,
      has_attachments: meta.hasAttachment,
      gmail_category: meta.gmailCategory ?? null,
    },
  ]);
}
