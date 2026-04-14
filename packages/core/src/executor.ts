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
} from './types/index.js';
import { getApp, getRule, getEnvironmentUrl, getAppSetup } from './config-loader.js';
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
  onTestStart?: (app: App, rule: Rule) => void | Promise<void>;
  onTestComplete?: (result: TestResult) => void | Promise<void>;
  onTestRetry?: (app: App, rule: Rule, attempt: number, maxRetries: number) => void | Promise<void>;
  onRunStart?: (totalTests: number) => void | Promise<void>;
  onRunComplete?: (result: RunResult) => void | Promise<void>;
  onSetupStart?: (app: App) => void | Promise<void>;
  onSetupComplete?: (app: App, success: boolean, error?: string) => void | Promise<void>;
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
  private setupCompleted: Map<string, boolean>;
  private setupErrors: Map<string, string>;

  constructor(config: QualyxConfig, options: ExecutorOptions = {}) {
    this.config = config;
    this.options = options;
    this.callbacks = options.callbacks || {};
    this.setupCompleted = new Map();
    this.setupErrors = new Map();
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

    // Get tests to run based on filters
    const testsToRun = this.getTestsToRun();

    // Notify run start
    await this.callbacks.onRunStart?.(testsToRun.length);

    // Execute tests (parallel or sequential)
    const results = this.options.parallel
      ? await this.executeParallel(testsToRun)
      : await this.executeSequential(testsToRun);

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
    await this.callbacks.onRunComplete?.(runResult);

    return runResult;
  }

  /**
   * Execute tests sequentially.
   */
  private async executeSequential(testsToRun: Array<{ app: App; rule: Rule }>): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const { app, rule } of testsToRun) {
      // Run setup if needed and not skipped
      if (!rule.skip_setup && app.setup?.length && !this.setupCompleted.has(app.name)) {
        await this.runSetup(app);
      }

      // Check if setup failed for this app
      if (this.setupErrors.has(app.name) && !rule.skip_setup) {
        const skipResult = this.createSkipResult(app, rule, `Setup failed: ${this.setupErrors.get(app.name)}`);
        results.push(skipResult);
        await this.callbacks.onTestComplete?.(skipResult);
        continue;
      }

      const result = await this.executeTest(app, rule);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute tests in parallel with concurrency limit.
   */
  private async executeParallel(testsToRun: Array<{ app: App; rule: Rule }>): Promise<TestResult[]> {
    const maxParallel = this.options.maxParallel ?? 3;
    const results: TestResult[] = [];
    const pending: Array<Promise<void>> = [];

    // First, run all setups sequentially to avoid race conditions
    const appsWithSetup = new Set<string>();
    for (const { app, rule } of testsToRun) {
      if (!rule.skip_setup && app.setup?.length && !appsWithSetup.has(app.name)) {
        appsWithSetup.add(app.name);
        if (!this.setupCompleted.has(app.name)) {
          await this.runSetup(app);
        }
      }
    }

    // Create a queue of tests
    const queue = [...testsToRun];
    let running = 0;

    const executeNext = async (): Promise<void> => {
      if (queue.length === 0) return;

      const test = queue.shift();
      if (!test) return;

      const { app, rule } = test;
      running++;

      try {
        // Check if setup failed for this app
        if (this.setupErrors.has(app.name) && !rule.skip_setup) {
          const skipResult = this.createSkipResult(app, rule, `Setup failed: ${this.setupErrors.get(app.name)}`);
          results.push(skipResult);
          await this.callbacks.onTestComplete?.(skipResult);
        } else {
          const result = await this.executeTest(app, rule);
          results.push(result);
        }
      } finally {
        running--;
        // Start next test if there are more in queue
        if (queue.length > 0 && running < maxParallel) {
          pending.push(executeNext());
        }
      }
    };

    // Start initial batch of parallel tests
    const initialBatch = Math.min(maxParallel, queue.length);
    for (let i = 0; i < initialBatch; i++) {
      pending.push(executeNext());
    }

    // Wait for all tests to complete
    await Promise.all(pending);

    // Sort results to maintain original order
    const orderMap = new Map(testsToRun.map(({ rule }, i) => [rule.id, i]));
    results.sort((a, b) => (orderMap.get(a.ruleId) ?? 0) - (orderMap.get(b.ruleId) ?? 0));

    return results;
  }

  /**
   * Create a skip result for a test.
   */
  private createSkipResult(app: App, rule: Rule, error: string): TestResult {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      appName: app.name,
      status: 'skipped',
      severity: rule.severity,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 0,
      steps: [],
      validations: [],
      error,
      retryCount: 0,
    };
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
    await this.callbacks.onTestStart?.(app, rule);

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
      await this.callbacks.onTestRetry?.(app, rule, retryCount, maxRetries);

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
    await this.callbacks.onTestComplete?.(testResult);

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
      collectMetrics: this.options.collectMetrics,
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
   * Run setup steps for an app.
   */
  private async runSetup(app: App): Promise<void> {
    const setupSteps = getAppSetup(app);
    if (!setupSteps.length) {
      this.setupCompleted.set(app.name, true);
      return;
    }

    // Notify setup start
    await this.callbacks.onSetupStart?.(app);

    // Create a virtual rule for setup
    const setupRule: Rule = {
      id: `__setup__${app.name}`,
      name: `Setup for ${app.name}`,
      severity: 'critical',
      steps: setupSteps,
      validations: [],
    };

    const timeout = this.config.organization.defaults?.timeout ?? 30000;
    const context: PromptContext = {
      app,
      rule: setupRule,
      environment: this.options.environment,
      credentials: this.resolveCredentials(app),
    };

    try {
      const prompt = this.options.dryRun
        ? buildDryRunPrompt(context)
        : buildExecutionPrompt(context);

      const result = await runClaude(prompt, {
        timeout,
        dryRun: this.options.dryRun,
        headless: !this.options.headed,
      });

      if (result.status === 'passed') {
        this.setupCompleted.set(app.name, true);
        await this.callbacks.onSetupComplete?.(app, true);
      } else {
        this.setupErrors.set(app.name, result.error || 'Setup failed');
        await this.callbacks.onSetupComplete?.(app, false, result.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown setup error';
      this.setupErrors.set(app.name, errorMessage);
      await this.callbacks.onSetupComplete?.(app, false, errorMessage);
    }
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
