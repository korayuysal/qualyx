# Qualyx

AI-powered QA automation platform using Claude Code CLI and Playwright.

## Overview

Qualyx allows you to define tests in natural language YAML, which are then executed by Claude Code CLI using Playwright for browser automation. This enables writing tests that are:

- **Human-readable** - Tests are written in plain English
- **Resilient** - AI adapts to UI changes without brittle selectors
- **Comprehensive** - Complex user flows are easy to describe

## Installation

```bash
npm install -g qualyx
```

**Requirements:**
- Node.js 18+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

## Quick Start

1. **Initialize a configuration file:**

```bash
qualyx init
```

2. **Edit `qualyx.yml`** to configure your apps and tests

3. **Validate your configuration:**

```bash
qualyx validate
```

4. **Run tests:**

```bash
qualyx run
```

## Configuration

Tests are defined in `qualyx.yml`:

```yaml
organization:
  name: My Company
  defaults:
    timeout: 30000
    retries: 2

apps:
  - name: my-app
    url: https://myapp.com
    auth:
      type: form-login
      credentials:
        email: ${TEST_USER_EMAIL}
        password: ${TEST_USER_PASSWORD}

    rules:
      - id: user-login
        name: User can login
        severity: critical
        steps:
          - Navigate to login page
          - Enter email and password
          - Click login button
          - Wait for dashboard to load
        validations:
          - User name is displayed in header
          - Dashboard shows welcome message
```

### Configuration Options

#### Organization

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Organization name | Required |
| `defaults.timeout` | Default timeout (ms) | 30000 |
| `defaults.retries` | Default retry count | 2 |

#### Apps

| Field | Description |
|-------|-------------|
| `name` | App identifier |
| `url` | Base URL |
| `environments` | Named URL mappings |
| `auth` | Authentication config |
| `screenshots` | Screenshot capture settings |
| `setup` | Setup steps run once before rules |
| `rules` | Test rules array |

#### Rules

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `severity` | critical, high, medium, low |
| `timeout` | Override default timeout |
| `steps` | Test steps (strings or objects) |
| `validations` | Expected outcomes |
| `on_failure` | Actions on failure |
| `test_data` | Dynamic test data |
| `schedule` | Cron expression for scheduled runs |
| `skip_setup` | Skip app setup for this rule |

### Step Syntax

Steps can be simple strings:

```yaml
steps:
  - Navigate to the homepage
  - Click the login button
```

Or objects with hints:

```yaml
steps:
  - action: Fill payment form
    hint: Use test card 4242424242424242
    caution: Do NOT click submit
```

### Setup Blocks

Setup steps run once per app before any rules execute:

```yaml
apps:
  - name: my-app
    url: https://myapp.com
    setup:
      - Login to the application
      - Navigate to dashboard
    rules:
      - id: test-1
        name: Test dashboard features
        skip_setup: false  # Default: use setup
        steps:
          - Check dashboard widgets
```

### Screenshot Configuration

Configure screenshot capture:

```yaml
apps:
  - name: my-app
    screenshots:
      on_failure: true   # Capture on failure (default)
      on_success: false  # Capture on success
      each_step: false   # Capture after each step
```

### Scheduling

Schedule tests with cron expressions:

```yaml
rules:
  - id: health-check
    name: Health Check
    schedule: "*/30 * * * *"  # Every 30 minutes
    steps:
      - Verify homepage loads

  - id: daily-smoke
    name: Daily Smoke Test
    schedule: "0 7 * * *"  # Daily at 7 AM
```

### Environment Variables

Credentials use `${VAR_NAME}` syntax:

```yaml
credentials:
  email: ${TEST_USER_EMAIL}
  password: ${TEST_USER_PASSWORD}
```

Set these in your environment or CI/CD pipeline.

## CLI Commands

### `qualyx init`

Create a starter configuration file.

```bash
qualyx init
qualyx init --force  # Overwrite existing
```

### `qualyx validate`

Validate configuration syntax.

```bash
qualyx validate
qualyx validate --config path/to/config.yml
qualyx validate --strict  # Warnings as errors
```

### `qualyx list`

List configured apps and rules.

```bash
qualyx list           # Show all
qualyx list apps      # Apps only
qualyx list rules     # Rules only
qualyx list --format json
```

### `qualyx run`

Execute tests.

```bash
qualyx run                        # Run all tests
qualyx run --app my-app           # Filter by app
qualyx run --rule user-login      # Filter by rule
qualyx run --environment staging  # Use staging URLs
qualyx run --dry-run              # Preview without execution
qualyx run --headed               # Show browser
qualyx run --verbose              # Detailed output
qualyx run --report               # Generate HTML report
qualyx run --retries 3            # Override retry count
qualyx run --timeout 60000        # Override timeout
qualyx run --parallel             # Run tests in parallel
qualyx run --max-parallel 5       # Limit concurrent tests
qualyx run --collect-metrics      # Collect performance metrics
```

### `qualyx report`

View or regenerate test reports.

```bash
qualyx report
qualyx report --run-id abc123
```

### `qualyx history`

View test run history.

```bash
qualyx history
qualyx history --limit 20
qualyx history --failed
qualyx history --format json
```

### `qualyx schedule`

Manage scheduled test rules.

```bash
qualyx schedule list              # List all scheduled rules
qualyx schedule cron              # Generate crontab entries
qualyx schedule cron --output crontab.txt
qualyx schedule github            # Generate GitHub Actions workflow
qualyx schedule github --output .github/workflows/qualyx.yml
```

## Integrations

### Slack Notifications

Send test results to Slack:

```yaml
notifications:
  slack:
    webhook_url: ${SLACK_WEBHOOK_URL}
    on_failure: true
    on_success: false
    mention_on_failure:
      - U123456789  # Slack user IDs
```

### Email Notifications

Send test results via email:

```yaml
notifications:
  email:
    smtp_host: smtp.gmail.com
    smtp_port: 587
    smtp_secure: false
    smtp_user: ${SMTP_USER}
    smtp_pass: ${SMTP_PASS}
    from: qa@company.com
    to:
      - team@company.com
      - alerts@company.com
    on_failure: true
    on_success: false
    subject_prefix: "[Qualyx]"
```

Features:
- HTML and plain text email formats
- Configurable triggers (on_failure, on_success)
- Customizable subject prefix
- Link to HTML report (if generated)

### Microsoft Teams Notifications

Send test results to Microsoft Teams:

```yaml
notifications:
  teams:
    webhook_url: ${TEAMS_WEBHOOK_URL}
    on_failure: true
    on_success: false
    mention_on_failure:
      - user@company.com
```

Features:
- Rich Adaptive Card messages
- User mentions on failure
- Summary with pass/fail counts
- Link to HTML report

### Jira Integration

Automatically create issues for failed tests:

```yaml
integrations:
  jira:
    base_url: https://company.atlassian.net
    email: ${JIRA_EMAIL}
    api_token: ${JIRA_API_TOKEN}
    project_key: QA
    create_issues: true
    issue_type: Bug
    labels:
      - qualyx
      - automated-test
```

Features:
- Creates issues on test failures
- Prevents duplicate issues (checks for existing open issues)
- Adds comments to existing issues on re-failure

## Parallel Execution

Run tests in parallel to speed up test suites:

```bash
qualyx run --parallel              # Run tests in parallel (default: 3 concurrent)
qualyx run --parallel --max-parallel 5  # Limit to 5 concurrent tests
```

Notes:
- Setup blocks run sequentially before parallel test execution
- Results are ordered in original test order
- Useful for independent tests that don't share state

## Performance Metrics

Collect performance metrics during test execution:

```bash
qualyx run --collect-metrics
```

Metrics collected:
- **Page Load Time** - Time from navigation start to load event
- **DOM Content Loaded** - Time until DOM is fully parsed
- **First Contentful Paint (FCP)** - Time until first content renders
- **Largest Contentful Paint (LCP)** - Time until largest content element renders
- **Total Request Count** - Number of network requests
- **Total Transfer Size** - Total bytes transferred

## Output

### Console Output

```
  Qualyx Test Runner
  Running 4 tests...

  ✓ flight-booking / Search for flights  CRITICAL  (2.3s)
  ✓ flight-booking / Filter by price     HIGH      (1.8s)
  ✗ flight-booking / Complete booking    CRITICAL  (5.2s)
    Error: Payment form did not appear
  ✓ hotel-booking / Search for hotels    CRITICAL  (2.1s)

  Summary
  ────────────────────────────────────────
  Total:   4
  Passed:  3
  Failed:  1
  Duration: 11.4s
  Pass Rate: 75.0%

  ✗ 1 test failed
```

### HTML Reports

Generate visual reports with `--report`:

```bash
qualyx run --report
```

Reports are saved to `./qualyx-reports/`.

## GitHub Actions Integration

```yaml
name: QA Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          npm install -g qualyx @anthropic-ai/claude-code

      - name: Run QA tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: qualyx run --report

      - name: Upload report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-report
          path: qualyx-reports/
```

## Cost Considerations

Each test execution uses Claude API calls. To manage costs:

1. Use `--dry-run` to preview tests
2. Run critical tests more frequently
3. Run full suite less frequently (e.g., nightly)
4. Group related assertions in single rules

## Development

```bash
# Clone the repository
git clone https://github.com/korayuysal/qualyx.git
cd qualyx

# Install dependencies
npm install

# Run in development mode
npm run dev -- run --dry-run

# Build
npm run build

# Run tests
npm test
```

## License

MIT
