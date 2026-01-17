import chalk from 'chalk';
import { loadConfig, ConfigLoadError } from '../../core/config-loader.js';
import { Executor } from '../../core/executor.js';
import { ConsoleReporter, printDryRunPreview } from '../../reporters/console.js';
import { generateHtmlReport } from '../../reporters/html.js';
import { saveRunResult } from '../../storage/results.js';
import type { RunOptions } from '../../types/index.js';

export interface RunCommandOptions extends RunOptions {
  config?: string;
  report?: boolean;
  reportDir?: string;
  save?: boolean;
}

export async function runRun(options: RunCommandOptions = {}): Promise<void> {
  try {
    // Load configuration
    const result = loadConfig(options.config);
    const config = result.config;

    // Show warnings
    if (result.warnings.length > 0) {
      console.log();
      console.log(chalk.yellow('  Warnings:'));
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`    - ${warning}`));
      }
      console.log();
    }

    // Create executor
    const executor = new Executor(config, {
      app: options.app,
      rule: options.rule,
      environment: options.environment,
      dryRun: options.dryRun,
      headed: options.headed,
      verbose: options.verbose,
      retries: options.retries,
      timeout: options.timeout,
    });

    // Handle dry-run mode
    if (options.dryRun) {
      const previews = executor.getExecutionPreview();

      if (previews.length === 0) {
        console.log();
        console.log(chalk.yellow('  No tests match the specified filters'));
        console.log();
        return;
      }

      printDryRunPreview(previews, options.verbose);
      return;
    }

    // Set up console reporter
    const consoleReporter = new ConsoleReporter({ verbose: options.verbose });
    const callbacks = consoleReporter.getCallbacks();

    // Execute tests with callbacks
    const runResult = await new Executor(config, {
      ...options,
      callbacks,
    }).run();

    // Save results to storage if enabled (default: true)
    if (options.save !== false) {
      try {
        saveRunResult(runResult, config);
      } catch (error) {
        // Non-fatal: log warning but continue
        console.log(chalk.yellow(`  Warning: Could not save results to storage`));
      }
    }

    // Generate HTML report if requested
    if (options.report) {
      try {
        const reportPath = generateHtmlReport(
          runResult,
          { outputDir: options.reportDir || './qualyx-reports' },
          config.organization.name
        );
        console.log(chalk.green(`  HTML report generated: ${reportPath}`));
        console.log();
      } catch (error) {
        console.log(chalk.yellow(`  Warning: Could not generate HTML report`));
      }
    }

    // Exit with appropriate code
    if (runResult.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      console.log();
      console.log(chalk.red(`  Configuration Error: ${error.message}`));
      console.log();
      process.exit(1);
    }

    // Handle Claude not available
    if (error instanceof Error && error.message.includes('Claude Code CLI')) {
      console.log();
      console.log(chalk.red(`  ${error.message}`));
      console.log();
      process.exit(1);
    }

    throw error;
  }
}
