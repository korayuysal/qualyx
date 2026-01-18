import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamsNotifier } from '../../integrations/teams.js';
import type { RunResult, TeamsConfig } from '../../types/index.js';

// Mock global fetch
global.fetch = vi.fn();

describe('TeamsNotifier', () => {
  const mockConfig: TeamsConfig = {
    webhook_url: 'https://teams.webhook.url/test',
    on_failure: true,
    on_success: false,
    mention_on_failure: ['user@company.com'],
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

  let notifier: TeamsNotifier;

  beforeEach(() => {
    notifier = new TeamsNotifier(mockConfig);
    vi.clearAllMocks();
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
      const successNotifier = new TeamsNotifier(successConfig);
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };
      expect(successNotifier.shouldNotify(passedResult)).toBe(true);
    });
  });

  describe('buildMessage', () => {
    it('should build an Adaptive Card message', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg');
      expect(message.type).toBe('message');
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    });

    it('should include FAILED status when tests fail', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg');
      const body = message.attachments[0].content.body;
      const headerBlock = body.find((b: any) => b.text?.includes('FAILED'));
      expect(headerBlock).toBeDefined();
    });

    it('should include PASSED status when all tests pass', () => {
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };
      const message = notifier.buildMessage(passedResult, 'TestOrg');
      const body = message.attachments[0].content.body;
      const headerBlock = body.find((b: any) => b.text?.includes('PASSED'));
      expect(headerBlock).toBeDefined();
    });

    it('should include user mentions on failure', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg');
      const body = message.attachments[0].content.body;
      const headerBlock = body.find((b: any) => b.text?.includes('@user@company.com'));
      expect(headerBlock).toBeDefined();
    });

    it('should include test statistics in columns', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg');
      const body = message.attachments[0].content.body;
      const columnSet = body.find((b: any) => b.type === 'ColumnSet');
      expect(columnSet).toBeDefined();
      expect(columnSet.columns).toHaveLength(4);
    });

    it('should include failed test details', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg');
      const body = message.attachments[0].content.body;
      const factSet = body.find((b: any) => b.type === 'FactSet' && b.facts?.some((f: any) => f.title.includes('Test 2')));
      expect(factSet).toBeDefined();
    });

    it('should include report URL action when provided', () => {
      const message = notifier.buildMessage(mockRunResult, 'TestOrg', 'https://report.url');
      const actions = message.attachments[0].content.actions;
      expect(actions).toHaveLength(1);
      expect(actions[0].url).toBe('https://report.url');
    });
  });

  describe('send', () => {
    it('should send notification when shouldNotify returns true', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true });

      await notifier.send(mockRunResult, 'TestOrg');

      expect(global.fetch).toHaveBeenCalledWith(
        mockConfig.webhook_url,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should not send notification when shouldNotify returns false', async () => {
      const passedResult = { ...mockRunResult, failed: 0, passed: 10 };

      await notifier.send(passedResult, 'TestOrg');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValue({ ok: false, status: 400, text: () => 'Bad Request' });

      await expect(notifier.send(mockRunResult, 'TestOrg')).rejects.toThrow('Teams notification failed');
    });
  });
});
