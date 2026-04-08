import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ScenarioEditor } from './editor';

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [scenario] = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.id, id))
    .limit(1);

  if (!scenario) notFound();

  const recentRuns = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.scenarioId, id))
    .orderBy(desc(schema.runs.startedAt))
    .limit(5);

  return (
    <div className="space-y-6">
      <ScenarioEditor scenario={scenario} recentRuns={recentRuns} />
    </div>
  );
}
