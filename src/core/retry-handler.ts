import type { PromptContext, ClaudeResponse, TestResult } from '../types/index.js';

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  previousError?: string;
  previousScreenshot?: string;
  previousDomSnippet?: string;
}

/**
 * Build enhanced context for retry attempts.
 * Includes information from the previous failed attempt to help Claude recover.
 */
export function buildRetryContext(
  originalContext: PromptContext,
  previousResult: ClaudeResponse,
  retryCount: number
): PromptContext {
  return {
    ...originalContext,
    previousAttempt: {
      error: previousResult.error || 'Unknown error occurred',
      screenshot: previousResult.screenshot,
      domSnippet: extractRelevantDom(previousResult),
    },
  };
}

/**
 * Extract relevant DOM snippet from the failed response.
 * This helps Claude understand what went wrong.
 */
function extractRelevantDom(result: ClaudeResponse): string | undefined {
  // If the response includes DOM information, extract it
  // This would come from Claude's execution if it captured DOM state
  // For now, we return undefined as this requires integration with the actual execution
  return undefined;
}

/**
 * Determine if a failure should be retried.
 */
export function shouldRetry(
  result: ClaudeResponse,
  currentAttempt: number,
  maxRetries: number
): boolean {
  // Don't retry if we've exhausted attempts
  if (currentAttempt >= maxRetries) {
    return false;
  }

  // Don't retry passed tests
  if (result.status === 'passed') {
    return false;
  }

  // Don't retry skipped tests
  if (result.status === 'skipped') {
    return false;
  }

  // Retry failed tests
  return true;
}

/**
 * Analyze the failure to provide better context for retry.
 */
export function analyzeFailure(result: ClaudeResponse): FailureAnalysis {
  const analysis: FailureAnalysis = {
    category: 'unknown',
    isRetryable: true,
    suggestions: [],
  };

  const errorLower = result.error?.toLowerCase() || '';

  // Categorize the failure
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    analysis.category = 'timeout';
    analysis.suggestions.push('Increase timeout or wait for slower elements');
  } else if (errorLower.includes('not found') || errorLower.includes('could not find')) {
    analysis.category = 'element_not_found';
    analysis.suggestions.push('Try alternative selectors or wait for element to appear');
  } else if (errorLower.includes('not visible') || errorLower.includes('hidden')) {
    analysis.category = 'element_not_visible';
    analysis.suggestions.push('Scroll element into view or wait for visibility');
  } else if (errorLower.includes('navigation') || errorLower.includes('navigate')) {
    analysis.category = 'navigation';
    analysis.suggestions.push('Verify URL and wait for page load');
  } else if (errorLower.includes('authentication') || errorLower.includes('login')) {
    analysis.category = 'authentication';
    analysis.suggestions.push('Verify credentials and login flow');
  } else if (errorLower.includes('network') || errorLower.includes('connection')) {
    analysis.category = 'network';
    analysis.suggestions.push('Check network connectivity and retry');
  }

  // Check for specific validation failures
  if (result.validations.some((v) => !v.passed)) {
    analysis.failedValidations = result.validations
      .filter((v) => !v.passed)
      .map((v) => v.validation);
  }

  // Check for specific step failures
  const failedSteps = result.steps.filter((s) => s.status === 'failed');
  if (failedSteps.length > 0) {
    analysis.failedStepIndex = result.steps.findIndex((s) => s.status === 'failed');
    analysis.failedStep = failedSteps[0].step;
  }

  return analysis;
}

export interface FailureAnalysis {
  category:
    | 'timeout'
    | 'element_not_found'
    | 'element_not_visible'
    | 'navigation'
    | 'authentication'
    | 'network'
    | 'unknown';
  isRetryable: boolean;
  suggestions: string[];
  failedValidations?: string[];
  failedStep?: string;
  failedStepIndex?: number;
}

/**
 * Generate an enhanced error message based on failure analysis.
 */
export function generateEnhancedErrorMessage(
  originalError: string,
  analysis: FailureAnalysis,
  attempt: number,
  maxAttempts: number
): string {
  const parts: string[] = [
    `Attempt ${attempt + 1}/${maxAttempts} failed.`,
    `Error: ${originalError}`,
    `Category: ${analysis.category}`,
  ];

  if (analysis.failedStep) {
    parts.push(`Failed at step: ${analysis.failedStep}`);
  }

  if (analysis.failedValidations?.length) {
    parts.push(`Failed validations: ${analysis.failedValidations.join(', ')}`);
  }

  if (analysis.suggestions.length > 0) {
    parts.push(`Suggestions: ${analysis.suggestions.join('; ')}`);
  }

  return parts.join('\n');
}

/**
 * Calculate delay between retry attempts (exponential backoff).
 */
export function calculateRetryDelay(attempt: number, baseDelay: number = 1000): number {
  // Exponential backoff: 1s, 2s, 4s, 8s...
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
