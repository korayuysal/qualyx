/**
 * Type definitions for the feature-verify command.
 * Verifies features against Jira requirements and Figma design specs.
 */

// ============================================================
// Jira Context Types
// ============================================================

export interface JiraIssueContext {
  /** Jira issue key (e.g., PROJ-123) */
  key: string;
  /** Issue summary/title */
  summary: string;
  /** Issue description (may contain markdown/ADF) */
  description?: string;
  /** Extracted acceptance criteria as an array of strings */
  acceptanceCriteria: string[];
  /** Current issue status */
  status: string;
  /** Full URL to the Jira issue */
  url: string;
}

// ============================================================
// Figma Context Types
// ============================================================

export interface FigmaComponentSpec {
  /** Figma node ID */
  nodeId: string;
  /** Name of the component/frame */
  nodeName: string;
  /** Type of the node (FRAME, COMPONENT, etc.) */
  nodeType: string;
  /** Extracted text content from the design */
  textContent: string[];
  /** Hex colors used in the design */
  colors: string[];
  /** Dimensions if available */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Additional component properties */
  properties?: Record<string, unknown>;
  /** Original Figma URL */
  url: string;
}

// ============================================================
// Feature Verify Result Types
// ============================================================

export interface FeatureVerifyResult {
  /** Overall verification status */
  status: 'passed' | 'failed';
  /** Individual verification results */
  verifications: Array<{
    /** The criterion that was verified */
    criterion: string;
    /** Whether it passed */
    status: 'passed' | 'failed';
    /** Additional notes about the verification */
    notes?: string;
  }>;
  /** Summary of the verification */
  summary: string;
  /** Base64 encoded screenshot */
  screenshot?: string;
}

// ============================================================
// CLI Options Types
// ============================================================

export interface FeatureVerifyOptions {
  /** Jira issue key or URL */
  jira?: string;
  /** Figma component URL */
  figma?: string;
  /** Target application URL to verify */
  url: string;
  /** Show browser (headed mode) */
  headed?: boolean;
  /** Detailed output */
  verbose?: boolean;
  /** Preview prompt only without execution */
  dryRun?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

// ============================================================
// Prompt Context Types
// ============================================================

export interface FeatureVerifyPromptContext {
  /** Target URL to verify */
  url: string;
  /** Jira issue context (if provided) */
  jira?: JiraIssueContext;
  /** Figma component spec (if provided) */
  figma?: FigmaComponentSpec;
}
