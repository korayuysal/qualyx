import type { TestResult, JiraConfig, QualyxConfig, RunResult } from '../types/index.js';

interface JiraIssue {
  id: string;
  key: string;
  self: string;
}

interface JiraSearchResult {
  issues: Array<{
    id: string;
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
      };
    };
  }>;
  total: number;
}

interface JiraCreateIssuePayload {
  fields: {
    project: {
      key: string;
    };
    summary: string;
    description: {
      type: string;
      version: number;
      content: Array<{
        type: string;
        content?: Array<{
          type: string;
          text?: string;
          marks?: Array<{ type: string }>;
        }>;
      }>;
    };
    issuetype: {
      name: string;
    };
    labels?: string[];
    components?: Array<{ name: string }>;
  };
}

interface JiraAddCommentPayload {
  body: {
    type: string;
    version: number;
    content: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
        marks?: Array<{ type: string }>;
      }>;
    }>;
  };
}

/**
 * Jira integration for creating issues on test failures.
 */
export class JiraIntegration {
  private config: JiraConfig;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.config = config;
    // Basic auth with email:api_token
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.api_token}`).toString('base64')}`;
  }

  /**
   * Search for existing open issues related to a test failure.
   */
  async findExistingIssue(testResult: TestResult): Promise<JiraSearchResult['issues'][0] | null> {
    const jql = `project = "${this.config.project_key}" AND summary ~ "${this.escapeJql(testResult.ruleId)}" AND status not in (Done, Closed, Resolved) ORDER BY created DESC`;

    const url = new URL('/rest/api/3/search', this.config.base_url);
    url.searchParams.set('jql', jql);
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('fields', 'summary,status');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira search failed: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as JiraSearchResult;
    return result.issues.length > 0 ? result.issues[0] : null;
  }

  /**
   * Create a new Jira issue for a failed test.
   */
  async createIssue(testResult: TestResult, runId: string): Promise<JiraIssue> {
    const summary = `[Qualyx] ${testResult.appName} - ${testResult.ruleName} failed`;
    const description = this.buildDescription(testResult, runId);

    const payload: JiraCreateIssuePayload = {
      fields: {
        project: {
          key: this.config.project_key,
        },
        summary,
        description,
        issuetype: {
          name: this.config.issue_type,
        },
      },
    };

    // Add labels if configured
    if (this.config.labels?.length) {
      payload.fields.labels = [...this.config.labels, 'qualyx', 'automated-test'];
    } else {
      payload.fields.labels = ['qualyx', 'automated-test'];
    }

    // Add components if configured
    if (this.config.components?.length) {
      payload.fields.components = this.config.components.map(name => ({ name }));
    }

    const url = new URL('/rest/api/3/issue', this.config.base_url);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira issue creation failed: ${response.status} ${errorText}`);
    }

    return (await response.json()) as JiraIssue;
  }

  /**
   * Add a comment to an existing issue about a re-failure.
   */
  async addComment(issueKey: string, testResult: TestResult, runId: string): Promise<void> {
    const payload: JiraAddCommentPayload = {
      body: this.buildCommentBody(testResult, runId),
    };

    const url = new URL(`/rest/api/3/issue/${issueKey}/comment`, this.config.base_url);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira comment failed: ${response.status} ${errorText}`);
    }
  }

  /**
   * Build Atlassian Document Format (ADF) description for the issue.
   */
  private buildDescription(testResult: TestResult, runId: string): JiraCreateIssuePayload['fields']['description'] {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'heading',
          content: [
            {
              type: 'text',
              text: 'Test Failure Details',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'App: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: testResult.appName },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Rule ID: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: testResult.ruleId },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Severity: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: testResult.severity.toUpperCase() },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Run ID: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: runId },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Failed at: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: testResult.completedAt },
          ],
        },
        {
          type: 'heading',
          content: [
            {
              type: 'text',
              text: 'Error',
            },
          ],
        },
        {
          type: 'codeBlock',
          content: [
            {
              type: 'text',
              text: testResult.error || 'No error message available',
            },
          ],
        },
        {
          type: 'heading',
          content: [
            {
              type: 'text',
              text: 'Steps Executed',
            },
          ],
        },
        ...testResult.steps.map(step => ({
          type: 'paragraph' as const,
          content: [
            {
              type: 'text' as const,
              text: step.status === 'passed' ? '✓ ' : '✗ ',
            },
            {
              type: 'text' as const,
              text: step.step,
            },
            ...(step.error ? [
              { type: 'text' as const, text: ` - ${step.error}`, marks: [{ type: 'em' as const }] },
            ] : []),
          ],
        })),
      ],
    };
  }

  /**
   * Build ADF comment body for re-failure.
   */
  private buildCommentBody(testResult: TestResult, runId: string): JiraAddCommentPayload['body'] {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Test failed again ', marks: [{ type: 'strong' }] },
            { type: 'text', text: `at ${testResult.completedAt}` },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Run ID: ' },
            { type: 'text', text: runId },
          ],
        },
        {
          type: 'codeBlock',
          content: [
            {
              type: 'text',
              text: testResult.error || 'No error message available',
            },
          ],
        },
      ],
    };
  }

  /**
   * Escape special characters for JQL queries.
   */
  private escapeJql(str: string): string {
    return str.replace(/[\\'"]/g, '\\$&');
  }

  /**
   * Process a failed test result - create issue or add comment.
   */
  async processFailedTest(testResult: TestResult, runId: string): Promise<{ action: 'created' | 'commented'; issueKey: string } | null> {
    if (!this.config.create_issues || testResult.status !== 'failed') {
      return null;
    }

    // Check for existing open issue
    const existingIssue = await this.findExistingIssue(testResult);

    if (existingIssue) {
      // Add comment to existing issue
      await this.addComment(existingIssue.key, testResult, runId);
      return { action: 'commented', issueKey: existingIssue.key };
    }

    // Create new issue
    const newIssue = await this.createIssue(testResult, runId);
    return { action: 'created', issueKey: newIssue.key };
  }
}

/**
 * Process test failures and create/update Jira issues.
 */
export async function processJiraIssues(
  runResult: RunResult,
  config: QualyxConfig
): Promise<Array<{ testId: string; action: 'created' | 'commented'; issueKey: string }>> {
  const jiraConfig = config.integrations?.jira;

  if (!jiraConfig) {
    return [];
  }

  const jira = new JiraIntegration(jiraConfig);
  const results: Array<{ testId: string; action: 'created' | 'commented'; issueKey: string }> = [];

  const failedTests = runResult.results.filter(r => r.status === 'failed');

  for (const testResult of failedTests) {
    try {
      const result = await jira.processFailedTest(testResult, runResult.runId);
      if (result) {
        results.push({
          testId: testResult.ruleId,
          action: result.action,
          issueKey: result.issueKey,
        });
      }
    } catch (error) {
      // Log error but continue processing other failures
      console.error(`Failed to process Jira issue for ${testResult.ruleId}:`, error);
    }
  }

  return results;
}
