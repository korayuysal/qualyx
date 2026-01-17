import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { QualyxConfigSchema, type QualyxConfig } from '../types/index.js';

const DEFAULT_CONFIG_FILES = ['qualyx.yml', 'qualyx.yaml', '.qualyx.yml', '.qualyx.yaml'];

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly validationErrors?: ZodError
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Substitute environment variables in a string.
 * Supports ${VAR_NAME} syntax.
 */
function substituteEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      // Return the original placeholder if env var is not set
      // This allows for optional env vars and better error messages later
      return match;
    }
    return envValue;
  });
}

/**
 * Recursively substitute environment variables in an object.
 */
function substituteEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVarsInObject);
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVarsInObject(value);
    }
    return result;
  }

  return obj;
}

/**
 * Find the configuration file path.
 * Searches for default config file names if no path is specified.
 */
export function findConfigFile(configPath?: string): string {
  if (configPath) {
    const absolutePath = resolve(configPath);
    if (!existsSync(absolutePath)) {
      throw new ConfigLoadError(`Configuration file not found: ${absolutePath}`, absolutePath);
    }
    return absolutePath;
  }

  // Search for default config files in the current directory
  const cwd = process.cwd();
  for (const fileName of DEFAULT_CONFIG_FILES) {
    const filePath = resolve(cwd, fileName);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  throw new ConfigLoadError(
    `No configuration file found. Create a qualyx.yml file or specify a path with --config`
  );
}

/**
 * Load and parse YAML configuration file.
 */
function loadYamlFile(filePath: string): unknown {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigLoadError(`Failed to parse YAML: ${error.message}`, filePath);
    }
    throw error;
  }
}

/**
 * Validate configuration against the Zod schema.
 */
function validateConfig(config: unknown, filePath: string): QualyxConfig {
  const result = QualyxConfigSchema.safeParse(config);

  if (!result.success) {
    throw new ConfigLoadError(
      `Configuration validation failed:\n${formatZodErrors(result.error)}`,
      filePath,
      result.error
    );
  }

  return result.data;
}

/**
 * Format Zod validation errors for display.
 */
function formatZodErrors(error: ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.length > 0 ? `  at "${err.path.join('.')}"` : '';
      return `  - ${err.message}${path}`;
    })
    .join('\n');
}

/**
 * Check for unresolved environment variables and warn about them.
 */
function checkUnresolvedEnvVars(config: QualyxConfig): string[] {
  const warnings: string[] = [];
  const configStr = JSON.stringify(config);
  const unresolvedMatches = configStr.match(/\$\{[^}]+\}/g);

  if (unresolvedMatches) {
    const uniqueVars = [...new Set(unresolvedMatches)];
    for (const varMatch of uniqueVars) {
      const varName = varMatch.slice(2, -1);
      warnings.push(`Environment variable ${varName} is not set`);
    }
  }

  return warnings;
}

/**
 * Validate that all rule IDs within an app are unique.
 */
function validateUniqueRuleIds(config: QualyxConfig): void {
  for (const app of config.apps) {
    const ruleIds = new Set<string>();
    for (const rule of app.rules) {
      if (ruleIds.has(rule.id)) {
        throw new ConfigLoadError(
          `Duplicate rule ID "${rule.id}" in app "${app.name}"`
        );
      }
      ruleIds.add(rule.id);
    }
  }
}

/**
 * Validate that all app names are unique.
 */
function validateUniqueAppNames(config: QualyxConfig): void {
  const appNames = new Set<string>();
  for (const app of config.apps) {
    if (appNames.has(app.name)) {
      throw new ConfigLoadError(`Duplicate app name "${app.name}"`);
    }
    appNames.add(app.name);
  }
}

export interface LoadConfigResult {
  config: QualyxConfig;
  filePath: string;
  warnings: string[];
}

/**
 * Load, parse, and validate the Qualyx configuration file.
 */
export function loadConfig(configPath?: string): LoadConfigResult {
  // Find the config file
  const filePath = findConfigFile(configPath);

  // Load and parse YAML
  const rawConfig = loadYamlFile(filePath);

  // Substitute environment variables
  const configWithEnvVars = substituteEnvVarsInObject(rawConfig);

  // Validate against schema
  const config = validateConfig(configWithEnvVars, filePath);

  // Additional validations
  validateUniqueAppNames(config);
  validateUniqueRuleIds(config);

  // Check for unresolved env vars
  const warnings = checkUnresolvedEnvVars(config);

  return {
    config,
    filePath,
    warnings,
  };
}

/**
 * Get a specific app from the configuration by name.
 */
export function getApp(config: QualyxConfig, appName: string) {
  const app = config.apps.find((a) => a.name === appName);
  if (!app) {
    throw new ConfigLoadError(`App "${appName}" not found in configuration`);
  }
  return app;
}

/**
 * Get a specific rule from an app by ID.
 */
export function getRule(config: QualyxConfig, appName: string, ruleId: string) {
  const app = getApp(config, appName);
  const rule = app.rules.find((r) => r.id === ruleId);
  if (!rule) {
    throw new ConfigLoadError(`Rule "${ruleId}" not found in app "${appName}"`);
  }
  return { app, rule };
}

/**
 * Get the URL for a specific environment, with fallback to the default URL.
 */
export function getEnvironmentUrl(app: { url: string; environments?: Record<string, string> }, environment?: string): string {
  if (!environment) {
    return app.url;
  }

  if (app.environments && app.environments[environment]) {
    return app.environments[environment];
  }

  // Fall back to default URL if environment not found
  return app.url;
}

/**
 * Get the directory containing the configuration file.
 */
export function getConfigDir(filePath: string): string {
  return dirname(filePath);
}
