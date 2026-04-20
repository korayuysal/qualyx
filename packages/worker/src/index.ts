import { createBoss, JOB_RUN_SCENARIO, JOB_SCHEDULE_TICK } from './queue.js';
import { handleRunScenario } from './handler.js';
import { ensureScheduleTick, handleScheduleTick } from './schedules.js';

async function main() {
  const boss = createBoss();

  boss.on('error', (error: Error) => {
    console.error('[pg-boss error]', error);
  });

  await boss.start();
  console.log('Qualyx worker started, listening for jobs...');

  await boss.work(JOB_RUN_SCENARIO, { batchSize: 1 }, handleRunScenario);

  await boss.work<object>(
    JOB_SCHEDULE_TICK,
    { batchSize: 1 },
    (jobs) => handleScheduleTick(boss, jobs),
  );
  await ensureScheduleTick(boss);
  console.log(`Schedule tick registered (${JOB_SCHEDULE_TICK}).`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down worker...');
    await boss.stop({ graceful: true, timeout: 30000 });
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
