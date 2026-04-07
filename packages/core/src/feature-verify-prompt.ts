/**
 * Prompt builder for feature-verify command.
 * Builds verification prompts from Jira and Figma context.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type {
  FeatureVerifyPromptContext,
  JiraIssueContext,
  FigmaComponentSpec,
} from './types/feature-verify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and compile the prompt template
const templatePath = resolve(__dirname, '../templates/feature-verify.md.hbs');
let featureVerifyTemplate: Handlebars.TemplateDelegate | null = null;

function getFeatureVerifyTemplate(): Handlebars.TemplateDelegate {
  if (!featureVerifyTemplate) {
    const templateSource = readFileSync(templatePath, 'utf-8');
    featureVerifyTemplate = Handlebars.compile(templateSource);
  }
  return featureVerifyTemplate;
}

/**
 * Build a verification prompt for Claude to verify a feature.
 */
export function buildFeatureVerifyPrompt(options: {
  url: string;
  jira?: JiraIssueContext;
  figma?: FigmaComponentSpec;
}): string {
  const template = getFeatureVerifyTemplate();

  const templateData: FeatureVerifyPromptContext = {
    url: options.url,
    jira: options.jira,
    figma: options.figma,
  };

  return template(templateData);
}

/**
 * Generate a summary of what will be verified.
 */
export function generateVerificationSummary(options: {
  url: string;
  jira?: JiraIssueContext;
  figma?: FigmaComponentSpec;
}): string {
  const lines: string[] = [];

  lines.push(`Target URL: ${options.url}`);
  lines.push('');

  if (options.jira) {
    lines.push(`Jira Issue: ${options.jira.key}`);
    lines.push(`  Summary: ${options.jira.summary}`);
    lines.push(`  Status: ${options.jira.status}`);
    if (options.jira.acceptanceCriteria.length > 0) {
      lines.push(`  Acceptance Criteria: ${options.jira.acceptanceCriteria.length} items`);
    }
  }

  if (options.figma) {
    lines.push(`Figma Component: ${options.figma.nodeName}`);
    lines.push(`  Type: ${options.figma.nodeType}`);
    if (options.figma.dimensions) {
      lines.push(`  Dimensions: ${options.figma.dimensions.width}px × ${options.figma.dimensions.height}px`);
    }
    if (options.figma.textContent.length > 0) {
      lines.push(`  Text Elements: ${options.figma.textContent.length}`);
    }
    if (options.figma.colors.length > 0) {
      lines.push(`  Colors: ${options.figma.colors.length}`);
    }
  }

  return lines.join('\n');
}

/**
 * Count the total number of verification criteria.
 */
export function countVerificationCriteria(options: {
  jira?: JiraIssueContext;
  figma?: FigmaComponentSpec;
}): number {
  let count = 0;

  if (options.jira) {
    // Count acceptance criteria or add 1 for general requirements check
    count += options.jira.acceptanceCriteria.length || 1;
  }

  if (options.figma) {
    // Count: general visual match, text content, colors, dimensions
    count += 1; // General visual match
    if (options.figma.textContent.length > 0) count += 1;
    if (options.figma.colors.length > 0) count += 1;
    if (options.figma.dimensions) count += 1;
  }

  return count;
}
