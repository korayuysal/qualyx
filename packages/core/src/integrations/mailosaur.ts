import MailosaurClient from 'mailosaur';
import type {
  MailosaurIntegrationConfig,
  MailosaurNotificationConfig,
  MailosaurPromptHint,
  QualyxConfig,
  RunResult,
} from '../types/index.js';

export class MailosaurNotifier {
  private config: MailosaurNotificationConfig;
  private client: MailosaurClient;

  constructor(config: MailosaurNotificationConfig) {
    this.config = config;
    this.client = new MailosaurClient(config.api_key);
  }

  shouldNotify(runResult: RunResult): boolean {
    const hasFailed = runResult.failed > 0;
    return hasFailed ? this.config.on_failure : this.config.on_success;
  }

  buildSubject(runResult: RunResult, organizationName: string): string {
    const status = runResult.failed > 0 ? 'FAILED' : 'PASSED';
    return `${this.config.subject_prefix} Test Run ${status} - ${organizationName} (${runResult.passed}/${runResult.totalTests} passed)`;
  }

  buildHtmlBody(runResult: RunResult, organizationName: string, reportUrl?: string): string {
    const hasFailed = runResult.failed > 0;
    const statusColor = hasFailed ? '#e74c3c' : '#2ecc71';
    const statusText = hasFailed ? 'FAILED' : 'PASSED';
    const passRate = runResult.totalTests > 0
      ? Math.round((runResult.passed / runResult.totalTests) * 100)
      : 0;

    const failedList = runResult.results
      .filter((r) => r.status === 'failed')
      .map((t) => `<li><strong>${escapeHtml(t.ruleName)}</strong> (${escapeHtml(t.appName)}) — ${escapeHtml(t.error || 'Unknown error')}</li>`)
      .join('');

    const failedSection = failedList
      ? `<h3 style="color:#e74c3c;">Failed Tests</h3><ul>${failedList}</ul>`
      : '';

    const reportLink = reportUrl
      ? `<p><a href="${escapeHtml(reportUrl)}" style="color:#3498db;">View Full Report</a></p>`
      : '';

    return `
      <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:20px;">
        <h1 style="color:${statusColor};margin:0 0 8px;">Test Run ${statusText}</h1>
        <p style="color:#666;margin:0 0 16px;">${escapeHtml(organizationName)} — ${escapeHtml(runResult.environment)}</p>
        <p><strong>Total:</strong> ${runResult.totalTests} · <strong>Passed:</strong> ${runResult.passed} · <strong>Failed:</strong> ${runResult.failed} · <strong>Pass rate:</strong> ${passRate}%</p>
        ${failedSection}
        ${reportLink}
        <p style="color:#888;font-size:12px;">Run ID: ${escapeHtml(runResult.runId)} · Duration: ${formatDuration(runResult.duration)} · Started: ${new Date(runResult.startedAt).toLocaleString()}</p>
      </div>
    `.trim();
  }

  async send(runResult: RunResult, organizationName: string, reportUrl?: string): Promise<void> {
    if (!this.shouldNotify(runResult)) return;

    await this.client.messages.create(this.config.server_id, {
      to: this.config.to,
      subject: this.buildSubject(runResult, organizationName),
      html: this.buildHtmlBody(runResult, organizationName, reportUrl),
      send: true,
    });
  }
}

export async function sendMailosaurNotification(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string,
): Promise<void> {
  const mailosaurConfig = config.notifications?.mailosaur;
  if (!mailosaurConfig) return;

  const notifier = new MailosaurNotifier(mailosaurConfig);
  await notifier.send(runResult, config.organization.name, reportUrl);
}

export function buildMailosaurPromptHint(
  config: MailosaurIntegrationConfig,
  { maskApiKey: shouldMask = false }: { maskApiKey?: boolean } = {},
): MailosaurPromptHint {
  return {
    serverId: config.server_id,
    defaultInbox: config.default_inbox,
    apiKey: shouldMask ? maskApiKey(config.api_key) : config.api_key,
  };
}

function maskApiKey(key: string): string {
  if (key.length <= 6) return '****';
  return `${key.slice(0, 3)}****${key.slice(-3)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
