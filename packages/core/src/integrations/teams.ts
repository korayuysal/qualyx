import type { RunResult, TeamsConfig, QualyxConfig } from '../types/index.js';

/**
 * Microsoft Teams Adaptive Card structure
 */
interface AdaptiveCard {
  type: string;
  attachments: Array<{
    contentType: string;
    contentUrl: null;
    content: {
      $schema: string;
      type: string;
      version: string;
      body: Array<{
        type: string;
        text?: string;
        size?: string;
        weight?: string;
        color?: string;
        wrap?: boolean;
        columns?: Array<{
          type: string;
          width: string;
          items: Array<{
            type: string;
            text: string;
            size?: string;
            weight?: string;
            color?: string;
            horizontalAlignment?: string;
          }>;
        }>;
        facts?: Array<{
          title: string;
          value: string;
        }>;
        style?: string;
        bleed?: boolean;
      }>;
      actions?: Array<{
        type: string;
        title: string;
        url: string;
      }>;
    };
  }>;
}

/**
 * Microsoft Teams notification integration for Qualyx test results.
 */
export class TeamsNotifier {
  private config: TeamsConfig;

  constructor(config: TeamsConfig) {
    this.config = config;
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
   * Build the Teams Adaptive Card message.
   */
  buildMessage(runResult: RunResult, organizationName: string, reportUrl?: string): AdaptiveCard {
    const hasFailed = runResult.failed > 0;
    const statusText = hasFailed ? 'FAILED' : 'PASSED';
    const statusColor = hasFailed ? 'attention' : 'good';
    const passRate = runResult.totalTests > 0
      ? Math.round((runResult.passed / runResult.totalTests) * 100)
      : 0;

    const failedTests = runResult.results.filter(r => r.status === 'failed');

    // Build mentions text if configured
    let mentionText = '';
    if (hasFailed && this.config.mention_on_failure?.length) {
      mentionText = this.config.mention_on_failure.map(email => `@${email}`).join(' ') + ' ';
    }

    const body: AdaptiveCard['attachments'][0]['content']['body'] = [
      {
        type: 'TextBlock',
        text: `${mentionText}Qualyx Test Run ${statusText}`,
        size: 'Large',
        weight: 'Bolder',
        color: statusColor,
      },
      {
        type: 'TextBlock',
        text: `${organizationName} - ${runResult.environment}`,
        size: 'Medium',
        color: 'default',
      },
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: 'Total', size: 'Small', weight: 'Bolder', horizontalAlignment: 'Center' },
              { type: 'TextBlock', text: String(runResult.totalTests), size: 'ExtraLarge', weight: 'Bolder', horizontalAlignment: 'Center' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: 'Passed', size: 'Small', weight: 'Bolder', color: 'good', horizontalAlignment: 'Center' },
              { type: 'TextBlock', text: String(runResult.passed), size: 'ExtraLarge', weight: 'Bolder', color: 'good', horizontalAlignment: 'Center' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: 'Failed', size: 'Small', weight: 'Bolder', color: 'attention', horizontalAlignment: 'Center' },
              { type: 'TextBlock', text: String(runResult.failed), size: 'ExtraLarge', weight: 'Bolder', color: 'attention', horizontalAlignment: 'Center' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: 'Pass Rate', size: 'Small', weight: 'Bolder', horizontalAlignment: 'Center' },
              { type: 'TextBlock', text: `${passRate}%`, size: 'ExtraLarge', weight: 'Bolder', horizontalAlignment: 'Center' },
            ],
          },
        ],
      },
    ];

    // Add failed tests if any
    if (failedTests.length > 0) {
      body.push({
        type: 'TextBlock',
        text: 'Failed Tests',
        size: 'Medium',
        weight: 'Bolder',
        color: 'attention',
      });

      body.push({
        type: 'FactSet',
        facts: failedTests.slice(0, 5).map(t => ({
          title: `${t.ruleName} (${t.appName})`,
          value: t.error || 'Unknown error',
        })),
      });

      if (failedTests.length > 5) {
        body.push({
          type: 'TextBlock',
          text: `...and ${failedTests.length - 5} more failed tests`,
          size: 'Small',
          color: 'default',
          wrap: true,
        });
      }
    }

    // Add run details
    body.push({
      type: 'FactSet',
      facts: [
        { title: 'Duration', value: formatDuration(runResult.duration) },
        { title: 'Run ID', value: runResult.runId.slice(0, 8) + '...' },
        { title: 'Started', value: new Date(runResult.startedAt).toLocaleString() },
      ],
    });

    const actions: AdaptiveCard['attachments'][0]['content']['actions'] = [];
    if (reportUrl) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Full Report',
        url: reportUrl,
      });
    }

    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body,
            actions: actions.length > 0 ? actions : undefined,
          },
        },
      ],
    };
  }

  /**
   * Send notification to Microsoft Teams.
   */
  async send(runResult: RunResult, organizationName: string, reportUrl?: string): Promise<void> {
    if (!this.shouldNotify(runResult)) {
      return;
    }

    const message = this.buildMessage(runResult, organizationName, reportUrl);

    const response = await fetch(this.config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Teams notification failed: ${response.status} ${errorText}`);
    }
  }
}

/**
 * Send a Teams notification for a test run.
 */
export async function sendTeamsNotification(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string
): Promise<void> {
  const teamsConfig = config.notifications?.teams;

  if (!teamsConfig) {
    return;
  }

  const notifier = new TeamsNotifier(teamsConfig);
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
