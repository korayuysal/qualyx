import type PgBoss from 'pg-boss';
import { eq } from 'drizzle-orm';
import {
  Executor,
  parseConfigFromYaml,
  getDb,
  schema,
} from '@qualyx/core';
import type { RunScenarioJob } from './queue.js';

export async function handleRunScenario(jobs: PgBoss.Job<RunScenarioJob>[]): Promise<void> {
  for (const job of jobs) {
    await processJob(job);
  }
}

async function processJob(job: PgBoss.Job<RunScenarioJob>): Promise<void> {
  const { runId, scenarioId } = job.data;
  const db = getDb();

  console.log(`[job:${runId}] Starting run for scenario ${scenarioId}`);

  // Fetch the scenario YAML from the database
  const [scenario] = await db
    .select({ yamlContent: schema.scenarios.yamlContent })
    .from(schema.scenarios)
    .where(eq(schema.scenarios.id, scenarioId))
    .limit(1);

  if (!scenario) {
    console.error(`[job:${runId}] Scenario ${scenarioId} not found`);
    await db
      .update(schema.runs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        resultJson: { error: `Scenario ${scenarioId} not found` },
      })
      .where(eq(schema.runs.id, runId));
    return;
  }

  // Parse the YAML into a QualyxConfig
  let config;
  try {
    const result = parseConfigFromYaml(scenario.yamlContent);
    config = result.config;
    if (result.warnings.length > 0) {
      console.warn(`[job:${runId}] Config warnings:`, result.warnings);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse config';
    console.error(`[job:${runId}] Config parse error:`, message);
    await db
      .update(schema.runs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        resultJson: { error: message },
      })
      .where(eq(schema.runs.id, runId));
    return;
  }

  // Count total tests and update the run record
  const totalTests = config.apps.reduce((sum: number, app: { rules: unknown[] }) => sum + app.rules.length, 0);
  await db
    .update(schema.runs)
    .set({ totalTests })
    .where(eq(schema.runs.id, runId));

  // Track running tallies for incremental updates
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  // Create and run the Executor with DB-updating callbacks
  const executor = new Executor(config, {
    callbacks: {
      onTestStart(app, rule) {
        console.log(`[job:${runId}] Test starting: ${app.name} / ${rule.name}`);
      },

      async onTestComplete(result) {
        // Insert individual test result
        await db.insert(schema.testResults).values({
          runId,
          ruleId: result.ruleId,
          ruleName: result.ruleName,
          appName: result.appName,
          status: result.status === 'pending' ? 'skipped' : result.status,
          severity: result.severity,
          startedAt: new Date(result.startedAt),
          completedAt: new Date(result.completedAt),
          duration: result.duration,
          error: result.error ?? null,
          screenshot: result.screenshot ?? null,
          retryCount: result.retryCount,
          stepsJson: result.steps,
          validationsJson: result.validations,
        });

        // Update running tallies
        if (result.status === 'passed') passedCount++;
        else if (result.status === 'failed') failedCount++;
        else skippedCount++;

        await db
          .update(schema.runs)
          .set({ passed: passedCount, failed: failedCount, skipped: skippedCount })
          .where(eq(schema.runs.id, runId));

        console.log(`[job:${runId}] Test complete: ${result.appName} / ${result.ruleName} → ${result.status}`);

        // Check for cancellation between tests
        const [currentRun] = await db
          .select({ status: schema.runs.status })
          .from(schema.runs)
          .where(eq(schema.runs.id, runId))
          .limit(1);

        if (currentRun?.status === 'cancelled') {
          throw new Error('Run cancelled by user');
        }
      },

      onTestRetry(app, rule, attempt, maxRetries) {
        console.log(`[job:${runId}] Retrying: ${app.name} / ${rule.name} (attempt ${attempt}/${maxRetries})`);
      },
    },
  });

  try {
    const runResult = await executor.run();

    // Final update with complete results
    await db
      .update(schema.runs)
      .set({
        status: runResult.failed > 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        duration: runResult.duration,
        totalTests: runResult.totalTests,
        passed: runResult.passed,
        failed: runResult.failed,
        skipped: runResult.skipped,
        resultJson: runResult,
      })
      .where(eq(schema.runs.id, runId));

    console.log(`[job:${runId}] Run complete: ${runResult.passed}/${runResult.totalTests} passed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Don't overwrite 'cancelled' status
    const [currentRun] = await db
      .select({ status: schema.runs.status })
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (currentRun?.status !== 'cancelled') {
      await db
        .update(schema.runs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          duration: 0,
          resultJson: { error: message },
        })
        .where(eq(schema.runs.id, runId));
    }

    console.error(`[job:${runId}] Run failed:`, message);
  }
}
