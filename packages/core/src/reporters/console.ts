import chalk from 'chalk';
import type { App, Rule, TestResult, RunResult, TestStatus } from '../types/index.js';
import type { ExecutorCallbacks } from '../executor.js';

export interface ConsoleReporterOptions {
  verbose?: boolean;
  showPrompts?: boolean;
}

/**
 * Format duration in a human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get the status icon for a test status.
 */
function getStatusIcon(status: TestStatus): string {
  switch (status) {
    case 'passed':
      return chalk.green('✓');
    case 'failed':
      return chalk.red('✗');
    case 'skipped':
      return chalk.yellow('○');
    case 'pending':
      return chalk.gray('◌');
    default:
      return chalk.gray('?');
  }
}

/**
 * Get the severity badge.
 */
function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white(` ${severity.toUpperCase()} `);
    case 'high':
      return chalk.bgYellow.black(` ${severity.toUpperCase()} `);
    case 'medium':
      return chalk.bgBlue.white(` ${severity.toUpperCase()} `);
    case 'low':
      return chalk.bgGray.white(` ${severity.toUpperCase()} `);
    default:
      return chalk.bgGray.white(` ${severity.toUpperCase()} `);
  }
}

/**
 * Console reporter that provides colored terminal output.
 */
export class ConsoleReporter {
  private options: ConsoleReporterOptions;
  private startTime: number = 0;
  private totalTests: number = 0;
  private completedTests: number = 0;

  constructor(options: ConsoleReporterOptions = {}) {
    this.options = options;
  }

  /**
   * Get executor callbacks for live reporting.
   */
  getCallbacks(): ExecutorCallbacks {
    return {
      onRunStart: this.onRunStart.bind(this),
      onTestStart: this.onTestStart.bind(this),
      onTestComplete: this.onTestComplete.bind(this),
      onTestRetry: this.onTestRetry.bind(this),
      onRunComplete: this.onRunComplete.bind(this),
      onSetupStart: this.onSetupStart.bind(this),
      onSetupComplete: this.onSetupComplete.bind(this),
    };
  }

  /**
   * Called when setup starts for an app.
   */
  private onSetupStart(app: App): void {
    console.log(chalk.cyan(`  Setting up: ${app.name}`));
  }

  /**
   * Called when setup completes for an app.
   */
  private onSetupComplete(app: App, success: boolean, error?: string): void {
    if (success) {
      console.log(chalk.green(`  ✓ Setup complete: ${app.name}`));
    } else {
      console.log(chalk.red(`  ✗ Setup failed: ${app.name}`));
      if (error) {
        console.log(chalk.red(`    Error: ${error}`));
      }
    }
    console.log();
  }

  /**
   * Called when a test run starts.
   */
  private onRunStart(totalTests: number): void {
    this.startTime = Date.now();
    this.totalTests = totalTests;
    this.completedTests = 0;

    console.log();
    console.log(chalk.bold.cyan('  Qualyx Test Runner'));
    console.log(chalk.gray(`  Running ${totalTests} test${totalTests !== 1 ? 's' : ''}...`));
    console.log();
  }

  /**
   * Called when a test starts.
   */
  private onTestStart(app: App, rule: Rule): void {
    if (this.options.verbose) {
      console.log(chalk.gray(`  Starting: ${app.name} / ${rule.name}`));
    }
  }

  /**
   * Called when a test completes.
   */
  private onTestComplete(result: TestResult): void {
    this.completedTests++;
    const icon = getStatusIcon(result.status);
    const severity = getSeverityBadge(result.severity);
    const duration = chalk.gray(`(${formatDuration(result.duration)})`);

    console.log(`  ${icon} ${result.appName} / ${result.ruleName} ${severity} ${duration}`);

    if (result.retryCount > 0) {
      console.log(chalk.gray(`    Retried ${result.retryCount} time(s)`));
    }

    if (result.status === 'failed' && result.error) {
      console.log(chalk.red(`    Error: ${result.error}`));
    }

    if (this.options.verbose && result.steps.length > 0) {
      console.log(chalk.gray('    Steps:'));
      for (const step of result.steps) {
        const stepIcon = getStatusIcon(step.status);
        console.log(chalk.gray(`      ${stepIcon} ${step.step}`));
        if (step.error) {
          console.log(chalk.red(`        ${step.error}`));
        }
      }
    }

    if (this.options.verbose && result.validations.length > 0) {
      console.log(chalk.gray('    Validations:'));
      for (const validation of result.validations) {
        const validationIcon = validation.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(chalk.gray(`      ${validationIcon} ${validation.validation}`));
      }
    }
  }

  /**
   * Called when a test is being retried.
   */
  private onTestRetry(app: App, rule: Rule, attempt: number, maxRetries: number): void {
    console.log(
      chalk.yellow(`    Retrying (${attempt}/${maxRetries}): ${app.name} / ${rule.name}`)
    );
  }

  /**
   * Called when a test run completes.
   */
  private onRunComplete(result: RunResult): void {
    console.log();
    this.printSummary(result);
  }

  /**
   * Print the final summary.
   */
  printSummary(result: RunResult): void {
    const { totalTests, passed, failed, skipped, duration } = result;

    console.log(chalk.bold('  Summary'));
    console.log(chalk.gray('  ─'.repeat(30)));

    // Stats
    console.log(`  Total:   ${totalTests}`);
    console.log(`  ${chalk.green('Passed:')}  ${passed}`);
    console.log(`  ${chalk.red('Failed:')}  ${failed}`);
    if (skipped > 0) {
      console.log(`  ${chalk.yellow('Skipped:')} ${skipped}`);
    }
    console.log(`  Duration: ${formatDuration(duration)}`);

    // Pass rate
    if (totalTests > 0) {
      const passRate = ((passed / totalTests) * 100).toFixed(1);
      console.log(`  Pass Rate: ${passRate}%`);
    }

    console.log();

    // Final status
    if (failed === 0) {
      console.log(chalk.green.bold('  ✓ All tests passed!'));
    } else {
      console.log(chalk.red.bold(`  ✗ ${failed} test${failed !== 1 ? 's' : ''} failed`));
    }

    console.log();
  }

  /**
   * Print detailed results (for verbose mode or separate report).
   */
  printDetailedResults(result: RunResult): void {
    console.log();
    console.log(chalk.bold('  Detailed Results'));
    console.log(chalk.gray('  ─'.repeat(30)));

    for (const test of result.results) {
      console.log();
      const icon = getStatusIcon(test.status);
      const severity = getSeverityBadge(test.severity);
      console.log(`  ${icon} ${test.ruleName} ${severity}`);
      console.log(chalk.gray(`     App: ${test.appName}`));
      console.log(chalk.gray(`     ID: ${test.ruleId}`));
      console.log(chalk.gray(`     Duration: ${formatDuration(test.duration)}`));

      if (test.steps.length > 0) {
        console.log(chalk.gray('     Steps:'));
        for (const step of test.steps) {
          const stepIcon = getStatusIcon(step.status);
          console.log(chalk.gray(`       ${stepIcon} ${step.step}`));
        }
      }

      if (test.validations.length > 0) {
        console.log(chalk.gray('     Validations:'));
        for (const validation of test.validations) {
          const validationIcon = validation.passed ? chalk.green('✓') : chalk.red('✗');
          console.log(chalk.gray(`       ${validationIcon} ${validation.validation}`));
        }
      }

      if (test.error) {
        console.log(chalk.red(`     Error: ${test.error}`));
      }
    }

    console.log();
  }
}

/**
 * Print a preview of tests (for dry-run mode).
 */
export function printDryRunPreview(
  previews: Array<{
    app: string;
    rule: string;
    severity: string;
    steps: number;
    prompt: string;
  }>,
  showPrompts: boolean = false
): void {
  console.log();
  console.log(chalk.bold.cyan('  Qualyx Dry Run Preview'));
  console.log(chalk.gray(`  ${previews.length} test${previews.length !== 1 ? 's' : ''} would be executed`));
  console.log();

  for (const preview of previews) {
    const severity = getSeverityBadge(preview.severity);
    console.log(`  ${chalk.gray('○')} ${preview.app} / ${preview.rule} ${severity}`);
    console.log(chalk.gray(`    Steps: ${preview.steps}`));

    if (showPrompts) {
      console.log();
      console.log(chalk.gray('    Prompt:'));
      console.log(chalk.gray('    ─'.repeat(20)));
      const lines = preview.prompt.split('\n');
      for (const line of lines) {
        console.log(chalk.gray(`    ${line}`));
      }
      console.log(chalk.gray('    ─'.repeat(20)));
      console.log();
    }
  }

  console.log();
  console.log(chalk.yellow('  No tests were executed (dry-run mode)'));
  console.log();
}

/**
 * Print validation results (for qualyx validate command).
 */
export function printValidationResult(
  filePath: string,
  valid: boolean,
  errors: string[],
  warnings: string[]
): void {
  console.log();

  if (valid) {
    console.log(chalk.green(`  ✓ Configuration is valid: ${filePath}`));
  } else {
    console.log(chalk.red(`  ✗ Configuration is invalid: ${filePath}`));
    for (const error of errors) {
      console.log(chalk.red(`    - ${error}`));
    }
  }

  if (warnings.length > 0) {
    console.log();
    console.log(chalk.yellow('  Warnings:'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`    - ${warning}`));
    }
  }

  console.log();
}

/**
 * Print a list of apps and rules (for qualyx list command).
 */
export function printList(
  apps: Array<{ name: string; url: string; rules: Array<{ id: string; name: string; severity: string }> }>
): void {
  console.log();
  console.log(chalk.bold.cyan('  Qualyx Configuration'));
  console.log();

  for (const app of apps) {
    console.log(chalk.bold(`  ${app.name}`));
    console.log(chalk.gray(`    URL: ${app.url}`));
    console.log(chalk.gray(`    Rules: ${app.rules.length}`));
    console.log();

    for (const rule of app.rules) {
      const severity = getSeverityBadge(rule.severity);
      console.log(`    ${chalk.gray('•')} ${rule.name} ${severity}`);
      console.log(chalk.gray(`      ID: ${rule.id}`));
    }

    console.log();
  }
}
