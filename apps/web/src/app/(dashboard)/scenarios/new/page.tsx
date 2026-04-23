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

const PROMPT_PLACEHOLDER = `Example: Search for flights from Istanbul to Cairo for next weekend, open the first result, and verify the total price matches the breakdown shown on the details page.`;

export default function NewScenarioPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [yaml, setYaml] = useState(STARTER_YAML);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const body = advancedOpen
      ? { name, description, yamlContent: yaml }
      : { name: name || undefined, description, url, prompt };

    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Scenario</h1>
        <p className="mt-1 text-sm text-gray-400">
          Describe what you want to verify in plain English.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-800 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Name <span className="text-gray-500">(optional)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Leave blank to auto-generate from your prompt"
          />
        </div>

        {!advancedOpen && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Website
              </label>
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="https://flights.google.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                What do you want to verify?
              </label>
              <textarea
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={PROMPT_PLACEHOLDER}
              />
              <p className="mt-1 text-xs text-gray-500">
                Write like you&apos;re briefing a QA engineer. Claude will open the site and act on your behalf.
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300">
            Description <span className="text-gray-500">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Short note for your team"
          />
        </div>

        <details
          className="rounded-md border border-gray-800 bg-gray-950/50"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-400 hover:text-gray-200">
            Advanced: edit as YAML
          </summary>
          <div className="border-t border-gray-800 p-3">
            <p className="mb-2 text-xs text-gray-500">
              Power users only. When this section is open, the YAML below is submitted instead of the prompt form above.
            </p>
            <textarea
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              rows={24}
              className="block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              spellCheck={false}
            />
          </div>
        </details>

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
