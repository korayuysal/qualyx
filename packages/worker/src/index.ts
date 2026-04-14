import { createBoss, JOB_RUN_SCENARIO } from './queue.js';
import { handleRunScenario } from './handler.js';

async function main() {
  const boss = createBoss();

  boss.on('error', (error: Error) => {
    console.error('[pg-boss error]', error);
  });

  await boss.start();
  console.log('Qualyx worker started, listening for jobs...');

  await boss.work(JOB_RUN_SCENARIO, { batchSize: 1 }, handleRunScenario);

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
