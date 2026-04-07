import chalk from 'chalk';
import { loadConfig, ConfigLoadError, printValidationResult } from '@qualyx/core';
import type { ValidateOptions } from '@qualyx/core';

export async function runValidate(configPath?: string, options: ValidateOptions = {}): Promise<void> {
  try {
    const result = loadConfig(configPath);

    // Gather statistics
    const stats = {
      apps: result.config.apps.length,
      rules: result.config.apps.reduce((sum, app) => sum + app.rules.length, 0),
      criticalRules: result.config.apps
        .flatMap((app) => app.rules)
        .filter((rule) => rule.severity === 'critical').length,
    };

    printValidationResult(result.filePath, true, [], result.warnings);

    console.log(chalk.gray('  Configuration Summary:'));
    console.log(chalk.gray(`    Organization: ${result.config.organization.name}`));
    console.log(chalk.gray(`    Apps: ${stats.apps}`));
    console.log(chalk.gray(`    Total Rules: ${stats.rules}`));
    console.log(chalk.gray(`    Critical Rules: ${stats.criticalRules}`));

    if (result.config.organization.defaults) {
      console.log(chalk.gray('    Defaults:'));
      console.log(chalk.gray(`      Timeout: ${result.config.organization.defaults.timeout}ms`));
      console.log(chalk.gray(`      Retries: ${result.config.organization.defaults.retries}`));
    }

    console.log();

    // In strict mode, warnings are treated as errors
    if (options.strict && result.warnings.length > 0) {
      console.log(chalk.red('  Strict mode: warnings treated as errors'));
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof ConfigLoadError) {
      const errors = error.validationErrors
        ? error.validationErrors.errors.map((e) => {
            const path = e.path.length > 0 ? ` at "${e.path.join('.')}"` : '';
            return `${e.message}${path}`;
          })
        : [error.message];

      printValidationResult(error.filePath || 'unknown', false, errors, []);
      process.exit(1);
    }

    throw error;
  }
}
