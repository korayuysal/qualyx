import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
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

  // Create a run record (status: running)
  // In Phase 2, this will also enqueue a pg-boss job
  const [run] = await db
    .insert(schema.runs)
    .values({
      scenarioId,
      status: 'running',
      triggeredBy: 'manual',
      triggeredByUser: session.user?.id,
    })
    .returning();

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
