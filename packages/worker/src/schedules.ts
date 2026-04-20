import type PgBoss from 'pg-boss';
import cronParser from 'cron-parser';
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { getDb, schema } from '@qualyx/core';
import { JOB_RUN_SCENARIO, JOB_SCHEDULE_TICK } from './queue.js';

const TICK_CRON = '* * * * *';

function computeNextRunAt(cronExpression: string, from: Date = new Date()): Date {
  const interval = cronParser.parseExpression(cronExpression, { currentDate: from });
  return interval.next().toDate();
}

export async function ensureScheduleTick(boss: PgBoss): Promise<void> {
  await boss.createQueue(JOB_SCHEDULE_TICK);
  await boss.schedule(JOB_SCHEDULE_TICK, TICK_CRON);
}

export async function handleScheduleTick(
  boss: PgBoss,
  jobs: PgBoss.Job<object>[],
): Promise<void> {
  if (jobs.length === 0) return;

  const db = getDb();
  const now = new Date();

  const dueSchedules = await db
    .select({
      id: schema.schedules.id,
      scenarioId: schema.schedules.scenarioId,
      cronExpression: schema.schedules.cronExpression,
    })
    .from(schema.schedules)
    .where(
      and(
        eq(schema.schedules.enabled, true),
        or(
          isNull(schema.schedules.nextRunAt),
          lte(schema.schedules.nextRunAt, now),
        ),
      ),
    );

  if (dueSchedules.length === 0) return;

  for (const schedule of dueSchedules) {
    try {
      const [run] = await db
        .insert(schema.runs)
        .values({
          scenarioId: schedule.scenarioId,
          status: 'running',
          triggeredBy: 'schedule',
        })
        .returning({ id: schema.runs.id });

      await boss.send(
        JOB_RUN_SCENARIO,
        { runId: run.id, scenarioId: schedule.scenarioId },
        { id: run.id },
      );

      const nextRunAt = computeNextRunAt(schedule.cronExpression, now);

      await db
        .update(schema.schedules)
        .set({ lastRunAt: now, nextRunAt, updatedAt: now })
        .where(eq(schema.schedules.id, schedule.id));

      console.log(
        `[tick] Enqueued run ${run.id} for schedule ${schedule.id} (next: ${nextRunAt.toISOString()})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[tick] Failed to dispatch schedule ${schedule.id}:`, message);
    }
  }
}
