import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { loadConfig, getScheduledRules, ConfigLoadError } from '@qualyx/core';
import type { ScheduledRule } from '@qualyx/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Template paths
const crontabTemplatePath = resolve(__dirname, '../../../templates/crontab.hbs');
const githubTemplatePath = resolve(__dirname, '../../../templates/github-schedule.yml.hbs');
// Note: paths resolve from dist/cli/commands/ → ../../../templates/ → packages/cli/templates/

// Register Handlebars helpers
Handlebars.registerHelper('escapeShell', (str: string) => {
  return str.replace(/'/g, "'\\''");
});

Handlebars.registerHelper('gt', (a: number, b: number) => {
  return a > b;
});

Handlebars.registerHelper('formatCronDescription', (schedule: string) => {
  // Basic cron expression descriptions
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (schedule === '* * * * *') return 'every minute';
  if (schedule === '0 * * * *') return 'every hour';
  if (schedule === '0 0 * * *') return 'daily at midnight';
  if (schedule === '0 0 * * 0') return 'weekly on Sunday';
  if (minute.includes('/')) {
    const interval = minute.split('/')[1];
    return `every ${interval} minutes`;
  }
  if (hour.includes('/')) {
    const interval = hour.split('/')[1];
    return `every ${interval} hours`;
  }
  if (dayOfMonth === '*' && month === '*') {
    if (dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNum = parseInt(dayOfWeek, 10);
      if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
        return `weekly on ${days[dayNum]} at ${hour}:${minute.padStart(2, '0')}`;
      }
    }
    return `daily at ${hour}:${minute.padStart(2, '0')}`;
  }

  return schedule;
});

export interface ScheduleCommandOptions {
  config?: string;
  output?: string;
  format?: 'table' | 'json';
  projectPath?: string;
}

/**
 * List all scheduled rules.
 */
export async function runScheduleList(options: ScheduleCommandOptions = {}): Promise<void> {
  try {
    const result = loadConfig(options.config);
    const scheduledRules = getScheduledRules(result.config);

    if (scheduledRules.length === 0) {
      console.log();
      console.log(chalk.yellow('  No scheduled rules found'));
      console.log(chalk.gray('  Add a schedule field to rules in your qualyx.yml:'));
      console.log(chalk.gray('    schedule: "0 7 * * *"  # Daily at 7 AM'));
      console.log();
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(scheduledRules, null, 2));
      return;
    }

    console.log();
    console.log(chalk.bold.cyan('  Scheduled Rules'));
    console.log();

    for (const rule of scheduledRules) {
      const severityBadge = getSeverityBadge(rule.severity);
      console.log(`  ${severityBadge} ${chalk.bold(rule.ruleName)}`);
      console.log(chalk.gray(`    App: ${rule.appName}`));
      console.log(chalk.gray(`    ID: ${rule.ruleId}`));
      console.log(chalk.cyan(`    Schedule: ${rule.schedule}`));
      console.log();
    }

    console.log(chalk.gray(`  Total: ${scheduledRules.length} scheduled rule(s)`));
    console.log();
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      console.log();
      console.log(chalk.red(`  Configuration Error: ${error.message}`));
      console.log();
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Generate crontab entries for scheduled rules.
 */
export async function runScheduleCron(options: ScheduleCommandOptions = {}): Promise<void> {
  try {
    const result = loadConfig(options.config);
    const scheduledRules = getScheduledRules(result.config);

    if (scheduledRules.length === 0) {
      console.log();
      console.log(chalk.yellow('  No scheduled rules found'));
      console.log();
      return;
    }

    const projectPath = options.projectPath || process.cwd();
    const templateSource = loadTemplate(crontabTemplatePath);
    const template = Handlebars.compile(templateSource);

    const output = template({
      rules: scheduledRules,
      projectPath,
      generatedAt: new Date().toISOString(),
    });

    if (options.output) {
      writeFileSync(options.output, output, 'utf-8');
      console.log();
      console.log(chalk.green(`  Crontab entries written to: ${options.output}`));
      console.log(chalk.gray(`  Install with: crontab ${options.output}`));
      console.log();
    } else {
      console.log();
      console.log(chalk.bold.cyan('  Generated Crontab Entries'));
      console.log();
      console.log(output);
    }
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      console.log();
      console.log(chalk.red(`  Configuration Error: ${error.message}`));
      console.log();
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Generate GitHub Actions workflow for scheduled rules.
 */
export async function runScheduleGithub(options: ScheduleCommandOptions = {}): Promise<void> {
  try {
    const result = loadConfig(options.config);
    const scheduledRules = getScheduledRules(result.config);

    if (scheduledRules.length === 0) {
      console.log();
      console.log(chalk.yellow('  No scheduled rules found'));
      console.log();
      return;
    }

    const templateSource = loadTemplate(githubTemplatePath);
    const template = Handlebars.compile(templateSource);

    // Group rules by schedule for efficient workflow triggers
    const scheduleGroups = groupBySchedule(scheduledRules);

    const output = template({
      rules: scheduledRules,
      scheduleGroups,
      generatedAt: new Date().toISOString(),
      organizationName: result.config.organization.name,
    });

    const defaultOutputPath = '.github/workflows/qualyx-scheduled.yml';

    if (options.output) {
      // Ensure directory exists
      const outputDir = dirname(options.output);
      if (outputDir && outputDir !== '.' && !existsSync(outputDir)) {
        const fs = await import('node:fs');
        fs.mkdirSync(outputDir, { recursive: true });
      }
      writeFileSync(options.output, output, 'utf-8');
      console.log();
      console.log(chalk.green(`  GitHub Actions workflow written to: ${options.output}`));
      console.log(chalk.gray('  Commit and push to enable scheduled runs.'));
      console.log();
    } else {
      console.log();
      console.log(chalk.bold.cyan('  Generated GitHub Actions Workflow'));
      console.log();
      console.log(output);
      console.log();
      console.log(chalk.gray(`  To save: qualyx schedule github --output ${defaultOutputPath}`));
      console.log();
    }
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      console.log();
      console.log(chalk.red(`  Configuration Error: ${error.message}`));
      console.log();
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Load a Handlebars template file.
 */
function loadTemplate(templatePath: string): string {
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  return readFileSync(templatePath, 'utf-8');
}

/**
 * Get colored severity badge.
 */
function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white(' CRITICAL ');
    case 'high':
      return chalk.bgYellow.black(' HIGH ');
    case 'medium':
      return chalk.bgBlue.white(' MEDIUM ');
    case 'low':
      return chalk.bgGray.white(' LOW ');
    default:
      return chalk.bgGray.white(` ${severity.toUpperCase()} `);
  }
}

/**
 * Group scheduled rules by their cron schedule.
 */
function groupBySchedule(rules: ScheduledRule[]): Array<{
  schedule: string;
  rules: ScheduledRule[];
}> {
  const groups: Map<string, ScheduledRule[]> = new Map();

  for (const rule of rules) {
    const existing = groups.get(rule.schedule) || [];
    existing.push(rule);
    groups.set(rule.schedule, existing);
  }

  return Array.from(groups.entries()).map(([schedule, rules]) => ({
    schedule,
    rules,
  }));
}
