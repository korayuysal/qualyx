import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { schema } from '@qualyx/core';
import { eq } from 'drizzle-orm';
import { parse as parseYaml } from 'yaml';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [scenario] = await db
    .select()
    .from(schema.scenarios)
    .where(eq(schema.scenarios.id, id))
    .limit(1);

  if (!scenario) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(scenario);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, prompt, url, yamlContent } = body as {
    name?: string;
    description?: string;
    prompt?: string;
    url?: string;
    yamlContent?: string;
  };

  if (prompt !== undefined && yamlContent !== undefined) {
    return NextResponse.json(
      { error: 'Update either prompt or YAML, not both' },
      { status: 400 },
    );
  }

  if (url !== undefined && !z.string().url().safeParse(url).success) {
    return NextResponse.json({ error: 'Website must be a valid URL' }, { status: 400 });
  }

  if (yamlContent !== undefined) {
    try {
      parseYaml(yamlContent);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid YAML: ${e instanceof Error ? e.message : 'Parse error'}` },
        { status: 400 },
      );
    }
  }

  const updates: Partial<typeof schema.scenarios.$inferInsert> = {
    updatedBy: session.user?.id,
    updatedAt: new Date(),
  };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;
  if (prompt !== undefined) {
    updates.prompt = prompt;
    updates.yamlContent = null;
  }
  if (url !== undefined) updates.url = url;
  if (yamlContent !== undefined) {
    updates.yamlContent = yamlContent;
    updates.prompt = null;
    updates.url = null;
  }

  const [updated] = await db
    .update(schema.scenarios)
    .set(updates)
    .where(eq(schema.scenarios.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await db.delete(schema.scenarios).where(eq(schema.scenarios.id, id));

  return NextResponse.json({ success: true });
}
