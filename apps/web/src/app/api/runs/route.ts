import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBoss, JOB_RUN_SCENARIO } from '@/lib/queue';
import { schema } from '@qualyx/core';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { scenarioId } = await request.json();

  if (!scenarioId) {
    return NextResponse.json({ error: 'scenarioId is required' }, { status: 400 });
  }

  // Verify scenario exists
  const [scenario] = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.id, scenarioId))
    .limit(1);

  if (!scenario) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  // Create a run record
  const [run] = await db
    .insert(schema.runs)
    .values({
      scenarioId,
      status: 'running',
      triggeredBy: 'manual',
      triggeredByUser: session.user?.id,
    })
    .returning();

  // Enqueue a pg-boss job for the worker to pick up
  const boss = await getBoss();
  await boss.send(JOB_RUN_SCENARIO, { runId: run.id, scenarioId }, { id: run.id });

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
