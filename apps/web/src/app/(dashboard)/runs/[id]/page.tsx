import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { eq, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { RunDetail } from './run-detail';

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [run] = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, id))
    .limit(1);

  if (!run) notFound();

  // Get scenario name
  let scenarioName = 'Unknown Scenario';
  if (run.scenarioId) {
    const [scenario] = await db
      .select({ name: schema.scenarios.name })
      .from(schema.scenarios)
      .where(eq(schema.scenarios.id, run.scenarioId))
      .limit(1);
    if (scenario) scenarioName = scenario.name;
  }

  const testResults = await db
    .select()
    .from(schema.testResults)
    .where(eq(schema.testResults.runId, id))
    .orderBy(asc(schema.testResults.completedAt));

  return (
    <div className="space-y-6">
      <RunDetail
        run={{
          id: run.id,
          status: run.status,
          totalTests: run.totalTests,
          passed: run.passed,
          failed: run.failed,
          skipped: run.skipped,
          duration: run.duration,
          triggeredBy: run.triggeredBy,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
        }}
        scenarioName={scenarioName}
        initialTestResults={testResults.map((tr) => ({
          id: tr.id,
          ruleId: tr.ruleId,
          ruleName: tr.ruleName,
          appName: tr.appName,
          status: tr.status,
          severity: tr.severity,
          duration: tr.duration,
          error: tr.error,
          retryCount: tr.retryCount,
          stepsJson: tr.stepsJson,
          validationsJson: tr.validationsJson,
          completedAt: tr.completedAt.toISOString(),
        }))}
      />
    </div>
  );
}
