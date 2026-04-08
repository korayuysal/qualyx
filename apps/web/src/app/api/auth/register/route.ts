import { NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schema } from '@qualyx/core';

export async function POST(request: Request) {
  const { email, password, name, inviteCode } = await request.json();

  if (!email || !password || !name || !inviteCode) {
    return NextResponse.json(
      { error: 'All fields are required' },
      { status: 400 }
    );
  }

  // Validate invite code
  const [invite] = await db
    .select()
    .from(schema.inviteCodes)
    .where(
      and(
        eq(schema.inviteCodes.code, inviteCode),
        isNull(schema.inviteCodes.usedBy)
      )
    )
    .limit(1);

  if (!invite) {
    return NextResponse.json(
      { error: 'Invalid or already used invite code' },
      { status: 400 }
    );
  }

  // Check if expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'Invite code has expired' },
      { status: 400 }
    );
  }

  // Check if email already exists
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: 'Email already registered' },
      { status: 400 }
    );
  }

  // Create user
  const passwordHash = await bcryptjs.hash(password, 12);
  const [user] = await db
    .insert(schema.users)
    .values({ email, name, passwordHash })
    .returning();

  // Mark invite code as used
  await db
    .update(schema.inviteCodes)
    .set({ usedBy: user.id, usedAt: new Date() })
    .where(eq(schema.inviteCodes.id, invite.id));

  return NextResponse.json({ success: true, userId: user.id });
}
