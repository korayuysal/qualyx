/**
 * CLI command for feature verification.
 * Verifies features against Jira requirements and Figma design specs.
 */

import chalk from 'chalk';
import type { Command } from 'commander';
import {
  fetchJiraContext,
  JiraContextError,
  fetchFigmaContext,
  FigmaContextError,
  buildFeatureVerifyPrompt,
  generateVerificationSummary,
  countVerificationCriteria,
  runClaude,
  ClaudeRunnerError,
  isClaudeAvailable,
} from '@qualyx/core';
import type {
  FeatureVerifyOptions,
  JiraIssueContext,
  FigmaComponentSpec,
  FeatureVerifyResult,
} from '@qualyx/core';

// ============================================================
// Command Registration
// ============================================================

export function registerFeatureVerifyCommand(program: Command): void {
  program
    .command('feature-verify')
    .description('Verify a feature against Jira requirements and/or Figma design specs')
    .requiredOption('-u, --url <url>', 'Target application URL to verify')
    .option('-j, --jira <key-or-url>', 'Jira issue key or URL (e.g., PROJ-123)')
    .option('-f, --figma <url>', 'Figma component URL with node-id')
    .option('--headed', 'Show browser during verification')
    .option('-v, --verbose', 'Show detailed output')
    .option('--dry-run', 'Preview the prompt without executing')
    .option('--timeout <ms>', 'Timeout in milliseconds', parseInt)
    .action(async (options) => {
      await runFeatureVerify({
        url: options.url,
        jira: options.jira,
        figma: options.figma,
        headed: options.headed,
        verbose: options.verbose,
        dryRun: options.dryRun,
        timeout: options.timeout,
      });
    });
}

// ============================================================
// Main Command Handler
// ============================================================

export async function runFeatureVerify(options: FeatureVerifyOptions): Promise<void> {
  console.log();

  // Validate that at least one context source is provided
  if (!options.jira && !options.figma) {
    console.log(chalk.red('  Error: At least one of --jira or --figma is required'));
    console.log();
    console.log(chalk.gray('  Examples:'));
    console.log(chalk.gray('    qualyx feature-verify --jira PROJ-123 --url https://app.com/feature'));
    console.log(
      chalk.gray(
        '    qualyx feature-verify --figma "https://figma.com/file/abc/Design?node-id=1:2" --url https://app.com/feature'
      )
    );
    console.log();
    process.exit(1);
  }

  // Check Claude CLI availability (unless dry-run)
  if (!options.dryRun) {
    const claudeAvailable = await isClaudeAvailable();
    if (!claudeAvailable) {
      console.log(chalk.red('  Error: Claude Code CLI not found'));
      console.log(chalk.gray('  Install with: npm install -g @anthropic-ai/claude-code'));
      console.log();
      process.exit(1);
    }
  }

  console.log(chalk.cyan.bold('  Feature Verification'));
  console.log(chalk.gray('  ─'.repeat(25)));
  console.log();

  // Fetch context from external sources
  let jiraContext: JiraIssueContext | undefined;
  let figmaContext: FigmaComponentSpec | undefined;

  // Fetch Jira context
  if (options.jira) {
    console.log(chalk.gray('  Fetching Jira issue...'));
    try {
      jiraContext = await fetchJiraContext(options.jira);
      console.log(chalk.green(`  ✓ Jira: ${jiraContext.key} - ${jiraContext.summary}`));
      if (options.verbose) {
        console.log(chalk.gray(`    Status: ${jiraContext.status}`));
        console.log(chalk.gray(`    Acceptance Criteria: ${jiraContext.acceptanceCriteria.length} items`));
      }
    } catch (error) {
      handleContextError('Jira', error);
    }
  }

  // Fetch Figma context
  if (options.figma) {
    console.log(chalk.gray('  Fetching Figma design...'));
    try {
      figmaContext = await fetchFigmaContext(options.figma);
      console.log(chalk.green(`  ✓ Figma: ${figmaContext.nodeName} (${figmaContext.nodeType})`));
      if (options.verbose) {
        if (figmaContext.dimensions) {
          console.log(
            chalk.gray(`    Dimensions: ${figmaContext.dimensions.width}px × ${figmaContext.dimensions.height}px`)
          );
        }
        console.log(chalk.gray(`    Text elements: ${figmaContext.textContent.length}`));
        console.log(chalk.gray(`    Colors: ${figmaContext.colors.length}`));
      }
    } catch (error) {
      handleContextError('Figma', error);
    }
  }

  console.log();

  // Build verification prompt
  const prompt = buildFeatureVerifyPrompt({
    url: options.url,
    jira: jiraContext,
    figma: figmaContext,
  });

  // Handle dry-run mode
  if (options.dryRun) {
    console.log(chalk.yellow.bold('  Dry Run Mode'));
    console.log(chalk.gray('  ─'.repeat(25)));
    console.log();

    // Show summary
    const summary = generateVerificationSummary({
      url: options.url,
      jira: jiraContext,
      figma: figmaContext,
    });
    console.log(chalk.gray(summary.split('\n').map((line) => `  ${line}`).join('\n')));
    console.log();

    // Show verification criteria count
    const criteriaCount = countVerificationCriteria({
      jira: jiraContext,
      figma: figmaContext,
    });
    console.log(chalk.gray(`  Total verification criteria: ${criteriaCount}`));
    console.log();

    // Show full prompt if verbose
    if (options.verbose) {
      console.log(chalk.gray('  ─'.repeat(25)));
      console.log(chalk.yellow.bold('  Generated Prompt:'));
      console.log(chalk.gray('  ─'.repeat(25)));
      console.log();
      console.log(prompt.split('\n').map((line) => chalk.gray(`  ${line}`)).join('\n'));
      console.log();
    }

    console.log(chalk.green('  ✓ Dry run complete - no verification executed'));
    console.log();
    return;
  }

  // Execute verification with Claude
  console.log(chalk.cyan('  Running verification...'));
  console.log(chalk.gray(`  Target: ${options.url}`));
  console.log();

  try {
    const response = await runClaude(prompt, {
      timeout: options.timeout || 120000, // 2 minutes default
      headless: !options.headed,
      retries: 0, // Don't retry verification
      dryRun: false,
    });

    // Parse and display results
    const result = parseVerificationResult(response);
    displayVerificationResults(result, options.verbose);

    // Exit with appropriate code
    if (result.status === 'failed') {
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof ClaudeRunnerError) {
      console.log(chalk.red(`  Error: ${error.message}`));
      if (error.stderr && options.verbose) {
        console.log(chalk.gray(`  Details: ${error.stderr}`));
      }
    } else if (error instanceof Error) {
      console.log(chalk.red(`  Error: ${error.message}`));
    } else {
      console.log(chalk.red('  An unexpected error occurred'));
    }
    console.log();
    process.exit(1);
  }
}

// ============================================================
// Helper Functions
// ============================================================

function handleContextError(source: string, error: unknown): never {
  console.log();

  if (error instanceof JiraContextError || error instanceof FigmaContextError) {
    console.log(chalk.red(`  ${source} Error: ${error.message}`));

    if (error.statusCode === 401) {
      console.log(chalk.gray('  Hint: Check your authentication credentials'));
    } else if (error.statusCode === 403) {
      console.log(chalk.gray('  Hint: Verify you have access to this resource'));
    } else if (error.statusCode === 404) {
      console.log(chalk.gray('  Hint: The resource may not exist or the URL may be incorrect'));
    }
  } else if (error instanceof Error) {
    console.log(chalk.red(`  ${source} Error: ${error.message}`));
  } else {
    console.log(chalk.red(`  ${source} Error: An unexpected error occurred`));
  }

  console.log();
  process.exit(1);
}

function parseVerificationResult(response: { status: string; error?: string }): FeatureVerifyResult {
  // Try to extract structured result from response
  // The response should contain a JSON result
  const result: FeatureVerifyResult = {
    status: response.status === 'passed' ? 'passed' : 'failed',
    verifications: [],
    summary: response.error || (response.status === 'passed' ? 'All verifications passed' : 'Verification failed'),
  };

  // If the response has verifications, use them
  const rawResponse = response as unknown as {
    status: string;
    verifications?: Array<{ criterion: string; status: string; notes?: string }>;
    summary?: string;
    screenshot?: string;
  };

  if (rawResponse.verifications && Array.isArray(rawResponse.verifications)) {
    result.verifications = rawResponse.verifications.map((v) => ({
      criterion: v.criterion,
      status: v.status === 'passed' ? 'passed' : 'failed',
      notes: v.notes,
    }));
  }

  if (rawResponse.summary) {
    result.summary = rawResponse.summary;
  }

  if (rawResponse.screenshot) {
    result.screenshot = rawResponse.screenshot;
  }

  return result;
}

function displayVerificationResults(result: FeatureVerifyResult, verbose?: boolean): void {
  console.log(chalk.gray('  ─'.repeat(25)));
  console.log();

  // Overall status
  if (result.status === 'passed') {
    console.log(chalk.green.bold('  ✓ VERIFICATION PASSED'));
  } else {
    console.log(chalk.red.bold('  ✗ VERIFICATION FAILED'));
  }
  console.log();

  // Individual verifications
  if (result.verifications.length > 0) {
    console.log(chalk.gray('  Results:'));
    for (const verification of result.verifications) {
      const icon = verification.status === 'passed' ? chalk.green('✓') : chalk.red('✗');
      const status = verification.status === 'passed' ? chalk.green('PASS') : chalk.red('FAIL');
      console.log(`    ${icon} ${status} ${verification.criterion}`);

      if (verbose && verification.notes) {
        console.log(chalk.gray(`      Notes: ${verification.notes}`));
      }
    }
    console.log();
  }

  // Summary
  console.log(chalk.gray('  Summary:'));
  console.log(chalk.gray(`    ${result.summary}`));
  console.log();

  // Statistics
  const passed = result.verifications.filter((v) => v.status === 'passed').length;
  const failed = result.verifications.filter((v) => v.status === 'failed').length;
  const total = result.verifications.length;

  if (total > 0) {
    console.log(chalk.gray(`  Statistics: ${passed}/${total} passed, ${failed}/${total} failed`));
    console.log();
  }
}
