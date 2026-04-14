import PgBoss from 'pg-boss';
import { pgSslConfig, pgDirectConnectionString } from '@qualyx/core';

let bossPromise: Promise<PgBoss> | null = null;

export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: pgDirectConnectionString(),
        schema: 'pgboss',
        ssl: pgSslConfig(),
      });
      await boss.start();
      return boss;
    })();
  }
  return bossPromise;
}

export const JOB_RUN_SCENARIO = 'run-scenario';
