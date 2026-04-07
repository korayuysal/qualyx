import { z } from 'zod';

// ============================================================
// Zod Schemas for Configuration Validation
// ============================================================

export const StepSchema = z.union([
  z.string(),
  z.object({
    action: z.string(),
    hint: z.string().optional(),
    caution: z.string().optional(),
  }),
]);

export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  timeout: z.number().positive().optional(),
  steps: z.array(StepSchema).min(1),
  validations: z.array(z.string()).optional(),
  on_failure: z.array(z.string()).optional(),
  test_data: z.record(z.unknown()).optional(),
  schedule: z.string().optional(), // Cron expression for scheduling
  skip_setup: z.boolean().optional(), // Skip setup block for this rule
});

export const AuthSchema = z.object({
  type: z.enum(['form-login', 'basic', 'bearer', 'cookie', 'none']).default('none'),
  credentials: z.record(z.string()).optional(),
  login_url: z.string().url().optional(),
});

export const ScreenshotsConfigSchema = z.object({
  on_failure: z.boolean().default(true),
  on_success: z.boolean().default(false),
  each_step: z.boolean().default(false),
});

export const AppSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  locale: z.string().optional(), // e.g. "cs" (Czech), "en", "de"
  environments: z.record(z.string().url()).optional(),
  auth: AuthSchema.optional(),
  screenshots: ScreenshotsConfigSchema.optional(),
  setup: z.array(z.string()).optional(), // Setup steps to run before rules
  rules: z.array(RuleSchema).min(1),
});

export const OrganizationDefaultsSchema = z.object({
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).max(5).default(2),
  headless: z.boolean().default(true),
});

export const OrganizationSchema = z.object({
  name: z.string().min(1),
  defaults: OrganizationDefaultsSchema.optional(),
});

// ============================================================
// Notification & Integration Schemas
// ============================================================

export const SlackConfigSchema = z.object({
  webhook_url: z.string().min(1),
  on_failure: z.boolean().default(true),
  on_success: z.boolean().default(false),
  channel: z.string().optional(), // Override channel (if webhook supports it)
  mention_on_failure: z.array(z.string()).optional(), // User IDs to mention on failure
});

export const EmailConfigSchema = z.object({
  smtp_host: z.string().min(1),
  smtp_port: z.number().default(587),
  smtp_secure: z.boolean().default(false), // true for 465, false for other ports
  smtp_user: z.string().min(1),
  smtp_pass: z.string().min(1),
  from: z.string().email(),
  to: z.array(z.string().email()).min(1),
  on_failure: z.boolean().default(true),
  on_success: z.boolean().default(false),
  subject_prefix: z.string().default('[Qualyx]'),
});

export const TeamsConfigSchema = z.object({
  webhook_url: z.string().url(),
  on_failure: z.boolean().default(true),
  on_success: z.boolean().default(false),
  mention_on_failure: z.array(z.string()).optional(), // User emails to mention
});

export const JiraConfigSchema = z.object({
  base_url: z.string().url(),
  email: z.string().email(),
  api_token: z.string().min(1),
  project_key: z.string().min(1),
  create_issues: z.boolean().default(true),
  issue_type: z.string().default('Bug'),
  labels: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
});

export const NotificationsSchema = z.object({
  slack: SlackConfigSchema.optional(),
  email: EmailConfigSchema.optional(),
  teams: TeamsConfigSchema.optional(),
});

export const IntegrationsSchema = z.object({
  jira: JiraConfigSchema.optional(),
});

export const QualyxConfigSchema = z.object({
  organization: OrganizationSchema,
  apps: z.array(AppSchema).min(1),
  notifications: NotificationsSchema.optional(),
  integrations: IntegrationsSchema.optional(),
});

// ============================================================
// TypeScript Types (inferred from Zod schemas)
// ============================================================

export type Step = z.infer<typeof StepSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Auth = z.infer<typeof AuthSchema>;
export type ScreenshotsConfig = z.infer<typeof ScreenshotsConfigSchema>;
export type App = z.infer<typeof AppSchema>;
export type OrganizationDefaults = z.infer<typeof OrganizationDefaultsSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type SlackConfig = z.infer<typeof SlackConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type TeamsConfig = z.infer<typeof TeamsConfigSchema>;
export type JiraConfig = z.infer<typeof JiraConfigSchema>;
export type Notifications = z.infer<typeof NotificationsSchema>;
export type Integrations = z.infer<typeof IntegrationsSchema>;
export type QualyxConfig = z.infer<typeof QualyxConfigSchema>;

// ============================================================
// Execution Types
// ============================================================

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface PerformanceMetrics {
  pageLoadTime?: number;       // Time to load the page (ms)
  domContentLoaded?: number;   // DOMContentLoaded event time (ms)
  firstContentfulPaint?: number; // First Contentful Paint (ms)
  largestContentfulPaint?: number; // Largest Contentful Paint (ms)
  timeToInteractive?: number;  // Time to Interactive (ms)
  totalRequestCount?: number;  // Number of network requests
  totalTransferSize?: number;  // Total bytes transferred
}

export interface StepResult {
  step: string;
  status: TestStatus;
  timestamp: string;
  duration: number;
  error?: string;
  screenshot?: string;
  metrics?: PerformanceMetrics; // Performance metrics for this step
}

export interface ValidationResult {
  validation: string;
  passed: boolean;
  details?: string;
}

export interface TestResult {
  ruleId: string;
  ruleName: string;
  appName: string;
  status: TestStatus;
  severity: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  steps: StepResult[];
  validations: ValidationResult[];
  error?: string;
  screenshot?: string;
  retryCount: number;
  metrics?: PerformanceMetrics; // Aggregated performance metrics for the test
}

export interface RunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  environment: string;
}

// ============================================================
// Claude Code Runner Types
// ============================================================

export interface ClaudeRunnerOptions {
  timeout: number;
  headless: boolean;
  retries: number;
  dryRun: boolean;
}

export interface ClaudeResponse {
  status: TestStatus;
  steps: StepResult[];
  validations: ValidationResult[];
  error?: string;
  screenshot?: string;
}

// ============================================================
// Prompt Builder Types
// ============================================================

export interface PromptContext {
  app: App;
  rule: Rule;
  environment?: string;
  credentials: Record<string, string>;
  previousAttempt?: {
    error: string;
    screenshot?: string;
    domSnippet?: string;
  };
  collectMetrics?: boolean;
}

// ============================================================
// Reporter Types
// ============================================================

export interface ReporterOptions {
  outputDir: string;
  verbose: boolean;
}

// ============================================================
// Storage Types
// ============================================================

export interface StoredRun {
  id: string;
  config_hash: string;
  started_at: string;
  completed_at: string;
  duration: number;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  environment: string;
  results_json: string;
}

export interface StoredTestResult {
  id: string;
  run_id: string;
  rule_id: string;
  rule_name: string;
  app_name: string;
  status: TestStatus;
  severity: string;
  started_at: string;
  completed_at: string;
  duration: number;
  error?: string;
  screenshot?: string;
  retry_count: number;
  steps_json: string;
  validations_json: string;
}

// ============================================================
// CLI Types
// ============================================================

export interface RunOptions {
  app?: string;
  rule?: string;
  environment?: string;
  dryRun?: boolean;
  headed?: boolean;
  verbose?: boolean;
  retries?: number;
  timeout?: number;
  parallel?: boolean;         // Run tests in parallel
  maxParallel?: number;       // Maximum concurrent tests (default: 3)
  collectMetrics?: boolean;   // Collect performance metrics
}

export interface ListOptions {
  format?: 'table' | 'json';
}

export interface ValidateOptions {
  strict?: boolean;
}

// ============================================================
// Schedule Types
// ============================================================

export interface ScheduledRule {
  appName: string;
  ruleId: string;
  ruleName: string;
  schedule: string; // Cron expression
  severity: string;
}

export interface ScheduleExportOptions {
  format: 'cron' | 'github';
  projectPath?: string;
  outputFile?: string;
}

// ============================================================
// Integration Types
// ============================================================

export interface SlackNotificationPayload {
  runResult: RunResult;
  reportUrl?: string;
  config: QualyxConfig;
}

export interface JiraIssuePayload {
  testResult: TestResult;
  runId: string;
  config: QualyxConfig;
}
