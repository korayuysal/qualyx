---
name: code-review
description: Review a code change for bugs, security holes, missing tests and needless complexity. Use when asked to review a diff, branch or pull request.
---

# Code review

Find the real problems a careful reviewer would want fixed before merging. Don't restyle the code.

## How
1. Read the task or acceptance criteria and AGENTS.md, so you know what the change should do.
2. Read the whole diff, then the code around it. Follow changed functions to their callers.
3. Check each suspected problem against the code. Keep it only if you can name the input or state that breaks it.

## What to look for, most important first
1. Correctness: wrong logic, missed edge cases (empty, missing, zero, very large, at the same time), bad error handling, acceptance criteria not met.
2. Security: missing login or ownership checks, injection, secrets in code or logs, unchecked input, data leaking between users.
3. Tests: new behaviour without a test, tests that would still pass if the code were wrong, skipped or weakened tests.
4. Compatibility: database, API or config changes that break existing data or users.
5. Simplicity: dead code, copy-paste, changes unrelated to the task.

Skip anything the linter or formatter already handles, and personal taste.

## Severity
- high: breaks something, loses data or opens a security hole. Must be fixed before merging.
- medium: a likely bug, or important behaviour without a test. Should be fixed.
- low: worth knowing, safe to merge.

## How to report
Most severe first. For each: file and line, what breaks and when, and the fix in one sentence.
No praise and no summary of what the code does. If nothing is wrong, say so in one line.

When asked for JSON, answer with only this object:
{"verdict": "approve" or "changes_requested", "findings": [{"severity": "high|medium|low", "file": "path", "line": 12, "problem": "...", "fix": "..."}]}
