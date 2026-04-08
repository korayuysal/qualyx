import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { desc, eq } from 'drizzle-orm';

export default async function RunsPage() {
  const runs = await db
    .select({
      id: schema.runs.id,
      status: schema.runs.status,
      totalTests: schema.runs.totalTests,
      passed: schema.runs.passed,
      failed: schema.runs.failed,
      skipped: schema.runs.skipped,
      duration: schema.runs.duration,
      environment: schema.runs.environment,
      triggeredBy: schema.runs.triggeredBy,
      startedAt: schema.runs.startedAt,
      completedAt: schema.runs.completedAt,
      scenarioName: schema.scenarios.name,
    })
    .from(schema.runs)
    .leftJoin(schema.scenarios, eq(schema.runs.scenarioId, schema.scenarios.id))
    .orderBy(desc(schema.runs.startedAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Test Runs</h1>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
          <p className="text-gray-400">No test runs yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Tests</th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Result</th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Trigger</th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      run.status === 'running'
                        ? 'bg-yellow-900/50 text-yellow-300'
                        : run.failed > 0
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-green-900/50 text-green-300'
                    }`}>
                      {run.status === 'running' ? 'Running' : run.failed > 0 ? 'Failed' : 'Passed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{run.totalTests}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-400">{run.passed}</span>
                    {' / '}
                    <span className="text-red-400">{run.failed}</span>
                    {run.skipped > 0 && (
                      <> / <span className="text-gray-500">{run.skipped}</span></>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{run.triggeredBy}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {run.startedAt.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
