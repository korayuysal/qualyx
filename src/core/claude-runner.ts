import { spawn } from 'node:child_process';
import type {
  ClaudeRunnerOptions,
  ClaudeResponse,
  TestStatus,
  StepResult,
  ValidationResult,
} from '../types/index.js';

export class ClaudeRunnerError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message);
    this.name = 'ClaudeRunnerError';
  }
}

const DEFAULT_OPTIONS: ClaudeRunnerOptions = {
  timeout: 60000,
  headless: true,
  retries: 2,
  dryRun: false,
};

/**
 * Parse JSON response from Claude output.
 * Claude may output additional text before/after the JSON, so we need to extract it.
 */
function parseClaudeResponse(output: string): ClaudeResponse {
  // Try to find JSON in the output
  const jsonMatch = output.match(/\{[\s\S]*"status"[\s\S]*\}/);

  if (!jsonMatch) {
    // If no valid JSON found, treat it as a failure
    return {
      status: 'failed',
      steps: [],
      validations: [],
      error: `Could not parse Claude response. Raw output: ${output.slice(0, 500)}...`,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the response structure
    const response: ClaudeResponse = {
      status: parsed.status === 'passed' ? 'passed' : 'failed',
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      validations: Array.isArray(parsed.validations) ? parsed.validations : [],
      error: parsed.error,
      screenshot: parsed.screenshot,
    };

    return response;
  } catch (error) {
    return {
      status: 'failed',
      steps: [],
      validations: [],
      error: `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Build the Claude Code CLI command arguments.
 */
function buildClaudeArgs(): string[] {
  return [
    '--print',  // Non-interactive mode
    '--output-format', 'text',  // Use text format (we'll parse JSON from output)
    '--dangerously-skip-permissions',  // Skip permission prompts for automation
  ];
}

/**
 * Run Claude Code CLI with the given prompt.
 */
export async function runClaude(
  prompt: string,
  options: Partial<ClaudeRunnerOptions> = {}
): Promise<ClaudeResponse> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.dryRun) {
    // In dry-run mode, return a mock response
    return {
      status: 'skipped',
      steps: [],
      validations: [],
      error: 'Dry run - no execution performed',
    };
  }

  const args = buildClaudeArgs();
  const output = await executeClaudeProcess(args, prompt, opts.timeout);
  return parseClaudeResponse(output);
}

/**
 * Execute the Claude Code CLI process and capture output.
 * Uses stdin to pass the prompt for better handling of long prompts.
 */
async function executeClaudeProcess(args: string[], prompt: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let isResolved = false;

    const claude = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Ensure Claude uses the right settings
        NO_COLOR: '1', // Disable color output for easier parsing
      },
    });

    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        claude.kill('SIGTERM');
        reject(new ClaudeRunnerError(`Claude execution timed out after ${timeout}ms`));
      }
    }, timeout);

    // Write prompt to stdin and close it
    claude.stdin.write(prompt);
    claude.stdin.end();

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    claude.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new ClaudeRunnerError(
              'Claude Code CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code'
            )
          );
        } else {
          reject(new ClaudeRunnerError(`Failed to spawn Claude process: ${error.message}`));
        }
      }
    });

    claude.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout) {
          // Process failed without output
          reject(
            new ClaudeRunnerError(
              `Claude exited with code ${code}`,
              code ?? undefined,
              stderr
            )
          );
        } else {
          // Process completed (may have non-zero exit but still produced output)
          resolve(stdout);
        }
      }
    });
  });
}

/**
 * Check if Claude Code CLI is available.
 */
export async function isClaudeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    claude.on('error', () => {
      resolve(false);
    });

    claude.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Get Claude Code CLI version.
 */
export async function getClaudeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    let stdout = '';

    const claude = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    claude.on('error', () => {
      resolve(null);
    });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Create a mock response for testing purposes.
 */
export function createMockResponse(
  status: TestStatus,
  steps: StepResult[] = [],
  validations: ValidationResult[] = [],
  error?: string
): ClaudeResponse {
  return {
    status,
    steps,
    validations,
    error,
  };
}
