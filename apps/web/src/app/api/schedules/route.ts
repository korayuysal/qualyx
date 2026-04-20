import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { desc, eq } from 'drizzle-orm';
import { validateCron, computeNextRunAt } from '@/lib/cron';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const schedules = await db
    .select({
      id: schema.schedules.id,
      scenarioId: schema.schedules.scenarioId,
      scenarioName: schema.scenarios.name,
      cronExpression: schema.schedules.cronExpression,
      enabled: schema.schedules.enabled,
      lastRunAt: schema.schedules.lastRunAt,
      nextRunAt: schema.schedules.nextRunAt,
      createdAt: schema.schedules.createdAt,
      updatedAt: schema.schedules.updatedAt,
    })
    .from(schema.schedules)
    .innerJoin(schema.scenarios, eq(schema.schedules.scenarioId, schema.scenarios.id))
    .orderBy(desc(schema.schedules.updatedAt));

  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const scenarioId: string | undefined = body.scenarioId;
  const cronExpression: string | undefined = body.cronExpression;
  const enabled: boolean = body.enabled ?? true;

  if (!scenarioId || !cronExpression) {
    return NextResponse.json(
      { error: 'scenarioId and cronExpression are required' },
      { status: 400 },
    );
  }

  const cronCheck = validateCron(cronExpression);
  if (!cronCheck.valid) {
    return NextResponse.json({ error: `Invalid cron: ${cronCheck.error}` }, { status: 400 });
  }

  const [scenario] = await db
    .select({ id: schema.scenarios.id })
    .from(schema.scenarios)
    .where(eq(schema.scenarios.id, scenarioId))
    .limit(1);

  if (!scenario) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  }

  const nextRunAt = computeNextRunAt(cronExpression);

  const [created] = await db
    .insert(schema.schedules)
    .values({
      scenarioId,
      cronExpression,
      enabled,
      nextRunAt,
      createdBy: session.user?.id,
    })
    .returning();

  return NextResponse.json({ id: created.id }, { status: 201 });
}
