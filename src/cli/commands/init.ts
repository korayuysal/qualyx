import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';

const STARTER_CONFIG = `# Qualyx Configuration
# Documentation: https://github.com/korayuysal/qualyx

organization:
  name: My Organization
  defaults:
    timeout: 30000
    retries: 2

apps:
  - name: my-app
    url: https://example.com
    environments:
      production: https://example.com
      staging: https://staging.example.com

    # Optional authentication configuration
    # auth:
    #   type: form-login
    #   credentials:
    #     email: \${TEST_USER_EMAIL}
    #     password: \${TEST_USER_PASSWORD}

    rules:
      - id: homepage-loads
        name: Homepage loads successfully
        severity: critical
        steps:
          - Navigate to the homepage
          - Verify the page loads without errors
        validations:
          - Page title is visible
          - No console errors appear

      - id: navigation-works
        name: Main navigation is functional
        severity: high
        steps:
          - Navigate to the homepage
          - Click on the main navigation menu
          - Verify navigation links are visible
        validations:
          - Navigation menu is displayed
          - Links are clickable

      # Example of a more complex test with hints
      # - id: user-login
      #   name: User can log in
      #   severity: critical
      #   steps:
      #     - Navigate to the login page
      #     - action: Enter email address
      #       hint: Use the email field, typically an input with type="email"
      #     - action: Enter password
      #       hint: Use the password field
      #     - Click the login button
      #     - Wait for redirect to dashboard
      #   validations:
      #     - User is redirected to dashboard
      #     - User name is displayed in header
`;

export interface InitOptions {
  force?: boolean;
  path?: string;
}

export async function runInit(options: InitOptions = {}): Promise<void> {
  const configPath = resolve(options.path || 'qualyx.yml');

  // Check if file already exists
  if (existsSync(configPath) && !options.force) {
    console.log();
    console.log(chalk.yellow(`  Configuration file already exists: ${configPath}`));
    console.log(chalk.gray('  Use --force to overwrite'));
    console.log();
    process.exit(1);
  }

  // Write the starter configuration
  writeFileSync(configPath, STARTER_CONFIG, 'utf-8');

  console.log();
  console.log(chalk.green(`  ✓ Created configuration file: ${configPath}`));
  console.log();
  console.log(chalk.gray('  Next steps:'));
  console.log(chalk.gray('    1. Edit qualyx.yml to configure your apps and tests'));
  console.log(chalk.gray('    2. Set environment variables for credentials'));
  console.log(chalk.gray('    3. Run `qualyx validate` to check your configuration'));
  console.log(chalk.gray('    4. Run `qualyx run` to execute tests'));
  console.log();
}
