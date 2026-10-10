// Human-owned acceptance criteria for the qualyx CLI. Agents must not edit this folder: if a test here looks
// wrong, the change needs a human decision, not a test edit.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ENTRY = resolve('packages/cli/src/index.ts');
const TSX = resolve('node_modules/.bin/tsx'); // the repo's own tsx: no npx lookup, no network

function qualyx(args: string[], cwd: string) {
  const r = spawnSync(TSX, [ENTRY, ...args], { cwd, encoding: 'utf-8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('qualyx CLI', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'qualyx-acceptance-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('init creates a starter config that validate accepts', () => {
    const init = qualyx(['init'], dir);
    expect(init.code).toBe(0);
    expect(existsSync(join(dir, 'qualyx.yml'))).toBe(true);

    const validate = qualyx(['validate', '--config', 'qualyx.yml'], dir);
    expect(validate.code).toBe(0);
    expect(validate.out).toContain('Configuration Summary');
  });

  it('init refuses to overwrite an existing config without --force', () => {
    expect(qualyx(['init'], dir).code).toBe(0);
    expect(qualyx(['init'], dir).code).toBe(1);
    expect(qualyx(['init', '--force'], dir).code).toBe(0);
  });

  it('list --format json returns the apps of the config as JSON', () => {
    qualyx(['init'], dir);
    const list = qualyx(['list', 'apps', '--config', 'qualyx.yml', '--format', 'json'], dir);
    expect(list.code).toBe(0);
    const apps = JSON.parse(list.out.slice(list.out.indexOf('[')));
    expect(Array.isArray(apps)).toBe(true);
    expect(apps.length).toBeGreaterThan(0);
  });

  it('validate rejects an invalid config with exit code 1', () => {
    writeFileSync(join(dir, 'bad.yml'), 'organization: 42\napps: not-a-list\n');
    const validate = qualyx(['validate', '--config', 'bad.yml'], dir);
    expect(validate.code).toBe(1);
    expect(validate.out.toLowerCase()).toMatch(/invalid|error/); // fails because of the config, not the harness
  });
});
