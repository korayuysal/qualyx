import chalk from 'chalk';
import { loadConfig, ConfigLoadError } from '../../core/config-loader.js';
import { printList } from '../../reporters/console.js';
import type { ListOptions } from '../../types/index.js';

export async function runList(
  resource: 'apps' | 'rules' | undefined,
  configPath?: string,
  options: ListOptions = {}
): Promise<void> {
  try {
    const result = loadConfig(configPath);
    const config = result.config;

    if (options.format === 'json') {
      // Output as JSON
      if (resource === 'apps') {
        const apps = config.apps.map((app) => ({
          name: app.name,
          url: app.url,
          environments: app.environments,
          rulesCount: app.rules.length,
        }));
        console.log(JSON.stringify(apps, null, 2));
      } else if (resource === 'rules') {
        const rules = config.apps.flatMap((app) =>
          app.rules.map((rule) => ({
            appName: app.name,
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
            stepsCount: rule.steps.length,
            validationsCount: rule.validations?.length || 0,
          }))
        );
        console.log(JSON.stringify(rules, null, 2));
      } else {
        // Output full config summary
        const summary = {
          organization: config.organization.name,
          appsCount: config.apps.length,
          totalRules: config.apps.reduce((sum, app) => sum + app.rules.length, 0),
          apps: config.apps.map((app) => ({
            name: app.name,
            url: app.url,
            rulesCount: app.rules.length,
            rules: app.rules.map((rule) => ({
              id: rule.id,
              name: rule.name,
              severity: rule.severity,
            })),
          })),
        };
        console.log(JSON.stringify(summary, null, 2));
      }
      return;
    }

    // Table/text output
    if (resource === 'apps') {
      printApps(config.apps);
    } else if (resource === 'rules') {
      printRules(config.apps);
    } else {
      // Print everything
      printList(
        config.apps.map((app) => ({
          name: app.name,
          url: app.url,
          rules: app.rules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            severity: rule.severity,
          })),
        }))
      );
    }
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      console.log();
      console.log(chalk.red(`  Error: ${error.message}`));
      console.log();
      process.exit(1);
    }

    throw error;
  }
}

function printApps(apps: Array<{ name: string; url: string; rules: unknown[] }>): void {
  console.log();
  console.log(chalk.bold.cyan('  Apps'));
  console.log();

  for (const app of apps) {
    console.log(chalk.bold(`  ${app.name}`));
    console.log(chalk.gray(`    URL: ${app.url}`));
    console.log(chalk.gray(`    Rules: ${app.rules.length}`));
    console.log();
  }
}

function printRules(
  apps: Array<{ name: string; rules: Array<{ id: string; name: string; severity: string; steps: unknown[] }> }>
): void {
  console.log();
  console.log(chalk.bold.cyan('  Rules'));
  console.log();

  for (const app of apps) {
    console.log(chalk.bold(`  ${app.name}`));

    for (const rule of app.rules) {
      const severityColor = getSeverityColor(rule.severity);
      console.log(`    ${chalk.gray('•')} ${rule.name}`);
      console.log(chalk.gray(`      ID: ${rule.id}`));
      console.log(`      Severity: ${severityColor(rule.severity.toUpperCase())}`);
      console.log(chalk.gray(`      Steps: ${rule.steps.length}`));
    }

    console.log();
  }
}

function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red;
    case 'high':
      return chalk.yellow;
    case 'medium':
      return chalk.blue;
    case 'low':
      return chalk.gray;
    default:
      return chalk.white;
  }
}
