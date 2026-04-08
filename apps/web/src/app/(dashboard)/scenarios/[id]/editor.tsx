'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  yamlContent: string;
  updatedAt: Date;
}

interface Run {
  id: string;
  status: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number | null;
  startedAt: Date;
}

export function ScenarioEditor({
  scenario,
  recentRuns,
}: {
  scenario: Scenario;
  recentRuns: Run[];
}) {
  const router = useRouter();
  const [name, setName] = useState(scenario.name);
  const [description, setDescription] = useState(scenario.description || '');
  const [yaml, setYaml] = useState(scenario.yamlContent);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSave() {
    setSaving(true);
    setMessage('');

    const res = await fetch(`/api/scenarios/${scenario.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, yamlContent: yaml }),
    });

    if (res.ok) {
      setMessage('Saved');
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  async function handleRun() {
    setRunning(true);
    setMessage('');

    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: scenario.id }),
    });

    if (res.ok) {
      const { runId } = await res.json();
      setMessage('Run started');
      router.push(`/runs/${runId}`);
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this scenario?')) return;

    const res = await fetch(`/api/scenarios/${scenario.id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      router.push('/scenarios');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{scenario.name}</h1>
          <p className="mt-1 text-sm text-gray-400">
            Last updated {scenario.updatedAt.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {running ? 'Starting...' : 'Run Now'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/30"
          >
            Delete
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-md px-4 py-2 text-sm ${
          message.startsWith('Error')
            ? 'bg-red-900/50 border border-red-800 text-red-200'
            : 'bg-green-900/50 border border-green-800 text-green-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Configuration (YAML)
            </label>
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              rows={30}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-300">Recent Runs</h3>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-gray-500">No runs yet</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <a
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="block rounded-md border border-gray-800 p-3 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      run.failed > 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {run.failed > 0 ? 'FAILED' : 'PASSED'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {run.passed}/{run.totalTests} passed
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {run.startedAt.toLocaleString()}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
