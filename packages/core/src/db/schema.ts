import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================
// Users
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  createdBy: uuid('created_by').references(() => users.id),
  usedBy: uuid('used_by').references(() => users.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Scenarios
// ============================================================

export const scenarios = pgTable('scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  yamlContent: text('yaml_content').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_scenarios_created_by').on(table.createdBy),
]);

// ============================================================
// Schedules
// ============================================================

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenarioId: uuid('scenario_id').notNull().references(() => scenarios.id, { onDelete: 'cascade' }),
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_schedules_scenario_id').on(table.scenarioId),
  index('idx_schedules_enabled').on(table.enabled),
]);

// ============================================================
// Runs
// ============================================================

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenarioId: uuid('scenario_id').references(() => scenarios.id),
  configHash: text('config_hash'),
  status: text('status', { enum: ['running', 'completed', 'failed', 'cancelled'] }).notNull().default('running'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  duration: integer('duration'),
  totalTests: integer('total_tests').notNull().default(0),
  passed: integer('passed').notNull().default(0),
  failed: integer('failed').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  environment: text('environment'),
  triggeredBy: text('triggered_by', { enum: ['manual', 'schedule', 'api'] }).notNull().default('manual'),
  triggeredByUser: uuid('triggered_by_user').references(() => users.id),
  resultJson: jsonb('result_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_runs_scenario_id').on(table.scenarioId),
  index('idx_runs_started_at').on(table.startedAt),
  index('idx_runs_status').on(table.status),
]);

// ============================================================
// Test Results
// ============================================================

export const testResults = pgTable('test_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').notNull(),
  ruleName: text('rule_name').notNull(),
  appName: text('app_name').notNull(),
  status: text('status', { enum: ['passed', 'failed', 'skipped'] }).notNull(),
  severity: text('severity').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  duration: integer('duration').notNull(),
  error: text('error'),
  screenshot: text('screenshot'),
  retryCount: integer('retry_count').notNull().default(0),
  stepsJson: jsonb('steps_json'),
  validationsJson: jsonb('validations_json'),
}, (table) => [
  index('idx_test_results_run_id').on(table.runId),
  index('idx_test_results_status').on(table.status),
  index('idx_test_results_rule_id').on(table.ruleId),
]);
