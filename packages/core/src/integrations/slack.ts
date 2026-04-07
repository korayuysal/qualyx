import type { RunResult, SlackConfig, QualyxConfig } from '../types/index.js';

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: string | {
      type: string;
      text: string;
    };
    url?: string;
    action_id?: string;
  }>;
  accessory?: {
    type: string;
    text?: {
      type: string;
      text: string;
      emoji?: boolean;
    };
    url?: string;
  };
}

interface SlackAttachment {
  color: string;
  blocks?: SlackBlock[];
  fallback?: string;
}

/**
 * Slack notification integration for Qualyx test results.
 */
export class SlackNotifier {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
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
   * Build the Slack message payload.
   */
  buildMessage(runResult: RunResult, organizationName: string, reportUrl?: string): SlackMessage {
    const hasFailed = runResult.failed > 0;
    const statusEmoji = hasFailed ? ':x:' : ':white_check_mark:';
    const statusText = hasFailed ? 'FAILED' : 'PASSED';
    const color = hasFailed ? '#e74c3c' : '#2ecc71';

    const passRate = runResult.totalTests > 0
      ? Math.round((runResult.passed / runResult.totalTests) * 100)
      : 0;

    // Build mention string for failures
    let mentionText = '';
    if (hasFailed && this.config.mention_on_failure?.length) {
      mentionText = this.config.mention_on_failure.map(id => `<@${id}>`).join(' ') + ' ';
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Qualyx Test Run ${statusText}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Organization:*\n${organizationName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Environment:*\n${runResult.environment}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Tests:*\n${runResult.totalTests}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pass Rate:*\n${passRate}%`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `:white_check_mark: *Passed:* ${runResult.passed}`,
          },
          {
            type: 'mrkdwn',
            text: `:x: *Failed:* ${runResult.failed}`,
          },
          {
            type: 'mrkdwn',
            text: `:arrow_right: *Skipped:* ${runResult.skipped}`,
          },
          {
            type: 'mrkdwn',
            text: `:clock1: *Duration:* ${formatDuration(runResult.duration)}`,
          },
        ],
      },
    ];

    // Add failed tests details
    if (hasFailed) {
      const failedTests = runResult.results.filter(r => r.status === 'failed');
      const failedTestsList = failedTests
        .slice(0, 5) // Limit to 5 failures
        .map(t => `• *${t.ruleName}* (${t.appName}): ${t.error || 'Unknown error'}`)
        .join('\n');

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Failed Tests:*\n${failedTestsList}${failedTests.length > 5 ? `\n_...and ${failedTests.length - 5} more_` : ''}`,
        },
      });
    }

    // Add report link if available
    if (reportUrl) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':page_facing_up: *View Full Report:*',
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Open Report',
            emoji: true,
          },
          url: reportUrl,
        },
      });
    }

    // Add context with run ID and timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Run ID: ${runResult.runId.slice(0, 8)}... | ${new Date(runResult.startedAt).toLocaleString()}`,
        },
      ],
    });

    return {
      text: `${mentionText}Qualyx Test Run ${statusText}: ${runResult.passed}/${runResult.totalTests} passed`,
      blocks,
      attachments: [
        {
          color,
          fallback: `Test run ${statusText}: ${runResult.passed}/${runResult.totalTests} passed`,
        },
      ],
    };
  }

  /**
   * Send notification to Slack.
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
      throw new Error(`Slack notification failed: ${response.status} ${errorText}`);
    }
  }
}

/**
 * Send a Slack notification for a test run.
 */
export async function sendSlackNotification(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string
): Promise<void> {
  const slackConfig = config.notifications?.slack;

  if (!slackConfig) {
    return;
  }

  const notifier = new SlackNotifier(slackConfig);
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
