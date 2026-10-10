# Qualyx

AI-powered QA automation: tests are written in plain-English YAML (`qualyx.yml`) and executed by orchestrating
the Claude Code CLI + Playwright in a browser. Hosted as a web app with a background worker.

## Layout (npm workspaces monorepo)

- `packages/core` (`@qualyx/core`): the engine. `config-loader.ts` (YAML + `${ENV}` substitution + Zod),
  `executor.ts` (sequential/parallel runs), `prompt-builder.ts` (Handlebars), `claude-runner.ts` (spawns `claude`),
  `retry-handler.ts`, `scenario-synth.ts`, `integrations/` (Slack, Teams, email, Jira, Figma, Mailosaur),
  `reporters/` (console, HTML), `storage/` (SQLite via better-sqlite3), `db/` (Postgres via Drizzle),
  `types/` (Zod schemas: the single source of truth for config and execution types).
- `packages/cli` (`qualyx` binary): Commander CLI: `init`, `validate`, `list`, `run`, `schedule`, `feature-verify`.
- `packages/worker`: pg-boss queue worker that runs scenarios and scheduled rules.
- `apps/web`: Next.js dashboard and API (next-auth, Drizzle, pg-boss).
- `templates/`: Handlebars templates (prompts, HTML report, Slack payloads, cron / GitHub Actions exports).

Other packages import `@qualyx/core` from its **build output**: build core before typechecking or testing them.

## Commands

- Install: `npm ci`
- Build core first: `npm run build -w packages/core`
- Typecheck: `npm run typecheck`
- Unit tests: `npx vitest run` (files in `packages/*/src/__tests__/`, mirroring the source structure)
- Acceptance tests: `npx vitest run --config vitest.acceptance.config.ts` (files in `tests/acceptance/`)
- Hermetic run of everything (what the software factory does):
  `docker compose -f compose.test.yml run --rm --build test sh -c 'npx vitest run'`

## Conventions

- ESM throughout (`"type": "module"`): internal imports use `.js` extensions even in `.ts` files.
- Add config fields to the Zod schemas in `packages/core/src/types/` first; types are inferred from them.
- TypeScript strict, ES2022, NodeNext. Files `kebab-case.ts`, classes `PascalCase`, functions/vars `camelCase`,
  constants `SCREAMING_SNAKE_CASE`. 2 spaces, single quotes, semicolons.
- Conventional Commits: `feat(scope):`, `fix(scope):`, `refactor(scope):` …

## Rules for agents

- Never edit `tests/acceptance/`, `compose.test.yml`, `Dockerfile.test`, `.github/` or this file: they are
  human-owned. If an acceptance test looks wrong, stop and explain why instead of changing it.
- No skipped tests, `@ts-ignore`, `eslint-disable` or coverage exclusions to make checks pass.
- Tests must not need the network (they run with `network_mode: none`).
- Add or update unit tests for every behaviour change.

<!-- factory:general-rules -->
## General rules

These apply to every agent in every project, whatever the tool or model.

### Writing
- Never sign your work. No "Co-Authored-By", "Generated with ...", agent or model names, or robot emojis in commits, pull requests, code, comments or docs.
- Keep it short, in plain words. Write for a busy person.
  - Commit message: one line on what changed, under 72 characters. Add a short paragraph only if the reason is not obvious.
  - Pull request: 2 to 5 bullets on what changed, why, and how it was tested. No essays.
  - Code comments: only when the code can't say it. Explain why, not what.
- No filler words like "comprehensive", "robust" or "seamlessly".

### Work
- Read AGENTS.md first and use the project's own commands and conventions.
- Make the smallest change that solves the task. No unrelated refactors.
- Never edit human-owned files (acceptance tests, test setup, CI, AGENTS.md, .agents/). If one looks wrong, stop and say so.
- Never make a check pass by weakening it: no skipped tests, no silenced lint or type errors.
- Never put secrets in code, logs or messages.
- If something is unclear, ask instead of guessing.

## Skills
In `.agents/skills/` (also `.claude/skills/`): `code-review`. Use `code-review` before handing over a change.
<!-- /factory:general-rules -->
