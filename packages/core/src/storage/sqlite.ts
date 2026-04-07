import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import type { RunResult, TestResult, StoredRun, StoredTestResult } from '../types/index.js';

const DEFAULT_DB_PATH = '.qualyx/history.db';

/**
 * SQLite storage for test run history.
 */
export class QualyxStorage {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    // Ensure directory exists
    const fullPath = resolve(dbPath);
    const dir = resolve(fullPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(fullPath);
    this.initialize();
  }

  /**
   * Initialize the database schema.
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        config_hash TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration INTEGER NOT NULL,
        total_tests INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        skipped INTEGER NOT NULL,
        environment TEXT,
        results_json TEXT
      );

      CREATE TABLE IF NOT EXISTS test_results (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        app_name TEXT NOT NULL,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration INTEGER NOT NULL,
        error TEXT,
        screenshot TEXT,
        retry_count INTEGER DEFAULT 0,
        steps_json TEXT,
        validations_json TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
      CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
    `);
  }

  /**
   * Save a complete run result to the database.
   */
  saveRun(result: RunResult, configHash?: string): void {
    const insertRun = this.db.prepare(`
      INSERT INTO runs (id, config_hash, started_at, completed_at, duration, total_tests, passed, failed, skipped, environment, results_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTestResult = this.db.prepare(`
      INSERT INTO test_results (id, run_id, rule_id, rule_name, app_name, status, severity, started_at, completed_at, duration, error, screenshot, retry_count, steps_json, validations_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveAll = this.db.transaction(() => {
      insertRun.run(
        result.runId,
        configHash || null,
        result.startedAt,
        result.completedAt,
        result.duration,
        result.totalTests,
        result.passed,
        result.failed,
        result.skipped,
        result.environment,
        JSON.stringify(result.results)
      );

      for (const test of result.results) {
        const testId = `${result.runId}-${test.ruleId}`;
        insertTestResult.run(
          testId,
          result.runId,
          test.ruleId,
          test.ruleName,
          test.appName,
          test.status,
          test.severity,
          test.startedAt,
          test.completedAt,
          test.duration,
          test.error || null,
          test.screenshot || null,
          test.retryCount,
          JSON.stringify(test.steps),
          JSON.stringify(test.validations)
        );
      }
    });

    saveAll();
  }

  /**
   * Get the most recent run.
   */
  getLatestRun(): RunResult | null {
    const row = this.db
      .prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 1')
      .get() as StoredRun | undefined;

    if (!row) {
      return null;
    }

    return this.rowToRunResult(row);
  }

  /**
   * Get a run by ID.
   */
  getRun(runId: string): RunResult | null {
    const row = this.db
      .prepare('SELECT * FROM runs WHERE id = ?')
      .get(runId) as StoredRun | undefined;

    if (!row) {
      return null;
    }

    return this.rowToRunResult(row);
  }

  /**
   * Get recent runs.
   */
  getRecentRuns(limit: number = 10): RunResult[] {
    const rows = this.db
      .prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?')
      .all(limit) as StoredRun[];

    return rows.map((row) => this.rowToRunResult(row));
  }

  /**
   * Get runs with failures.
   */
  getFailedRuns(limit: number = 10): RunResult[] {
    const rows = this.db
      .prepare('SELECT * FROM runs WHERE failed > 0 ORDER BY started_at DESC LIMIT ?')
      .all(limit) as StoredRun[];

    return rows.map((row) => this.rowToRunResult(row));
  }

  /**
   * Get test results for a specific rule across runs.
   */
  getTestHistory(ruleId: string, appName: string, limit: number = 10): TestResult[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM test_results WHERE rule_id = ? AND app_name = ? ORDER BY started_at DESC LIMIT ?'
      )
      .all(ruleId, appName, limit) as StoredTestResult[];

    return rows.map((row) => this.rowToTestResult(row));
  }

  /**
   * Get statistics for a rule over time.
   */
  getRuleStats(
    ruleId: string,
    appName: string
  ): { total: number; passed: number; failed: number; passRate: number } {
    const row = this.db
      .prepare(
        `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM test_results
        WHERE rule_id = ? AND app_name = ?
      `
      )
      .get(ruleId, appName) as { total: number; passed: number; failed: number };

    return {
      total: row.total,
      passed: row.passed,
      failed: row.failed,
      passRate: row.total > 0 ? (row.passed / row.total) * 100 : 0,
    };
  }

  /**
   * Delete old runs (older than specified days).
   */
  cleanupOldRuns(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffIso = cutoffDate.toISOString();

    const deleteTestResults = this.db.prepare(`
      DELETE FROM test_results WHERE run_id IN (
        SELECT id FROM runs WHERE started_at < ?
      )
    `);

    const deleteRuns = this.db.prepare('DELETE FROM runs WHERE started_at < ?');

    const cleanup = this.db.transaction(() => {
      deleteTestResults.run(cutoffIso);
      const result = deleteRuns.run(cutoffIso);
      return result.changes;
    });

    return cleanup();
  }

  /**
   * Convert a stored run row to a RunResult.
   */
  private rowToRunResult(row: StoredRun): RunResult {
    return {
      runId: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      totalTests: row.total_tests,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      environment: row.environment,
      results: JSON.parse(row.results_json),
    };
  }

  /**
   * Convert a stored test result row to a TestResult.
   */
  private rowToTestResult(row: StoredTestResult): TestResult {
    return {
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      appName: row.app_name,
      status: row.status,
      severity: row.severity,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      steps: JSON.parse(row.steps_json),
      validations: JSON.parse(row.validations_json),
      error: row.error ?? undefined,
      screenshot: row.screenshot ?? undefined,
      retryCount: row.retry_count,
    };
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance for convenience
let defaultStorage: QualyxStorage | null = null;

/**
 * Get the default storage instance.
 */
export function getStorage(dbPath?: string): QualyxStorage {
  if (!defaultStorage) {
    defaultStorage = new QualyxStorage(dbPath);
  }
  return defaultStorage;
}

/**
 * Close the default storage instance.
 */
export function closeStorage(): void {
  if (defaultStorage) {
    defaultStorage.close();
    defaultStorage = null;
  }
}
