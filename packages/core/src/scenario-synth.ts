import { z } from 'zod';
import { QualyxConfigSchema, type QualyxConfig } from './types/index.js';

export const PromptScenarioBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  url: z.string().url(),
  prompt: z.string().trim().min(1),
  description: z.string().optional(),
});

export type PromptScenarioBody = z.infer<typeof PromptScenarioBodySchema>;

export interface PromptScenarioInput {
  name: string;
  url: string;
  prompt: string;
  scenarioId: string;
}

export function configFromPrompt(input: PromptScenarioInput): QualyxConfig {
  const raw = {
    organization: { name: input.name },
    apps: [
      {
        name: input.name,
        url: input.url,
        rules: [
          {
            id: input.scenarioId,
            name: input.name,
            steps: [input.prompt],
          },
        ],
      },
    ],
  };

  return QualyxConfigSchema.parse(raw);
}

export function deriveScenarioName(prompt: string, url: string): string {
  const firstLine = prompt.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const cleaned = firstLine
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 0) {
    const words = cleaned.split(' ').slice(0, 6).join(' ');
    return capitalizeFirst(words);
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return `Test ${host}`;
  } catch {
    return 'Untitled scenario';
  }
}

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
