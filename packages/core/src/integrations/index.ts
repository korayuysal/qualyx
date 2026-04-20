import type { QualyxConfig, RunResult } from '../types/index.js';
import { sendSlackNotification } from './slack.js';
import { sendEmailNotification } from './email.js';
import { sendTeamsNotification } from './teams.js';
import { processJiraIssues, type JiraIssueResult } from './jira.js';

export { SlackNotifier, sendSlackNotification } from './slack.js';
export { EmailNotifier, sendEmailNotification } from './email.js';
export { TeamsNotifier, sendTeamsNotification } from './teams.js';
export { JiraIntegration, processJiraIssues } from './jira.js';
export type { JiraIssueResult } from './jira.js';

export const NOTIFICATION_CHANNELS = ['slack', 'email', 'teams', 'jira'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

export type NotificationChannelResult =
  | { channel: 'slack' | 'email' | 'teams'; ok: true }
  | { channel: 'slack' | 'email' | 'teams'; ok: false; error: string }
  | { channel: 'jira'; ok: true; jiraIssues: JiraIssueResult[] }
  | { channel: 'jira'; ok: false; error: string };

export async function sendAllNotifications(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string,
): Promise<NotificationChannelResult[]> {
  const webhookHandlers: Array<{
    channel: 'slack' | 'email' | 'teams';
    enabled: boolean;
    send: () => Promise<void>;
  }> = [
    {
      channel: 'slack',
      enabled: !!config.notifications?.slack,
      send: () => sendSlackNotification(runResult, config, reportUrl),
    },
    {
      channel: 'email',
      enabled: !!config.notifications?.email,
      send: () => sendEmailNotification(runResult, config, reportUrl),
    },
    {
      channel: 'teams',
      enabled: !!config.notifications?.teams,
      send: () => sendTeamsNotification(runResult, config, reportUrl),
    },
  ];

  const tasks: Array<Promise<NotificationChannelResult>> = [];

  for (const h of webhookHandlers) {
    if (!h.enabled) continue;
    tasks.push(
      h.send()
        .then<NotificationChannelResult>(() => ({ channel: h.channel, ok: true }))
        .catch((e) => ({ channel: h.channel, ok: false, error: toMessage(e) })),
    );
  }

  if (config.integrations?.jira) {
    tasks.push(
      processJiraIssues(runResult, config)
        .then<NotificationChannelResult>((jiraIssues) => ({
          channel: 'jira',
          ok: true,
          jiraIssues,
        }))
        .catch((e) => ({ channel: 'jira', ok: false, error: toMessage(e) })),
    );
  }

  return Promise.all(tasks);
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
