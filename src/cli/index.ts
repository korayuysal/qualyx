import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runValidate } from './commands/validate.js';
import { runList } from './commands/list.js';
import { runRun } from './commands/run.js';
import { runScheduleList, runScheduleCron, runScheduleGithub } from './commands/schedule.js';

const VERSION = '0.2.0';

export function createCli(): Command {
  const program = new Command();

  program
    .name('qualyx')
    .description('AI-powered QA automation platform using Claude Code CLI and Playwright')
    .version(VERSION);

  // Init command
  program
    .command('init')
    .description('Create a starter qualyx.yml configuration file')
    .option('-f, --force', 'Overwrite existing configuration file')
    .option('-p, --path <path>', 'Path for the configuration file', 'qualyx.yml')
    .action(async (options) => {
      await runInit(options);
    });

  // Validate command
  program
    .command('validate')
    .description('Validate the configuration file')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-s, --strict', 'Treat warnings as errors')
    .action(async (options) => {
      await runValidate(options.config, { strict: options.strict });
    });

  // List command
  program
    .command('list [resource]')
    .description('List apps and rules from configuration')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-f, --format <format>', 'Output format: table or json', 'table')
    .action(async (resource: 'apps' | 'rules' | undefined, options) => {
      await runList(resource, options.config, { format: options.format });
    });

  // Run command
  program
    .command('run')
    .description('Execute tests')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-a, --app <name>', 'Run tests only for specified app')
    .option('-r, --rule <id>', 'Run only specified rule')
    .option('-e, --environment <name>', 'Environment to run against')
    .option('--dry-run', 'Preview tests without executing')
    .option('--headed', 'Run browser in headed mode (visible)')
    .option('-v, --verbose', 'Show detailed output')
    .option('--retries <number>', 'Number of retries on failure', parseInt)
    .option('--timeout <ms>', 'Timeout per test in milliseconds', parseInt)
    .option('--report', 'Generate HTML report')
    .option('--report-dir <path>', 'Directory for HTML reports', './qualyx-reports')
    .option('--no-save', 'Do not save results to history')
    .action(async (options) => {
      await runRun({
        config: options.config,
        app: options.app,
        rule: options.rule,
        environment: options.environment,
        dryRun: options.dryRun,
        headed: options.headed,
        verbose: options.verbose,
        retries: options.retries,
        timeout: options.timeout,
        report: options.report,
        reportDir: options.reportDir,
        save: options.save,
      });
    });

  // Schedule command
  const scheduleCmd = program
    .command('schedule')
    .description('Manage scheduled test rules');

  scheduleCmd
    .command('list')
    .description('List all scheduled rules')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-f, --format <format>', 'Output format: table or json', 'table')
    .action(async (options) => {
      await runScheduleList({
        config: options.config,
        format: options.format,
      });
    });

  scheduleCmd
    .command('cron')
    .description('Generate crontab entries for scheduled rules')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-o, --output <path>', 'Output file path')
    .option('-p, --project-path <path>', 'Project path for cron commands')
    .action(async (options) => {
      await runScheduleCron({
        config: options.config,
        output: options.output,
        projectPath: options.projectPath,
      });
    });

  scheduleCmd
    .command('github')
    .description('Generate GitHub Actions workflow for scheduled rules')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options) => {
      await runScheduleGithub({
        config: options.config,
        output: options.output,
      });
    });

  // Report command (view last report)
  program
    .command('report')
    .description('View or regenerate the last test report')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-o, --output <path>', 'Output path for HTML report')
    .option('--run-id <id>', 'Generate report for specific run ID')
    .action(async (options) => {
      const { getLatestRunResult, getRunResult } = await import('../storage/results.js');
      const { generateHtmlReport } = await import('../reporters/html.js');
      const { loadConfig } = await import('../core/config-loader.js');
      const chalk = (await import('chalk')).default;

      // Get the run result
      const runResult = options.runId ? getRunResult(options.runId) : getLatestRunResult();

      if (!runResult) {
        console.log();
        console.log(chalk.yellow('  No test runs found in history'));
        console.log(chalk.gray('  Run tests first with: qualyx run'));
        console.log();
        return;
      }

      // Load config to get organization name
      let orgName = 'Qualyx';
      try {
        const configResult = loadConfig(options.config);
        orgName = configResult.config.organization.name;
      } catch {
        // Use default org name
      }

      // Generate the report
      const reportPath = generateHtmlReport(
        runResult,
        { outputDir: options.output || './qualyx-reports' },
        orgName
      );

      console.log();
      console.log(chalk.green(`  Report generated: ${reportPath}`));
      console.log(chalk.gray(`  Run ID: ${runResult.runId}`));
      console.log(chalk.gray(`  Date: ${new Date(runResult.startedAt).toLocaleString()}`));
      console.log(chalk.gray(`  Results: ${runResult.passed}/${runResult.totalTests} passed`));
      console.log();
    });

  // History command
  program
    .command('history')
    .description('View test run history')
    .option('-l, --limit <number>', 'Number of runs to show', '10')
    .option('--failed', 'Show only failed runs')
    .option('-f, --format <format>', 'Output format: table or json', 'table')
    .action(async (options) => {
      const { getRecentRunResults, getFailedRunResults } = await import('../storage/results.js');
      const chalk = (await import('chalk')).default;

      const limit = parseInt(options.limit, 10);
      const runs = options.failed ? getFailedRunResults(limit) : getRecentRunResults(limit);

      if (runs.length === 0) {
        console.log();
        console.log(chalk.yellow('  No test runs found in history'));
        console.log();
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }

      console.log();
      console.log(chalk.bold.cyan('  Test Run History'));
      console.log();

      for (const run of runs) {
        const date = new Date(run.startedAt).toLocaleString();
        const status = run.failed > 0 ? chalk.red('FAILED') : chalk.green('PASSED');
        const stats = `${run.passed}/${run.totalTests} passed`;

        console.log(`  ${status} ${chalk.gray(date)} - ${stats}`);
        console.log(chalk.gray(`    ID: ${run.runId.slice(0, 8)}...`));
        console.log(chalk.gray(`    Environment: ${run.environment}`));
        console.log();
      }
    });

  return program;
}
