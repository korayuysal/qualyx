# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-18

### Added
- Parallel test execution with `--parallel` and `--max-parallel` options
- Email notifications via SMTP (nodemailer)
- Microsoft Teams notifications with Adaptive Cards
- Performance metrics collection with `--collect-metrics`
- Page load time, DOM content loaded, FCP, LCP metrics
- Network request count and transfer size tracking

## [0.2.0] - 2025-01-17

### Added
- Test scheduling with cron expressions
- Schedule commands: `list`, `cron`, `github`
- Slack notifications integration with webhook support
- Jira integration for automatic issue creation on failures
- Test history tracking with SQLite database
- HTML report generation with `--report` flag
- Environment support (staging, production) via `--environment`
- GitHub Actions workflow generation via `qualyx schedule github`
- User mentions on failure for Slack notifications
- Duplicate issue prevention in Jira integration

## [0.1.0] - 2025-01-16

### Added
- Initial release
- YAML configuration parsing with Zod validation
- CLI commands: `init`, `validate`, `list`, `run`
- Claude Code CLI integration for AI-powered test execution
- Dry-run mode for test preview with `--dry-run`
- Handlebars prompt template generation
- App-level setup blocks for shared test preparation
- Screenshot capture configuration (on_failure, on_success, each_step)
- Environment variable substitution with `${VAR_NAME}` syntax
- Test severity levels (critical, high, medium, low)
- Retry support with configurable retry count
- Step hints and cautions for AI guidance

[0.3.0]: https://github.com/korayuysal/qualyx/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/korayuysal/qualyx/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/korayuysal/qualyx/releases/tag/v0.1.0
