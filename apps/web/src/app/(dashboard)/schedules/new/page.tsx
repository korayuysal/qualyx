'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { previewNextRuns, validateCron } from '@/lib/cron';

const CRON_EXAMPLES = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily 09:00', value: '0 9 * * *' },
  { label: 'Weekdays 08:00', value: '0 8 * * 1-5' },
];

type Scenario = { id: string; name: string };

export default function NewSchedulePage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((data: Scenario[]) => {
        setScenarios(data);
        if (data.length > 0) setScenarioId((current) => current || data[0].id);
      })
      .catch(() => setError('Failed to load scenarios'));
  }, []);

  const preview = useMemo(() => {
    const check = validateCron(cron);
    if (!check.valid) return { ok: false as const, error: check.error };
    try {
      return { ok: true as const, runs: previewNextRuns(cron, 3) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid' };
    }
  }, [cron]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scenarioId) {
      setError('Select a scenario');
      return;
    }
    if (!preview.ok) {
      setError(preview.error);
      return;
    }
    setSaving(true);
    setError('');

    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId, cronExpression: cron, enabled }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create schedule');
      setSaving(false);
      return;
    }

    router.push('/schedules');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New Schedule</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-800 bg-red-900/50 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300">Scenario</label>
          <select
            required
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {scenarios.length === 0 && <option value="">No scenarios available</option>}
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Cron expression</label>
          <input
            required
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="0 9 * * *"
            spellCheck={false}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {CRON_EXAMPLES.map((ex) => (
              <button
                key={ex.value}
                type="button"
                onClick={() => setCron(ex.value)}
                className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-gray-800 bg-gray-900/50 p-4 text-sm">
          {preview.ok ? (
            <>
              <p className="font-medium text-gray-300">Next 3 runs:</p>
              <ul className="mt-1 space-y-1 text-gray-400">
                {preview.runs.map((d, i) => (
                  <li key={i} className="font-mono text-xs">
                    {d.toLocaleString()}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-red-300">Invalid cron: {preview.error}</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-gray-700 bg-gray-900"
          />
          Enabled
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !preview.ok || !scenarioId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Schedule'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
