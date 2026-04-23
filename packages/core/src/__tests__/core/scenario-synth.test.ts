import { describe, it, expect } from 'vitest';
import { configFromPrompt, deriveScenarioName } from '../../scenario-synth.js';
import { QualyxConfigSchema } from '../../types/index.js';

describe('configFromPrompt', () => {
  it('produces a QualyxConfig that parses via the Zod schema', () => {
    const config = configFromPrompt({
      name: 'Flight search',
      url: 'https://flights.google.com',
      prompt: 'Search flights IST → CAI next weekend and verify the total price.',
      scenarioId: '11111111-1111-1111-1111-111111111111',
    });

    expect(() => QualyxConfigSchema.parse(config)).not.toThrow();
  });

  it('stores the full prompt as the single step so the existing prompt template consumes it verbatim', () => {
    const prompt = 'Open the landing page and confirm the CTA button is visible.';
    const config = configFromPrompt({
      name: 'Landing CTA',
      url: 'https://example.com',
      prompt,
      scenarioId: 'abc',
    });

    expect(config.apps).toHaveLength(1);
    expect(config.apps[0].rules).toHaveLength(1);
    expect(config.apps[0].rules[0].steps).toEqual([prompt]);
  });

  it('uses the scenario id as the rule id so run records remain stable', () => {
    const config = configFromPrompt({
      name: 'x',
      url: 'https://example.com',
      prompt: 'do stuff',
      scenarioId: 'scenario-42',
    });

    expect(config.apps[0].rules[0].id).toBe('scenario-42');
  });

  it('rejects invalid URLs at synth time (surfaces errors before the worker runs)', () => {
    expect(() =>
      configFromPrompt({
        name: 'x',
        url: 'not-a-url',
        prompt: 'do stuff',
        scenarioId: 'x',
      }),
    ).toThrow();
  });
});

describe('deriveScenarioName', () => {
  it('takes the first six words of the first non-empty line', () => {
    const name = deriveScenarioName(
      'Search for flights from Istanbul to Cairo and verify the price.',
      'https://flights.google.com',
    );
    expect(name).toBe('Search for flights from Istanbul to');
  });

  it('strips URLs and punctuation before deriving', () => {
    const name = deriveScenarioName(
      'Visit https://example.com/foo/bar and click the login button!',
      'https://example.com',
    );
    expect(name).toBe('Visit and click the login button');
  });

  it('falls back to the hostname when the prompt has no useful words', () => {
    const name = deriveScenarioName('   ', 'https://flights.google.com');
    expect(name).toBe('Test flights.google.com');
  });

  it('survives an invalid URL fallback', () => {
    const name = deriveScenarioName('', 'not-a-url');
    expect(name).toBe('Untitled scenario');
  });
});
