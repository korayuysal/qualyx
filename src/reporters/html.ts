import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type { RunResult } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and compile the HTML report template
const templatePath = resolve(__dirname, '../../templates/report.html.hbs');
let reportTemplate: Handlebars.TemplateDelegate | null = null;

function getReportTemplate(): Handlebars.TemplateDelegate {
  if (!reportTemplate) {
    const templateSource = readFileSync(templatePath, 'utf-8');
    reportTemplate = Handlebars.compile(templateSource);
  }
  return reportTemplate;
}

// Register Handlebars helpers for HTML reports
Handlebars.registerHelper('formatDate', (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

Handlebars.registerHelper('formatDuration', (ms: number) => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

export interface HtmlReporterOptions {
  outputDir: string;
  fileName?: string;
}

const DEFAULT_OPTIONS: HtmlReporterOptions = {
  outputDir: './qualyx-reports',
  fileName: 'report.html',
};

/**
 * HTML reporter that generates visual test reports.
 */
export class HtmlReporter {
  private options: HtmlReporterOptions;

  constructor(options: Partial<HtmlReporterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate an HTML report from run results.
   */
  generate(result: RunResult, organization: string = 'Qualyx'): string {
    const template = getReportTemplate();

    // Calculate percentages for progress bar
    const total = result.totalTests || 1; // Avoid division by zero
    const passedPercent = (result.passed / total) * 100;
    const failedPercent = (result.failed / total) * 100;
    const skippedPercent = (result.skipped / total) * 100;

    const templateData = {
      run: result,
      organization,
      passedPercent: passedPercent.toFixed(1),
      failedPercent: failedPercent.toFixed(1),
      skippedPercent: skippedPercent.toFixed(1),
      version: '0.1.0',
    };

    return template(templateData);
  }

  /**
   * Generate and save the HTML report to a file.
   */
  save(result: RunResult, organization: string = 'Qualyx'): string {
    const html = this.generate(result, organization);

    // Ensure output directory exists
    const outputDir = resolve(this.options.outputDir);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename with timestamp if not specified
    const fileName = this.options.fileName || `report-${result.runId.slice(0, 8)}.html`;
    const filePath = resolve(outputDir, fileName);

    writeFileSync(filePath, html, 'utf-8');

    return filePath;
  }

  /**
   * Generate a timestamped report filename.
   */
  static generateFileName(result: RunResult): string {
    const date = new Date(result.startedAt);
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `report-${timestamp}.html`;
  }
}

/**
 * Quick function to generate and save an HTML report.
 */
export function generateHtmlReport(
  result: RunResult,
  options: Partial<HtmlReporterOptions> = {},
  organization: string = 'Qualyx'
): string {
  const reporter = new HtmlReporter(options);
  return reporter.save(result, organization);
}
