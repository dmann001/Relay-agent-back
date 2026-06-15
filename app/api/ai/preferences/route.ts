import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { listEmailAccounts } from '@/lib/server/email-accounts';
import { DEFAULT_WRITING_STYLE, getAccountPreference } from '@/lib/server/ai-context';
import { handleApiError } from '@/lib/server/api-utils';

const updateSchema = z.object({
  accountId: z.string().uuid(),
  writingStyle: z.string().trim().max(1000).default(DEFAULT_WRITING_STYLE),
  signature: z.string().trim().max(2000).default(''),
  draftInstructions: z.string().trim().max(2000).default(''),
  aiEnabled: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const accounts = await listEmailAccounts(userId);
    const preferences = await Promise.all(accounts.map((account) =>
      getAccountPreference(userId, account.id, account.email, '')
    ));
    return NextResponse.json({ preferences });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid AI preference values' }, { status: 400 });
    }

    const accounts = await listEmailAccounts(userId);
    const account = accounts.find(({ id }) => id === parsed.data.accountId);
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const { error } = await getSupabaseAdmin().from('ai_account_preferences').upsert({
      user_id: userId,
      account_id: account.id,
      writing_style: parsed.data.writingStyle || DEFAULT_WRITING_STYLE,
      signature: parsed.data.signature,
      draft_instructions: parsed.data.draftInstructions,
      ai_enabled: parsed.data.aiEnabled,
    }, { onConflict: 'account_id' });
    if (error) throw error;

    return NextResponse.json({
      preference: await getAccountPreference(userId, account.id, account.email, ''),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
