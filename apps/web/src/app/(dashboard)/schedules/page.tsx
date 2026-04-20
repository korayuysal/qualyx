import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { ScheduleRowActions } from './row-actions';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const schedules = await db
    .select({
      id: schema.schedules.id,
      scenarioId: schema.schedules.scenarioId,
      scenarioName: schema.scenarios.name,
      cronExpression: schema.schedules.cronExpression,
      enabled: schema.schedules.enabled,
      lastRunAt: schema.schedules.lastRunAt,
      nextRunAt: schema.schedules.nextRunAt,
    })
    .from(schema.schedules)
    .innerJoin(schema.scenarios, eq(schema.schedules.scenarioId, schema.scenarios.id))
    .orderBy(desc(schema.schedules.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="mt-1 text-sm text-gray-400">
            Run scenarios automatically on a cron schedule
          </p>
        </div>
        <Link
          href="/schedules/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          New Schedule
        </Link>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
          <p className="text-gray-400">No schedules yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create a schedule to run a scenario automatically
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-900 text-left text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Scenario</th>
                <th className="px-4 py-3 font-medium">Cron</th>
                <th className="px-4 py-3 font-medium">Next run</th>
                <th className="px-4 py-3 font-medium">Last run</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/scenarios/${s.scenarioId}`}
                      className="font-medium text-gray-100 hover:text-blue-400"
                    >
                      {s.scenarioName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {s.cronExpression}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {s.nextRunAt ? s.nextRunAt.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {s.lastRunAt ? s.lastRunAt.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.enabled
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScheduleRowActions id={s.id} enabled={s.enabled} />
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
