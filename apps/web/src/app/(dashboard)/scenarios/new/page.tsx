'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STARTER_YAML = `organization:
  name: My Organization
  defaults:
    timeout: 30000
    retries: 2

apps:
  - name: my-app
    url: https://example.com
    auth:
      type: none

    rules:
      - id: homepage-loads
        name: Homepage loads correctly
        severity: critical
        steps:
          - Navigate to the homepage
          - Wait for the page to fully load
        validations:
          - Page title is visible
          - No JavaScript errors in the console
`;

export default function NewScenarioPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [yaml, setYaml] = useState(STARTER_YAML);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, yamlContent: yaml }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create scenario');
      setSaving(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/scenarios/${id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">New Scenario</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-800 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g., Homepage QA Suite"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Configuration (YAML)
          </label>
          <textarea
            required
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            rows={24}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            spellCheck={false}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Scenario'}
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
