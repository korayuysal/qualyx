import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, unlinkSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const CLI = 'npx tsx packages/cli/src/index.ts';

function createTestDir(): string {
  const testDir = resolve(process.cwd(), `test-e2e-${randomUUID().slice(0, 8)}`);
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(testDir: string): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

describe('E2E: qualyx init', () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    testDir = createTestDir();
    testConfigPath = resolve(testDir, 'test-init.yml');
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should create a configuration file', () => {
    const result = execSync(`${CLI} init --path ${testConfigPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(existsSync(testConfigPath)).toBe(true);
    expect(result).toContain('Created configuration file');
  });

  it('should fail without --force when file exists', () => {
    // First create the file
    execSync(`${CLI} init --path ${testConfigPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    // Then try to create again without --force
    try {
      execSync(`${CLI} init --path ${testConfigPath}`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });

  it('should overwrite with --force flag', () => {
    // First create the file
    execSync(`${CLI} init --path ${testConfigPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    // Then overwrite with --force
    const result = execSync(`${CLI} init --path ${testConfigPath} --force`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('Created configuration file');
  });
});

describe('E2E: qualyx validate', () => {
  let testDir: string;
  let validConfigPath: string;
  let invalidConfigPath: string;

  beforeEach(() => {
    testDir = createTestDir();
    validConfigPath = resolve(testDir, 'valid-config.yml');
    invalidConfigPath = resolve(testDir, 'invalid-config.yml');

    // Create a valid config
    writeFileSync(validConfigPath, `
organization:
  name: Test Organization
  defaults:
    timeout: 30000
    retries: 2

apps:
  - name: test-app
    url: https://example.com
    rules:
      - id: test-rule
        name: Test Rule
        severity: critical
        steps:
          - Navigate to homepage
        validations:
          - Page loads successfully
`);

    // Create an invalid config (missing required fields)
    writeFileSync(invalidConfigPath, `
organization:
  name: Test
apps:
  - name: test
    rules:
      - id: test
`);
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should validate a correct configuration', () => {
    const result = execSync(`${CLI} validate --config ${validConfigPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('Configuration is valid');
  });

  it('should fail on invalid configuration', () => {
    try {
      execSync(`${CLI} validate --config ${invalidConfigPath}`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.status).toBe(1);
    }
  });
});

describe('E2E: qualyx list', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(() => {
    testDir = createTestDir();
    configPath = resolve(testDir, 'list-config.yml');

    writeFileSync(configPath, `
organization:
  name: Test Organization

apps:
  - name: app-one
    url: https://example.com
    rules:
      - id: rule-1
        name: Rule One
        severity: critical
        steps:
          - Step 1
        validations:
          - Validation 1
      - id: rule-2
        name: Rule Two
        severity: high
        steps:
          - Step 2
        validations:
          - Validation 2
  - name: app-two
    url: https://httpbin.org
    rules:
      - id: rule-3
        name: Rule Three
        severity: medium
        steps:
          - Step 3
        validations:
          - Validation 3
`);
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should list all apps', () => {
    const result = execSync(`${CLI} list apps --config ${configPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('app-one');
    expect(result).toContain('app-two');
  });

  it('should list all rules', () => {
    const result = execSync(`${CLI} list rules --config ${configPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('rule-1');
    expect(result).toContain('rule-2');
    expect(result).toContain('rule-3');
  });

  it('should output JSON format for apps', () => {
    const result = execSync(`${CLI} list apps --config ${configPath} --format json`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('app-one');
  });

  it('should output JSON format for rules', () => {
    const result = execSync(`${CLI} list rules --config ${configPath} --format json`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(3);
  });
});

describe('E2E: qualyx run --dry-run', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(() => {
    testDir = createTestDir();
    configPath = resolve(testDir, 'run-config.yml');

    writeFileSync(configPath, `
organization:
  name: Test Organization
  defaults:
    timeout: 30000
    retries: 1

apps:
  - name: example-site
    url: https://example.com
    rules:
      - id: homepage-load
        name: Homepage loads correctly
        severity: critical
        steps:
          - Navigate to the homepage
          - Wait for the page to fully load
        validations:
          - Page title is visible
          - Main content area is displayed
      - id: check-links
        name: Check navigation links
        severity: high
        steps:
          - Navigate to homepage
          - Locate navigation links
        validations:
          - Navigation links are visible
`);
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should preview tests without execution', () => {
    const result = execSync(`${CLI} run --config ${configPath} --dry-run`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('Dry Run Preview');
    expect(result).toContain('homepage-load');
    expect(result).toContain('check-links');
  });

  it('should filter by app in dry-run', () => {
    const result = execSync(`${CLI} run --config ${configPath} --dry-run --app example-site`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('example-site');
  });

  it('should filter by rule in dry-run', () => {
    const result = execSync(`${CLI} run --config ${configPath} --dry-run --rule homepage-load`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('homepage-load');
    expect(result).not.toContain('check-links');
  });

  it('should show verbose output in dry-run', () => {
    const result = execSync(`${CLI} run --config ${configPath} --dry-run --verbose`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('Prompt:');
    expect(result).toContain('Test Execution:');
  });
});

describe('E2E: qualyx schedule', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(() => {
    testDir = createTestDir();
    configPath = resolve(testDir, 'schedule-config.yml');

    writeFileSync(configPath, `
organization:
  name: Test Organization

apps:
  - name: scheduled-app
    url: https://example.com
    rules:
      - id: health-check
        name: Health Check
        severity: critical
        schedule: "*/30 * * * *"
        steps:
          - Check homepage
        validations:
          - Page loads
      - id: daily-test
        name: Daily Test
        severity: high
        schedule: "0 7 * * *"
        steps:
          - Run daily checks
        validations:
          - All checks pass
`);
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should list scheduled rules', () => {
    const result = execSync(`${CLI} schedule list --config ${configPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('health-check');
    expect(result).toContain('daily-test');
    expect(result).toContain('*/30 * * * *');
    expect(result).toContain('0 7 * * *');
  });

  it('should generate crontab entries', () => {
    const result = execSync(`${CLI} schedule cron --config ${configPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('*/30 * * * *');
    expect(result).toContain('0 7 * * *');
    expect(result).toContain('qualyx run');
  });

  it('should generate GitHub Actions workflow', () => {
    const result = execSync(`${CLI} schedule github --config ${configPath}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    expect(result).toContain('name:');
    expect(result).toContain('schedule:');
    expect(result).toContain('cron:');
  });
});

describe('E2E: qualyx history', () => {
  it('should handle history command', () => {
    const result = execSync(`${CLI} history`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    // Either shows history or says no runs found
    expect(result).toBeTruthy();
  });
});
