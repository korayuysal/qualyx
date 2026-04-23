// Core engine
export * from './executor.js';
export * from './claude-runner.js';
export * from './prompt-builder.js';
export { loadConfig, parseConfigFromYaml, findConfigFile, getApp, getRule, getEnvironmentUrl, getConfigDir, getScheduledRules, getAppSetup, ConfigLoadError } from './config-loader.js';
export type { LoadConfigResult } from './config-loader.js';
export * from './retry-handler.js';
export * from './feature-verify-prompt.js';
export { configFromPrompt, deriveScenarioName, PromptScenarioBodySchema } from './scenario-synth.js';
export type { PromptScenarioInput, PromptScenarioBody } from './scenario-synth.js';

// Types
export * from './types/index.js';
export * from './types/feature-verify.js';

// Integrations
export { SlackNotifier, sendSlackNotification } from './integrations/slack.js';
export { EmailNotifier, sendEmailNotification } from './integrations/email.js';
export { TeamsNotifier, sendTeamsNotification } from './integrations/teams.js';
export { JiraIntegration, processJiraIssues } from './integrations/jira.js';
export { sendAllNotifications, NOTIFICATION_CHANNELS } from './integrations/index.js';
export type {
  NotificationChannel,
  NotificationChannelResult,
  JiraIssueResult,
} from './integrations/index.js';
export {
  MailosaurNotifier,
  sendMailosaurNotification,
  buildMailosaurPromptHint,
} from './integrations/mailosaur.js';
export { fetchJiraContext, parseJiraKey, JiraContextError } from './integrations/jira-context.js';
export { fetchFigmaContext, parseFigmaUrl, FigmaContextError } from './integrations/figma-context.js';

// Storage
export { QualyxStorage, getStorage, closeStorage } from './storage/sqlite.js';
export {
  saveRunResult,
  getLatestRunResult,
  getRunResult,
  getRecentRunResults,
  getFailedRunResults,
  getTestHistory,
  getTestStats,
  cleanupOldRuns,
  hashConfig,
  analyzeTestTrend,
} from './storage/results.js';

// Database (PostgreSQL)
export { getDb, closeDb, schema, pgSslConfig, pgDirectConnectionString } from './db/index.js';
export type { Database } from './db/index.js';

// Reporters
export { ConsoleReporter, printDryRunPreview, printValidationResult, printList } from './reporters/console.js';
export { generateHtmlReport } from './reporters/html.js';
