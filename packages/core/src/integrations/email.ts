import { createTransport, type Transporter } from 'nodemailer';
import type { RunResult, EmailConfig, QualyxConfig } from '../types/index.js';

/**
 * Email notification integration for Qualyx test results.
 */
export class EmailNotifier {
  private config: EmailConfig;
  private transporter: Transporter;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
    });
  }

  /**
   * Determine if a notification should be sent based on run result.
   */
  shouldNotify(runResult: RunResult): boolean {
    const hasFailed = runResult.failed > 0;

    if (hasFailed && this.config.on_failure) {
      return true;
    }

    if (!hasFailed && this.config.on_success) {
      return true;
    }

    return false;
  }

  /**
   * Build the email subject.
   */
  buildSubject(runResult: RunResult, organizationName: string): string {
    const status = runResult.failed > 0 ? 'FAILED' : 'PASSED';
    const prefix = this.config.subject_prefix;
    return `${prefix} Test Run ${status} - ${organizationName} (${runResult.passed}/${runResult.totalTests} passed)`;
  }

  /**
   * Build the email HTML body.
   */
  buildHtmlBody(runResult: RunResult, organizationName: string, reportUrl?: string): string {
    const hasFailed = runResult.failed > 0;
    const statusColor = hasFailed ? '#e74c3c' : '#2ecc71';
    const statusText = hasFailed ? 'FAILED' : 'PASSED';
    const passRate = runResult.totalTests > 0
      ? Math.round((runResult.passed / runResult.totalTests) * 100)
      : 0;

    const failedTests = runResult.results.filter(r => r.status === 'failed');
    const failedTestsHtml = failedTests.length > 0
      ? `
        <h3 style="color: #e74c3c;">Failed Tests</h3>
        <ul>
          ${failedTests.map(t => `
            <li>
              <strong>${t.ruleName}</strong> (${t.appName})
              <br><span style="color: #666;">${t.error || 'Unknown error'}</span>
            </li>
          `).join('')}
        </ul>
      `
      : '';

    const reportLink = reportUrl
      ? `<p><a href="${reportUrl}" style="color: #3498db;">View Full Report</a></p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 20px; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; }
          .stat-value { font-size: 32px; font-weight: bold; }
          .stat-label { color: #666; font-size: 14px; }
          .passed { color: #2ecc71; }
          .failed { color: #e74c3c; }
          .skipped { color: #f39c12; }
          .footer { padding: 20px; background: #f9f9f9; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Test Run ${statusText}</h1>
            <p>${organizationName} - ${runResult.environment}</p>
          </div>
          <div class="content">
            <div class="stats">
              <div class="stat">
                <div class="stat-value">${runResult.totalTests}</div>
                <div class="stat-label">Total Tests</div>
              </div>
              <div class="stat">
                <div class="stat-value passed">${runResult.passed}</div>
                <div class="stat-label">Passed</div>
              </div>
              <div class="stat">
                <div class="stat-value failed">${runResult.failed}</div>
                <div class="stat-label">Failed</div>
              </div>
              <div class="stat">
                <div class="stat-value">${passRate}%</div>
                <div class="stat-label">Pass Rate</div>
              </div>
            </div>
            ${failedTestsHtml}
            ${reportLink}
            <p style="color: #666; font-size: 14px;">
              Duration: ${formatDuration(runResult.duration)}<br>
              Run ID: ${runResult.runId.slice(0, 8)}...<br>
              Started: ${new Date(runResult.startedAt).toLocaleString()}
            </p>
          </div>
          <div class="footer">
            Sent by Qualyx - AI-powered QA automation
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build plain text email body.
   */
  buildTextBody(runResult: RunResult, organizationName: string, reportUrl?: string): string {
    const status = runResult.failed > 0 ? 'FAILED' : 'PASSED';
    const passRate = runResult.totalTests > 0
      ? Math.round((runResult.passed / runResult.totalTests) * 100)
      : 0;

    const failedTests = runResult.results.filter(r => r.status === 'failed');
    const failedTestsText = failedTests.length > 0
      ? `\nFailed Tests:\n${failedTests.map(t => `  - ${t.ruleName} (${t.appName}): ${t.error || 'Unknown error'}`).join('\n')}\n`
      : '';

    return `
Qualyx Test Run ${status}
========================
Organization: ${organizationName}
Environment: ${runResult.environment}

Summary:
  Total: ${runResult.totalTests}
  Passed: ${runResult.passed}
  Failed: ${runResult.failed}
  Skipped: ${runResult.skipped}
  Pass Rate: ${passRate}%
  Duration: ${formatDuration(runResult.duration)}
${failedTestsText}
Run ID: ${runResult.runId}
Started: ${new Date(runResult.startedAt).toLocaleString()}
${reportUrl ? `\nView Report: ${reportUrl}` : ''}
    `.trim();
  }

  /**
   * Send notification email.
   */
  async send(runResult: RunResult, organizationName: string, reportUrl?: string): Promise<void> {
    if (!this.shouldNotify(runResult)) {
      return;
    }

    const mailOptions = {
      from: this.config.from,
      to: this.config.to.join(', '),
      subject: this.buildSubject(runResult, organizationName),
      text: this.buildTextBody(runResult, organizationName, reportUrl),
      html: this.buildHtmlBody(runResult, organizationName, reportUrl),
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Verify SMTP connection.
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Send an email notification for a test run.
 */
export async function sendEmailNotification(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string
): Promise<void> {
  const emailConfig = config.notifications?.email;

  if (!emailConfig) {
    return;
  }

  const notifier = new EmailNotifier(emailConfig);
  await notifier.send(runResult, config.organization.name, reportUrl);
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
