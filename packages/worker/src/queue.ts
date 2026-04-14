import PgBoss from 'pg-boss';
import { z } from 'zod';
import { pgSslConfig, pgDirectConnectionString } from '@qualyx/core';

export const JOB_RUN_SCENARIO = 'run-scenario';

export const RunScenarioJobSchema = z.object({
  runId: z.string().uuid(),
  scenarioId: z.string().uuid(),
});

export type RunScenarioJob = z.infer<typeof RunScenarioJobSchema>;

export function createBoss(): PgBoss {
  return new PgBoss({
    connectionString: pgDirectConnectionString(),
    schema: 'pgboss',
    archiveCompletedAfterSeconds: 86400,
    retryLimit: 0,
    expireInMinutes: 30,
    ssl: pgSslConfig(),
  });
}
