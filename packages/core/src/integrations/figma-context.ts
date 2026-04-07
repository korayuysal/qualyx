/**
 * Figma context fetcher for feature-verify command.
 * Fetches component specifications including text, colors, and dimensions.
 */

import type { FigmaComponentSpec } from '../types/feature-verify.js';

// ============================================================
// Environment Variable Configuration
// ============================================================

function getFigmaToken(): string {
  const token = process.env.FIGMA_TOKEN;

  if (!token) {
    throw new FigmaContextError(
      'Missing required environment variable: FIGMA_TOKEN\n' +
        'Please set your Figma personal access token:\n' +
        '  FIGMA_TOKEN=your-personal-access-token\n\n' +
        'Get a token at: https://www.figma.com/developers/api#access-tokens'
    );
  }

  return token;
}

// ============================================================
// Error Types
// ============================================================

export class FigmaContextError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'FigmaContextError';
  }
}

// ============================================================
// URL Parsing
// ============================================================

interface FigmaUrlParts {
  fileKey: string;
  nodeId?: string;
}

/**
 * Parse a Figma URL to extract file key and node ID.
 *
 * @example
 * // Full URL with node-id
 * parseFigmaUrl('https://www.figma.com/file/abc123/Design?node-id=1:2')
 * // returns { fileKey: 'abc123', nodeId: '1:2' }
 *
 * // Design mode URL
 * parseFigmaUrl('https://www.figma.com/design/abc123/Title?node-id=0-1')
 * // returns { fileKey: 'abc123', nodeId: '0-1' }
 *
 * // File URL without node
 * parseFigmaUrl('https://www.figma.com/file/abc123/Design')
 * // returns { fileKey: 'abc123', nodeId: undefined }
 */
export function parseFigmaUrl(url: string): FigmaUrlParts {
  // Handle various Figma URL formats
  // - https://www.figma.com/file/FILEKEY/TITLE
  // - https://www.figma.com/design/FILEKEY/TITLE
  // - https://figma.com/file/FILEKEY/TITLE?node-id=1:2
  // - https://www.figma.com/file/FILEKEY/TITLE?node-id=0-1&mode=design

  const urlObj = new URL(url);

  // Extract file key from path
  // Path format: /file/FILEKEY/... or /design/FILEKEY/...
  const pathMatch = urlObj.pathname.match(/\/(?:file|design)\/([^/]+)/);
  if (!pathMatch) {
    throw new FigmaContextError(
      `Invalid Figma URL: ${url}\n` +
        'Expected format: https://www.figma.com/file/{file_key}/{title}?node-id={node_id}'
    );
  }

  const fileKey = pathMatch[1];

  // Extract node ID from query params
  // Figma uses both "node-id" and encodes colons as hyphens in some contexts
  let nodeId = urlObj.searchParams.get('node-id');

  // Some Figma URLs use hyphens instead of colons for node IDs
  // Convert "0-1" format to "0:1" format for API compatibility
  if (nodeId && nodeId.includes('-') && !nodeId.includes(':')) {
    nodeId = nodeId.replace(/-/g, ':');
  }

  return {
    fileKey,
    nodeId: nodeId || undefined,
  };
}

// ============================================================
// Figma API Response Types
// ============================================================

interface FigmaNodesResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  nodes: {
    [nodeId: string]: {
      document: FigmaNode;
      components?: Record<string, FigmaComponent>;
      styles?: Record<string, FigmaStyle>;
    };
  };
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  characters?: string; // Text content
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
  };
  componentProperties?: Record<string, unknown>;
}

interface FigmaFill {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  visible?: boolean;
}

interface FigmaComponent {
  key: string;
  name: string;
  description: string;
}

interface FigmaStyle {
  key: string;
  name: string;
  styleType: string;
}

// ============================================================
// Color Extraction
// ============================================================

/**
 * Convert Figma color (0-1 range) to hex string.
 */
function figmaColorToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  return hex.toUpperCase();
}

/**
 * Extract unique colors from a Figma node and its children.
 */
function extractColors(node: FigmaNode, colors: Set<string> = new Set()): Set<string> {
  // Extract fill colors
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color && fill.visible !== false) {
        colors.add(figmaColorToHex(fill.color));
      }
    }
  }

  // Extract stroke colors
  if (node.strokes) {
    for (const stroke of node.strokes) {
      if (stroke.type === 'SOLID' && stroke.color && stroke.visible !== false) {
        colors.add(figmaColorToHex(stroke.color));
      }
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      extractColors(child, colors);
    }
  }

  return colors;
}

/**
 * Extract text content from a Figma node and its children.
 */
function extractTextContent(node: FigmaNode, texts: string[] = []): string[] {
  // Extract text from TEXT nodes
  if (node.type === 'TEXT' && node.characters) {
    const trimmed = node.characters.trim();
    if (trimmed && !texts.includes(trimmed)) {
      texts.push(trimmed);
    }
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      extractTextContent(child, texts);
    }
  }

  return texts;
}

// ============================================================
// Main Fetch Function
// ============================================================

/**
 * Fetch Figma component specification including text, colors, and dimensions.
 */
export async function fetchFigmaContext(figmaUrl: string): Promise<FigmaComponentSpec> {
  const token = getFigmaToken();
  const { fileKey, nodeId } = parseFigmaUrl(figmaUrl);

  if (!nodeId) {
    throw new FigmaContextError(
      'Figma URL must include a node-id parameter.\n' +
        'Select a frame or component in Figma and copy its link with "Copy link to selection".'
    );
  }

  // Fetch node data from Figma API
  const apiUrl = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
  apiUrl.searchParams.set('ids', nodeId);

  const response = await fetch(apiUrl.toString(), {
    method: 'GET',
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new FigmaContextError(
        'Figma authentication failed. Check your FIGMA_TOKEN.',
        401
      );
    }
    if (response.status === 403) {
      throw new FigmaContextError(
        'Permission denied. Make sure you have access to this Figma file.',
        403
      );
    }
    if (response.status === 404) {
      throw new FigmaContextError(
        `Figma file or node not found. Check the URL: ${figmaUrl}`,
        404
      );
    }

    const errorText = await response.text();
    throw new FigmaContextError(
      `Figma API error (${response.status}): ${errorText}`,
      response.status
    );
  }

  const data = (await response.json()) as FigmaNodesResponse;

  // Get the node data
  const nodeData = data.nodes[nodeId];
  if (!nodeData || !nodeData.document) {
    throw new FigmaContextError(
      `Node ${nodeId} not found in the Figma file.\n` +
        'Make sure you copied the correct link from Figma.'
    );
  }

  const node = nodeData.document;

  // Extract text content
  const textContent = extractTextContent(node);

  // Extract colors
  const colorsSet = extractColors(node);
  const colors = Array.from(colorsSet);

  // Extract dimensions
  const dimensions = node.absoluteBoundingBox
    ? {
        width: Math.round(node.absoluteBoundingBox.width),
        height: Math.round(node.absoluteBoundingBox.height),
      }
    : undefined;

  // Extract component properties if available
  const properties = node.componentProperties || undefined;

  return {
    nodeId,
    nodeName: node.name,
    nodeType: node.type,
    textContent,
    colors,
    dimensions,
    properties,
    url: figmaUrl,
  };
}
