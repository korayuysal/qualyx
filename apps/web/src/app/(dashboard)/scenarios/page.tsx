import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export default async function ScenariosPage() {
  const scenarios = await db
    .select()
    .from(schema.scenarios)
    .orderBy(desc(schema.scenarios.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenarios</h1>
          <p className="mt-1 text-sm text-gray-400">
            Define test scenarios in YAML
          </p>
        </div>
        <Link
          href="/scenarios/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          New Scenario
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
          <p className="text-gray-400">No scenarios yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Create your first test scenario to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {scenarios.map((scenario) => (
            <Link
              key={scenario.id}
              href={`/scenarios/${scenario.id}`}
              className="block rounded-lg border border-gray-800 bg-gray-900/50 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{scenario.name}</h3>
                <span className="text-xs text-gray-500">
                  Updated {scenario.updatedAt.toLocaleDateString()}
                </span>
              </div>
              {scenario.description && (
                <p className="mt-1 text-sm text-gray-400">{scenario.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
