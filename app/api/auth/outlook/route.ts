import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/supabase-admin';
import { createOAuthState } from '@/lib/server/crypto';
import {
  createOutlookAuthorizationUrl,
  OutlookOAuthError,
  validateOutlookOAuthConfig,
} from '@/lib/server/outlook-accounts';
import { handleApiError } from '@/lib/server/api-utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    validateOutlookOAuthConfig();
    return NextResponse.json({ url: createOutlookAuthorizationUrl(createOAuthState(userId)) });
  } catch (error) {
    if (error instanceof OutlookOAuthError && error.code === 'outlook_not_configured') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return handleApiError(error);
  }
}
