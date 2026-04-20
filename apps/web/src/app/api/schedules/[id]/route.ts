import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { eq } from 'drizzle-orm';
import { validateCron, computeNextRunAt } from '@/lib/cron';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [schedule] = await db
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.id, id))
    .limit(1);

  if (!schedule) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(schedule);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { cronExpression, enabled } = body as {
    cronExpression?: string;
    enabled?: boolean;
  };

  const patch: Partial<typeof schema.schedules.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (cronExpression !== undefined) {
    const cronCheck = validateCron(cronExpression);
    if (!cronCheck.valid) {
      return NextResponse.json(
        { error: `Invalid cron: ${cronCheck.error}` },
        { status: 400 },
      );
    }
    patch.cronExpression = cronExpression;
    patch.nextRunAt = computeNextRunAt(cronExpression);
  }

  if (enabled !== undefined) {
    patch.enabled = enabled;
  }

  const [updated] = await db
    .update(schema.schedules)
    .set(patch)
    .where(eq(schema.schedules.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await db.delete(schema.schedules).where(eq(schema.schedules.id, id));

  return NextResponse.json({ success: true });
}
