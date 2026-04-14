'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface RunData {
  id: string;
  status: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

interface TestResultData {
  id: string;
  ruleId: string;
  ruleName: string;
  appName: string;
  status: string;
  severity: string;
  duration: number;
  error: string | null;
  retryCount: number;
  stepsJson: unknown;
  validationsJson: unknown;
  completedAt: string;
}

function StepsDisplay({ steps }: { steps: unknown }) {
  if (!steps || !Array.isArray(steps) || steps.length === 0) return null;
  const typedSteps = steps as Array<{ step: string; status: string }>;
  return (
    <div>
      <div className="text-xs font-medium text-gray-400 mb-1">Steps</div>
      <div className="space-y-1">
        {typedSteps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={step.status === 'passed' ? 'text-green-400' : 'text-red-400'}>
              {step.status === 'passed' ? '✓' : '✗'}
            </span>
            <span className="text-gray-300">{step.step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidationsDisplay({ validations }: { validations: unknown }) {
  if (!validations || !Array.isArray(validations) || validations.length === 0) return null;
  const typedValidations = validations as Array<{ validation: string; passed: boolean; details?: string }>;
  return (
    <div>
      <div className="text-xs font-medium text-gray-400 mb-1">Validations</div>
      <div className="space-y-1">
        {typedValidations.map((v, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={v.passed ? 'text-green-400' : 'text-red-400'}>
              {v.passed ? '✓' : '✗'}
            </span>
            <div>
              <span className="text-gray-300">{v.validation}</span>
              {v.details && <p className="text-gray-500 mt-0.5">{v.details}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunDetail({
  run: initialRun,
  scenarioName,
  initialTestResults,
}: {
  run: RunData;
  scenarioName: string;
  initialTestResults: TestResultData[];
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [testResults, setTestResults] = useState(initialTestResults);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (run.status !== 'running') return;

    const es = new EventSource(`/api/runs/${run.id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('run-status', (e) => {
      const data = JSON.parse(e.data);
      setRun((prev) => ({ ...prev, ...data }));
    });

    es.addEventListener('test-result', (e) => {
      const result = JSON.parse(e.data);
      setTestResults((prev) => {
        // Avoid duplicates by checking ID
        if (prev.some((tr) => tr.id === result.id)) return prev;
        return [...prev, result];
      });
    });

    es.addEventListener('run-complete', (e) => {
      const data = JSON.parse(e.data);
      setRun((prev) => ({ ...prev, status: data.status }));
      es.close();
    });

    es.addEventListener('error', () => {
      es.close();
    });

    return () => {
      es.close();
    };
  }, [run.id, run.status]);

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch(`/api/runs/${run.id}/cancel`, { method: 'POST' });
    if (res.ok) {
      setRun((prev) => ({ ...prev, status: 'cancelled' }));
      eventSourceRef.current?.close();
    }
    setCancelling(false);
  }

  const statusColor: Record<string, string> = {
    running: 'bg-yellow-900/50 text-yellow-300',
    completed: 'bg-green-900/50 text-green-300',
    failed: 'bg-red-900/50 text-red-300',
    cancelled: 'bg-gray-700/50 text-gray-300',
  };

  const testStatusColor: Record<string, string> = {
    passed: 'text-green-400',
    failed: 'text-red-400',
    skipped: 'text-gray-500',
  };

  const completedTests = testResults.length;
  const progressPercent = run.totalTests > 0
    ? Math.round((completedTests / run.totalTests) * 100)
    : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{scenarioName}</h1>
          <p className="mt-1 text-sm text-gray-400">
            Started {new Date(run.startedAt).toLocaleString()}
            {' · '}
            <span className="capitalize">{run.triggeredBy}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColor[run.status] || ''}`}>
            {run.status === 'running' ? 'Running...' : run.status.charAt(0).toUpperCase() + run.status.slice(1)}
          </span>
          {run.status === 'running' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Run'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {run.status === 'running' && run.totalTests > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>{completedTests} / {run.totalTests} tests</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-2xl font-bold">{run.totalTests}</div>
          <div className="text-sm text-gray-400">Total Tests</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-2xl font-bold text-green-400">{run.passed}</div>
          <div className="text-sm text-gray-400">Passed</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-2xl font-bold text-red-400">{run.failed}</div>
          <div className="text-sm text-gray-400">Failed</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="text-2xl font-bold">
            {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}
          </div>
          <div className="text-sm text-gray-400">Duration</div>
        </div>
      </div>

      {/* Test results table */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Test Results</h2>
        {testResults.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-8 text-center">
            <p className="text-gray-400">
              {run.status === 'running' ? 'Waiting for test results...' : 'No test results'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {testResults.map((tr) => (
              <div key={tr.id} className="rounded-lg border border-gray-800">
                <button
                  onClick={() => setExpandedTest(expandedTest === tr.id ? null : tr.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-900/30"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${testStatusColor[tr.status] || 'text-gray-400'}`}>
                      {tr.status.toUpperCase()}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-200">{tr.ruleName}</span>
                      <span className="ml-2 text-xs text-gray-500">{tr.appName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {tr.retryCount > 0 && (
                      <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-yellow-400">
                        {tr.retryCount} {tr.retryCount === 1 ? 'retry' : 'retries'}
                      </span>
                    )}
                    <span className="rounded bg-gray-800 px-1.5 py-0.5">{tr.severity}</span>
                    <span>{tr.duration ? `${(tr.duration / 1000).toFixed(1)}s` : '-'}</span>
                    <span>{expandedTest === tr.id ? '▼' : '▶'}</span>
                  </div>
                </button>

                {expandedTest === tr.id && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                    {tr.error && (
                      <div className="rounded-md bg-red-900/20 border border-red-900/50 p-3">
                        <div className="text-xs font-medium text-red-400 mb-1">Error</div>
                        <pre className="text-xs text-red-200 whitespace-pre-wrap">{tr.error}</pre>
                      </div>
                    )}
                    <StepsDisplay steps={tr.stepsJson} />
                    <ValidationsDisplay validations={tr.validationsJson} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back link */}
      <div>
        <a href="/runs" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to all runs
        </a>
      </div>
    </>
  );
}
