import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type { App, Rule, Step, PromptContext } from '../types/index.js';
import { getEnvironmentUrl } from './config-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and compile the prompt template
const templatePath = resolve(__dirname, '../../templates/prompt.md.hbs');
let promptTemplate: Handlebars.TemplateDelegate | null = null;

function getPromptTemplate(): Handlebars.TemplateDelegate {
  if (!promptTemplate) {
    const templateSource = readFileSync(templatePath, 'utf-8');
    promptTemplate = Handlebars.compile(templateSource);
  }
  return promptTemplate;
}

// Register Handlebars helpers
Handlebars.registerHelper('uppercase', (str: string) => {
  return str ? str.toUpperCase() : '';
});

Handlebars.registerHelper('stepNumber', (index: number) => {
  return index + 1;
});

Handlebars.registerHelper('formatStep', (step: Step) => {
  if (typeof step === 'string') {
    return step;
  }

  let result = step.action;
  if (step.hint) {
    result += `\n   > **Hint:** ${step.hint}`;
  }
  if (step.caution) {
    result += `\n   > **Caution:** ${step.caution}`;
  }
  return new Handlebars.SafeString(result);
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

/**
 * Mask sensitive credentials for display in prompts.
 * We show enough to verify it's the right credential without exposing full values.
 */
function maskCredential(value: string): string {
  if (value.length <= 4) {
    return '****';
  }
  return value.slice(0, 2) + '****' + value.slice(-2);
}

/**
 * Resolve credentials from environment variables.
 * Credentials in config use ${VAR_NAME} syntax which should already be resolved
 * by the config loader, but we mask them here for the prompt display.
 */
function resolveCredentials(
  auth: App['auth'],
  maskValues: boolean = false
): Record<string, string> {
  if (!auth?.credentials) {
    return {};
  }

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(auth.credentials)) {
    // Check if the value is still an unresolved env var placeholder
    if (value.startsWith('${') && value.endsWith('}')) {
      resolved[key] = maskValues ? '(not set)' : value;
    } else {
      resolved[key] = maskValues ? maskCredential(value) : value;
    }
  }

  return resolved;
}

/**
 * Build a prompt for Claude Code to execute a test rule.
 */
export function buildPrompt(context: PromptContext): string {
  const template = getPromptTemplate();

  const url = getEnvironmentUrl(context.app, context.environment);

  const templateData = {
    app: context.app,
    rule: context.rule,
    url,
    environment: context.environment,
    credentials: resolveCredentials(context.app.auth, true),
    previousAttempt: context.previousAttempt,
    screenshotConfig: context.app.screenshots,
  };

  return template(templateData);
}

/**
 * Build a prompt with unmasked credentials for actual execution.
 * This version includes the full credential values for Claude to use.
 */
export function buildExecutionPrompt(context: PromptContext): string {
  const template = getPromptTemplate();

  const url = getEnvironmentUrl(context.app, context.environment);

  const templateData = {
    app: context.app,
    rule: context.rule,
    url,
    environment: context.environment,
    credentials: resolveCredentials(context.app.auth, false),
    previousAttempt: context.previousAttempt,
    screenshotConfig: context.app.screenshots,
  };

  return template(templateData);
}

/**
 * Build a preview prompt for dry-run mode.
 * This shows what would be sent to Claude without exposing sensitive data.
 */
export function buildDryRunPrompt(context: PromptContext): string {
  return buildPrompt(context);
}

/**
 * Extract steps as a simple list for display purposes.
 */
export function extractStepsList(rule: Rule): string[] {
  return rule.steps.map((step, index) => {
    const stepNum = index + 1;
    if (typeof step === 'string') {
      return `${stepNum}. ${step}`;
    }
    return `${stepNum}. ${step.action}`;
  });
}

/**
 * Generate a summary of the test rule for console output.
 */
export function generateRuleSummary(app: App, rule: Rule): string {
  const lines = [
    `Test: ${rule.name} (${rule.id})`,
    `App: ${app.name}`,
    `URL: ${app.url}`,
    `Severity: ${rule.severity.toUpperCase()}`,
    `Steps: ${rule.steps.length}`,
  ];

  if (rule.validations?.length) {
    lines.push(`Validations: ${rule.validations.length}`);
  }

  if (rule.timeout) {
    lines.push(`Timeout: ${rule.timeout}ms`);
  }

  return lines.join('\n');
}
