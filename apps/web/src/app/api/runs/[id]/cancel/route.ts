import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBoss, JOB_RUN_SCENARIO } from '@/lib/queue';
import { schema } from '@qualyx/core';
import { eq } from 'drizzle-orm';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: runId } = await params;

  // Fetch the run
  const [run] = await db
    .select({ status: schema.runs.status })
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (run.status !== 'running') {
    return NextResponse.json({ error: 'Run is not running' }, { status: 400 });
  }

  // Mark as cancelled in DB
  await db
    .update(schema.runs)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
    })
    .where(eq(schema.runs.id, runId));

  // Cancel the pg-boss job (run ID matches job ID)
  try {
    const boss = await getBoss();
    await boss.cancel(JOB_RUN_SCENARIO, runId);
  } catch {
    // Job may already be completed or not exist — that's fine
  }

  return NextResponse.json({ status: 'cancelled' });
}
