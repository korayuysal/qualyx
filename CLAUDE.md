# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

- `npm run build` — Compile TypeScript to `dist/` via `tsc`
- `npm run dev -- <command> [options]` — Run CLI in development mode via `tsx` (e.g., `npm run dev -- run --dry-run`)
- `npm start` — Run compiled CLI from `dist/`
- `npm test` — Run all tests with Vitest
- `npm test -- src/__tests__/core/executor.test.ts` — Run a single test file
- `npm test -- --watch` — Watch mode
- `npm run typecheck` — Type-check without emitting
- `npm run lint` — ESLint (note: no eslint config is currently set up)

## Architecture

Qualyx is an AI-powered QA automation platform. Users define tests in plain English YAML (`qualyx.yml`), and the tool orchestrates Claude Code CLI + Playwright to execute them in a browser.

**Execution flow:** CLI command → Config loader (YAML + Zod validation) → Executor (sequential/parallel) → Prompt builder (Handlebars) → Claude runner (spawns `claude` CLI subprocess) → Results → Reporters/Notifications/Storage

### Module Layout

- **`src/cli/`** — Commander.js CLI. `index.ts` defines all commands; `commands/` has per-command implementations. The `run` command is the primary entry point for test execution.
- **`src/core/`** — Engine. `executor.ts` orchestrates test runs (supports parallel via Promise.allSettled). `claude-runner.ts` spawns the `claude` CLI as a child process with `--print --output-format text --dangerously-skip-permissions`. `prompt-builder.ts` compiles Handlebars templates. `config-loader.ts` parses YAML with `${ENV_VAR}` substitution and validates via Zod. `retry-handler.ts` handles retry logic with previous-attempt context.
- **`src/types/`** — All types defined as Zod schemas in `index.ts`, with TypeScript types inferred via `z.infer<>`. This is the single source of truth for config shape and execution types.
- **`src/integrations/`** — Slack webhooks, email (nodemailer), MS Teams Adaptive Cards, Jira issue creation.
- **`src/reporters/`** — `console.ts` (chalk terminal output), `html.ts` (HTML report from Handlebars template).
- **`src/storage/`** — SQLite via `better-sqlite3`. `sqlite.ts` manages the DB at `.qualyx/history.db`; `results.ts` is the query API layer.
- **`templates/`** — Handlebars templates for prompts (`prompt.md.hbs`), HTML reports, Slack payloads, cron/GitHub Actions exports, and feature verification.

### Key Patterns

- **ESM throughout**: The project uses `"type": "module"`. All internal imports must use `.js` extensions (e.g., `import { x } from './foo.js'`), even though source files are `.ts`.
- **Zod as source of truth**: Config validation and TypeScript types both derive from Zod schemas in `src/types/index.ts`. Add new config fields there first.
- **Callback pattern in Executor**: The executor uses callback functions (onTestStart, onTestComplete, etc.) passed from the CLI run command for reporting and notifications.
- **Env var substitution**: Config loader recursively replaces `${VAR_NAME}` patterns with `process.env` values before Zod validation.

## Code Conventions

- TypeScript strict mode, ES2022 target, NodeNext module resolution
- Files: `kebab-case.ts` | Classes: `PascalCase` | Functions/vars: `camelCase` | Constants: `SCREAMING_SNAKE_CASE`
- 2 spaces, single quotes, semicolons required
- Conventional Commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`, etc.
- Tests use Vitest, placed in `src/__tests__/` mirroring the source structure
