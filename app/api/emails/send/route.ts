// Send email via Gmail. Tokens are resolved server-side from the user's
// connected account. After sending, the sent message's metadata is cached in
// the DB so it appears in the Sent list immediately.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireUser } from '@/lib/server/supabase-admin';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts } from '@/lib/server/email-accounts';
import { sendOutlookDraft, sendOutlookMessage, updateOutlookDraft } from '@/lib/server/outlook-api';
import { fetchMessageMetadataBatch, sendDraft, sendMessage, updateDraft } from '@/lib/server/gmail-api';
import { handleApiError } from '@/lib/server/api-utils';
import { GmailMessageMetadata } from '@/lib/server/gmail-api';
import { upsertEmailRows } from '@/lib/server/email-sync';
import { recordDraftFeedback } from '@/lib/server/personalization';

function isProviderNotFound(error: any) {
  return error?.code === 404
    || error?.status === 404
    || error?.response?.status === 404
    || /requested entity was not found/i.test(error?.message || '');
}

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
      generatedDraft,
      generatedDraftId,
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

    const accounts = await listEmailAccounts(userId);
    const account = accountId
      ? accounts.find((a) => a.id === accountId)
      : accounts[0];
    if (!account) {
      return NextResponse.json(
        { error: 'No email account connected', code: 'NO_ACCOUNT' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // If this came from a saved draft, sync the latest content into the Gmail
    // draft and send the draft itself (so Gmail cleans it up server-side).
    let providerDraftId: string | null = null;
    if (draftId) {
      const { data: draftRow } = await supabase
        .from('drafts')
        .select('id, provider_draft_id, gmail_draft_id')
        .eq('user_id', userId)
        .eq('id', draftId)
        .maybeSingle();
      providerDraftId = draftRow?.provider_draft_id ?? draftRow?.gmail_draft_id ?? null;
    }

    let sent: { id?: string | null; threadId?: string | null };
    if (account.provider === 'outlook') {
      if (providerDraftId) {
        try {
          await updateOutlookDraft(account, providerDraftId, { to, cc, subject, body: emailBody, threadId, inReplyToMessageId, attachments });
          sent = await sendOutlookDraft(account, providerDraftId);
        } catch (error) {
          if (!isProviderNotFound(error)) throw error;
          console.warn('[Send] Cached Outlook draft was missing; sending as a new message instead.');
          sent = await sendOutlookMessage(account, { to, cc, subject, body: emailBody, threadId, inReplyToMessageId, attachments });
        }
      } else {
        sent = await sendOutlookMessage(account, { to, cc, subject, body: emailBody, threadId, inReplyToMessageId, attachments });
      }
    } else {
      const client = await getAuthorizedClient(account as any);
      if (providerDraftId) {
        try {
          await updateDraft(client, providerDraftId, {
            to,
            cc,
            subject,
            body: emailBody,
            threadId,
            inReplyToMessageId,
            attachments,
          });
          sent = await sendDraft(client, providerDraftId);
        } catch (error) {
          if (!isProviderNotFound(error)) throw error;
          console.warn('[Send] Cached Gmail draft was missing; sending as a new message instead.');
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
    }

    // Remove the draft from the Relay DB now that it's sent.
    if (draftId) {
      await supabase.from('drafts').delete().eq('user_id', userId).eq('id', draftId);
    }

    // Cache the sent message metadata so the Sent list updates immediately.
    if (sent.id && account.provider === 'gmail') {
      try {
        const client = await getAuthorizedClient(account as any);
        const [meta] = await fetchMessageMetadataBatch(client, [sent.id]);
        if (meta) {
          await upsertSentMetadata(userId, account.id, meta);
        }
      } catch (error) {
        console.error('[Send] Failed to cache sent metadata (non-fatal):', error);
      }
    }

    void recordDraftFeedback({
      userId,
      accountId: account.id,
      to,
      cc,
      subject,
      finalBody: emailBody,
      generatedBody: typeof generatedDraft === 'string' ? generatedDraft : undefined,
      generatedDraftId: typeof generatedDraftId === 'string' ? generatedDraftId : undefined,
      providerMessageId: sent.id || null,
      threadId: sent.threadId || threadId || null,
    }).catch((error) => {
      console.error('[Send] Failed to record draft feedback (non-fatal):', error);
    });

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
