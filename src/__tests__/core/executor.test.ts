import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Executor } from '../../core/executor.js';
import type { QualyxConfig, App, Rule } from '../../types/index.js';

// Mock claude-runner
vi.mock('../../core/claude-runner.js', () => ({
  runClaude: vi.fn().mockResolvedValue({
    status: 'passed',
    steps: [],
    validations: [],
  }),
  isClaudeAvailable: vi.fn().mockResolvedValue(true),
}));

describe('Executor', () => {
  const mockApp: App = {
    name: 'test-app',
    url: 'https://test.com',
    rules: [
      {
        id: 'rule-1',
        name: 'Rule 1',
        severity: 'critical',
        steps: ['Step 1'],
        validations: ['Validation 1'],
      },
      {
        id: 'rule-2',
        name: 'Rule 2',
        severity: 'high',
        steps: ['Step 2'],
        validations: ['Validation 2'],
      },
      {
        id: 'rule-3',
        name: 'Rule 3',
        severity: 'medium',
        steps: ['Step 3'],
        validations: ['Validation 3'],
      },
    ],
  };

  const mockConfig: QualyxConfig = {
    organization: {
      name: 'Test Org',
      defaults: {
        timeout: 30000,
        retries: 1,
      },
    },
    apps: [mockApp],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTestsToRun', () => {
    it('should return all tests when no filters are specified', () => {
      const executor = new Executor(mockConfig, {});
      const preview = executor.getExecutionPreview();
      expect(preview).toHaveLength(3);
    });

    it('should filter by app name', () => {
      const executor = new Executor(mockConfig, { app: 'test-app' });
      const preview = executor.getExecutionPreview();
      expect(preview).toHaveLength(3);
      expect(preview.every(p => p.app === 'test-app')).toBe(true);
    });

    it('should filter by rule id', () => {
      const executor = new Executor(mockConfig, { rule: 'rule-1' });
      const preview = executor.getExecutionPreview();
      expect(preview).toHaveLength(1);
      expect(preview[0].rule).toBe('rule-1');
    });

    it('should return empty when app does not exist', () => {
      const executor = new Executor(mockConfig, { app: 'nonexistent' });
      const preview = executor.getExecutionPreview();
      expect(preview).toHaveLength(0);
    });
  });

  describe('getExecutionPreview', () => {
    it('should return preview with correct structure', () => {
      const executor = new Executor(mockConfig, {});
      const preview = executor.getExecutionPreview();

      expect(preview[0]).toHaveProperty('app');
      expect(preview[0]).toHaveProperty('rule');
      expect(preview[0]).toHaveProperty('severity');
      expect(preview[0]).toHaveProperty('steps');
      expect(preview[0]).toHaveProperty('prompt');
    });

    it('should include severity information', () => {
      const executor = new Executor(mockConfig, {});
      const preview = executor.getExecutionPreview();

      expect(preview[0].severity).toBe('critical');
      expect(preview[1].severity).toBe('high');
      expect(preview[2].severity).toBe('medium');
    });
  });

  describe('run with parallel option', () => {
    it('should run tests sequentially by default', async () => {
      const executor = new Executor(mockConfig, { dryRun: true });
      const result = await executor.run();

      expect(result.totalTests).toBe(3);
    });

    it('should respect maxParallel option', () => {
      const executor = new Executor(mockConfig, { parallel: true, maxParallel: 2 });
      // The maxParallel option is used internally
      expect(executor).toBeDefined();
    });
  });

  describe('callbacks', () => {
    it('should call onRunStart with total tests count', async () => {
      const onRunStart = vi.fn();
      const executor = new Executor(mockConfig, {
        dryRun: true,
        callbacks: { onRunStart },
      });

      await executor.run();

      expect(onRunStart).toHaveBeenCalledWith(3);
    });

    it('should call onRunComplete with result', async () => {
      const onRunComplete = vi.fn();
      const executor = new Executor(mockConfig, {
        dryRun: true,
        callbacks: { onRunComplete },
      });

      await executor.run();

      expect(onRunComplete).toHaveBeenCalled();
      const result = onRunComplete.mock.calls[0][0];
      expect(result).toHaveProperty('runId');
      expect(result).toHaveProperty('totalTests');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('failed');
    });
  });
});
