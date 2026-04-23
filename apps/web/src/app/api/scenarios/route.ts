import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { schema, deriveScenarioName, PromptScenarioBodySchema } from '@qualyx/core';
import { parse as parseYaml } from 'yaml';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scenarios = await db.select().from(schema.scenarios);
  return NextResponse.json(scenarios);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

  if (body.prompt !== undefined && body.yamlContent !== undefined) {
    return NextResponse.json(
      { error: 'Provide either a prompt or YAML, not both' },
      { status: 400 },
    );
  }

  if (body.prompt !== undefined) {
    const parsed = PromptScenarioBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid scenario' },
        { status: 400 },
      );
    }
    const { name, description, prompt, url } = parsed.data;
    const finalName = name ?? deriveScenarioName(prompt, url);

    const [scenario] = await db
      .insert(schema.scenarios)
      .values({
        name: finalName,
        description: description || null,
        prompt,
        url,
        createdBy: session.user?.id,
        updatedBy: session.user?.id,
      })
      .returning();

    return NextResponse.json({ id: scenario.id }, { status: 201 });
  }

  if (body.yamlContent !== undefined) {
    const { name, description, yamlContent } = body as {
      name?: string;
      description?: string;
      yamlContent: string;
    };
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    try {
      parseYaml(yamlContent);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid YAML: ${e instanceof Error ? e.message : 'Parse error'}` },
        { status: 400 },
      );
    }

    const [scenario] = await db
      .insert(schema.scenarios)
      .values({
        name,
        description: description || null,
        yamlContent,
        createdBy: session.user?.id,
        updatedBy: session.user?.id,
      })
      .returning();

    return NextResponse.json({ id: scenario.id }, { status: 201 });
  }

  return NextResponse.json(
    { error: 'Either prompt+url or yamlContent is required' },
    { status: 400 },
  );
}
