import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
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

  const { name, description, yamlContent } = await request.json();

  if (!name || !yamlContent) {
    return NextResponse.json({ error: 'Name and YAML content are required' }, { status: 400 });
  }

  // Validate YAML syntax
  try {
    parseYaml(yamlContent);
  } catch (e) {
    return NextResponse.json(
      { error: `Invalid YAML: ${e instanceof Error ? e.message : 'Parse error'}` },
      { status: 400 }
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
