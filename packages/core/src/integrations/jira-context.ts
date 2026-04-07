/**
 * Jira context fetcher for feature-verify command.
 * Fetches issue details including requirements and acceptance criteria.
 */

import type { JiraIssueContext } from '../types/feature-verify.js';

// ============================================================
// Environment Variable Configuration
// ============================================================

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

function getJiraConfig(): JiraConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  const missing: string[] = [];
  if (!baseUrl) missing.push('JIRA_BASE_URL');
  if (!email) missing.push('JIRA_EMAIL');
  if (!apiToken) missing.push('JIRA_API_TOKEN');

  if (missing.length > 0) {
    throw new JiraContextError(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please set the following:\n' +
        '  JIRA_BASE_URL=https://company.atlassian.net\n' +
        '  JIRA_EMAIL=user@company.com\n' +
        '  JIRA_API_TOKEN=your-api-token'
    );
  }

  return { baseUrl: baseUrl!, email: email!, apiToken: apiToken! };
}

// ============================================================
// Error Types
// ============================================================

export class JiraContextError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'JiraContextError';
  }
}

// ============================================================
// Jira API Response Types
// ============================================================

interface JiraIssueResponse {
  key: string;
  self: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    description?: JiraAdfDocument | string | null;
    // Custom fields might contain acceptance criteria
    [key: string]: unknown;
  };
}

interface JiraAdfDocument {
  type: 'doc';
  version: number;
  content: JiraAdfNode[];
}

interface JiraAdfNode {
  type: string;
  content?: JiraAdfNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

// ============================================================
// URL/Key Parsing
// ============================================================

/**
 * Parse a Jira issue key from a URL or direct key input.
 *
 * @example
 * parseJiraKey('PROJ-123') // returns 'PROJ-123'
 * parseJiraKey('https://company.atlassian.net/browse/PROJ-123') // returns 'PROJ-123'
 * parseJiraKey('https://company.atlassian.net/jira/software/projects/PROJ/boards/1?selectedIssue=PROJ-123') // returns 'PROJ-123'
 */
export function parseJiraKey(input: string): string {
  // Direct key format: PROJ-123
  const directKeyMatch = input.match(/^[A-Z][A-Z0-9]+-\d+$/i);
  if (directKeyMatch) {
    return input.toUpperCase();
  }

  // URL format: /browse/PROJ-123
  const browseMatch = input.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
  if (browseMatch) {
    return browseMatch[1].toUpperCase();
  }

  // URL format: selectedIssue=PROJ-123
  const selectedIssueMatch = input.match(/selectedIssue=([A-Z][A-Z0-9]+-\d+)/i);
  if (selectedIssueMatch) {
    return selectedIssueMatch[1].toUpperCase();
  }

  // Try to find any key-like pattern in the URL
  const anyKeyMatch = input.match(/([A-Z][A-Z0-9]+-\d+)/i);
  if (anyKeyMatch) {
    return anyKeyMatch[1].toUpperCase();
  }

  throw new JiraContextError(
    `Invalid Jira key or URL: ${input}\n` +
      'Expected format: PROJ-123 or https://company.atlassian.net/browse/PROJ-123'
  );
}

// ============================================================
// ADF (Atlassian Document Format) Parsing
// ============================================================

/**
 * Extract plain text from Atlassian Document Format (ADF).
 */
function extractTextFromAdf(doc: JiraAdfDocument | null | undefined): string {
  if (!doc || !doc.content) {
    return '';
  }

  const extractText = (nodes: JiraAdfNode[]): string => {
    return nodes
      .map((node) => {
        if (node.text) {
          return node.text;
        }
        if (node.content) {
          return extractText(node.content);
        }
        return '';
      })
      .join('');
  };

  return extractText(doc.content);
}

/**
 * Extract acceptance criteria from issue description.
 * Looks for common patterns like:
 * - "Acceptance Criteria:" sections
 * - Bullet points starting with "- [ ]" or "* [ ]"
 * - Numbered lists under "AC:" header
 */
function extractAcceptanceCriteria(description: string): string[] {
  const criteria: string[] = [];

  // Pattern 1: "Acceptance Criteria" section with bullet points
  const acSectionMatch = description.match(
    /(?:acceptance\s+criteria|ac)[\s:]*\n([\s\S]*?)(?:\n\n|\n#|$)/i
  );
  if (acSectionMatch) {
    const section = acSectionMatch[1];
    // Extract bullet points
    const bullets = section.match(/(?:^|\n)\s*[-*•]\s*(.+)/g);
    if (bullets) {
      for (const bullet of bullets) {
        const text = bullet.replace(/(?:^|\n)\s*[-*•]\s*/, '').trim();
        if (text && !criteria.includes(text)) {
          criteria.push(text);
        }
      }
    }
  }

  // Pattern 2: Checkbox style "- [ ]" or "- [x]"
  const checkboxMatches = description.match(/(?:^|\n)\s*[-*]\s*\[[ x]\]\s*(.+)/gi);
  if (checkboxMatches) {
    for (const match of checkboxMatches) {
      const text = match.replace(/(?:^|\n)\s*[-*]\s*\[[ x]\]\s*/, '').trim();
      if (text && !criteria.includes(text)) {
        criteria.push(text);
      }
    }
  }

  // Pattern 3: Numbered "1. Given/When/Then" patterns (BDD style)
  const bddMatches = description.match(/(?:^|\n)\s*\d+\.\s*((?:given|when|then).+)/gi);
  if (bddMatches) {
    for (const match of bddMatches) {
      const text = match.replace(/(?:^|\n)\s*\d+\.\s*/, '').trim();
      if (text && !criteria.includes(text)) {
        criteria.push(text);
      }
    }
  }

  // If no structured criteria found, try to extract any bullet points as requirements
  if (criteria.length === 0) {
    const anyBullets = description.match(/(?:^|\n)\s*[-*•]\s*(.+)/g);
    if (anyBullets) {
      for (const bullet of anyBullets) {
        const text = bullet.replace(/(?:^|\n)\s*[-*•]\s*/, '').trim();
        // Filter out very short or header-like items
        if (text && text.length > 10 && !text.includes(':') && !criteria.includes(text)) {
          criteria.push(text);
        }
      }
    }
  }

  return criteria;
}

// ============================================================
// Main Fetch Function
// ============================================================

/**
 * Fetch Jira issue context including summary, description, and acceptance criteria.
 */
export async function fetchJiraContext(keyOrUrl: string): Promise<JiraIssueContext> {
  const config = getJiraConfig();
  const issueKey = parseJiraKey(keyOrUrl);

  const authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`;

  const url = new URL(`/rest/api/3/issue/${issueKey}`, config.baseUrl);
  url.searchParams.set('fields', 'summary,status,description');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new JiraContextError(
        'Jira authentication failed. Check your JIRA_EMAIL and JIRA_API_TOKEN.',
        401
      );
    }
    if (response.status === 403) {
      throw new JiraContextError(
        `Permission denied for issue ${issueKey}. Check your Jira permissions.`,
        403
      );
    }
    if (response.status === 404) {
      throw new JiraContextError(`Jira issue not found: ${issueKey}`, 404);
    }

    const errorText = await response.text();
    throw new JiraContextError(
      `Jira API error (${response.status}): ${errorText}`,
      response.status
    );
  }

  const issue = (await response.json()) as JiraIssueResponse;

  // Extract description text
  let descriptionText = '';
  if (issue.fields.description) {
    if (typeof issue.fields.description === 'string') {
      descriptionText = issue.fields.description;
    } else {
      // ADF format
      descriptionText = extractTextFromAdf(issue.fields.description as JiraAdfDocument);
    }
  }

  // Extract acceptance criteria
  const acceptanceCriteria = extractAcceptanceCriteria(descriptionText);

  // Build issue URL
  const issueUrl = `${config.baseUrl.replace(/\/$/, '')}/browse/${issueKey}`;

  return {
    key: issue.key,
    summary: issue.fields.summary,
    description: descriptionText || undefined,
    acceptanceCriteria,
    status: issue.fields.status.name,
    url: issueUrl,
  };
}
