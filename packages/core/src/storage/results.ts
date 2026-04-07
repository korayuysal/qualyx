import { createHash } from 'node:crypto';
import type { QualyxConfig, RunResult, TestResult } from '../types/index.js';
import { QualyxStorage, getStorage } from './sqlite.js';

/**
 * Generate a hash of the configuration for change detection.
 */
export function hashConfig(config: QualyxConfig): string {
  const content = JSON.stringify(config);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Save a run result to storage.
 */
export function saveRunResult(result: RunResult, config?: QualyxConfig): void {
  const storage = getStorage();
  const configHash = config ? hashConfig(config) : undefined;
  storage.saveRun(result, configHash);
}

/**
 * Get the latest run result.
 */
export function getLatestRunResult(): RunResult | null {
  const storage = getStorage();
  return storage.getLatestRun();
}

/**
 * Get a run result by ID.
 */
export function getRunResult(runId: string): RunResult | null {
  const storage = getStorage();
  return storage.getRun(runId);
}

/**
 * Get recent run results.
 */
export function getRecentRunResults(limit: number = 10): RunResult[] {
  const storage = getStorage();
  return storage.getRecentRuns(limit);
}

/**
 * Get runs that had failures.
 */
export function getFailedRunResults(limit: number = 10): RunResult[] {
  const storage = getStorage();
  return storage.getFailedRuns(limit);
}

/**
 * Get history for a specific test rule.
 */
export function getTestHistory(ruleId: string, appName: string, limit: number = 10): TestResult[] {
  const storage = getStorage();
  return storage.getTestHistory(ruleId, appName, limit);
}

/**
 * Get statistics for a test rule.
 */
export function getTestStats(ruleId: string, appName: string) {
  const storage = getStorage();
  return storage.getRuleStats(ruleId, appName);
}

/**
 * Clean up old run data.
 */
export function cleanupOldRuns(daysToKeep: number = 30): number {
  const storage = getStorage();
  return storage.cleanupOldRuns(daysToKeep);
}

/**
 * Analyze trends for a test rule.
 */
export function analyzeTestTrend(ruleId: string, appName: string, limit: number = 20) {
  const history = getTestHistory(ruleId, appName, limit);

  if (history.length === 0) {
    return null;
  }

  // Calculate metrics
  const totalRuns = history.length;
  const passed = history.filter((t) => t.status === 'passed').length;
  const failed = history.filter((t) => t.status === 'failed').length;
  const avgDuration = history.reduce((sum, t) => sum + t.duration, 0) / totalRuns;

  // Determine trend direction
  const recent = history.slice(0, Math.ceil(history.length / 2));
  const older = history.slice(Math.ceil(history.length / 2));

  const recentPassRate = recent.filter((t) => t.status === 'passed').length / recent.length;
  const olderPassRate =
    older.length > 0 ? older.filter((t) => t.status === 'passed').length / older.length : recentPassRate;

  let trend: 'improving' | 'degrading' | 'stable';
  if (recentPassRate > olderPassRate + 0.1) {
    trend = 'improving';
  } else if (recentPassRate < olderPassRate - 0.1) {
    trend = 'degrading';
  } else {
    trend = 'stable';
  }

  return {
    ruleId,
    appName,
    totalRuns,
    passed,
    failed,
    passRate: (passed / totalRuns) * 100,
    avgDuration,
    trend,
    history: history.map((t) => ({
      status: t.status,
      duration: t.duration,
      startedAt: t.startedAt,
    })),
  };
}
