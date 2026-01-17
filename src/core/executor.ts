import { randomUUID } from 'node:crypto';
import type {
  QualyxConfig,
  App,
  Rule,
  TestResult,
  RunResult,
  RunOptions,
  PromptContext,
  ClaudeResponse,
} from '../types/index.js';
import { getApp, getRule, getEnvironmentUrl } from './config-loader.js';
import { buildExecutionPrompt, buildDryRunPrompt } from './prompt-builder.js';
import { runClaude, isClaudeAvailable } from './claude-runner.js';
import {
  shouldRetry,
  buildRetryContext,
  calculateRetryDelay,
  sleep,
  analyzeFailure,
} from './retry-handler.js';

export interface ExecutorCallbacks {
  onTestStart?: (app: App, rule: Rule) => void;
  onTestComplete?: (result: TestResult) => void;
  onTestRetry?: (app: App, rule: Rule, attempt: number, maxRetries: number) => void;
  onRunStart?: (totalTests: number) => void;
  onRunComplete?: (result: RunResult) => void;
}

export interface ExecutorOptions extends RunOptions {
  callbacks?: ExecutorCallbacks;
}

/**
 * Main executor class that orchestrates test runs.
 */
export class Executor {
  private config: QualyxConfig;
  private options: ExecutorOptions;
  private callbacks: ExecutorCallbacks;

  constructor(config: QualyxConfig, options: ExecutorOptions = {}) {
    this.config = config;
    this.options = options;
    this.callbacks = options.callbacks || {};
  }

  /**
   * Execute all tests or filtered tests based on options.
   */
  async run(): Promise<RunResult> {
    // Check if Claude is available (unless dry-run)
    if (!this.options.dryRun) {
      const claudeAvailable = await isClaudeAvailable();
      if (!claudeAvailable) {
        throw new Error(
          'Claude Code CLI is not available. Please install it with: npm install -g @anthropic-ai/claude-code'
        );
      }
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const results: TestResult[] = [];

    // Get tests to run based on filters
    const testsToRun = this.getTestsToRun();

    // Notify run start
    this.callbacks.onRunStart?.(testsToRun.length);

    // Execute each test sequentially
    for (const { app, rule } of testsToRun) {
      const result = await this.executeTest(app, rule);
      results.push(result);
    }

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const runResult: RunResult = {
      runId,
      startedAt,
      completedAt,
      duration,
      totalTests: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
      environment: this.options.environment || 'default',
    };

    // Notify run complete
    this.callbacks.onRunComplete?.(runResult);

    return runResult;
  }

  /**
   * Get the list of tests to run based on filters.
   */
  private getTestsToRun(): Array<{ app: App; rule: Rule }> {
    const tests: Array<{ app: App; rule: Rule }> = [];

    for (const app of this.config.apps) {
      // Filter by app name if specified
      if (this.options.app && app.name !== this.options.app) {
        continue;
      }

      for (const rule of app.rules) {
        // Filter by rule ID if specified
        if (this.options.rule && rule.id !== this.options.rule) {
          continue;
        }

        tests.push({ app, rule });
      }
    }

    return tests;
  }

  /**
   * Execute a single test with retry logic.
   */
  private async executeTest(app: App, rule: Rule): Promise<TestResult> {
    // Notify test start
    this.callbacks.onTestStart?.(app, rule);

    const startedAt = new Date().toISOString();
    const maxRetries = this.options.retries ?? this.config.organization.defaults?.retries ?? 2;
    const timeout = this.options.timeout ?? rule.timeout ?? this.config.organization.defaults?.timeout ?? 30000;

    let result: ClaudeResponse;
    let retryCount = 0;
    let lastContext: PromptContext = this.buildContext(app, rule);

    // Initial execution
    const prompt = this.options.dryRun
      ? buildDryRunPrompt(lastContext)
      : buildExecutionPrompt(lastContext);

    result = await runClaude(prompt, {
      timeout,
      dryRun: this.options.dryRun,
      headless: !this.options.headed,
    });

    // Retry loop
    while (shouldRetry(result, retryCount, maxRetries)) {
      retryCount++;

      // Notify retry
      this.callbacks.onTestRetry?.(app, rule, retryCount, maxRetries);

      // Wait before retry (exponential backoff)
      await sleep(calculateRetryDelay(retryCount - 1));

      // Build enhanced context with failure information
      lastContext = buildRetryContext(lastContext, result, retryCount);

      // Execute with enhanced context
      const retryPrompt = buildExecutionPrompt(lastContext);
      result = await runClaude(retryPrompt, {
        timeout,
        dryRun: this.options.dryRun,
        headless: !this.options.headed,
      });
    }

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const testResult: TestResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      appName: app.name,
      status: result.status,
      severity: rule.severity,
      startedAt,
      completedAt,
      duration,
      steps: result.steps,
      validations: result.validations,
      error: result.error,
      screenshot: result.screenshot,
      retryCount,
    };

    // Notify test complete
    this.callbacks.onTestComplete?.(testResult);

    return testResult;
  }

  /**
   * Build the prompt context for a test.
   */
  private buildContext(app: App, rule: Rule): PromptContext {
    return {
      app,
      rule,
      environment: this.options.environment,
      credentials: this.resolveCredentials(app),
    };
  }

  /**
   * Resolve credentials from app auth configuration.
   */
  private resolveCredentials(app: App): Record<string, string> {
    if (!app.auth?.credentials) {
      return {};
    }
    return app.auth.credentials;
  }

  /**
   * Get a preview of what would be executed (for dry-run mode).
   */
  getExecutionPreview(): Array<{
    app: string;
    rule: string;
    severity: string;
    steps: number;
    prompt: string;
  }> {
    const testsToRun = this.getTestsToRun();

    return testsToRun.map(({ app, rule }) => {
      const context = this.buildContext(app, rule);
      const prompt = buildDryRunPrompt(context);

      return {
        app: app.name,
        rule: rule.id,
        severity: rule.severity,
        steps: rule.steps.length,
        prompt,
      };
    });
  }
}

/**
 * Create and run an executor with the given configuration.
 */
export async function executeTests(
  config: QualyxConfig,
  options: ExecutorOptions = {}
): Promise<RunResult> {
  const executor = new Executor(config, options);
  return executor.run();
}
