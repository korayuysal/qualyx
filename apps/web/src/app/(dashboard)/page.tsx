import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { desc, sql, eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function DashboardPage() {
  const recentRuns = await db
    .select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.startedAt))
    .limit(10);

  const [stats] = await db
    .select({
      totalRuns: sql<number>`count(*)`,
      totalPassed: sql<number>`sum(case when ${schema.runs.status} = 'completed' and ${schema.runs.failed} = 0 then 1 else 0 end)`,
      totalFailed: sql<number>`sum(case when ${schema.runs.failed} > 0 then 1 else 0 end)`,
    })
    .from(schema.runs);

  const scenarioCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.scenarios);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Overview of your QA automation status
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Runs" value={stats?.totalRuns ?? 0} />
        <StatCard label="Passed" value={stats?.totalPassed ?? 0} color="green" />
        <StatCard label="Failed" value={stats?.totalFailed ?? 0} color="red" />
        <StatCard label="Scenarios" value={scenarioCount[0]?.count ?? 0} color="blue" />
      </div>

      {/* Recent Runs */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          <Link
            href="/runs"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View all
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
            <p className="text-gray-400">No test runs yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Create a scenario and run it to see results here
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Tests</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Passed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Failed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-900/30">
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} failed={run.failed} />
                    </td>
                    <td className="px-4 py-3">{run.totalTests}</td>
                    <td className="px-4 py-3 text-green-400">{run.passed}</td>
                    <td className="px-4 py-3 text-red-400">{run.failed}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}
                    </td>
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
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-400' :
    color === 'red' ? 'text-red-400' :
    color === 'blue' ? 'text-blue-400' : 'text-gray-100';

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status, failed }: { status: string; failed: number }) {
  if (status === 'running') {
    return <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">Running</span>;
  }
  if (failed > 0) {
    return <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">Failed</span>;
  }
  return <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">Passed</span>;
}
