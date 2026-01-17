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
  environments: z.record(z.string().url()).optional(),
  auth: AuthSchema.optional(),
  screenshots: ScreenshotsConfigSchema.optional(),
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

export const QualyxConfigSchema = z.object({
  organization: OrganizationSchema,
  apps: z.array(AppSchema).min(1),
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
export type QualyxConfig = z.infer<typeof QualyxConfigSchema>;

// ============================================================
// Execution Types
// ============================================================

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending';

export interface StepResult {
  step: string;
  status: TestStatus;
  timestamp: string;
  duration: number;
  error?: string;
  screenshot?: string;
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
}

export interface ListOptions {
  format?: 'table' | 'json';
}

export interface ValidateOptions {
  strict?: boolean;
}
