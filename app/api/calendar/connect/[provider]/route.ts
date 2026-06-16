import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/server/api-utils';
import { createCalendarAuthorizationUrl } from '@/lib/server/calendar-connections';
import { createOAuthState } from '@/lib/server/crypto';
import { getEmailAccount } from '@/lib/server/email-accounts';
import { requireUser } from '@/lib/server/supabase-admin';

const paramsSchema = z.object({ provider: z.enum(['gmail', 'outlook']) });
const querySchema = z.object({ accountId: z.string().uuid() });

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const userId = await requireUser(request);
    const params = paramsSchema.safeParse(await context.params);
    const query = querySchema.safeParse({ accountId: request.nextUrl.searchParams.get('accountId') });
    if (!params.success || !query.success) {
      return NextResponse.json({ error: 'Invalid calendar connection request' }, { status: 400 });
    }
    const account = await getEmailAccount(userId, query.data.accountId);
    if (!account || account.provider !== params.data.provider) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }
    const state = createOAuthState(userId, {
      purpose: 'calendar', accountId: account.id, provider: account.provider,
    });
    return NextResponse.json({ url: createCalendarAuthorizationUrl(account.provider, state) });
  } catch (error) {
    return handleApiError(error);
  }
}
