import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/server/api-utils';
import { runMemoryMaintenance } from '@/lib/server/memory-maintenance';
import { requireUser } from '@/lib/server/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    return NextResponse.json(await runMemoryMaintenance(userId));
  } catch (error) {
    return handleApiError(error);
  }
}
