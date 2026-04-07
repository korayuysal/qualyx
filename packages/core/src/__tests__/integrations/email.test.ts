import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailNotifier } from '../../integrations/email.js';
import type { RunResult, EmailConfig } from '../../types/index.js';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

describe('EmailNotifier', () => {
  const mockConfig: EmailConfig = {
    smtp_host: 'smtp.test.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: 'user@test.com',
    smtp_pass: 'password',
    from: 'qa@test.com',
    to: ['team@test.com'],
    on_failure: true,
    on_success: false,
    subject_prefix: '[Qualyx]',
  };

  const mockRunResult: RunResult = {
    runId: 'test-run-123',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    duration: 5000,
    totalTests: 10,
    passed: 8,
    failed: 2,
    skipped: 0,
    environment: 'staging',
    results: [
      {
        ruleId: 'test-1',
        ruleName: 'Test 1',
        appName: 'my-app',
        status: 'passed',
        severity: 'critical',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 1000,
        steps: [],
        validations: [],
        retryCount: 0,
      },
      {
        ruleId: 'test-2',
        ruleName: 'Test 2',
        appName: 'my-app',
        status: 'failed',
        severity: 'high',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 2000,
        steps: [],
        validations: [],
        error: 'Element not found',
        retryCount: 1,
      },
    ],
  };

  let notifier: EmailNotifier;

  beforeEach(() => {
    notifier = new EmailNotifier(mockConfig);
  });

  describe('shouldNotify', () => {
    it('should return true when there are failures and on_failure is true', () => {
      expect(notifier.shouldNotify(mockRunResult)).toBe(true);
    });

    it('should return false when all tests pass and on_success is false', () => {
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };
      expect(notifier.shouldNotify(passedResult)).toBe(false);
    });

    it('should return true when all tests pass and on_success is true', () => {
      const successConfig = { ...mockConfig, on_success: true };
      const successNotifier = new EmailNotifier(successConfig);
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };
      expect(successNotifier.shouldNotify(passedResult)).toBe(true);
    });
  });

  describe('buildSubject', () => {
    it('should build FAILED subject when tests fail', () => {
      const subject = notifier.buildSubject(mockRunResult, 'TestOrg');
      expect(subject).toContain('FAILED');
      expect(subject).toContain('[Qualyx]');
      expect(subject).toContain('TestOrg');
      expect(subject).toContain('8/10 passed');
    });

    it('should build PASSED subject when all tests pass', () => {
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };
      const subject = notifier.buildSubject(passedResult, 'TestOrg');
      expect(subject).toContain('PASSED');
    });
  });

  describe('buildHtmlBody', () => {
    it('should include test statistics', () => {
      const html = notifier.buildHtmlBody(mockRunResult, 'TestOrg');
      expect(html).toContain('10'); // total
      expect(html).toContain('8'); // passed
      expect(html).toContain('2'); // failed
      expect(html).toContain('80%'); // pass rate
    });

    it('should include failed test details', () => {
      const html = notifier.buildHtmlBody(mockRunResult, 'TestOrg');
      expect(html).toContain('Test 2');
      expect(html).toContain('Element not found');
    });

    it('should include report link when provided', () => {
      const html = notifier.buildHtmlBody(mockRunResult, 'TestOrg', 'https://report.url');
      expect(html).toContain('https://report.url');
    });
  });

  describe('buildTextBody', () => {
    it('should include test statistics', () => {
      const text = notifier.buildTextBody(mockRunResult, 'TestOrg');
      expect(text).toContain('Total: 10');
      expect(text).toContain('Passed: 8');
      expect(text).toContain('Failed: 2');
    });

    it('should include failed test details', () => {
      const text = notifier.buildTextBody(mockRunResult, 'TestOrg');
      expect(text).toContain('Test 2');
      expect(text).toContain('Element not found');
    });
  });
});
