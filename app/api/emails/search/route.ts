import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizedClient } from '@/lib/server/gmail-accounts';
import { listEmailAccounts, getEmailAccount } from '@/lib/server/email-accounts';
import { handleApiError } from '@/lib/server/api-utils';
import { requireUser } from '@/lib/server/supabase-admin';
import { fetchMessageMetadataBatch, listMessageIdsPage } from '@/lib/server/gmail-api';
import { metadataToRow, rowToEmail, upsertEmailRows } from '@/lib/server/email-sync';
import { outlookMessageToEmail, searchOutlookMessages } from '@/lib/server/outlook-api';
import type { Email } from '@/types';

function sanitizeSearchQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 160);
}

function sortByNewest(emails: Email[]) {
  return emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const query = sanitizeSearchQuery(params.get('q') || '');
    const accountId = params.get('accountId') || undefined;
    const limit = Math.min(Math.max(parseInt(params.get('limit') || '50', 10) || 50, 1), 100);

    if (!query) {
      return NextResponse.json({ emails: [], total: 0, hasMore: false });
    }

    const accounts = accountId
      ? [await getEmailAccount(userId, accountId)].filter(Boolean)
      : await listEmailAccounts(userId);
    if (accountId && accounts.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const perAccountLimit = Math.max(10, Math.ceil(limit / Math.max(accounts.length, 1)));
    const results: Email[] = [];
    const errors: Array<{ accountId: string; message: string }> = [];

    for (const account of accounts) {
      if (!account) continue;
      try {
        if (account.provider === 'gmail') {
          const client = await getAuthorizedClient(account as any);
          const { ids, nextPageToken } = await listMessageIdsPage(client, query, perAccountLimit);
          const metas = await fetchMessageMetadataBatch(client, ids);
          const rows = metas.map((meta) => metadataToRow(userId, account.id, meta));
          await upsertEmailRows(rows);
          results.push(...rows.map((row) => ({
            ...rowToEmail(row),
            accountEmail: account.email,
          })));
          if (nextPageToken && results.length >= limit) break;
        } else {
          const messages = await searchOutlookMessages(account, query, perAccountLimit);
          results.push(...messages.map((message) => ({
            ...outlookMessageToEmail(message, account.id),
            accountEmail: account.email,
          })));
        }
      } catch (error: any) {
        errors.push({
          accountId: account.id,
          message: error?.message || 'Search failed',
        });
      }
    }

    const emails = sortByNewest(results).slice(0, limit);
    return NextResponse.json({
      emails,
      total: emails.length,
      hasMore: results.length > limit,
      errors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
