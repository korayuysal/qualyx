import cronParser from 'cron-parser';

export function validateCron(expression: string): { valid: true } | { valid: false; error: string } {
  try {
    cronParser.parseExpression(expression);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid cron expression' };
  }
}

export function computeNextRunAt(expression: string, from: Date = new Date()): Date {
  return cronParser.parseExpression(expression, { currentDate: from }).next().toDate();
}

export function previewNextRuns(expression: string, count = 3, from: Date = new Date()): Date[] {
  const interval = cronParser.parseExpression(expression, { currentDate: from });
  const runs: Date[] = [];
  for (let i = 0; i < count; i++) {
    runs.push(interval.next().toDate());
  }
  return runs;
}
