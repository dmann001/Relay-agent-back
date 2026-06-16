import { NextRequest, NextResponse } from 'next/server';
import { runDueCommitmentMonitors } from '@/lib/server/commitment-monitor';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const results = await runDueCommitmentMonitors();
  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
