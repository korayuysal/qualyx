import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { eq, asc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      let lastTestCount = 0;

      const poll = async () => {
        if (closed) return;

        try {
          // Fetch current run status
          const [run] = await db
            .select({
              status: schema.runs.status,
              totalTests: schema.runs.totalTests,
              passed: schema.runs.passed,
              failed: schema.runs.failed,
              skipped: schema.runs.skipped,
              duration: schema.runs.duration,
            })
            .from(schema.runs)
            .where(eq(schema.runs.id, runId))
            .limit(1);

          if (!run) {
            send('error', { message: 'Run not found' });
            controller.close();
            closed = true;
            return;
          }

          // Fetch test results
          const testResults = await db
            .select()
            .from(schema.testResults)
            .where(eq(schema.testResults.runId, runId))
            .orderBy(asc(schema.testResults.completedAt));

          // Send any new test results since last poll
          if (testResults.length > lastTestCount) {
            for (const tr of testResults.slice(lastTestCount)) {
              send('test-result', tr);
            }
            lastTestCount = testResults.length;
          }

          // Send current run status
          send('run-status', {
            status: run.status,
            totalTests: run.totalTests,
            passed: run.passed,
            failed: run.failed,
            skipped: run.skipped,
            duration: run.duration,
          });

          // Close stream when run is done
          if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
            send('run-complete', { status: run.status });
            controller.close();
            closed = true;
            return;
          }

          // Poll again
          setTimeout(poll, 2000);
        } catch (error) {
          if (!closed) {
            send('error', { message: 'Internal error' });
            controller.close();
            closed = true;
          }
        }
      };

      await poll();
    },
    cancel() {
      closed = true;
    },
  });

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    closed = true;
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
