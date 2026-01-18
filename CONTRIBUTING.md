# Contributing to Qualyx

Thank you for your interest in contributing to Qualyx! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### Development Setup

1. Fork the repository on GitHub

2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/qualyx.git
   cd qualyx
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Run in development mode:
   ```bash
   npm run dev -- run --dry-run
   ```

### Project Structure

```
qualyx/
├── src/
│   ├── cli/           # CLI command implementations
│   ├── core/          # Core logic (parser, runner, validator)
│   ├── integrations/  # Third-party integrations (Slack, Jira, etc.)
│   ├── notifications/ # Notification handlers
│   ├── utils/         # Utility functions
│   └── index.ts       # Entry point
├── templates/         # Handlebars templates
├── __tests__/         # Test files
└── examples/          # Example configurations
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Prefer `const` over `let` when possible

### Naming Conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Formatting

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters

Run linting before committing:
```bash
npm run lint
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/core/parser.test.ts
```

### Writing Tests

- Place test files next to the source file or in `__tests__/`
- Name test files with `.test.ts` suffix
- Use descriptive test names that explain the expected behavior

Example:
```typescript
import { describe, it, expect } from 'vitest';
import { parseConfig } from './parser';

describe('parseConfig', () => {
  it('should parse valid YAML configuration', () => {
    const config = parseConfig('valid-config.yml');
    expect(config.organization.name).toBe('Test Org');
  });

  it('should throw on invalid YAML', () => {
    expect(() => parseConfig('invalid.yml')).toThrow();
  });
});
```

### Test Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Maintain or improve code coverage

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Run linting: `npm run lint`
3. Run type checking: `npm run typecheck`
4. Build the project: `npm run build`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(cli): add --parallel flag for concurrent test execution
fix(parser): handle empty steps array in rules
docs(readme): add installation instructions for Windows
```

### Pull Request Guidelines

1. Create a descriptive PR title following commit message format
2. Fill out the PR template completely
3. Link related issues using `Fixes #123` or `Closes #123`
4. Keep PRs focused on a single change
5. Respond to review feedback promptly

### Review Process

1. A maintainer will review your PR
2. Address any requested changes
3. Once approved, the PR will be merged
4. Your contribution will be included in the next release

## Feature Requests

Before implementing a new feature:

1. Check existing issues for similar requests
2. Open a feature request issue to discuss the idea
3. Wait for maintainer feedback before starting work

## Bug Reports

When reporting bugs, please include:

- Qualyx version (`qualyx --version`)
- Node.js version (`node --version`)
- Operating system
- Minimal reproduction steps
- Expected vs actual behavior
- Relevant configuration (sanitize credentials)

## Questions?

- Open a [GitHub Discussion](https://github.com/korayuysal/qualyx/discussions)
- Check existing issues and discussions first

Thank you for contributing to Qualyx!
