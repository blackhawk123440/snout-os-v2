import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRequestContext } from '@/lib/request-context';
import { ForbiddenError, requireRole } from '@/lib/rbac';

const RuleSchema = z.object({
  daysOfWeek: z.array(z.number().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const BulkSchema = z.object({
  rules: z.array(RuleSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await getRequestContext();
    requireRole(ctx, 'sitter');
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.sitterId) {
    return NextResponse.json({ error: 'Sitter not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = BulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    // Replace all existing rules with the new set (array-based transaction per CLAUDE.md)
    await prisma.$transaction([
      prisma.sitterAvailabilityRule.deleteMany({
        where: { orgId: ctx.orgId, sitterId: ctx.sitterId! },
      }),
      ...parsed.data.rules.map((rule) =>
        prisma.sitterAvailabilityRule.create({
          data: {
            orgId: ctx.orgId,
            sitterId: ctx.sitterId!,
            daysOfWeek: JSON.stringify(rule.daysOfWeek),
            startTime: rule.startTime,
            endTime: rule.endTime,
          },
        })
      ),
    ]);

    return NextResponse.json({ success: true, count: parsed.data.rules.length });
  } catch (error: unknown) {
    console.error('[availability/bulk] ERROR:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save availability', message }, { status: 500 });
  }
}
