import type { QualyxConfig, RunResult } from '../types/index.js';
import { sendSlackNotification } from './slack.js';
import { sendEmailNotification } from './email.js';
import { sendTeamsNotification } from './teams.js';
import { processJiraIssues } from './jira.js';

export { SlackNotifier, sendSlackNotification } from './slack.js';
export { EmailNotifier, sendEmailNotification } from './email.js';
export { TeamsNotifier, sendTeamsNotification } from './teams.js';
export { JiraIntegration, processJiraIssues } from './jira.js';

export interface NotificationChannelResult {
  channel: 'slack' | 'email' | 'teams' | 'jira';
  ok: boolean;
  error?: string;
  jiraIssues?: Array<{ testId: string; action: 'created' | 'commented'; issueKey: string }>;
}

export async function sendAllNotifications(
  runResult: RunResult,
  config: QualyxConfig,
  reportUrl?: string,
): Promise<NotificationChannelResult[]> {
  const tasks: Array<Promise<NotificationChannelResult>> = [];

  if (config.notifications?.slack) {
    tasks.push(
      sendSlackNotification(runResult, config, reportUrl)
        .then<NotificationChannelResult>(() => ({ channel: 'slack', ok: true }))
        .catch((e) => ({ channel: 'slack', ok: false, error: toMessage(e) })),
    );
  }

  if (config.notifications?.email) {
    tasks.push(
      sendEmailNotification(runResult, config, reportUrl)
        .then<NotificationChannelResult>(() => ({ channel: 'email', ok: true }))
        .catch((e) => ({ channel: 'email', ok: false, error: toMessage(e) })),
    );
  }

  if (config.notifications?.teams) {
    tasks.push(
      sendTeamsNotification(runResult, config, reportUrl)
        .then<NotificationChannelResult>(() => ({ channel: 'teams', ok: true }))
        .catch((e) => ({ channel: 'teams', ok: false, error: toMessage(e) })),
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
