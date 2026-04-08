import { NextResponse } from 'next/server';
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
  const { name, description, yamlContent } = await request.json();

  // Validate YAML if provided
  if (yamlContent) {
    try {
      parseYaml(yamlContent);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid YAML: ${e instanceof Error ? e.message : 'Parse error'}` },
        { status: 400 }
      );
    }
  }

  const [updated] = await db
    .update(schema.scenarios)
    .set({
      ...(name && { name }),
      ...(description !== undefined && { description: description || null }),
      ...(yamlContent && { yamlContent }),
      updatedBy: session.user?.id,
      updatedAt: new Date(),
    })
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
